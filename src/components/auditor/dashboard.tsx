"use client";

import { useState } from "react";
import { useApp } from "@/store/app";
import { useApi } from "@/hooks/use-api";
import { usd, usdK } from "@/lib/format";
import type { DashboardDTO } from "@/lib/types";
import { KpiCard, SkeletonCard, TituloSeccion, PuntoAndon } from "@/components/auditor/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, TrendingDown, AlertTriangle, ShieldCheck, OctagonX, ListChecks, ArrowRight, BarChart3, Gauge } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ETIQUETA_CORTA: Record<string, string> = {
  "Precio fuera de tarifario": "Precio s/ tarifario",
  "Partida duplicada": "Partida duplicada",
  "Factura duplicada": "Factura duplicada",
  "Partida no autorizada": "No autorizada",
  "Cantidad excesiva": "Cantidad excesiva",
  "Monto no cuadra": "Monto no cuadra",
  "Inconsistente con el siniestro": "No coincide con siniestro",
  "Tope de honorarios excedido": "Tope de honorarios",
  "Reserva excedida": "Reserva excedida",
};

const NAVY = "oklch(0.32 0.068 255)";
const VERDE = "oklch(0.55 0.125 152)";
const AMBAR = "oklch(0.68 0.14 70)";
const ROJO = "oklch(0.55 0.19 27)";

export function Dashboard() {
  const { data, cargando } = useApi<DashboardDTO>("/api/dashboard", { refetchMs: 30000 });
  const { irA } = useApp();
  const [pestana, setPestana] = useState<"resumen" | "analisis">("resumen");

  if (cargando || !data) {
    return (
      <div className="space-y-4">
        <SkeletonCard className="h-24" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard className="h-72 lg:col-span-2" />
          <SkeletonCard className="h-72" />
        </div>
      </div>
    );
  }

  const pareto = data.pareto.slice(0, 6);
  const totalHallazgos = pareto.reduce((a, p) => a + p.cantidad, 0);
  const paretoAcum = pareto.reduce<{ tipo: string; cantidad: number; monto: number; acumulado: number }[]>((acc, p) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].acumulado : 0;
    acc.push({ ...p, tipo: ETIQUETA_CORTA[p.tipo] ?? p.tipo, acumulado: totalHallazgos ? Math.round(((prev + p.cantidad) / totalHallazgos) * 100) : 0 });
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      {/* Encabezado: corto y en lenguaje humano */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Panel de control</h1>
        <p className="text-sm text-muted-foreground">
          Resumen de hoy · {data.totalFacturas} facturas revisadas por el agente
        </p>
      </div>

      {/* HERO — una sola decisión: qué hacer ahora */}
      {data.andon.amarillo > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-card p-6">
          <div className="min-w-0">
            <p className="nums text-3xl font-semibold tracking-tight text-amber-700">
              {data.andon.amarillo} {data.andon.amarillo === 1 ? "factura espera" : "facturas esperan"} tu revisión
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              El agente ya preparó cada una: verás el hallazgo y su evidencia lado a lado.
            </p>
          </div>
          <Button size="lg" className="rounded-full px-6" onClick={() => irA("cola")}>
            Revisar ahora <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-card p-6">
          <div className="min-w-0">
            <p className="nums text-3xl font-semibold tracking-tight text-emerald-700">Todo al día</p>
            <p className="mt-1 text-sm text-muted-foreground">No hay facturas esperando revisión humana.</p>
          </div>
          <Button size="lg" variant="outline" className="rounded-full px-6" onClick={() => irA("cola")}>
            Ver todas las facturas <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      )}

      {/* Semáforo Andon — el estado del flujo en 3 números */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 rounded-2xl border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-card p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </span>
          <div className="min-w-0">
            <p className="nums text-2xl font-semibold tracking-tight text-emerald-700">{data.andon.verde}</p>
            <p className="truncate text-xs text-muted-foreground">Fluyen solas hacia el pago</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 rounded-2xl border-amber-100 bg-gradient-to-br from-amber-50/80 to-card p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </span>
          <div className="min-w-0">
            <p className="nums text-2xl font-semibold tracking-tight text-amber-700">{data.andon.amarillo}</p>
            <p className="truncate text-xs text-muted-foreground">Necesitan una persona</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 rounded-2xl border-red-100 bg-gradient-to-br from-red-50/80 to-card p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100">
            <OctagonX className="h-5 w-5 text-red-600" />
          </span>
          <div className="min-w-0">
            <p className="nums text-2xl font-semibold tracking-tight text-red-700">{data.andon.rojo}</p>
            <p className="truncate text-xs text-muted-foreground">Detenidas: falta un soporte</p>
          </div>
        </Card>
      </div>

      {/* KPIs — tres números, lenguaje plano */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          titulo="Monto en disputa"
          valor={usdK(data.montoDiscrepancia)}
          detalle="Total señalado por el agente en las facturas"
          icono={<TrendingDown className="h-4 w-4" />}
          tono="alerta"
        />
        <KpiCard
          titulo="Fluye sin tocar a nadie"
          valor={`${data.pctSinHallazgos}%`}
          detalle={`${data.facturasLimpias} de ${data.totalFacturas} facturas van directas al pago`}
          icono={<Bot className="h-4 w-4" />}
        />
        <KpiCard
          titulo="Hallazgos ya revisados"
          valor={`${data.hallazgosResueltos}/${data.hallazgosTotales}`}
          detalle="Cerrados por un auditor humano"
          icono={<ListChecks className="h-4 w-4" />}
        />
      </div>

      {/* Pestañas: Resumen para empezar, Análisis para profundizar */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-border/70 bg-secondary/60 p-0.5">
          {([
            { id: "resumen" as const, label: "Resumen", icon: <Gauge className="h-3.5 w-3.5" /> },
            { id: "analisis" as const, label: "Análisis", icon: <BarChart3 className="h-3.5 w-3.5" /> },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setPestana(t.id)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                pestana === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {pestana === "resumen" ? (
        <Card className="rounded-2xl p-5">
          <TituloSeccion sub="Dónde empezar a conversar — discrepancia por taller">Talleres con más observaciones</TituloSeccion>
          <div className="space-y-3.5">
            {data.topTalleres.length === 0 && <p className="text-sm text-muted-foreground">Sin observaciones registradas.</p>}
            {data.topTalleres.map((t) => {
              const max = data.topTalleres[0]?.monto || 1;
              return (
                <div key={t.nombre}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <p className="truncate text-[13px] font-medium">{t.nombre}</p>
                    <p className="nums shrink-0 text-[13px] font-semibold">{usdK(t.monto)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(6, (t.monto / max) * 100)}%`, background: t.monto === max ? ROJO : AMBAR }}
                      />
                    </div>
                    <span className="nums w-20 shrink-0 text-right text-[11px] text-muted-foreground">
                      {t.hallazgos} hallazgos
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="rounded-2xl p-5">
            <TituloSeccion sub="Los problemas más frecuentes primero">¿Qué se repite más?</TituloSeccion>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoAcum} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.008 250)" vertical={false} />
                  <XAxis dataKey="tipo" tick={{ fontSize: 10 }} interval={0} height={54} angle={-18} textAnchor="end" tickLine={false} axisLine={false} width={120} />
                  <YAxis yAxisId="izq" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="der" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
                  <Tooltip
                    formatter={(v: number, nombre) => (nombre === "Hallazgos" ? [v, "Hallazgos"] : [`${v}%`, "Acumulado"])}
                    contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.008 250)", fontSize: 12 }}
                  />
                  <Bar yAxisId="izq" dataKey="cantidad" name="Hallazgos" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {paretoAcum.map((_, i) => (
                      <Cell key={i} fill={NAVY} fillOpacity={1 - i * 0.12} />
                    ))}
                  </Bar>
                  <Line yAxisId="der" type="monotone" dataKey="acumulado" stroke={AMBAR} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-2xl p-5">
            <TituloSeccion sub="Facturas revisadas y monto con discrepancia por semana">¿Mejoramos con el tiempo?</TituloSeccion>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.tendencia} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.008 250)" vertical={false} />
                  <XAxis dataKey="semana" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="izq" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis yAxisId="der" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.91 0.008 250)", fontSize: 12 }}
                    formatter={(v: number, nombre) => (nombre === "Monto en disputa" ? [usd(v), "Monto señalado"] : [v, nombre as string])}
                  />
                  <Bar yAxisId="izq" dataKey="facturas" name="Facturas revisadas" fill={NAVY} fillOpacity={0.85} radius={[6, 6, 0, 0]} maxBarSize={30} />
                  <Bar yAxisId="izq" dataKey="conHallazgo" name="Con hallazgo" fill={AMBAR} radius={[6, 6, 0, 0]} maxBarSize={30} />
                  <Line yAxisId="der" type="monotone" dataKey="monto" name="Monto señalado" stroke={VERDE} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
