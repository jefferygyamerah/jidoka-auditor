/// <reference types="bun-types" />
// El doctor debe salir 1 si a la BD le falta CUALQUIER tabla o columna del esquema, aunque
// Taller/Factura/Configuracion existan: su ✔ no puede tapar una auditoría que no puede persistir.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { crearDbTemporal } from "./db-temporal";

const tmp = crearDbTemporal();
const doctor = () => Bun.spawnSync(["bun", "scripts/doctor.ts"], { env: { ...process.env, DATABASE_URL: tmp.url, JIDOKA_DISABLE_IA: "1" } });
const sql = (q: string) => { const d = new Database(tmp.url.slice(5)); d.run(q); d.close(); };

beforeAll(() => tmp.push());
afterAll(() => tmp.limpiar());

test("esquema completo → sale 0", () => {
  const r = doctor();
  expect(r.stdout.toString()).toContain("✔ Base de datos");
  expect(r.exitCode).toBe(0);
});

test("falta una columna del motor (Hallazgo.comentarioRevision) → sale 1 y la nombra", () => {
  sql('ALTER TABLE "Hallazgo" DROP COLUMN "comentarioRevision"');
  const r = doctor();
  expect(r.stdout.toString()).toMatch(/✖ Base de datos.*Hallazgo\.comentarioRevision/);
  expect(r.exitCode).toBe(1);
});

test("falta la tabla Hallazgo → sale 1 y la nombra", () => {
  sql('DROP TABLE "Hallazgo"');
  const r = doctor();
  expect(r.stdout.toString()).toMatch(/✖ Base de datos.*Hallazgo/);
  expect(r.exitCode).toBe(1);
});
