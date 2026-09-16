"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { useApi } from "@/hooks/use-api";
import { usd, horaCorta, fechaCorta } from "@/lib/format";
import type { FacturaListaDTO, ActividadDTO } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { EstadoBadge, SeveridadBadge, TituloSeccion, Vacio } from "@/components/auditor/ui-bits";
import { Bot, CircleAlert, Hourglass, ListChecks, Play, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const ETAPA_COLOR: Record<string, string> = {
  RECEPCION: "bg-slate-100 text-slate-600",
  NORMALIZACION: "bg-sky-50 text-sky-700",
  REGLAS: "bg-violet-50 text-violet-700",
  IA: "bg-indigo-50 text-indigo-700",
  DECISION: "bg-amber-50 text-amber-700",
  HUMANO: "bg-emerald-50 text-emerald-700",
};

export function CentroJidoka() {
  const { version, bump, abrirFactura } = useApp();
  const { toast } = useToast();
  const [ejecutando, setEjecutando] = useState<string | null>(null);
  const { data: facturas, refetch } = useApi<FacturaListaDTO[]>("/api/facturas", { refreshKey: version, refetchMs: 8000 });
  const { data: actividad } = useApi<ActividadDTO[]>("/api/actividad", { refreshKey: version, refetchMs: 5000 });

  const pendientes = useMemo(
    () => (facturas ?? []).filter((f) => f.estadoAuditoria === "RECIBIDA" || f.estadoAuditoria === "EN_AUDITORIA"),
    [facturas]
  );
  const observadas = useMemo(() => (facturas ?? []).filter((f) => f.estadoAuditoria === "OBSERVADA"), [facturas]);
  const ejecutadas = useMemo(() => (facturas ?? []).filter((f) => f.estadoAuditoria !== "RECIBIDA" && f.estadoAuditoria !== "EN_AUDITORIA"), [facturas]);

  async function auditar(id: string, numero: string) {
    setEjecutando(id);
    try {
      const res = await fetch(`/api/facturas/${id}/auditar`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      toast({
        title: `${numero}: ${json.hallazgos === 0 ? "sin hallazgos, flujo directo" : `${json.hallazgos} hallazgo(s), andon ${json.estado === "RECHAZADA" ? "rojo" : "amarillo"}`}`,
        description: `Riesgo ${json.riesgo}/100 · discrepancia ${usd(json.montoDiscrepancia)}`,
      });
      bump();
      await refetch();
    } catch (e) {
      toast({ title: "Error en la auditoría", description: (e as Error).message, variant: "destructive" });
    } finally {
      setEjecutando(null);
    }
  }

  async function auditarTodas() {
    for (const f of pendientes) {
      await auditar(f.id, f.numero);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centro Jidoka</h1>
          <p className="text-sm text-muted-foreground">
            Consola del agente auditor: normaliza, compara contra el tarifario y detiene la línea solo ante anomalías.
          </p>
        </div>
        {pendientes.length > 0 && (
          <Button className="rounded-full" onClick={auditarTodas} disabled={ejecutando !== null}>
            <Zap className="mr-1.5 h-4 w-4" /> Auditar las {pendientes.length} pendientes
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Bandeja de entrada del agente */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="rounded-2xl p-5">
            <TituloSeccion sub="Facturas en espera del pipeline del agente">
              Bandeja de entrada ({pendientes.length})
            </TituloSeccion>
            {pendientes.length === 0 ? (
              <Vacio titulo="Bandeja limpia" mensaje="No hay facturas pendientes de auditoría. Cuando un taller registre una, entrará aquí automáticamente." />
            ) : (
              <div className="space-y-2.5">
                {pendientes.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 p-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      <Hourglass className="h-4 w-4 text-primary" />
                    </span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => abrirFactura(f.id)}>
                      <p className="nums text-[13px] font-semibold">{f.numero} · {usd(f.montoTotal)}</p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {f.taller.nombre} · {f.siniestro.numero} · {f.siniestro.vehiculo}
                      </p>
                    </button>
                    <EstadoBadge estado={f.estadoAuditoria} />
                    <Button size="sm" className="h-8 rounded-full" onClick={() => auditar(f.id, f.numero)} disabled={ejecutando !== null}>
                      {ejecutando === f.id ? (
                        <>
                          <Play className="mr-1.5 h-3.5 w-3.5 animate-pulse" /> Ejecutando…
                        </>
                      ) : (
                        <>
                          <Play className="mr-1.5 h-3.5 w-3.5" /> Auditar
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="rounded-2xl p-5">
            <TituloSeccion sub={`${ejecutadas.length} expedientes decididos por el pipeline`}>Últimos resultados del agente</TituloSeccion>
            <div className="fino max-h-96 space-y-2 overflow-y-auto pr-1">
              {ejecutadas.slice(0, 12).map((f) => (
                <button key={f.id} className="flex w-full items-center gap-3 rounded-xl border border-border/50 px-3.5 py-2.5 text-left hover:bg-accent/60" onClick={() => abrirFactura(f.id)}>
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", f.estadoAuditoria === "APROBADA" ? "bg-emerald-500" : f.estadoAuditoria === "RECHAZADA" ? "bg-red-500" : "bg-amber-400")} />
                  <span className="nums min-w-0 flex-1 truncate text-[12.5px] font-medium">{f.numero}</span>
                  <span className="hidden truncate text-[11.5px] text-muted-foreground sm:block">{f.taller.nombre}</span>
                  <span className="nums text-[12px] text-muted-foreground">{usd(f.montoTotal)}</span>
                  {f.hallazgosCount > 0 ? (
                    <span className="nums flex items-center gap-1 text-[11.5px] font-semibold text-amber-700">
                      <CircleAlert className="h-3 w-3" />
                      {f.hallazgosCount}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-emerald-600">limpia</span>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Actividad en vivo */}
        <div className="lg:col-span-2">
          <Card className="sticky top-20 rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <TituloSeccion sub="Bitácora global con actualización en vivo">Actividad del agente</TituloSeccion>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                en vivo
              </span>
            </div>
            <div className="fino max-h-[70vh] space-y-2.5 overflow-y-auto pr-1">
              {(actividad ?? []).map((a) => (
                <button key={a.id} className="block w-full rounded-xl border border-border/50 p-3 text-left hover:bg-accent/60" onClick={() => abrirFactura(a.facturaId)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", ETAPA_COLOR[a.etapa] ?? "bg-secondary")}>
                      {a.etapa}
                    </span>
                    <span className="nums text-[10.5px] text-muted-foreground">{fechaCorta(a.creadoEn)} {horaCorta(a.creadoEn)}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{a.mensaje}</p>
                  <p className="nums mt-1 text-[10.5px] font-medium text-primary">{a.facturaNumero}</p>
                </button>
              ))}
              {!actividad?.length && <p className="text-[12px] text-muted-foreground">Sin actividad todavía.</p>}
            </div>
          </Card>
        </div>
      </div>

      {/* Observadas esperando humano */}
      {observadas.length > 0 && (
        <Card className="rounded-2xl p-5">
          <TituloSeccion sub="Jidoka con juicio humano: el agente detuvo, el auditor decide">Andon amarillo — esperando decisión humana ({observadas.length})</TituloSeccion>
          <div className="grid gap-2.5 md:grid-cols-2">
            {observadas.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3.5">
                <ListChecks className="h-4 w-4 shrink-0 text-amber-600" />
                <button className="min-w-0 flex-1 text-left" onClick={() => abrirFactura(f.id)}>
                  <p className="nums text-[12.5px] font-semibold">{f.numero} · {usd(f.montoTotal)}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{f.taller.nombre} · {f.siniestro.numero}</p>
                </button>
                <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="nums text-[11.5px] font-medium text-amber-700">riesgo {f.riesgo}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
