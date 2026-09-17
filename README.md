# JIDOKA — Auditoría agéntica de facturación de siniestros

**Qué es:** un agente determinista que audita facturas de talleres contra el expediente del siniestro y el tarifario contratado. Cada hallazgo trae la evidencia línea por línea; una persona decide (aceptar / pedir evidencia / descartar). El agente nunca aprueba pagos.

**Demo en vivo:** https://jidoka.adwentech.com

## Para jueces: verlo correr en 5 minutos

Requisitos: Node 22+, bun (`curl -fsSL https://bun.sh/install | bash`).

```bash
git clone https://github.com/jefferygyamerah/jidoka-auditor.git
cd jidoka-auditor
npm install
cp .env.example .env
npm run db:generate          # cliente Prisma
JIDOKA_DISABLE_IA=1 npx tsx scripts/seed.ts   # crea db/custom.db con datos sintéticos (34 facturas)
bun run fixtures:cargar       # carga los expedientes de prueba con resultado esperado
bun run doctor                # valida entorno + esquema (sin claves de nube)
npm run dev                  # http://localhost:3000
```

Credenciales en la nube: **no requiere ninguna** (`npm run doctor` lo verifica — que no haya claves es parte del contrato).

## Qué mirar (guion de 2 minutos)

1. **Panel de control** — una decisión: cuántas facturas esperan revisión humana (hero + botón "Revisar ahora").
2. **Auditoría → abre la primera factura** — hallazgos con evidencia citada, monto en disputa, y la acción humana: aceptar · pedir evidencia · descartar.
3. **Agente en vivo** (rol Agente de IA) — el informe línea por línea que produce el motor determinista.
4. **Tarifarios** (rol Admin) — el catálogo contra el que se audita cada partida.
5. **Diseño y principios** — la filosofía JIDOKA del producto: detectar temprano, detener solo lo necesario.

## Las reglas del motor (deterministas, sin IA en el camino crítico)

Tarifa fuera de catálogo · partida duplicada · factura duplicada · partida no autorizada · cantidad excesiva · monto que no cuadra · inconsistencia con el siniestro · tope de honorarios · reserva excedida · regla de parada (evidencia faltante ⇒ montos quedan "sin evaluar").

## Arquitectura

Next.js 16 (App Router) · Prisma + SQLite · motor de reglas puro en `src/lib/motor/` · tests con bun (`bun test tests/`): 18 pruebas incluyendo fixtures con resultado esperado por expediente y un doctor que valida el esquema completo.

```
Factura → Reglas deterministas → Hallazgos con evidencia → Revisión humana → Informe
```

## Entregable obligatorio · Herramientas de IA

**[HACKIATHON-HERRAMIENTAS-IA-V5.pdf](docs/hackathon/HACKIATHON-HERRAMIENTAS-IA-V5.pdf)** — declaración de herramientas de IA usadas (Bases §2–3), con dos diagramas del diseño: el núcleo determinista (el motor decide, el LLM solo redacta, con compuerta de validación) y el humano en el circuito (aceptar · pedir evidencia · descartar con motivo).

## Datos

Todos los datos son **sintéticos** (talleres, siniestros, asegurados inventados). La semilla reproducible vive en `db/seed-db.sql` y `scripts/seed.ts`. No se versionan modelos, caches ni secretos.

## Créditos

Equipo AdwenTech — hackIAthon 2026. Construido con agentes (Hermes/GLM) bajo revisión humana de cada cambio.
