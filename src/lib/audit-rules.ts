// ─────────────────────────────────────────────────────────────
// Motor de reglas deterministas · "Poka-yoke"
// Compara cada factura contra el tarifario pactado, detecta
// duplicados, topes de honorarios e inconsistencias con el
// siniestro. 100% auditable y reproducible.
//
// Contrato acordado (tarea #44 · hackIAthon Viamatica):
// · El motor PROPONE hallazgos con cita de evidencia; NUNCA
//   aprueba ni rechaza pagos ni emite montos aprobados.
// · Regla de parada (jidoka): una línea con evidencia faltante o
//   conflicto se aísla (sin evaluar) y el informe lo indica de
//   forma visible; sin evidencia compartida válida, las
//   conclusiones dependientes quedan bloqueadas.
// · Duplicado = misma partida SIN posiciones/instancias
//   documentadas distintas. La repetición legítima con contexto
//   distinto documentado NO es duplicado.
// ─────────────────────────────────────────────────────────────
import crypto from "crypto";
import { db } from "@/lib/db";
import type { EvidenciaCita } from "@/lib/types";

export type Severidad = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

export interface HallazgoPropuesto {
  partidaId?: string;
  regla: string;
  tipo: string;
  severidad: Severidad;
  descripcion: string;
  montoDiscrepancia: number;
  ajustePropuesto?: number | null;
  detalle: Record<string, unknown>;
  evidencia: EvidenciaCita[];
  evidenciaPendiente?: string | null;
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
  R10: "Parada por evidencia faltante",
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
 * Ejecuta las reglas deterministas sobre una factura ya persistida
 * (con partidas). Devuelve hallazgos con evidencia y el estado del
 * informe (completo o incompleto por parada). No decide pagos.
 */
export async function auditarReglas(facturaId: string) {
  const config = await db.configuracion.findUnique({ where: { id: "GLOBAL" } });
  const tolerancia = config?.toleranciaPct ?? 2;
  const topeHonorarios = config?.topeHonorariosPct ?? 20;
  const umbralAutoajuste = config?.umbralAutoajuste ?? 50;

  const factura = await db.factura.findUniqueOrThrow({
    where: { id: facturaId },
    include: { partidas: { orderBy: { linea: "asc" } }, siniestro: true, taller: true },
  });
  const tarifario = await db.tarifarioItem.findMany({ where: { tallerId: factura.tallerId } });
  const mapaTarifario = new Map(tarifario.map((t) => [t.codigo, t]));
  const nombreTarifario = `Tarifario pactado · ${factura.taller.nombre}`;

  const hallazgos: HallazgoPropuesto[] = [];
  let subtotalDeclarado = 0;
  let subtotalHonorarios = 0;
  let subtotalRepuestosInsumos = 0;

  // ── Regla de parada afirmativa: sin tarifario pactado no hay base de
  // comparación para ningún precio. Se aísla TODO monto dependiente y el
  // informe continúa solo con lo verificable internamente (R2/R3/R6).
  const paradaGlobal = tarifario.length === 0;

  for (const p of factura.partidas) {
    subtotalDeclarado += p.subtotal;
    if (p.categoria === "HONORARIO") subtotalHonorarios += p.subtotal;
    else subtotalRepuestosInsumos += p.subtotal;

    const pactado = mapaTarifario.get(p.codigo);

    if (paradaGlobal) {
      // Línea aislada: monto no evaluable contra tarifario (falta la evidencia compartida).
      hallazgos.push({
        partidaId: p.id,
        regla: "R10",
        tipo: ETIQUETA_REGLA.R10,
        severidad: "CRITICA",
        descripcion: `Línea ${p.linea} «${p.descripcion}» queda sin evaluar: no existe tarifario pactado cargado para ${factura.taller.nombre}. Solicitar el convenio vigente antes de concluir montos.`,
        montoDiscrepancia: 0,
        ajustePropuesto: null,
        detalle: { codigo: p.codigo, linea: p.linea, motivo: "TARIFARIO_AUSENTE" },
        evidencia: [
          { fuente: `Factura ${factura.numero}`, localizador: `línea ${p.linea} (cód. ${p.codigo})` },
          { fuente: nombreTarifario, localizador: "no cargado en el sistema" },
        ],
        evidenciaPendiente: `Tarifario pactado vigente de ${factura.taller.nombre} (con código ${p.codigo})`,
      });
      continue; // R1/R4/R5/R7 no aplican sin base de comparación
    }

    // R1 · Precio fuera de tarifario (comparación contra el convenio)
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
          ajustePropuesto: round2((pactado.precioPactado - p.precioUnitario) * p.cantidad),
          detalle: {
            cobrado: p.precioUnitario,
            pactado: pactado.precioPactado,
            desvioPct: round2(desvioPct),
            unidad: p.unidad,
            cantidad: p.cantidad,
          },
          evidencia: [
            { fuente: `Factura ${factura.numero}`, localizador: `línea ${p.linea} · ${p.descripcion}` },
            { fuente: nombreTarifario, localizador: `código ${pactado.codigo} · ${pactado.descripcion}` },
          ],
        });
      }
    } else {
      // R4 · Partida no autorizada (código inexistente en el convenio)
      const parecido = tarifario.find((t) => t.descripcion.toLowerCase() === p.descripcion.toLowerCase());
      hallazgos.push({
        partidaId: p.id,
        regla: "R4",
        tipo: ETIQUETA_REGLA.R4,
        severidad: parecido ? "BAJA" : "MEDIA",
        descripcion: `La partida «${p.descripcion}» (código ${p.codigo}) no existe en el tarifario pactado con ${factura.taller.nombre}.`,
        montoDiscrepancia: p.subtotal,
        ajustePropuesto: null,
        detalle: { codigo: p.codigo, descripcion: p.descripcion, subtotal: p.subtotal, posibleHomologo: parecido?.codigo ?? null },
        evidencia: [
          { fuente: `Factura ${factura.numero}`, localizador: `línea ${p.linea} · ${p.descripcion}` },
          { fuente: nombreTarifario, localizador: parecido ? `homólogo por descripción: código ${parecido.codigo}` : "código no encontrado" },
        ],
        evidenciaPendiente: parecido ? null : `Autorización o codificación oficial de «${p.descripcion}» en el convenio`,
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
        ajustePropuesto: null,
        detalle: { cantidad: p.cantidad, limite, unidad: p.unidad },
        evidencia: [
          { fuente: `Factura ${factura.numero}`, localizador: `línea ${p.linea} · cantidad ${p.cantidad} ${p.unidad}` },
          { fuente: "Parámetros del motor", localizador: `umbral por categoría: ${limite} ${p.unidad}` },
        ],
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
          ajustePropuesto: null,
          detalle: { zonaSiniestro: factura.siniestro.zonaDanio, zonaPartida },
          evidencia: [
            { fuente: `Factura ${factura.numero}`, localizador: `línea ${p.linea} · ${p.descripcion}` },
            { fuente: `Expediente del siniestro ${factura.siniestro.numero}`, localizador: `daño reportado: zona ${factura.siniestro.zonaDanio}` },
          ],
        });
      }
    }
  }

  // R2 · Partidas duplicadas dentro de la misma factura.
  // Repetición legítima: mismos códigos con contextos documentados
  // distintos (p.ej. misma pieza en posiciones distintas). Solo se
  // marca duplicado cuando no hay contexto distinto que lo justifique.
  const porCodigo = new Map<string, typeof factura.partidas>();
  for (const p of factura.partidas) {
    const arr = porCodigo.get(p.codigo) ?? [];
    arr.push(p);
    porCodigo.set(p.codigo, arr);
  }
  for (const [codigo, arr] of porCodigo) {
    if (arr.length < 2) continue;
    const contextos = arr.map((a) => (a.contexto ?? "").trim());
    const contextosDistintos = contextos.every((c) => c.length > 0) && new Set(contextos.map((c) => c.toLowerCase())).size === arr.length;
    if (contextosDistintos) continue; // repetición legítima documentada
    for (const duplicada of arr.slice(1)) {
      hallazgos.push({
        partidaId: duplicada.id,
        regla: "R2",
        tipo: ETIQUETA_REGLA.R2,
        severidad: "ALTA",
        descripcion: `Cobro posiblemente duplicado: «${duplicada.descripcion}» aparece ${arr.length} veces en la factura (líneas ${arr.map((a) => a.linea).join(", ")}) sin posiciones ni instancias documentadas que justifiquen la repetición.`,
        montoDiscrepancia: round2(duplicada.subtotal),
        ajustePropuesto: -round2(duplicada.subtotal),
        detalle: { codigo, repeticiones: arr.length, lineas: arr.map((a) => a.linea), contextos: contextos },
        evidencia: [
          { fuente: `Factura ${factura.numero}`, localizador: `líneas ${arr.map((a) => a.linea).join(", ")} · cód. ${codigo}` },
        ],
        evidenciaPendiente: contextos.some((c) => !c)
          ? `Posición o instancia documentada de cada aparición del código ${codigo} (p.ej. orden de reparación)`
          : null,
      });
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
        ajustePropuesto: null,
        detalle: { facturaGemela: gemela.numero, siniestroGemelo: gemela.siniestro.numero, huella: factura.huella },
        evidencia: [
          { fuente: `Factura ${factura.numero}`, localizador: `huella SHA-256 ${factura.huella.slice(0, 10)}…` },
          { fuente: `Factura ${gemela.numero}`, localizador: `huella idéntica · siniestro ${gemela.siniestro.numero}` },
        ],
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
      ajustePropuesto: null,
      detalle: { declarado: factura.montoTotal, esperado, itbmsPct: factura.itbmsPct },
      evidencia: [
        { fuente: `Factura ${factura.numero}`, localizador: "total declarado" },
        { fuente: `Factura ${factura.numero}`, localizador: `suma aritmética de ${factura.partidas.length} líneas + ITBMS ${factura.itbmsPct}%` },
      ],
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
      ajustePropuesto: -exceso,
      detalle: { honorarios: round2(subtotalHonorarios), baseTecnica: round2(subtotalRepuestosInsumos), topePct: topeHonorarios, exceso },
      evidencia: [
        { fuente: `Factura ${factura.numero}`, localizador: `líneas de honorarios · subtotal $${round2(subtotalHonorarios)}` },
        { fuente: "Parámetros del motor", localizador: `tope de honorarios pactado: ${topeHonorarios}%` },
      ],
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
      ajustePropuesto: null,
      detalle: { reserva: factura.siniestro.montoReserva, facturado: factura.montoTotal, excesoPct: round2(excesoPct) },
      evidencia: [
        { fuente: `Factura ${factura.numero}`, localizador: "total facturado" },
        { fuente: `Expediente del siniestro ${factura.siniestro.numero}`, localizador: `reserva autorizada $${round2(factura.siniestro.montoReserva)}` },
      ],
    });
  }

  // Score de riesgo (0-100) y montos consolidados
  const riesgo = Math.min(
    100,
    hallazgos.reduce((acc, h) => acc + PESO_SEVERIDAD[h.severidad], 0)
  );
  const montoDiscrepancia = round2(hallazgos.reduce((acc, h) => acc + h.montoDiscrepancia, 0));

  // Monto sin evaluar (regla de parada): bajo parada global, todo el
  // contenido de la factura queda no evaluable contra convenio.
  let sinEvaluar = false;
  let notaBloqueo: string | null = null;
  let montoSinEvaluar: number | null = null;
  if (paradaGlobal) {
    sinEvaluar = true;
    notaBloqueo = `No existe tarifario pactado cargado para ${factura.taller.nombre}: los montos de esta factura NO pueden evaluarse. El informe solo incluye verificaciones internas (duplicados y aritmética).`;
    montoSinEvaluar = round2(factura.montoTotal);
  }

  return {
    hallazgos,
    riesgo,
    montoDiscrepancia,
    sinEvaluar,
    notaBloqueo,
    montoSinEvaluar,
    fuentesLeidas: { tarifario: tarifario.length, partidas: factura.partidas.length, siniestro: factura.siniestro.numero },
    config: { tolerancia, topeHonorarios, umbralAutoajuste },
  };
}
