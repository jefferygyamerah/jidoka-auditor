#!/usr/bin/env python3
"""Un-shot: hacer el repo jidoka-auditor publicable.
1) Untrackear .env, db/custom.db, deploy/tunnel-config.yml (dejar en disco).
2) .gitignore: añadir /db/, deploy logs y artefactos locales.
3) Regenerar db/seed-db.sql (dump limpio, datos sintéticos) si no existe.
4) Crear README para jueces + .env.example.
5) Commit. (El push y el flip a público los hace Jeff o el operador con gh.)
"""
import os
import subprocess
import sqlite3

R = '/home/jeffery/Workspace/jidoka-auditor'
os.chdir(R)

def sh(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

# 1) untrack
for f in ['.env', 'db/custom.db', 'deploy/tunnel-config.yml']:
    r = sh('git', 'rm', '--cached', f)
    print(f'untrack {f}:', (r.stdout + r.stderr).strip().splitlines()[-1] if (r.stdout + r.stderr).strip() else 'ok')

# 2) gitignore additions (idempotente)
need = ['/db/', 'deploy/*.log', 'deploy/server.pid', 'deploy/ux-after.png', 'deploy/shot.js', 'dev.log', 'server.log']
gi = open('.gitignore').read()
add = [n for n in need if n not in gi]
if add:
    with open('.gitignore', 'a') as fh:
        fh.write('\n# local runtime & deploy artifacts (AgentKwame)\n' + '\n'.join(add) + '\n')
    print('gitignore +', add)

# 3) dump SQL de la seed (datos 100% sintéticos, reproducible)
con = sqlite3.connect('db/custom.db')
with open('db/seed-db.sql', 'w') as fh:
    for line in con.iterdump():
        fh.write(line + '\n')
con.close()
print('db/seed-db.sql escrito')

# 4) .env.example
example = 'DATABASE_URL=file:./db/custom.db\n'
open('.env.example', 'w').write(example)

# README para jueces (es-MX, directo, 5 minutos)
readme = '''# JIDOKA — Auditoría agéntica de facturación de siniestros

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

## Datos

Todos los datos son **sintéticos** (talleres, siniestros, asegurados inventados). La semilla reproducible vive en `db/seed-db.sql` y `scripts/seed.ts`. No se versionan modelos, caches ni secretos.

## Créditos

Equipo AdwenTech — hackIAthon 2026. Construido con agentes (Hermes/GLM) bajo revisión humana de cada cambio.
'''
open('README.md', 'w').write(readme)
print('README.md escrito')

# 5) commit
r = sh('git', 'add', '-A')
r = sh('git', '-c', 'user.name=AgentKwame', '-c', 'user.email=kwame@adwentech.com',
       'commit', '-m',
       'Publicable: untrack env/db/tunnel, seed SQL, README para jueces, .env.example')
print('commit:', (r.stdout + r.stderr).strip().splitlines()[-1] if (r.stdout + r.stderr).strip() else 'sin cambios')
