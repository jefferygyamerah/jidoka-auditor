/// <reference types="bun-types" />
// Prueba de contrato del motor: cada expediente de fixtures/expedientes
// debe producir EXACTAMENTE los hallazgos esperados (regla + línea),
// el riesgo, el monto en discrepancia y el estado de parada.
// Corre sobre una BD SQLite temporal; no toca db/custom.db.
//   bun test
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";
import { cargarExpediente, leerFixtures, verificarEsperado } from "@/lib/fixtures";

const tmp = mkdtempSync(join(tmpdir(), "jidoka-test-"));
process.env.DATABASE_URL = `file:${join(tmp, "test.db")}`;
process.env.JIDOKA_DISABLE_IA = "1"; // el motor decide; el LLM no participa en las pruebas

let db: PrismaClient;
let ejecutarAuditoria: (id: string) => Promise<unknown>;
let generarInformeAgente: (id: string) => Promise<{ estadoInforme: string }>;

beforeAll(async () => {
  const push = Bun.spawnSync(["bunx", "prisma", "db", "push", "--skip-generate", "--accept-data-loss"], { env: { ...process.env } });
  if (push.exitCode !== 0) throw new Error(`prisma db push falló: ${push.stderr.toString()}`);
  ({ db } = await import("@/lib/db"));
  ({ ejecutarAuditoria, generarInformeAgente } = await import("@/lib/audit-agent"));
  await db.configuracion.create({ data: { id: "GLOBAL" } });
});

afterAll(async () => {
  await db?.$disconnect();
  rmSync(tmp, { recursive: true, force: true });
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
