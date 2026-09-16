// Carga los expedientes de fixtures/expedientes en la BD configurada (demo),
// los audita y muestra si el resultado coincide con lo esperado.
//   bun run fixtures:cargar          (idempotente: no duplica facturas ya cargadas)
import { db } from "../src/lib/db";
import { ejecutarAuditoria, generarInformeAgente } from "../src/lib/audit-agent";
import { cargarExpediente, leerFixtures, verificarEsperado } from "../src/lib/fixtures";

await db.configuracion.upsert({ where: { id: "GLOBAL" }, update: {}, create: { id: "GLOBAL" } });
let fallas = 0;
for (const exp of leerFixtures()) {
  const ids = await cargarExpediente(db, exp);
  for (const f of exp.facturas) {
    await ejecutarAuditoria(ids[f.numero]);
    await generarInformeAgente(ids[f.numero]);
  }
  const diffs = await verificarEsperado(db, exp, ids[exp.esperado.factura]);
  fallas += diffs.length ? 1 : 0;
  console.log(`${diffs.length ? "✖" : "✔"} ${exp.id} ${exp.titulo}${diffs.length ? "\n    " + diffs.join("\n    ") : ""}`);
}
await db.$disconnect();
console.log(fallas ? `\n${fallas} expediente(s) no coinciden con lo esperado.` : "\nTodos los expedientes coinciden con lo esperado.");
process.exit(fallas ? 1 : 0);
