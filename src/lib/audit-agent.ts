// ─────────────────────────────────────────────────────────────
// Agente auditor híbrido · "Jidoka" (automatización con criterio)
// 1) Ejecuta reglas deterministas (audit-rules.ts)
// 2) Persiste hallazgos con cita de evidencia (NUNCA decide pagos)
// 3) Redacta el informe línea por línea para el auditor humano
//    (LLM opcional sobre hallazgos ya demostrados; el fallback es
//    determinista y produce el MISMO contrato de informe)
//
// Contrato acordado (tarea #44 · hackIAthon Viamatica):
// · La salida del agente es un INFORME de discrepancias con
//   evidencia; no aprueba, rechaza ni liquida pagos.
// · Regla de parada: línea afectada aislada, montos sin evaluar
//   visibles; sin base compartida válida no hay conclusiones.
// · El auditor humano revisa CADA hallazgo: aceptar, descartar
//   con motivo, o pedir evidencia específica.
// ─────────────────────────────────────────────────────────────
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { auditarReglas, calcularHuella, ETIQUETA_REGLA } from "@/lib/audit-rules";
import type { InformeAgente } from "@/lib/types";

const round2 = (n: number) => Math.round(n * 100) / 100;
const usd = (n: number) => `$${round2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Informe determinista (siempre disponible) a partir de hallazgos ya demostrados. */
function informeDeterminista(
  factura: {
    numero: string;
    montoTotal: number;
    montoSinEvaluar: number | null;
    sinEvaluar: boolean;
    notaBloqueo: string | null;
    taller: { nombre: string };
    siniestro: { numero: string };
    partidas: { id: string; linea: number; descripcion: string; subtotal: number }[];
  },
  hallazgos: { regla: string; tipo: string; severidad: string; descripcion: string; partidaId: string | null; montoDiscrepancia: number }[]
): InformeAgente {
  const conHallazgo = new Set(hallazgos.filter((h) => h.partidaId).map((h) => h.partidaId as string));
  const lineas: InformeAgente["lineas"] = factura.partidas.map((p) => {
    const hs = hallazgos.filter((h) => h.partidaId === p.id);
    if (hs.some((h) => h.regla === "R10")) {
      return { linea: p.linea, descripcion: p.descripcion, estado: "SIN_EVALUAR" as const, detalle: "Sin tarifario pactado de referencia: monto no evaluable." };
    }
    if (hs.length) {
      return { linea: p.linea, descripcion: p.descripcion, estado: "DISCREPANCIA" as const, detalle: hs.map((h) => `${h.tipo}: ${h.descripcion}`).join(" ") };
    }
    return { linea: p.linea, descripcion: p.descripcion, estado: "CONFORME" as const, detalle: "Cumple tarifario y consistencia con el siniestro." };
  });
  // Verificaciones a nivel de factura (R3/R6/R8/R9) también se listan como líneas virtuales
  for (const h of hallazgos.filter((x) => !x.partidaId)) {
    lineas.push({ linea: null, descripcion: ETIQUETA_REGLA[h.regla] ?? h.tipo, estado: "DISCREPANCIA", detalle: h.descripcion });
  }
  const montosSinEvaluar: string[] = [];
  if (factura.sinEvaluar && factura.montoSinEvaluar != null) {
    montosSinEvaluar.push(`Total de factura ${usd(factura.montoSinEvaluar)} — no evaluable contra convenio (falta tarifario pactado de ${factura.taller.nombre}).`);
  }
  const conDiscrepancia = lineas.filter((l) => l.estado === "DISCREPANCIA").length;
  return {
    resumen: factura.sinEvaluar
      ? `Factura ${factura.numero} (${usd(factura.montoTotal)}) de ${factura.taller.nombre} · siniestro ${factura.siniestro.numero}. INFORME INCOMPLETO: ${factura.notaBloqueo ?? "evidencia compartida faltante"} Se listan ${lineas.filter((l) => l.estado === "SIN_EVALUAR").length} línea(s) sin evaluar y ${conDiscrepancia} verificación(es) interna(s) con observación.`
      : `Factura ${factura.numero} (${usd(factura.montoTotal)}) de ${factura.taller.nombre} · siniestro ${factura.siniestro.numero}. ${factura.partidas.length} líneas auditadas: ${conDiscrepancia} con discrepancia o anomalía, ${factura.partidas.length - conHallazgo.size} conformes. ${hallazgos.length} hallazgo(s) documentado(s) con evidencia, pendientes de revisión del auditor.`,
    estadoInforme: factura.sinEvaluar ? "INCOMPLETO" : "LISTO",
    lineas,
    montosSinEvaluar,
    nota:
      "Informe de discrepancias para revisión humana. El agente no aprueba ni rechaza pagos; toda decisión y monto final corresponde al auditor. Montos de ajuste mostrados son propuestas de referencia del motor.",
  };
}

/** Refina la redacción del informe con LLM SOBRE hallazgos ya demostrados (opcional). */
async function refinarConLLM(base: InformeAgente, hallazgosTxt: string): Promise<string | null> {
  if (process.env.JIDOKA_DISABLE_IA === "1") return null;
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Eres el asistente de redacción del Agente Auditor de Siniestros de Istmo Seguros (Panamá, aseguradora de autos). Tu único trabajo es REDACTAR con claridad un resumen ejecutivo a partir de hallazgos YA VERIFICADOS por el motor determinista. Reglas absolutas:
- NO inventes, corrijas ni agregues hallazgos; no cambies montos, códigos ni líneas.
- NO apruebes ni rechaces pagos; no uses palabras como "aprobar", "rechazar", "liquidar" como recomendación. El informe va PARA REVISIÓN del auditor humano.
- Si el informe está incompleto (montos sin evaluar), dilo de forma explícita y visible.
- Español panameño profesional, conciso, sin emojis, sin markdown, sin términos en japonés ni marcas.
Devuelve EXCLUSIVAMENTE JSON válido: {"resumen": "2-4 oraciones"}`,
        },
        {
          role: "user",
          content: `INFORME BASE (fuente de verdad):\n${base.resumen}\n\nLÍNEAS:\n${base.lineas.map((l) => `L${l.linea ?? "—"} [${l.estado}] ${l.descripcion}: ${l.detalle}`).join("\n")}\n\nHALLAZGOS DEL MOTOR:\n${hallazgosTxt}\n\nMONTOS SIN EVALUAR:\n${base.montosSinEvaluar.join("\n") || "ninguno"}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonTxt = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(jsonTxt.slice(jsonTxt.indexOf("{"), jsonTxt.lastIndexOf("}") + 1));
    const resumen = String(parsed.resumen ?? "").slice(0, 900);
    // Guard: el LLM no puede convertir un informe incompleto en completo
    if (base.estadoInforme === "INCOMPLETO" && !/incompleto|sin evaluar|no evaluable/i.test(resumen)) return null;
    return resumen || null;
  } catch {
    return null;
  }
}

/**
 * Equivalencias con el catálogo · el LLM LEE Y CITA, no decide.
 * Para cada hallazgo R4 (partida sin código en el convenio) el modelo puede proponer un
 * código alternativo, pero solo se guarda si el código existe en el tarifario Y la
 * descripción que cita es VERBATIM la del catálogo. Queda como propuesta junto a la del
 * motor determinista; el hallazgo, su severidad y su monto no cambian.
 */
async function sugerirEquivalenciasConLLM(facturaId: string): Promise<number> {
  if (process.env.JIDOKA_DISABLE_IA === "1") return 0;
  const hallazgosR4 = await db.hallazgo.findMany({ where: { facturaId, regla: "R4" } });
  if (!hallazgosR4.length) return 0;
  const factura = await db.factura.findUniqueOrThrow({ where: { id: facturaId } });
  const catalogo = await db.tarifarioItem.findMany({ where: { tallerId: factura.tallerId } });
  if (!catalogo.length) return 0;

  let guardadas = 0;
  try {
    const zai = await ZAI.create();
    for (const h of hallazgosR4) {
      const detalle = JSON.parse(h.detalle || "{}") as Record<string, unknown> & { equivalencia?: { codigoPropuesto?: string } | null };
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `Eres asistente de catalogación de un auditor de facturas de taller (Panamá). Te dan UNA partida facturada y el TARIFARIO PACTADO completo. Tu único trabajo es señalar cuál ítem del tarifario podría ser el equivalente y CITAR su descripción exacta. Reglas absolutas:
- Solo puedes elegir un código que aparezca literalmente en el tarifario dado; si ninguno equivale, responde con codigo vacío.
- "descripcionCitada" debe ser el texto EXACTO del tarifario, carácter por carácter, sin reescribirlo.
- NO decides nada: no apruebas, no rechazas, no cambias montos ni códigos. Es una sugerencia para el auditor humano.
Devuelve EXCLUSIVAMENTE JSON: {"codigo": "...", "descripcionCitada": "...", "motivo": "una oración"}`,
          },
          {
            role: "user",
            content: `PARTIDA FACTURADA: código ${detalle.codigo} · «${detalle.descripcion}» · ${detalle.cantidad} ${detalle.unidad}\n\nTARIFARIO PACTADO:\n${catalogo
              .map((c) => `${c.codigo} | ${c.categoria} | ${c.descripcion} | ${c.unidad} | $${c.precioPactado}`)
              .join("\n")}`,
          },
        ],
      });
      const raw = (completion.choices[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      const item = catalogo.find((c) => c.codigo === String(parsed.codigo ?? "").trim());
      // Guard anti-alucinación: el código existe y la cita es literal, o se descarta.
      if (!item || item.descripcion.trim() !== String(parsed.descripcionCitada ?? "").trim()) continue;
      detalle.propuestaIA = {
        codigoPropuesto: item.codigo,
        descripcionCitada: item.descripcion,
        motivo: String(parsed.motivo ?? "").slice(0, 300),
        coincideConElMotor: detalle.equivalencia?.codigoPropuesto === item.codigo,
      };
      await db.hallazgo.update({ where: { id: h.id }, data: { detalle: JSON.stringify(detalle) } });
      guardadas++;
    }
  } catch {
    return guardadas; // sin nube o con respuesta inválida, el motor determinista ya dejó su propuesta
  }
  return guardadas;
}

/** Genera el informe del agente (determinista + redacción LLM opcional) y lo persiste. */
export async function generarInformeAgente(facturaId: string): Promise<InformeAgente> {
  const factura = await db.factura.findUniqueOrThrow({
    where: { id: facturaId },
    include: { partidas: { orderBy: { linea: "asc" } }, hallazgos: true, siniestro: true, taller: true },
  });
  const base = informeDeterminista(
    factura,
    factura.hallazgos.map((h) => ({
      regla: h.regla,
      tipo: h.tipo,
      severidad: h.severidad,
      descripcion: h.descripcion,
      partidaId: h.partidaId,
      montoDiscrepancia: h.montoDiscrepancia,
    }))
  );
  const refinado = await refinarConLLM(
    base,
    factura.hallazgos.length
      ? factura.hallazgos.map((h, i) => `${i + 1}. [${h.severidad}] ${h.tipo} — ${h.descripcion} (discrepancia: ${usd(h.montoDiscrepancia)})`).join("\n")
      : "Sin hallazgos."
  );
  const informe: InformeAgente = refinado ? { ...base, resumen: refinado } : base;
  await db.factura.update({
    where: { id: facturaId },
    data: { informeAgente: JSON.stringify(informe), informeEnCurso: false },
  });
  return informe;
}

/** Pipeline: RECIBIDA → reglas → informe → PARA_REVISION. El agente nunca decide pagos. */
export async function ejecutarAuditoria(facturaId: string): Promise<{
  riesgo: number;
  estado: string;
  hallazgos: number;
  montoDiscrepancia: number;
  sinEvaluar: boolean;
  montoSinEvaluar: number | null;
}> {
  let paso = 1;
  const log = (etapa: string, mensaje: string) =>
    db.logAgente.create({ data: { facturaId, paso: paso++, etapa, mensaje } });

  const factura = await db.factura.findUniqueOrThrow({ where: { id: facturaId } });

  await db.factura.update({ where: { id: facturaId }, data: { estadoAuditoria: "EN_AUDITORIA" } });
  const taller = await db.taller.findUniqueOrThrow({ where: { id: factura.tallerId } });
  await log("RECEPCION", `Factura ${factura.numero} recibida de ${taller.nombre}. Monto declarado ${usd(factura.montoTotal)}.`);

  const partidas = await db.partida.findMany({ where: { facturaId } });
  const huella = calcularHuella(
    factura.tallerId,
    partidas.map((p) => ({ codigo: p.codigo, cantidad: p.cantidad, precioUnitario: p.precioUnitario }))
  );
  await db.factura.update({ where: { id: facturaId }, data: { huella } });
  await log("NORMALIZACION", `${partidas.length} partidas normalizadas (con contexto documentado cuando aplica) y fingerprint anti-duplicados calculado (${huella.slice(0, 10)}…).`);

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
        ajustePropuesto: h.ajustePropuesto ?? null,
        evidenciaPendiente: h.evidenciaPendiente ?? null,
        estadoRevision: "PENDIENTE",
        detalle: JSON.stringify({ ...h.detalle, evidencia: h.evidencia }),
      },
    });
  }
  await log(
    "REGLAS",
    resultado.hallazgos.length
      ? `${resultado.hallazgos.length} hallazgo(s) determinista(s) con cita de evidencia — ${resultado.hallazgos.map((h) => h.tipo).join(", ")}. Riesgo consolidado ${resultado.riesgo}/100.`
      : "0 hallazgos: todas las líneas cumplen tarifario, sin duplicados ni inconsistencias internas."
  );

  // El motor ya propuso la equivalencia determinista; el LLM solo agrega una alternativa citada.
  const sugeridas = await sugerirEquivalenciasConLLM(facturaId);
  if (sugeridas) {
    await log("IA", `El modelo propuso ${sugeridas} equivalencia(s) de catálogo citando el tarifario textualmente. Son propuestas: el motor mantiene el hallazgo y decide el auditor.`);
  }

  const ajusteProp = round2(resultado.hallazgos.reduce((a, h) => a + (h.ajustePropuesto ?? 0), 0));
  await db.factura.update({
    where: { id: facturaId },
    data: {
      estadoAuditoria: "PARA_REVISION",
      riesgo: resultado.riesgo,
      montoAjusteProp: ajusteProp !== 0 ? ajusteProp : null,
      montoSinEvaluar: resultado.montoSinEvaluar,
      sinEvaluar: resultado.sinEvaluar,
      notaBloqueo: resultado.notaBloqueo,
      informeAgente: null,
      informeEnCurso: false,
    },
  });

  if (resultado.sinEvaluar) {
    await log("PARADA", `Regla de parada activa: ${resultado.notaBloqueo ?? "evidencia compartida inválida"} Las conclusiones dependientes quedan bloqueadas y los montos, sin evaluar.`);
  }
  await log("DECISION", `Informe de discrepancias generado y enviado a revisión del auditor humano. El agente no aprueba ni rechaza pagos.`);

  // El informe se redacta en segundo plano (determinista primero; LLM solo pule redacción)
  await log("IA", "Redactando informe línea por línea para el revisor…");
  void generarInformeAgente(facturaId)
    .then(() => {
      void db.logAgente.create({
        data: { facturaId, paso: paso + 10, etapa: "IA", mensaje: "Informe del agente disponible para el auditor." },
      });
    })
    .catch(() => {});

  return {
    riesgo: resultado.riesgo,
    estado: "PARA_REVISION",
    hallazgos: resultado.hallazgos.length,
    montoDiscrepancia: resultado.montoDiscrepancia,
    sinEvaluar: resultado.sinEvaluar,
    montoSinEvaluar: resultado.montoSinEvaluar,
  };
}
