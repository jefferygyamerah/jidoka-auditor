# JIDOKA · Auditor agéntico de facturas de siniestros (autos)

Prototipo para el hackIAthon (reto 2). El motor determinista compara cada factura de taller
contra el tarifario pactado y el expediente del siniestro, y entrega un **informe de
discrepancias línea por línea con cita de evidencia**. El agente nunca aprueba ni rechaza
pagos: eso lo decide el auditor humano, hallazgo por hallazgo. Sin tarifario compartido
válido, la línea se aísla y el informe queda marcado como incompleto (regla de parada).

Stack: Next.js 16 · TypeScript · Prisma/SQLite · shadcn/ui. El LLM (Z.ai, opcional) solo
pule la redacción del resumen; sin claves de nube el sistema funciona igual.

## Correr

```bash
bun install
echo 'DATABASE_URL=file:../db/custom.db' > .env   # relativo a prisma/schema.prisma
bun run db:push
JIDOKA_DISABLE_IA=1 bun scripts/seed.ts             # datos de demo (34 facturas)
bun run dev                                          # http://localhost:3000
```

## Verificar

```bash
bun run doctor            # ¿puede auditar en esta máquina sin nube? (sale 1 si falta cualquier tabla o columna)
bun test                  # cada expediente de fixtures/ produce EXACTAMENTE lo esperado
bun run fixtures:cargar   # carga los expedientes nuevos en la BD de demo y los contrasta; lo ya cargado se conserva (revisión humana incluida)
bun run fixtures:cargar --reauditar   # vuelve a auditar TODO: borra hallazgos y revisiones, reabre las facturas
```

## Reglas del motor

| Regla | Qué detecta |
|---|---|
| R1 | Precio sobre el tarifario pactado (tolerancia configurable) |
| R2 | Partida duplicada sin posición/instancia documentada (con contexto distinto es repetición legítima) |
| R3 | Factura duplicada por huella SHA-256 del contenido económico |
| R4 | Partida sin código en el convenio |
| R5 | Cantidad fuera de lo razonable por categoría |
| R6 | Total declarado que no cuadra con partidas + ITBMS |
| R7 | Repuesto de una zona distinta a la del daño reportado |
| R8 | Honorarios sobre el tope pactado |
| R9 | Monto sobre la reserva del siniestro |
| R10 | Parada: sin tarifario cargado, la línea queda sin evaluar |

## Equivalencias con el catálogo

Cuando una partida no coincide por **código** con el tarifario (R4), el motor propone la
equivalencia más probable de forma determinista: normaliza el texto (minúsculas, sin tildes,
plural a raíz, sinónimos de taller de `src/lib/equivalencias-sinonimos.json`) y puntúa por
términos en común, unidad y categoría. La propuesta viaja con **confianza (0–1), motivo en
palabras y cita de evidencia**, y con confianza ≥ 0.80 el hallazgo baja a severidad BAJA —
pero **no desaparece**: lo confirma o lo descarta el auditor, con motivo.

Con IA habilitada (`JIDOKA_DISABLE_IA` ≠ 1 y proveedor configurado), el LLM puede **proponer**
otra equivalencia citando la descripción exacta del tarifario; solo se guarda si el código
existe y la cita es literal, y queda junto a la del motor como sugerencia. **El LLM lee y cita;
las reglas deciden qué se marca; el auditor aprueba o descarta.**

En la pantalla del hallazgo, el bloque «¿De dónde sale este monto?» muestra cobrado vs pactado
(o «sin catálogo»), la equivalencia propuesta con su confianza y motivo, y la cita de evidencia.

La **entrada desde una base de Notion queda fuera del corte del hackathon**: el punto de
enganche está marcado en `src/lib/fixtures.ts` (`leerFixtures`), que es donde entraría como
otra fuente de expedientes sin tocar motor ni UI.

`fixtures/expedientes/EXP-NN.json` son expedientes sintéticos (rotulados DEMO) con el
resultado esperado; son el contrato del motor. Ver `fixtures/README.md`.
