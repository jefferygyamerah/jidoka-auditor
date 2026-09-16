// ─────────────────────────────────────────────────────────────
// Motor de reglas deterministas · "Poka-yoke"
// Compara cada factura contra el tarifario pactado, detecta
// duplicados, topes de honorarios e inconsistencias con el
// siniestro. 100% auditable y reproducible.
// ─────────────────────────────────────────────────────────────
import crypto from "crypto";
import { db } from "@/lib/db";

export type Severidad = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

export interface HallazgoPropuesto {
  partidaId?: string;
  regla: string;
  tipo: string;
  severidad: Severidad;
  descripcion: string;
  montoDiscrepancia: number;
  detalle: Record<string, unknown>;
}

export const PESO_SEVERIDAD: Record<Severidad, number> = {
  BAJA: 4,
  MEDIA: 12,
  ALTA: 26,
  CRITICA: 42,
};

export const ETIQUETA_REGLA: Record<string, string> = {
  R1: "Precio fuera de tarifario",
  R2: "Partida duplicada",
  R3: "Factura duplicada",
  R4: "Partida no autorizada",
  R5: "Cantidad excesiva",
  R6: "Monto no cuadra",
  R7: "Inconsistente con el siniestro",
  R8: "Tope de honorarios excedido",
  R9: "Reserva excedida",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Fingerprint determinista del contenido económico de la factura. */
export function calcularHuella(
  tallerId: string,
  partidas: { codigo: string; cantidad: number; precioUnitario: number }[]
): string {
  const normalizada = partidas
    .map((p) => `${p.codigo}|${p.cantidad}|${round2(p.precioUnitario)}`)
    .sort()
    .join(";;");
  return crypto.createHash("sha256").update(`${tallerId}::${normalizada}`).digest("hex").slice(0, 32);
}

/** Detecta la zona del vehículo a la que pertenece una partida de repuesto. */
function zonaDePartida(descripcion: string): string | null {
  const d = descripcion.toLowerCase();
  if (/puerta delantera izquierda|puerta trasera izquierda|guardafango izquierdo|pilar izquierdo|estribo izquierdo|fald[óo]n.*izquierd|espejo.*izquierd/.test(d)) return "LATERAL_IZQ";
  if (/puerta delantera derecha|puerta trasera derecha|guardafango derecho|pilar derecho|estribo derecho|fald[óo]n.*derech|espejo.*derech/.test(d)) return "LATERAL_DER";
  if (/parachoques trasero|maletera|absorber trasero|defensa trasera|guardafango trasero|luneta trasera|puerta trasera/.test(d)) return "TRASERA";
  if (/parabrisas|luneta|ventana|vidrio/.test(d)) return "VIDRIOS";
  if (/parachoques delantero|parrilla|faro|cap[óo]|radiador|guardafango delantero|absorber delantero|defensa delantera/.test(d)) return "FRENTE";
  return null;
}

/**
 * Ejecuta las 9 reglas deterministas sobre una factura ya persistida
 * (con partidas). Devuelve los hallazgos propuestos y el score de riesgo.
 */
export async function auditarReglas(facturaId: string) {
  const config = await db.configuracion.findUnique({ where: { id: "GLOBAL" } });
  const tolerancia = config?.toleranciaPct ?? 2;
  const topeHonorarios = config?.topeHonorariosPct ?? 15;
  const umbralAutoajuste = config?.umbralAutoajuste ?? 50;

  const factura = await db.factura.findUniqueOrThrow({
    where: { id: facturaId },
    include: { partidas: { orderBy: { linea: "asc" } }, siniestro: true, taller: true },
  });
  const tarifario = await db.tarifarioItem.findMany({ where: { tallerId: factura.tallerId } });
  const mapaTarifario = new Map(tarifario.map((t) => [t.codigo, t]));

  const hallazgos: HallazgoPropuesto[] = [];
  let subtotalDeclarado = 0;
  let subtotalHonorarios = 0;
  let subtotalRepuestosInsumos = 0;

  for (const p of factura.partidas) {
    subtotalDeclarado += p.subtotal;
    if (p.categoria === "HONORARIO") subtotalHonorarios += p.subtotal;
    else subtotalRepuestosInsumos += p.subtotal;

    const pactado = mapaTarifario.get(p.codigo);

    // R1 · Precio fuera de tarifario (poka-yoke contra el tarifario pactado)
    if (pactado) {
      const desvioPct = ((p.precioUnitario - pactado.precioPactado) / pactado.precioPactado) * 100;
      if (desvioPct > tolerancia) {
        const severidad: Severidad = desvioPct > 25 ? "ALTA" : desvioPct > 10 ? "MEDIA" : "BAJA";
        hallazgos.push({
          partidaId: p.id,
          regla: "R1",
          tipo: ETIQUETA_REGLA.R1,
          severidad,
          descripcion: `«${p.descripcion}» se cobra a $${round2(p.precioUnitario)}/${p.unidad} pero el tarifario pactado con ${factura.taller.nombre} establece $${round2(pactado.precioPactado)}/${p.unidad} (+${round2(desvioPct)}%).`,
          montoDiscrepancia: round2((p.precioUnitario - pactado.precioPactado) * p.cantidad),
          detalle: {
            cobrado: p.precioUnitario,
            pactado: pactado.precioPactado,
            desvioPct: round2(desvioPct),
            unidad: p.unidad,
            cantidad: p.cantidad,
          },
        });
      }
    } else {
      // R4 · Partida no autorizada (código inexistente en el tarifario del taller)
      const parecido = tarifario.find((t) => t.descripcion.toLowerCase() === p.descripcion.toLowerCase());
      hallazgos.push({
        partidaId: p.id,
        regla: "R4",
        tipo: ETIQUETA_REGLA.R4,
        severidad: parecido ? "BAJA" : "MEDIA",
        descripcion: `La partida «${p.descripcion}» (código ${p.codigo}) no existe en el tarifario pactado con ${factura.taller.nombre}.`,
        montoDiscrepancia: p.subtotal,
        detalle: { codigo: p.codigo, descripcion: p.descripcion, subtotal: p.subtotal, posibleHomologo: parecido?.codigo ?? null },
      });
    }

    // R5 · Cantidad excesiva (heurística por categoría/unidad)
    const limite =
      p.categoria === "REPUESTO" ? 3 : p.categoria === "INSUMO" ? (p.unidad === "GLB" ? 8 : p.unidad === "CAJA" ? 2 : 20) : p.categoria === "MANO_OBRA" ? 32 : 2;
    if (p.cantidad > limite) {
      hallazgos.push({
        partidaId: p.id,
        regla: "R5",
        tipo: ETIQUETA_REGLA.R5,
        severidad: "ALTA",
        descripcion: `Cantidad inusual: ${p.cantidad} ${p.unidad} de «${p.descripcion}» supera el umbral razonable (${limite} ${p.unidad}) para un siniestro de ${factura.siniestro.zonaDanio === "MULTIPLE" ? "daño múltiple" : "zona " + factura.siniestro.zonaDanio.toLowerCase()}.`,
        montoDiscrepancia: 0,
        detalle: { cantidad: p.cantidad, limite, unidad: p.unidad },
      });
    }

    // R7 · Inconsistencia con el daño reportado del siniestro
    if (p.categoria === "REPUESTO" && factura.siniestro.zonaDanio !== "MULTIPLE") {
      const zonaPartida = zonaDePartida(p.descripcion);
      if (zonaPartida && zonaPartida !== factura.siniestro.zonaDanio) {
        hallazgos.push({
          partidaId: p.id,
          regla: "R7",
          tipo: ETIQUETA_REGLA.R7,
          severidad: "MEDIA",
          descripcion: `«${p.descripcion}» corresponde a la zona ${zonaPartida.replace("_", " ").toLowerCase()} del vehículo, pero el siniestro ${factura.siniestro.numero} reporta daño en zona ${factura.siniestro.zonaDanio.replace("_", " ").toLowerCase()}.`,
          montoDiscrepancia: 0,
          detalle: { zonaSiniestro: factura.siniestro.zonaDanio, zonaPartida },
        });
      }
    }
  }

  // R2 · Partidas duplicadas dentro de la misma factura
  const porCodigo = new Map<string, typeof factura.partidas>();
  for (const p of factura.partidas) {
    const clave = p.codigo;
    const arr = porCodigo.get(clave) ?? [];
    arr.push(p);
    porCodigo.set(clave, arr);
  }
  for (const [, arr] of porCodigo) {
    if (arr.length > 1) {
      for (const duplicada of arr.slice(1)) {
        hallazgos.push({
          partidaId: duplicada.id,
          regla: "R2",
          tipo: ETIQUETA_REGLA.R2,
          severidad: "ALTA",
          descripcion: `Cobro duplicado: «${duplicada.descripcion}» aparece ${arr.length} veces en la factura (líneas ${arr.map((a) => a.linea).join(", ")}). Se marca la repetición como sospechosa.`,
          montoDiscrepancia: round2(duplicada.subtotal),
          detalle: { codigo: duplicada.codigo, repeticiones: arr.length, lineas: arr.map((a) => a.linea) },
        });
      }
    }
  }

  // R3 · Factura duplicada (huella idéntica en otra factura del mismo taller)
  if (factura.huella) {
    const gemela = await db.factura.findFirst({
      where: { huella: factura.huella, id: { not: factura.id }, tallerId: factura.tallerId },
      include: { siniestro: true },
    });
    if (gemela) {
      hallazgos.push({
        regla: "R3",
        tipo: ETIQUETA_REGLA.R3,
        severidad: "CRITICA",
        descripcion: `El contenido económico de esta factura es idéntico al de la factura ${gemela.numero} (siniestro ${gemela.siniestro.numero}) del mismo taller. Posible doble cobro.`,
        montoDiscrepancia: round2(factura.montoTotal),
        detalle: { facturaGemela: gemela.numero, siniestroGemelo: gemela.siniestro.numero },
      });
    }
  }

  // R6 · El total declarado no cuadra con la suma de partidas + ITBMS
  const esperado = round2(subtotalDeclarado * (1 + factura.itbmsPct / 100));
  if (Math.abs(esperado - factura.montoTotal) > 0.5) {
    hallazgos.push({
      regla: "R6",
      tipo: ETIQUETA_REGLA.R6,
      severidad: "MEDIA",
      descripcion: `El total declarado ($${round2(factura.montoTotal)}) no coincide con la suma de partidas más ITBMS ${factura.itbmsPct}% (esperado $${esperado}). Diferencia: $${round2(Math.abs(esperado - factura.montoTotal))}.`,
      montoDiscrepancia: round2(Math.abs(esperado - factura.montoTotal)),
      detalle: { declarado: factura.montoTotal, esperado, itbmsPct: factura.itbmsPct },
    });
  }

  // R8 · Tope de honorarios administrativos (solo con base técnica suficiente)
  if (subtotalRepuestosInsumos >= 200 && subtotalHonorarios > (subtotalRepuestosInsumos * topeHonorarios) / 100) {
    const exceso = round2(subtotalHonorarios - (subtotalRepuestosInsumos * topeHonorarios) / 100);
    hallazgos.push({
      regla: "R8",
      tipo: ETIQUETA_REGLA.R8,
      severidad: exceso > 150 ? "ALTA" : "MEDIA",
      descripcion: `Honorarios por $${round2(subtotalHonorarios)} equivalen al ${round2((subtotalHonorarios / subtotalRepuestosInsumos) * 100)}% del subtotal técnico, por encima del tope pactado (${topeHonorarios}%). Exceso: $${exceso}.`,
      montoDiscrepancia: exceso,
      detalle: { honorarios: round2(subtotalHonorarios), baseTecnica: round2(subtotalRepuestosInsumos), topePct: topeHonorarios, exceso },
    });
  }

  // R9 · Reserva del siniestro excedida
  if (factura.montoTotal > factura.siniestro.montoReserva * 1.15) {
    const excesoPct = ((factura.montoTotal - factura.siniestro.montoReserva) / factura.siniestro.montoReserva) * 100;
    hallazgos.push({
      regla: "R9",
      tipo: ETIQUETA_REGLA.R9,
      severidad: excesoPct > 40 ? "ALTA" : "MEDIA",
      descripcion: `El monto facturado ($${round2(factura.montoTotal)}) excede la reserva del siniestro ($${round2(factura.siniestro.montoReserva)}) en un ${round2(excesoPct)}%.`,
      montoDiscrepancia: round2(factura.montoTotal - factura.siniestro.montoReserva),
      detalle: { reserva: factura.siniestro.montoReserva, facturado: factura.montoTotal, excesoPct: round2(excesoPct) },
    });
  }

  // Score de riesgo (0-100) y monto de discrepancia consolidado
  const riesgo = Math.min(
    100,
    hallazgos.reduce((acc, h) => acc + PESO_SEVERIDAD[h.severidad], 0)
  );
  const montoDiscrepancia = round2(hallazgos.reduce((acc, h) => acc + h.montoDiscrepancia, 0));

  // Decisión del agente (Jidoka: detener la línea solo cuando hace falta)
  const tieneCritico = hallazgos.some((h) => h.severidad === "CRITICA");
  let estadoSugerido: "APROBADA" | "OBSERVADA" | "RECHAZADA";
  let montoSugerido: number | null = null;
  if (riesgo === 0) {
    estadoSugerido = "APROBADA";
  } else if (tieneCritico) {
    estadoSugerido = "RECHAZADA";
  } else if (riesgo >= 30) {
    estadoSugerido = "OBSERVADA";
  } else {
    estadoSugerido = "OBSERVADA";
    if (montoDiscrepancia <= umbralAutoajuste) montoSugerido = round2(Math.max(0, factura.montoTotal - montoDiscrepancia));
  }

  return { hallazgos, riesgo, montoDiscrepancia, estadoSugerido, montoSugerido, config: { tolerancia, topeHonorarios, umbralAutoajuste } };
}
