// ─────────────────────────────────────────────────────────────
// Fixtures · expedientes sintéticos con resultado esperado
// Un expediente = taller + tarifario pactado + siniestro + factura(s)
// + lo que el motor DEBE encontrar. Sirve para `bun test`, para el
// `doctor` y para cargar la demo (scripts/cargar-fixtures.ts).
// ─────────────────────────────────────────────────────────────
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";

export interface ExpedienteFixture {
  id: string;
  titulo: string;
  descripcion: string;
  taller: { nombre: string; ruc: string; ciudad: string; telefono: string; contacto: string; descuentoPct?: number };
  tarifario: { codigo: string; categoria: string; descripcion: string; unidad: string; precioPactado: number }[];
  siniestro: {
    numero: string; poliza: string; asegurado: string; vehiculo: string; anioVehiculo: number; placa: string;
    fechaOcurrencia: string; tipoCobertura: string; zonaDanio: string; descripcion: string; montoReserva: number;
  };
  facturas: {
    numero: string;
    fechaEmision: string;
    itbmsPct?: number;
    montoTotal?: number | null; // null = suma de partidas + ITBMS
    partidas: { codigo: string; cantidad: number; precioUnitario: number; descripcion?: string; categoria?: string; unidad?: string; contexto?: string | null }[];
  }[];
  esperado: {
    factura: string; // número de la factura evaluada
    sinEvaluar: boolean;
    riesgo: number;
    montoDiscrepancia: number;
    hallazgos: { regla: string; linea?: number | null }[];
  };
}

export const DIR_FIXTURES = join(process.cwd(), "fixtures", "expedientes");
const round2 = (n: number) => Math.round(n * 100) / 100;

export function leerFixtures(dir = DIR_FIXTURES): ExpedienteFixture[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as ExpedienteFixture);
}

/** Inserta el expediente (sin auditar). Devuelve {numero → facturaId}. Idempotente por número de factura. */
export async function cargarExpediente(db: PrismaClient, exp: ExpedienteFixture): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  const existentes = await db.factura.findMany({ where: { numero: { in: exp.facturas.map((f) => f.numero) } } });
  if (existentes.length === exp.facturas.length) {
    for (const f of existentes) ids[f.numero] = f.id;
    return ids;
  }
  if (existentes.length) throw new Error(`${exp.id}: carga parcial previa (${existentes.map((f) => f.numero).join(", ")}); borra esas facturas o usa una BD limpia`);
  const taller = await db.taller.create({ data: { descuentoPct: 0, ...exp.taller } });
  for (const t of exp.tarifario) await db.tarifarioItem.create({ data: { ...t, tallerId: taller.id } });
  const siniestro = await db.siniestro.create({
    data: { ...exp.siniestro, fechaOcurrencia: new Date(exp.siniestro.fechaOcurrencia) },
  });
  const pactado = new Map(exp.tarifario.map((t) => [t.codigo, t]));
  for (const f of exp.facturas) {
    const itbms = f.itbmsPct ?? 7;
    let subtotal = 0;
    const partidas = f.partidas.map((p, i) => {
      const ref = pactado.get(p.codigo);
      const sub = round2(p.precioUnitario * p.cantidad);
      subtotal += sub;
      return {
        linea: i + 1,
        categoria: p.categoria ?? ref?.categoria ?? "REPUESTO",
        codigo: p.codigo,
        descripcion: p.descripcion ?? ref?.descripcion ?? "Partida sin catálogo",
        cantidad: p.cantidad,
        unidad: p.unidad ?? ref?.unidad ?? "UND",
        precioUnitario: p.precioUnitario,
        subtotal: sub,
        contexto: p.contexto ?? null,
      };
    });
    const factura = await db.factura.create({
      data: {
        numero: f.numero,
        tallerId: taller.id,
        siniestroId: siniestro.id,
        fechaEmision: new Date(f.fechaEmision),
        itbmsPct: itbms,
        montoTotal: f.montoTotal ?? round2(subtotal * (1 + itbms / 100)),
        partidas: { create: partidas },
      },
    });
    ids[f.numero] = factura.id;
  }
  return ids;
}

/** Compara lo que el motor dejó en la BD con `esperado`. Devuelve diferencias (vacío = OK). */
export async function verificarEsperado(db: PrismaClient, exp: ExpedienteFixture, facturaId: string): Promise<string[]> {
  const e = exp.esperado;
  const f = await db.factura.findUniqueOrThrow({ where: { id: facturaId }, include: { hallazgos: true, partidas: true } });
  const lineaDe = new Map(f.partidas.map((p) => [p.id, p.linea]));
  const clave = (h: { regla: string; linea?: number | null }) => `${h.regla}@${h.linea ?? "-"}`;
  const obtenidos = f.hallazgos.map((h) => clave({ regla: h.regla, linea: h.partidaId ? lineaDe.get(h.partidaId) : null })).sort();
  const esperados = e.hallazgos.map(clave).sort();
  const diffs: string[] = [];
  if (obtenidos.join(",") !== esperados.join(",")) diffs.push(`hallazgos esperados [${esperados}] ≠ obtenidos [${obtenidos}]`);
  if (f.sinEvaluar !== e.sinEvaluar) diffs.push(`sinEvaluar esperado ${e.sinEvaluar} ≠ ${f.sinEvaluar}`);
  if (f.riesgo !== e.riesgo) diffs.push(`riesgo esperado ${e.riesgo} ≠ ${f.riesgo}`);
  const monto = round2(f.hallazgos.reduce((a, h) => a + h.montoDiscrepancia, 0));
  if (Math.abs(monto - e.montoDiscrepancia) > 0.005) diffs.push(`montoDiscrepancia esperado ${e.montoDiscrepancia} ≠ ${monto}`);
  const sinEvidencia = f.hallazgos.filter((h) => !(JSON.parse(h.detalle || "{}").evidencia?.length > 0));
  if (sinEvidencia.length) diffs.push(`${sinEvidencia.length} hallazgo(s) sin cita de evidencia`);
  return diffs;
}
