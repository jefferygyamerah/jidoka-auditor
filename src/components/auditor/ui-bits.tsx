"use client";

import { cn } from "@/lib/utils";
import { ESTADO_LABEL } from "@/lib/format";
import { AlertTriangle, CheckCircle2, OctagonX, Clock3, Loader2 } from "lucide-react";

// ── Badges de estado andon ────────────────────────────────────
const ESTADO_ESTILO: Record<string, string> = {
  RECIBIDA: "bg-slate-100 text-slate-600 border-slate-200",
  EN_AUDITORIA: "bg-amber-50 text-amber-700 border-amber-200",
  OBSERVADA: "bg-amber-50 text-amber-700 border-amber-300",
  APROBADA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RECHAZADA: "bg-red-50 text-red-700 border-red-200",
};

const ESTADO_ICONO: Record<string, React.ReactNode> = {
  RECIBIDA: <Clock3 className="h-3 w-3" />,
  EN_AUDITORIA: <Loader2 className="h-3 w-3 animate-spin" />,
  OBSERVADA: <AlertTriangle className="h-3 w-3" />,
  APROBADA: <CheckCircle2 className="h-3 w-3" />,
  RECHAZADA: <OctagonX className="h-3 w-3" />,
};

export function EstadoBadge({ estado, className }: { estado: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        ESTADO_ESTILO[estado] ?? "bg-slate-100 text-slate-600 border-slate-200",
        className
      )}
    >
      {ESTADO_ICONO[estado]}
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  );
}

// ── Badges de severidad de hallazgo ──────────────────────────
const SEV_ESTILO: Record<string, string> = {
  BAJA: "bg-slate-100 text-slate-600 border-slate-200",
  MEDIA: "bg-amber-50 text-amber-700 border-amber-200",
  ALTA: "bg-orange-50 text-orange-700 border-orange-300",
  CRITICA: "bg-red-50 text-red-700 border-red-300",
};

export function SeveridadBadge({ severidad, className }: { severidad: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap",
        SEV_ESTILO[severidad] ?? SEV_ESTILO.BAJA,
        className
      )}
    >
      {severidad}
    </span>
  );
}

// ── Punto andon ───────────────────────────────────────────────
export function PuntoAndon({ color, className }: { color: "verde" | "amarillo" | "rojo"; className?: string }) {
  const c = color === "verde" ? "bg-emerald-500" : color === "amarillo" ? "bg-amber-400" : "bg-red-500";
  return <span className={cn("inline-block h-2 w-2 rounded-full", c, className)} />;
}

// ── Barra de riesgo ───────────────────────────────────────────
export function RiesgoBar({ riesgo, className }: { riesgo: number; className?: string }) {
  const color = riesgo >= 50 ? "bg-red-500" : riesgo >= 25 ? "bg-amber-400" : riesgo > 0 ? "bg-yellow-300" : "bg-emerald-500";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, riesgo)}%` }} />
      </div>
      <span className="nums text-[11px] text-muted-foreground">{riesgo}/100</span>
    </div>
  );
}

// ── Tarjeta KPI ───────────────────────────────────────────────
export function KpiCard({
  titulo,
  valor,
  detalle,
  icono,
  tono = "neutral",
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  icono?: React.ReactNode;
  tono?: "neutral" | "positivo" | "alerta" | "peligro";
}) {
  const tonos = {
    neutral: "text-foreground",
    positivo: "text-emerald-600",
    alerta: "text-amber-600",
    peligro: "text-red-600",
  };
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_4px_16px_rgba(16,24,40,0.06)]">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-muted-foreground">{titulo}</p>
        {icono && <span className="text-muted-foreground/70">{icono}</span>}
      </div>
      <p className={cn("nums mt-2 text-[28px] font-semibold leading-none tracking-tight", tonos[tono])}>{valor}</p>
      {detalle && <p className="mt-2 text-xs text-muted-foreground">{detalle}</p>}
    </div>
  );
}

// ── Chip de zona del vehículo ─────────────────────────────────
export function ZonaChip({ zona }: { zona: string }) {
  const labels: Record<string, string> = {
    FRENTE: "Frente",
    TRASERA: "Trasera",
    LATERAL_IZQ: "Lat. izq.",
    LATERAL_DER: "Lat. der.",
    MULTIPLE: "Múltiple",
    VIDRIOS: "Vidrios",
  };
  return (
    <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
      {labels[zona] ?? zona}
    </span>
  );
}

// ── Estado vacío ──────────────────────────────────────────────
export function Vacio({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
        <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{titulo}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{mensaje}</p>
    </div>
  );
}

// ── Esqueleto ─────────────────────────────────────────────────
export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl border border-border/60 bg-card", className)} />;
}

// ── Etiqueta de sección estilo Apple ─────────────────────────
export function TituloSeccion({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-[15px] font-semibold tracking-tight">{children}</h3>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
