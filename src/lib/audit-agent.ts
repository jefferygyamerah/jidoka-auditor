// ─────────────────────────────────────────────────────────────
// Agente auditor híbrido · "Jidoka" (automatización con criterio)
// 1) Ejecuta reglas deterministas (audit-rules.ts)
// 2) Persiste hallazgos + decisión de línea
// 3) LLM (z-ai-web-dev-sdk) redacta el informe de hallazgos,
//    recomendación y causa raíz (5 Whys) para el revisor humano
// ─────────────────────────────────────────────────────────────
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { auditarReglas, calcularHuella } from "@/lib/audit-rules";

const round2 = (n: number) => Math.round(n * 100) / 100;

const usd = (n: number) => `$${round2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface InformeIA {
  resumen: string;
  recomendacion: "APROBAR" | "APROBAR_CON_AJUSTE" | "ESCALAR" | "RECHAZAR";
  causaRaiz: string;
  acciones: string[];
  confianza: number;
}

/** Genera (con IA) el informe ejecutivo del agente y lo persiste en la factura. */
export async function generarInformeIA(facturaId: string): Promise<InformeIA> {
  if (process.env.JIDOKA_DISABLE_IA === "1") throw new Error("IA deshabilitada en este contexto");
  const factura = await db.factura.findUniqueOrThrow({
    where: { id: facturaId },
    include: {
      partidas: { orderBy: { linea: "asc" } },
      hallazgos: true,
      siniestro: true,
      taller: true,
    },
  });

  const hallazgosTxt = factura.hallazgos.length
    ? factura.hallazgos
        .map(
          (h, i) =>
            `${i + 1}. [${h.severidad}] ${h.tipo} — ${h.descripcion} (discrepancia: ${usd(h.montoDiscrepancia)})`
        )
        .join("\n")
    : "Sin hallazgos: todas las partidas cumplen el tarifario pactado y no hay duplicados ni inconsistencias.";

  const partidasTxt = factura.partidas
    .map(
      (p) =>
        `L${p.linea}: [${p.categoria}] ${p.descripcion} (cód. ${p.codigo}) — ${p.cantidad} ${p.unidad} × ${usd(p.precioUnitario)} = ${usd(p.subtotal)}`
    )
    .join("\n");

  const system = `Eres el Agente Auditor de Siniestros de Istmo Seguros (Panamá), una aseguradora de autos. Auditas facturas de talleres contra el tarifario pactado y la siniestralidad reportada.

Forma de trabajar:
- Audita con criterio: solo escala al humano cuando hay anomalías reales; no lo molestes con ruido.
- Juzga siempre desde los datos concretos de las partidas, nunca desde suposiciones.
- CAUSA RAÍZ: en causaRaiz, encadena porqués (¿por qué ocurrió? → ¿por qué? → ...) hasta la causa de fondo del comportamiento del taller, de forma breve (2-4 enunciados encadenados).
- MEJORA CONTINUA: en acciones, propone mejoras concretas y accionables (para el taller o para el proceso).

Estilo: español panameño profesional, conciso, sin emojis, sin markdown pesado. No uses términos en japonés ni marcas (jidoka, kaizen, andon, muda, Toyota): habla en lenguaje llano de auditoría y seguros. Respuesta EXCLUSIVAMENTE en JSON válido con este esquema:
{
  "resumen": "2-4 oraciones con el veredicto económico: monto facturado, hallazgos clave con montos y qué se recomienda ajustar",
  "recomendacion": "APROBAR" | "APROBAR_CON_AJUSTE" | "ESCALAR" | "RECHAZAR",
  "causaRaiz": "análisis de causa raíz en 2-4 enunciados encadenados (técnica de los 5 porqués); si la factura está limpia, describe por qué el proceso funcionó",
  "acciones": ["acción concreta 1 (máx 1 línea)", "acción 2", "acción 3"],
  "confianza": 0-100
}

Criterios de recomendación: hallazgo CRITICO → RECHAZAR o ESCALAR según monto; discrepancias ALTA → ESCALAR o APROBAR_CON_AJUSTE; solo BAJA/MEDIA menores → APROBAR_CON_AJUSTE; sin hallazgos → APROBAR.`;

  const user = `SINIESTRO ${factura.siniestro.numero} · ${factura.siniestro.vehiculo} ${factura.siniestro.anioVehiculo} (placa ${factura.siniestro.placa})
Asegurado: ${factura.siniestro.asegurado} · Cobertura: ${factura.siniestro.tipoCobertura}
Zona dañada reportada: ${factura.siniestro.zonaDanio} — ${factura.siniestro.descripcion}
Reserva autorizada: ${usd(factura.siniestro.montoReserva)}

FACTURA ${factura.numero} emitida por ${factura.taller.nombre} (${factura.taller.ciudad})
Fecha de emisión: ${factura.fechaEmision.toISOString().slice(0, 10)} · Total declarado: ${usd(factura.montoTotal)} (ITBMS ${factura.itbmsPct}% incluido) · RUC del taller: ${factura.taller.ruc}

PARTIDAS FACTURADAS:
${partidasTxt}

HALLAZGOS DEL MOTOR DETERMINISTA (ya verificados contra tarifario y duplicados):
${hallazgosTxt}`;

  let informe: InformeIA;
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonTxt = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonTxt.slice(jsonTxt.indexOf("{"), jsonTxt.lastIndexOf("}") + 1));
    const validas = ["APROBAR", "APROBAR_CON_AJUSTE", "ESCALAR", "RECHAZAR"];
    informe = {
      resumen: String(parsed.resumen ?? "").slice(0, 900),
      recomendacion: validas.includes(parsed.recomendacion) ? parsed.recomendacion : "ESCALAR",
      causaRaiz: String(parsed.causaRaiz ?? "").slice(0, 900),
      acciones: Array.isArray(parsed.acciones) ? parsed.acciones.slice(0, 5).map((a: unknown) => String(a).slice(0, 220)) : [],
      confianza: Math.min(100, Math.max(0, Number(parsed.confianza) || 82)),
    };
  } catch {
    // Fallback determinista: el agente nunca se queda mudo
    const total = factura.hallazgos.reduce((a, h) => a + h.montoDiscrepancia, 0);
    informe = {
      resumen: factura.hallazgos.length
        ? `Factura ${factura.numero} por ${usd(factura.montoTotal)} presenta ${factura.hallazgos.length} hallazgo(s) del motor de reglas, con discrepancia consolidada de ${usd(total)}. Se recomienda revisión humana antes de liquidar.`
        : `Factura ${factura.numero} por ${usd(factura.montoTotal)} auditada sin hallazgos: cumple tarifario, sin duplicados ni inconsistencias con el siniestro ${factura.siniestro.numero}.`,
      recomendacion: factura.hallazgos.some((h) => h.severidad === "CRITICA")
        ? "RECHAZAR"
        : factura.hallazgos.length
          ? "ESCALAR"
          : "APROBAR",
      causaRaiz: factura.hallazgos.length
        ? `¿Por qué? Se detectaron desviaciones al comparar contra el tarifario pactado. ¿Por qué? El taller cobró por encima del estándar o registró partidas repetidas. ¿Por qué? Posible debilidad en su control interno de facturación; conviene verificación directa y recordatorio del convenio.`
        : `¿Por qué la factura fluyó sin fricción? Porque las partidas coinciden con el tarifario y el daño reportado; el estándar (tarifario pactado) se está respetando.`,
      acciones: factura.hallazgos.length
        ? ["Verificar con el perito asignado las partidas señaladas.", "Solicitar al taller nota de crédito por las discrepancias.", "Registrar el patrón en la ficha de seguimiento del taller."]
        : ["Aprobar y liquidar sin ajustes.", "Mantener monitoreo estadístico por taller."],
      confianza: 70,
    };
  }

  await db.factura.update({
    where: { id: facturaId },
    data: { informeIA: JSON.stringify(informe), informeEnCurso: false },
  });
  return informe;
}

/** Pipeline completo: RECIBIDA → reglas → decisión → informe IA en segundo plano. */
export async function ejecutarAuditoria(facturaId: string): Promise<{ riesgo: number; estado: string; hallazgos: number; montoDiscrepancia: number }> {
  let paso = 1;
  const log = (etapa: string, mensaje: string) =>
    db.logAgente.create({ data: { facturaId, paso: paso++, etapa, mensaje } });

  const factura = await db.factura.findUniqueOrThrow({ where: { id: facturaId } });

  await db.factura.update({ where: { id: facturaId }, data: { estadoAuditoria: "EN_AUDITORIA" } });
  await log("RECEPCION", `Factura ${factura.numero} recibida de ${await db.taller.findUniqueOrThrow({ where: { id: factura.tallerId } }).then((t) => t.nombre)}. Monto declarado ${usd(factura.montoTotal)}.`);

  const partidas = await db.partida.findMany({ where: { facturaId } });
  const huella = calcularHuella(
    factura.tallerId,
    partidas.map((p) => ({ codigo: p.codigo, cantidad: p.cantidad, precioUnitario: p.precioUnitario }))
  );
  await db.factura.update({ where: { id: facturaId }, data: { huella } });
  await log("NORMALIZACION", `${partidas.length} partidas normalizadas y fingerprint anti-duplicados calculado (${huella.slice(0, 10)}…).`);

  const resultado = await auditarReglas(facturaId);
  await db.hallazgo.deleteMany({ where: { facturaId } });
  for (const h of resultado.hallazgos) {
    await db.hallazgo.create({
      data: {
        facturaId,
        partidaId: h.partidaId ?? null,
        regla: h.regla,
        tipo: h.tipo,
        severidad: h.severidad,
        descripcion: h.descripcion,
        montoDiscrepancia: h.montoDiscrepancia,
        detalle: JSON.stringify(h.detalle),
      },
    });
  }
  await log(
    "REGLAS",
    resultado.hallazgos.length
      ? `9 reglas deterministas ejecutadas: ${resultado.hallazgos.length} hallazgo(s) — ${resultado.hallazgos.map((h) => h.tipo).join(", ")}. Riesgo ${resultado.riesgo}/100.`
      : "9 reglas deterministas ejecutadas: 0 hallazgos. Todas las partidas cumplen el tarifario pactado."
  );

  const estadoFinal = resultado.estadoSugerido;
  await db.factura.update({
    where: { id: facturaId },
    data: {
      estadoAuditoria: estadoFinal,
      riesgo: resultado.riesgo,
      montoSugerido: resultado.montoSugerido,
      informeIA: null,
      informeEnCurso: false,
    },
  });

  if (estadoFinal === "APROBADA") {
    await log("DECISION", `Flujo directo: sin anomalías, la factura se aprueba automáticamente. Cero horas humanas consumidas.`);
  } else if (estadoFinal === "RECHAZADA") {
    await log("DECISION", `Línea detenida: hallazgo crítico detectado. Factura marcada RECHAZADA pendiente de confirmación humana.`);
  } else {
    await log("DECISION", `Semáforo ámbar: la factura pasa a OBSERVADA con riesgo ${resultado.riesgo}/100 y se escala al revisor humano.`);
  }

  // El informe IA se genera en segundo plano (no bloquea la decisión determinista)
  await log("IA", "Redactando informe ejecutivo con análisis de causa raíz (5 porqués)…");
  void generarInformeIA(facturaId)
    .then(() => {
      void db.logAgente.create({
        data: { facturaId, paso: paso + 10, etapa: "IA", mensaje: "Informe ejecutivo del agente disponible para el revisor." },
      });
    })
    .catch(() => {});

  return { riesgo: resultado.riesgo, estado: estadoFinal, hallazgos: resultado.hallazgos.length, montoDiscrepancia: resultado.montoDiscrepancia };
}
