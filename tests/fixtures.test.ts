/// <reference types="bun-types" />
// Prueba de contrato del motor: cada expediente de fixtures/expedientes
// debe producir EXACTAMENTE los hallazgos esperados (regla + línea),
// el riesgo, el monto en discrepancia y el estado de parada.
// Corre sobre una BD SQLite temporal; no toca db/custom.db.
//   bun test
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { PrismaClient } from "@prisma/client";
import { cargarExpediente, cargarYAuditar, leerFixtures, verificarEsperado } from "@/lib/fixtures";
import { crearDbTemporal } from "./db-temporal";

const tmp = crearDbTemporal();
process.env.DATABASE_URL = tmp.url;
process.env.JIDOKA_DISABLE_IA = "1"; // el motor decide; el LLM no participa en las pruebas

let db: PrismaClient;
let ejecutarAuditoria: (id: string) => Promise<unknown>;
let generarInformeAgente: (id: string) => Promise<{ estadoInforme: string }>;

beforeAll(async () => {
  tmp.push();
  ({ db } = await import("@/lib/db"));
  ({ ejecutarAuditoria, generarInformeAgente } = await import("@/lib/audit-agent"));
  await db.configuracion.create({ data: { id: "GLOBAL" } });
});

afterAll(async () => {
  await db?.$disconnect();
  tmp.limpiar();
});

const fixtures = leerFixtures();

describe("fixtures", () => {
  test("hay al menos 10 expedientes y cada uno cubre una regla distinta o un caso límite", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
    expect(new Set(fixtures.map((f) => f.id)).size).toBe(fixtures.length);
  });

  for (const exp of fixtures) {
    test(`${exp.id} · ${exp.titulo}`, async () => {
      const ids = await cargarExpediente(db, exp);
      for (const f of exp.facturas) await ejecutarAuditoria(ids[f.numero]); // en orden: R3 necesita la gemela anterior
      const facturaId = ids[exp.esperado.factura];
      const diffs = await verificarEsperado(db, exp, facturaId);
      expect(diffs).toEqual([]);
      const informe = await generarInformeAgente(facturaId);
      expect(informe.estadoInforme).toBe(exp.esperado.sinEvaluar ? "INCOMPLETO" : "LISTO");
    });
  }
});

// El cargador de la demo se corre más de una vez (README: idempotente). Volver a correrlo
// NO puede re-auditar lo ya cargado: ejecutarAuditoria borra los hallazgos (y con ellos la
// revisión humana) y reabre la factura. Re-auditar es una decisión explícita (--reauditar).
describe("recargar fixtures", () => {
  const exp = fixtures.find((f) => f.esperado.hallazgos.length > 0)!;
  let facturaId: string;
  let idsAntes: string[];

  beforeAll(async () => {
    facturaId = (await db.factura.findUniqueOrThrow({ where: { numero: exp.esperado.factura } })).id; // ya cargada y auditada arriba
    const hallazgos = await db.hallazgo.findMany({ where: { facturaId }, orderBy: { id: "asc" } });
    idsAntes = hallazgos.map((h) => h.id);
    await db.hallazgo.update({ where: { id: idsAntes[0] }, data: { estadoRevision: "ACEPTADO", comentarioRevision: "revisado a mano", revisadoPor: "auditora" } });
    await db.factura.update({ where: { id: facturaId }, data: { estadoAuditoria: "CERRADA" } });
  });

  test("sin --reauditar conserva los hallazgos, la revisión humana y la factura cerrada", async () => {
    const { ids, nuevo } = await cargarYAuditar(db, exp);
    expect(nuevo).toBe(false);
    expect(ids[exp.esperado.factura]).toBe(facturaId);
    const despues = await db.hallazgo.findMany({ where: { facturaId }, orderBy: { id: "asc" } });
    expect(despues.map((h) => h.id)).toEqual(idsAntes);
    expect(despues[0]).toMatchObject({ estadoRevision: "ACEPTADO", comentarioRevision: "revisado a mano", revisadoPor: "auditora" });
    expect((await db.factura.findUniqueOrThrow({ where: { id: facturaId } })).estadoAuditoria).toBe("CERRADA");
  });

  test("con --reauditar sí vuelve a auditar: hallazgos nuevos, factura reabierta, resultado igual al esperado", async () => {
    const { nuevo } = await cargarYAuditar(db, exp, { reauditar: true });
    expect(nuevo).toBe(false);
    const despues = await db.hallazgo.findMany({ where: { facturaId } });
    expect(despues.map((h) => h.id)).not.toEqual(idsAntes);
    expect(despues.every((h) => h.estadoRevision === "PENDIENTE")).toBe(true);
    expect((await db.factura.findUniqueOrThrow({ where: { id: facturaId } })).estadoAuditoria).toBe("PARA_REVISION");
    expect(await verificarEsperado(db, exp, facturaId)).toEqual([]);
  });
});
