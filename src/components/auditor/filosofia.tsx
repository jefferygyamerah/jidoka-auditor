"use client";

import { Card } from "@/components/ui/card";
import { TituloSeccion } from "@/components/auditor/ui-bits";
import {
  BellRing,
  Bot,
  Columns3,
  HandHeart,
  KanbanSquare,
  Lightbulb,
  ListChecks,
  Minimize2,
  MoveRight,
  SearchCheck,
  ShieldCheck,
  Timer,
  TrendingUp,
} from "lucide-react";

const PRINCIPIOS = [
  {
    icono: <Bot className="h-4.5 w-4.5" />,
    nombre: "Automatización con criterio",
    lema: "La máquina puede detener la línea cuando algo falla",
    cuerpo:
      "El agente audita 100% de las facturas al instante — algo humanamente imposible — y solo escala lo que presenta anomalía real. Las facturas limpas fluyen sin fricción: la mayoría del volumen nunca toca a un humano.",
    donde: "Motor híbrido · estados de la cola · bitácora de decisiones",
  },
  {
    icono: <Columns3 className="h-4.5 w-4.5" />,
    nombre: "Flujo visual del trabajo",
    lema: "El trabajo avanza por estados visibles, empujado por demanda",
    cuerpo:
      "Cada factura avanza por el tablero: Recibida → Auditando → Para revisión → Cerrada. El tablero limita el trabajo en proceso del revisor humano y hace visible el cuello de botella en tiempo real.",
    donde: "Cola de auditoría (tablero por estados)",
  },
  {
    icono: <BellRing className="h-4.5 w-4.5" />,
    nombre: "Semáforo de alertas",
    lema: "Cualquier persona ve el estado del sistema de un vistazo",
    cuerpo:
      "Verde (flujo limpio), ámbar (espera revisión humana), rojo (regla de parada: montos sin evaluar por evidencia faltante). El panel agrega el estado del sistema y el color viaja con cada tarjeta hasta el expediente.",
    donde: "Panel de control · badges de color en tarjetas",
  },
  {
    icono: <ShieldCheck className="h-4.5 w-4.5" />,
    nombre: "A prueba de errores",
    lema: "El error no pasa a la siguiente estación",
    cuerpo:
      "Reglas deterministas comparan cada partida contra el tarifario pactado, detectan duplicados por huella criptográfica (respetando repeticiones legítimas con contexto documentado), validan topes de honorarios, cuadran totales con ITBMS y cruzan partidas contra la zona dañada del siniestro. Cero interpretación: el estándar es objetivo.",
    donde: "Motor de reglas · evidencia técnica en cada hallazgo",
  },
  {
    icono: <SearchCheck className="h-4.5 w-4.5" />,
    nombre: "Juicio desde el dato primario",
    lema: "Verificar en el lugar de los hechos, no de memoria",
    cuerpo:
      "El agente y el revisor juzgan desde el dato primario: la partida cobrada contra el precio pactado, el daño reportado contra el repuesto facturado. Cada hallazgo cita su evidencia (factura, tarifario, siniestro) con localizador verificable.",
    donde: "Detalle de factura · evidencia citada · bitácora",
  },
  {
    icono: <HandHeart className="h-4.5 w-4.5" />,
    nombre: "Mejora continua",
    lema: "Cada anomalía alimenta la prevención",
    cuerpo:
      "El informe del agente señala cada discrepancia con su evidencia; el auditor acepta, pide evidencia o descarta con motivo, y ese aprendizaje queda en la bitácora. El Pareto muestra dónde invertir en prevención por taller.",
    donde: "Informe del agente · Pareto 80/20 · top talleres",
  },
  {
    icono: <Timer className="h-4.5 w-4.5" />,
    nombre: "Eliminación de desperdicio",
    lema: "El mayor desperdicio: revisar a mano lo que ya cumple",
    cuerpo:
      "El KPI central es el flujo directo: facturas conformes que nunca tocan a un humano. La revisión manual se reserva para su único valor real: juzgar la excepción con criterio — nunca emitir veredictos de pago, que quedan en la aseguradora.",
    donde: "KPIs de flujo directo y revisión",
  },
  {
    icono: <KanbanSquare className="h-4.5 w-4.5" />,
    nombre: "Carga de trabajo nivelada",
    lema: "El revisor nunca enfrenta una cola inmanejable",
    cuerpo:
      "El agente absorbe los picos de facturación (fin de mes del taller) y entrega al humano una cola priorizada por riesgo — no por orden de llegada. La bandeja siempre es manejable.",
    donde: "Score de riesgo · orden de la cola",
  },
];

const APPLE = [
  {
    icono: <Minimize2 className="h-4.5 w-4.5" />,
    titulo: "Claridad antes que decoración",
    cuerpo: "Tipografía Inter con jerarquía estricta, números tabulares para montos y un solo acento de color semántico (verde/ámbar/rojo). La densidad de datos es alta, el ruido visual bajo.",
  },
  {
    icono: <MoveRight className="h-4.5 w-4.5" />,
    titulo: "Deferencia al contenido",
    cuerpo: "El contenido — la evidencia de la auditoría — es el protagonista. Chrome mínimo: vidrio esmerilado sutil, bordes de 1px, sombras de 2% de opacidad.",
  },
  {
    icono: <Lightbulb className="h-4.5 w-4.5" />,
    titulo: "Progresión por capas",
    cuerpo: "Primero el veredicto, luego el hallazgo, al final la evidencia técnica. El detalle se despliega solo cuando el usuario lo pide — sin pantallas anidadas.",
  },
];

export function Filosofia() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Diseño y principios</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Cada decisión de producto aplica un principio de manufactura de clase mundial — inspirado en el método de producción
          Toyota — al proceso de auditoría de facturación de siniestros, y la interfaz sigue los principios de diseño de Apple.
        </p>
      </div>

      <div className="rounded-2xl border border-[oklch(0.32_0.068_255)]/20 bg-gradient-to-br from-[oklch(0.32_0.068_255)] to-[oklch(0.42_0.08_258)] p-6 text-white sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Tesis del proyecto</p>
        <p className="mt-2 max-w-3xl text-lg font-medium leading-relaxed sm:text-xl">
          «En una aseguradora, la oficina de pagos es una línea de producción: su defecto es el cobro indebido y su desperdicio es
          la revisión manual de lo que ya cumple. JIDOKA lleva ese enfoque a la línea: automatizar con juicio, hacer visible
          la anomalía y reservar al humano para lo único humano — decidir.»
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[12px] font-medium">
          {["Agente 100% de cobertura", "Humano solo en excepciones", "Tarifario como estándar vivo", "Trazabilidad total"].map((t) => (
            <span key={t} className="rounded-full bg-white/12 px-3 py-1">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div>
        <TituloSeccion sub="Cada principio, mapeado a la funcionalidad que lo encarna">Principios de ingeniería aplicados</TituloSeccion>
        <div className="grid gap-4 md:grid-cols-2">
          {PRINCIPIOS.map((p) => (
            <Card key={p.nombre} className="rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">{p.icono}</span>
                <div>
                  <p className="text-[14px] font-semibold tracking-tight">{p.nombre}</p>
                  <p className="text-[11.5px] text-muted-foreground">{p.lema}</p>
                </div>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">{p.cuerpo}</p>
              <p className="mt-3 border-t border-border/50 pt-2.5 text-[11px] font-medium text-primary/80">→ {p.donde}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <TituloSeccion sub="Cómo se tradujo el marco en la interfaz">Principios de diseño Apple</TituloSeccion>
        <div className="grid gap-4 md:grid-cols-3">
          {APPLE.map((a) => (
            <Card key={a.titulo} className="rounded-2xl p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">{a.icono}</span>
              <p className="mt-3 text-[14px] font-semibold tracking-tight">{a.titulo}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{a.cuerpo}</p>
            </Card>
          ))}
        </div>
      </div>

      <Card className="rounded-2xl p-5">
        <TituloSeccion sub="Del papel a la operación">Arquitectura del motor híbrido</TituloSeccion>
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { n: "1", t: "Recepción y normalización", d: "Partidas, totales y huella criptográfica anti-duplicados." },
            { n: "2", t: "Reglas poka-yoke", d: "Comparación determinista contra tarifario, siniestro y topes pactados." },
            { n: "3", t: "Regla de parada", d: "Si falta evidencia compartida, detiene la línea: montos «sin evaluar»." },
            { n: "4", t: "Informe del agente (LLM)", d: "Informe línea por línea con evidencia citada para el revisor humano." },
          ].map((paso) => (
            <div key={paso.n} className="rounded-xl border border-border/60 p-4">
              <span className="nums flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {paso.n}
              </span>
              <p className="mt-2.5 text-[13px] font-semibold">{paso.t}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{paso.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5" />
          Las reglas corren en milisegundos y son auditables; el LLM solo redacta lo que ya está demostrado — nunca decide solo.
          <TrendingUp className="ml-auto h-3.5 w-3.5" />
        </div>
      </Card>
    </div>
  );
}
