# Worklog

---
Task ID: 1
Agent: Super Z (main)
Task: Construir "Auditor Agéntico de Facturación de Siniestros" (JIDOKA) — prototipo web fullstack para hackatón, con principios del Sistema de Producción Toyota y diseño estilo Apple.

Work Log:
- Clarificación con usuario: prototipo web, motor híbrido (reglas + LLM), 4 módulos (cola, dashboard, detalle, carga), multi-rol, estilo corporativo azul marino, USD/Panamá, datos realistas completos, hackatón con TPS + Apple UX.
- Skill fullstack-dev cargado; entorno inicializado (Next.js 16 + Prisma/SQLite + shadcn/ui + z-ai-web-dev-sdk).
- Prisma schema: Taller, TarifarioItem, Siniestro, Factura, Partida, Hallazgo, LogAgente, Revision, Configuracion. `bun run db:push`.
- Motor determinista (src/lib/audit-rules.ts): 9 reglas poka-yoke (R1 precio s/tarifario, R2 partida duplicada, R3 factura duplicada por huella SHA-256, R4 no autorizada, R5 cantidad excesiva, R6 monto no cuadra con ITBMS, R7 inconsistencia con zona del siniestro, R8 tope honorarios, R9 reserva excedida) + score de riesgo 0-100 + decisión jidoka (flujo directo / ajuste / línea detenida).
- Agente híbrido (src/lib/audit-agent.ts): pipeline con bitácora por pasos + informe LLM (z-ai-web-dev-sdk) con resumen, recomendación, causa raíz 5 Whys y acciones kaizen; fallback determinista sin IA; guard JIDOKA_DISABLE_IA para seed.
- Seed (scripts/seed.ts): 6 talleres panameños, 252 partidas de tarifario con varianza pactada, 16 siniestros, 33 facturas (19 limpias, 6 observadas pendientes, 4 rechazadas, revisiones históricas). Falsos positivos de R7/R8 corregidos (detección de zona por regex ordenada, gate de base técnica).
- API: /api/dashboard, /api/facturas (GET/POST con auditoría automática), /api/facturas/[id], .../auditar, .../informe (LLM), .../revision, /api/siniestros, /api/talleres, /api/tarifario (GET/PATCH), /api/configuracion (GET/PATCH), /api/actividad.
- SPA en / (ruta única): shell con selector de 4 roles (Auditor/Agente/Taller/Admin), vistas: Tablero Andon (KPIs muda evitado, Pareto 80/20, tendencia kaizen, top talleres), Cola kanban 5 columnas, Expediente (partidas vs tarifario, hallazgos con evidencia, bitácora, informe IA, decisión humana con monto/comentario, re-auditar), Nueva factura (builder + demo con anomalías + veredicto instantáneo), Centro Jidoka (bandeja + feed en vivo 5s), Siniestros (uso de reserva), Tarifarios editables + parámetros del motor, Filosofía TPS.
- Diseño: azul marino corporativo + Inter, vidrio esmerilado, números tabulares, badges andon, framer-motion, responsive (kanban scroll-x, nav chips móvil, footer sticky).
- Verificación con agent-browser: dashboard, kanban, expediente con informe IA real (3.2s, cifras exactas), aprobación humana con ajuste (USD 392.43), carga de factura con anomalías detectadas en vivo (R1 +28% y R2 duplicado, riesgo 52/100), Centro Jidoka, Admin, Filosofía, móvil 390px. Errores corregidos: ícono SlideRight inexistente, fechaEmision faltante en POST, etiquetas truncadas del Pareto.
- Lint limpio; servidor sano en :3000.

Stage Summary:
- Prototipo completo y verificado en navegador. Stack: Next.js 16, TypeScript, Prisma/SQLite, shadcn/ui, recharts, framer-motion, z-ai-web-dev-sdk (solo backend).
- Decisiones clave: auditoría determinista decide siempre (explicable); el LLM solo redacta el informe sobre hallazgos ya demostrados; huella criptográfica anti-duplicados; seed con 6 casos pendientes para demo en vivo.
- Archivos clave: prisma/schema.prisma, scripts/seed.ts, src/lib/audit-rules.ts, src/lib/audit-agent.ts, src/app/api/**, src/components/auditor/**, src/store/app.ts, src/app/page.tsx.

---
Task ID: 2
Agent: Super Z (main)
Task: Reducir la terminología japonesa en la UI ("too much japanese") — español primero

Work Log:
- Barrido con grep de todos los términos japoneses (Jidoka, Andon, Kanban, Kaizen, Poka-yoke, Muda, Genchi Genbutsu, Heijunka + kanji 自働化/看板/行灯/ポカヨケ/現地現物/改善/無駄/平準化) en src/.
- shell.tsx: nav "Tablero Andon"→"Panel de control", "Centro Jidoka"→"Agente en vivo", "Filosofía TPS"→"Diseño y principios", rol "Agente JIDOKA"→"Agente de IA", footer sin Toyota.
- dashboard.tsx: "Muda evitado"→"Desperdicio evitado", "Flujo directo (jidoka)"→"(automático)", "Tendencia kaizen"→"Tendencia de mejora", "Andon activo"→"Semáforo ámbar".
- jidoka.tsx/detalle.tsx/siniestros.tsx/cola.tsx/nueva-factura.tsx/tarifarios.tsx: eliminados Genchi Genbutsu, poka-yoke, andon, kaizen; "Bitácora JIDOKA"→"Bitácora del agente"; "5 Whys"→"5 porqués".
- filosofia.tsx: reescrita — 8 principios con nombres en español (kanji eliminados), una sola mención de origen Toyota en la intro; pasos del motor en español.
- audit-agent.ts: logs de decisión sin prefijo "JIDOKA·", "9 reglas poka-yoke"→"9 reglas deterministas"; prompt LLM reescrito con instrucción explícita de NO usar términos japoneses ni Toyota en el informe.
- labels.ts/layout.tsx: metadata y roles en español llano.
- Re-seed de la BD (JIDOKA_DISABLE_IA=1) para purgar mensajes antiguos con prefijo japonés. Estados: 22 APROBADA / 6 OBSERVADA / 4 RECHAZADA.
- Verificado en navegador (Panel de control, Diseño y principios, cola, expediente, roles Agente/Taller) y lint completo limpio.

---

## 2026-09-19 · Incidente — demo pública caída en silencio y restauración

- Jeff reportó jidoka.adwentech.com caído sin aviso la noche del 2026-09-19 (post-entrega hackIAthon).
- Diagnóstico: el origen (Next.js standalone en 127.0.0.1:3100) y el túnel Cloudflare nombrado 934a420e corrían como procesos de fondo de una sesión de agente anterior; la rotación/cierre de esa sesión mató ambos procesos sin alerta. Túneles del sistema (aios-cockpit, ceo) intactos — el fallo era solo de la demo.
- Segundo hallazgo: el directorio de lanzamiento documentado (next-service-dist/) ya no existe en este checkout; el build vivo está en .next/standalone/ (assets estáticos y public embebidos, BUILD_ID MVbJguJaQrz7yjE5SbNx5). Primer intento de arranque falló por cd a next-service-dist.
- Corrección: relanzado origen desde .next/standalone con PORT=3100, DATABASE_URL=file:db/custom.db (bun server.js) + túnel cloudflared con deploy/tunnel-config.yml (protocol http2, 4 conexiones registradas).
- Verificación: HTTP 200 público y local, título correcto «JIDOKA · Auditoría Inteligente de Facturación de Siniestros», chunk CSS 200, /api/dashboard 200 con datos (34 facturas), log del túnel con 4 conexiones registradas.
- Pendiente estructural: ambos procesos siguen ligados a la sesión del agente; la caída se repetirá tras reinicio del Pi o rotación de sesión. Recomendación: unidades systemd (jidoka-origin.service + jidoka-tunnel.service) cuando el proyecto estabilice — decisión de Jeff.

Stage Summary:
- La marca "JIDOKA" se conserva solo como nombre del producto (logo, título, footer); todo el copy operativa está en español natural. Cambio de nombre de marca disponible a pedido (1 línea).
- Claves internas de código (vista "andon"/"jidoka", campo andon en API, componente PuntoAndon) se mantienen: no son visibles al usuario.

## 2026-09-16 · Alineación al flujo acordado (#44, dominio autos)
- Informe-only: el agente ya no aprueba/rechaza pagos ni sugiere montos globales; estados de flujo RECIBIDA → EN_AUDITORIA → PARA_REVISION → CERRADA.
- Regla de parada (R10): sin tarifario/evidencia compartida la línea se detiene, montos quedan «sin evaluar» y el informe lo dice de forma visible.
- Revisión por hallazgo: aceptar / pedir evidencia / descartar con motivo (R10 siempre exige comentario); informe se cierra cuando no quedan pendientes.
- Anti-duplicado corregido: repeticiones legítimas con contexto documentado (posición/hora) no se marcan como duplicadas (FAC-2026-0133 en el seed demuestra el caso).
- Cada hallazgo cita evidencia con localizador (línea de factura / código de tarifario / hecho del siniestro).
- UI alineada: kanban de 4 estados, informe del agente línea por línea con montos sin evaluar, banner de parada, dashboard sin KPIs de pago.
- Verificado: tsc limpio, build Next.js OK, 34 facturas sembradas, 4 escenarios acordados probados end-to-end (R1 precio, R2 duplicado real, repetición legítima, R10 parada) + revisión por hallazgo vía API.
