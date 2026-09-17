/// <reference types="bun-types" />
// BD SQLite temporal con el esquema aplicado (prisma db push). No toca db/custom.db.
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export function crearDbTemporal() {
  const dir = mkdtempSync(join(tmpdir(), "jidoka-test-"));
  const url = `file:${join(dir, "test.db").replaceAll("\\", "/")}`; // Prisma quiere barras también en Windows
  return {
    url,
    push() {
      const r = Bun.spawnSync(["bunx", "prisma", "db", "push", "--skip-generate", "--accept-data-loss"], { env: { ...process.env, DATABASE_URL: url } });
      if (r.exitCode !== 0) throw new Error(`prisma db push falló (${url}):\n${r.stdout}\n${r.stderr}`);
    },
    limpiar: () => rmSync(dir, { recursive: true, force: true }),
  };
}
