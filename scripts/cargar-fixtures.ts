// Carga los expedientes de fixtures/expedientes en la BD configurada (demo), audita los
// nuevos y muestra si el resultado coincide con lo esperado.
//   bun run fixtures:cargar               (idempotente: lo ya cargado se conserva tal cual, revisión humana incluida)
//   bun run fixtures:cargar --reauditar   (vuelve a auditar TODO: borra hallazgos y revisiones, reabre las facturas)
import { db } from "../src/lib/db";
import { cargarYAuditar, leerFixtures, verificarEsperado } from "../src/lib/fixtures";

const reauditar = process.argv.includes("--reauditar");
await db.configuracion.upsert({ where: { id: "GLOBAL" }, update: {}, create: { id: "GLOBAL" } });
let fallas = 0;
for (const exp of leerFixtures()) {
  const { ids, nuevo } = await cargarYAuditar(db, exp, { reauditar });
  const objetivo = ids[exp.esperado.factura];
  const diffs = objetivo ? await verificarEsperado(db, exp, objetivo) : [`esperado.factura «${exp.esperado.factura}» no está entre las facturas del expediente`];
  fallas += diffs.length ? 1 : 0;
  const nota = nuevo ? "" : reauditar ? " · re-auditado" : " · ya estaba cargado, se conserva";
  console.log(`${diffs.length ? "✖" : "✔"} ${exp.id} ${exp.titulo}${nota}${diffs.length ? "\n    " + diffs.join("\n    ") : ""}`);
}
await db.$disconnect();
console.log(fallas ? `\n${fallas} expediente(s) no coinciden con lo esperado.` : "\nTodos los expedientes coinciden con lo esperado.");
process.exit(fallas ? 1 : 0);
