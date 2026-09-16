"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/store/app";
import { useApi } from "@/hooks/use-api";
import { usd, fechaCompleta, horaCorta, ZONA_LABEL } from "@/lib/format";
import { ACCION_LABEL, ROL_LABEL } from "@/lib/labels";
import type { FacturaDetalleDTO } from "@/lib/types";
import { EstadoBadge, SeveridadBadge, TituloSeccion } from "@/components/auditor/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Copy,
  Fingerprint,
  Hourglass,
  ListChecks,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ETAPA_ICONO: Record<string, React.ReactNode> = {
  RECEPCION: <Hourglass className="h-3.5 w-3.5" />,
  NORMALIZACION: <Fingerprint className="h-3.5 w-3.5" />,
  REGLAS: <ListChecks className="h-3.5 w-3.5" />,
  IA: <Brain className="h-3.5 w-3.5" />,
  DECISION: <ShieldAlert className="h-3.5 w-3.5" />,
  HUMANO: <CheckCircle2 className="h-3.5 w-3.5" />,
};

export function DetalleFactura() {
  const { facturaId, volverDeFactura, rol, bump } = useApp();
  const { data, cargando, refetch } = useApi<FacturaDetalleDTO>(facturaId ? `/api/facturas/${facturaId}` : null, { refreshKey: 1 });
  const { toast } = useToast();

  const [informeEstado, setInformeEstado] = useState<"reposo" | "cargando" | "error">("reposo");
  const [detalleAbierto, setDetalleAbierto] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const [monto, setMonto] = useState<string>("");
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);
  const [reauditando, setReauditando] = useState(false);

  async function reauditar() {
    if (!facturaId) return;
    setReauditando(true);
    try {
      await fetch(`/api/facturas/${facturaId}/auditar`, { method: "POST" });
      toast({ title: "Pipeline re-ejecutado", description: "El agente volvió a correr las 9 reglas y regeneró su decisión." });
      bump();
      await refetch();
    } catch {
      toast({ title: "No se pudo re-auditar", variant: "destructive" });
    } finally {
      setReauditando(false);
    }
  }

  const puedeDecidir = (rol === "AUDITOR" || rol === "ADMIN") && (data?.estadoAuditoria === "OBSERVADA" || data?.estadoAuditoria === "RECHAZADA");

  useEffect(() => {
    if (data) {
      setMonto(String((data.montoSugerido ?? data.montoTotal).toFixed(2)));
      setComentario("");
      setDetalleAbierto(null);
    }
  }, [data?.id]);

  // El informe IA se genera en cuanto se abre el expediente (si aún no existe)
  const generarInforme = useCallback(
    async (regenerar = false) => {
      if (!facturaId) return;
      setInformeEstado("cargando");
      try {
        const res = await fetch(`/api/facturas/${facturaId}/informe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regenerar }),
        });
        if (!res.ok) throw new Error();
        await refetch();
        setInformeEstado("reposo");
      } catch {
        setInformeEstado("error");
      }
    },
    [facturaId, refetch]
  );

  useEffect(() => {
    if (data && !data.informeIA) void generarInforme(false);
  }, [data?.id, data?.informeIA, generarInforme]);

  async function decidir(accion: "APROBAR" | "RECHAZAR" | "ESCALAR") {
    if (!facturaId) return;
    setAccionEnCurso(accion);
    try {
      const res = await fetch(`/api/facturas/${facturaId}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditor: rol === "ADMIN" ? "Administrador" : "Marisol Ortega",
          rol: rol === "ADMIN" ? "ADMIN" : "AUDITOR",
          accion,
          comentario,
          montoAprobado: accion === "APROBAR" ? Number(monto) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      toast({
        title: accion === "APROBAR" ? "Factura aprobada" : accion === "RECHAZAR" ? "Factura rechazada" : "Escalada a supervisor",
        description: accion === "APROBAR" ? `Monto aprobado: ${usd(Number(monto))}` : comentario || "Decisión registrada en la bitácora.",
      });
      bump();
      await refetch();
    } catch (e) {
      toast({ title: "No se pudo registrar la decisión", description: (e as Error).message, variant: "destructive" });
    } finally {
      setAccionEnCurso(null);
    }
  }

  if (cargando || !data) {
    return <div className="animate-pulse rounded-2xl border border-border/60 bg-card h-[70vh]" />;
  }

  const f = data;
  const subtotal = f.partidas.reduce((a, p) => a + p.subtotal, 0);
  const esperado = Math.round(subtotal * (1 + f.itbmsPct / 100) * 100) / 100;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" className="mt-0.5 h-8 w-8 rounded-full" onClick={volverDeFactura}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="nums text-xl font-semibold tracking-tight">{f.numero}</h1>
              <EstadoBadge estado={f.estadoAuditoria} />
              {f.severidadMaxima && <SeveridadBadge severidad={f.severidadMaxima} />}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {f.taller.nombre} · {f.taller.ciudad} · Siniestro {f.siniestro.numero} · {ZONA_LABEL[f.siniestro.zonaDanio]}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="nums text-2xl font-semibold tracking-tight">{usd(f.montoTotal)}</p>
          {f.montoSugerido != null && f.montoSugerido < f.montoTotal && (
            <p className="nums text-[13px] font-medium text-emerald-600">Aprobado por {usd(f.montoSugerido)}</p>
          )}
          {f.montoDiscrepancia > 0 && (
            <p className="nums text-[12px] text-amber-700">Discrepancia detectada: {usd(f.montoDiscrepancia)}</p>
          )}
          {rol !== "TALLER" && (
            <Button variant="outline" size="sm" className="mt-2 h-7 rounded-full text-[11.5px]" onClick={reauditar} disabled={reauditando}>
              <RotateCcw className={cn("mr-1 h-3 w-3", reauditando && "animate-spin")} />
              Re-auditar con el agente
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Columna izquierda */}
        <div className="space-y-4 lg:col-span-3">
          {/* Contexto del siniestro (Genchi Genbutsu: ir al lugar) */}
          <Card className="rounded-2xl p-5">
            <TituloSeccion sub="Contexto reportado — el agente juzga cada partida contra este hecho real">Siniestro {f.siniestro.numero}</TituloSeccion>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
              <Dato etiqueta="Asegurado" valor={f.siniestro.asegurado} />
              <Dato etiqueta="Vehículo" valor={`${f.siniestro.vehiculo} ${f.siniestro.placa}`} />
              <Dato etiqueta="Zona dañada" valor={ZONA_LABEL[f.siniestro.zonaDanio]} />
              <Dato etiqueta="Reserva" valor={usd(f.siniestro.montoReserva)} />
            </div>
            <p className="mt-3 rounded-xl bg-secondary/70 px-3 py-2 text-[12.5px] leading-relaxed text-secondary-foreground">
              {f.siniestro.descripcion}
            </p>
          </Card>

          {/* Partidas vs tarifario */}
          <Card className="overflow-hidden rounded-2xl">
            <div className="p-5 pb-3">
              <TituloSeccion sub="Cada partida cobrada contra el precio pactado en convenio — poka-yoke contra el tarifario">
                Partidas facturadas vs tarifario
              </TituloSeccion>
            </div>
            <div className="fino overflow-x-auto">
              <table className="w-full min-w-[640px] text-[12.5px]">
                <thead>
                  <tr className="border-y border-border/60 bg-secondary/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Partida</th>
                    <th className="px-2 py-2 text-right font-medium">Cant.</th>
                    <th className="px-2 py-2 text-right font-medium">Cobrado</th>
                    <th className="px-2 py-2 text-right font-medium">Pactado</th>
                    <th className="px-4 py-2 text-right font-medium">Desvío</th>
                  </tr>
                </thead>
                <tbody>
                  {f.partidas.map((p) => {
                    const desvio = p.desvioPct;
                    const fuera = desvio != null && desvio > 2;
                    return (
                      <tr
                        key={p.id}
                        className={cn(
                          "border-b border-border/40",
                          p.duplicada ? "bg-red-50/60" : p.alerta ? "bg-amber-50/50" : ""
                        )}
                      >
                        <td className="px-4 py-2.5">
                          <p className={cn("font-medium leading-tight", p.duplicada && "text-red-700")}>
                            {p.descripcion}
                            {p.duplicada && (
                              <span className="ml-2 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">DUPLICADA</span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {p.codigo} · {p.categoria.replace("_", " ").toLowerCase()}
                          </p>
                        </td>
                        <td className="nums px-2 py-2.5 text-right">
                          {p.cantidad} {p.unidad}
                        </td>
                        <td className="nums px-2 py-2.5 text-right font-medium">{usd(p.precioUnitario)}</td>
                        <td className="nums px-2 py-2.5 text-right text-muted-foreground">
                          {p.precioPactado != null ? usd(p.precioPactado) : "—"}
                        </td>
                        <td className="nums px-4 py-2.5 text-right">
                          {desvio != null && Math.abs(desvio) > 0.5 ? (
                            <span className={cn("font-semibold", fuera ? (desvio > 25 ? "text-red-600" : "text-amber-600") : "text-emerald-600")}>
                              {desvio > 0 ? "+" : ""}
                              {desvio}%
                            </span>
                          ) : (
                            <span className="text-emerald-600">✓</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/40 text-[12px]">
                    <td className="px-4 py-2 text-muted-foreground" colSpan={3}>
                      Subtotal
                    </td>
                    <td className="nums px-2 py-2 text-right font-medium" colSpan={2}>
                      {usd(subtotal)}
                    </td>
                  </tr>
                  <tr className="bg-secondary/40 text-[12px]">
                    <td className="px-4 py-1.5 text-muted-foreground" colSpan={3}>
                      ITBMS {f.itbmsPct}%
                    </td>
                    <td className="nums px-2 py-1.5 text-right font-medium" colSpan={2}>
                      {usd(esperado - subtotal)}
                    </td>
                  </tr>
                  <tr className="text-[13px]">
                    <td className="px-4 py-2.5 font-semibold" colSpan={3}>
                      Total declarado
                    </td>
                    <td className="nums px-2 py-2.5 text-right font-semibold" colSpan={2}>
                      {usd(f.montoTotal)}
                      {Math.abs(esperado - f.montoTotal) > 0.5 && (
                        <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          no cuadra (esperado {usd(esperado)})
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Hallazgos */}
          <Card className="rounded-2xl p-5">
            <TituloSeccion sub={`Motor determinista: 9 reglas poka-yoke · riesgo ${f.riesgo}/100`}>
              Hallazgos del agente ({f.hallazgos.length})
            </TituloSeccion>
            {f.hallazgos.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-[13px] text-emerald-800">
                  Sin hallazgos: todas las partidas cumplen el tarifario, no hay duplicados ni inconsistencias con el siniestro. Flujo directo aprobado.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {f.hallazgos.map((h) => (
                  <div key={h.id} className="rounded-xl border border-border/60 bg-card p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeveridadBadge severidad={h.severidad} />
                      <p className="text-[13px] font-semibold">{h.tipo}</p>
                      <span className="nums rounded-md bg-secondary px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">{h.regla}</span>
                      {h.montoDiscrepancia > 0 && (
                        <span className="nums ml-auto text-[13px] font-semibold text-amber-700">{usd(h.montoDiscrepancia)}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{h.descripcion}</p>
                    {h.detalle && Object.keys(h.detalle).length > 0 && (
                      <div className="mt-2">
                        <button
                          className="flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline"
                          onClick={() => setDetalleAbierto(detalleAbierto === h.id ? null : h.id)}
                        >
                          Evidencia técnica (Genchi Genbutsu)
                          {detalleAbierto === h.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        {detalleAbierto === h.id && (
                          <pre className="nums mt-2 overflow-x-auto rounded-lg bg-secondary/70 p-3 text-[11px] leading-relaxed">
                            {JSON.stringify(h.detalle, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4 lg:col-span-2">
          {/* Informe IA */}
          <Card className="overflow-hidden rounded-2xl border-[oklch(0.32_0.068_255)]/25">
            <div className="flex items-center justify-between bg-[oklch(0.32_0.068_255)] px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <p className="text-[13px] font-semibold">Informe del agente (IA)</p>
              </div>
              {f.informeIA && (
                <button
                  className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium hover:bg-white/25"
                  onClick={() => generarInforme(true)}
                  disabled={informeEstado === "cargando"}
                >
                  <RefreshCw className={cn("h-3 w-3", informeEstado === "cargando" && "animate-spin")} />
                  Regenerar
                </button>
              )}
            </div>
            <div className="p-5">
              {f.informeIA ? (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        f.informeIA.recomendacion === "APROBAR" && "bg-emerald-50 text-emerald-700",
                        f.informeIA.recomendacion === "APROBAR_CON_AJUSTE" && "bg-emerald-50 text-emerald-700",
                        f.informeIA.recomendacion === "ESCALAR" && "bg-amber-50 text-amber-700",
                        f.informeIA.recomendacion === "RECHAZAR" && "bg-red-50 text-red-700"
                      )}
                    >
                      {ACCION_LABEL[f.informeIA.recomendacion]}
                    </span>
                    <span className="nums text-[11px] text-muted-foreground">Confianza {f.informeIA.confianza}%</span>
                  </div>
                  <p className="text-[13px] leading-relaxed">{f.informeIA.resumen}</p>
                  <div className="rounded-xl bg-secondary/60 p-3.5">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <CircleAlert className="h-3 w-3" /> Causa raíz (5 Whys)
                    </p>
                    <p className="text-[12.5px] leading-relaxed text-secondary-foreground">{f.informeIA.causaRaiz}</p>
                  </div>
                  {f.informeIA.acciones.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kaizen — acciones sugeridas</p>
                      <ul className="space-y-1.5">
                        {f.informeIA.acciones.map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed">
                            <span className="nums mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9.5px] font-bold text-primary">
                              {i + 1}
                            </span>
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : informeEstado === "error" ? (
                <div className="text-center">
                  <p className="text-[13px] text-muted-foreground">El agente no pudo redactar el informe en este momento.</p>
                  <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => generarInforme(false)}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reintentar
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 text-[13px] font-medium">
                    <Bot className="h-4 w-4 animate-pulse text-primary" />
                    El agente está analizando el expediente…
                  </div>
                  {[72, 96, 56].map((w, i) => (
                    <div key={i} className="h-3 animate-pulse rounded-full bg-secondary" style={{ width: `${w}%` }} />
                  ))}
                  <p className="text-[11px] text-muted-foreground">Redacta resumen, recomendación y causa raíz con 5 Whys.</p>
                </div>
              )}
            </div>
          </Card>

          {/* Bitácora del agente */}
          <Card className="rounded-2xl p-5">
            <TituloSeccion sub="Trazabilidad completa del pipeline de auditoría">Bitácora JIDOKA</TituloSeccion>
            <ol className="relative space-y-3 border-l border-border/70 pl-4">
              {f.logs.map((l) => (
                <li key={l.id} className="relative">
                  <span className="absolute -left-[21.5px] flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card">
                    {ETAPA_ICONO[l.etapa] ?? <Copy className="h-2.5 w-2.5" />}
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{l.etapa}</p>
                    <p className="nums text-[10.5px] text-muted-foreground">{horaCorta(l.creadoEn)}</p>
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{l.mensaje}</p>
                </li>
              ))}
            </ol>
          </Card>

          {/* Decisiones humanas */}
          {f.revisiones.length > 0 && (
            <Card className="rounded-2xl p-5">
              <TituloSeccion sub="Registro histórico de decisiones">Revisión humana</TituloSeccion>
              <div className="space-y-3">
                {f.revisiones.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12.5px] font-semibold">
                        {r.auditor} · <span className="font-normal text-muted-foreground">{ROL_LABEL[r.rol] ?? r.rol}</span>
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                          r.accion === "APROBAR" && "bg-emerald-50 text-emerald-700",
                          r.accion === "RECHAZAR" && "bg-red-50 text-red-700",
                          r.accion === "ESCALAR" && "bg-amber-50 text-amber-700"
                        )}
                      >
                        {ACCION_LABEL[r.accion] ?? r.accion}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">“{r.comentario}”</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      {r.montoAprobado != null && <p className="nums text-[12px] font-medium text-emerald-700">Monto aprobado: {usd(r.montoAprobado)}</p>}
                      <p className="nums ml-auto text-[10.5px] text-muted-foreground">{fechaCompleta(r.fecha)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Panel de acción */}
          {puedeDecidir ? (
            <Card className="rounded-2xl border-primary/25 p-5">
              <TituloSeccion sub="Solo lo detenido por el andon llega a tu bandeja — decide con el expediente completo">Decisión del revisor</TituloSeccion>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="monto" className="text-[12px] text-muted-foreground">
                      Monto a aprobar (USD)
                    </Label>
                    <Input id="monto" value={monto} onChange={(e) => setMonto(e.target.value)} type="number" min="0" step="0.01" className="nums h-9 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="comentario" className="text-[12px] text-muted-foreground">
                      Comentario obligatorio
                    </Label>
                    <Textarea
                      id="comentario"
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder="Justifica la decisión…"
                      className="min-h-[72px] rounded-xl text-[12.5px]"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="h-9 flex-1 rounded-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={accionEnCurso !== null || !comentario.trim()}
                    onClick={() => decidir("APROBAR")}
                  >
                    {accionEnCurso === "APROBAR" ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                    Aprobar {usd(Number(monto) || 0)}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 flex-1 rounded-full border-amber-300 text-amber-700 hover:bg-amber-50"
                    disabled={f.estadoAuditoria !== "OBSERVADA" || accionEnCurso !== null || !comentario.trim()}
                    onClick={() => decidir("ESCALAR")}
                  >
                    {accionEnCurso === "ESCALAR" ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Hourglass className="mr-1.5 h-4 w-4" />}
                    Escalar a supervisor
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 flex-1 rounded-full border-red-200 text-red-600 hover:bg-red-50"
                    disabled={accionEnCurso !== null || !comentario.trim()}
                    onClick={() => decidir("RECHAZAR")}
                  >
                    {accionEnCurso === "RECHAZAR" ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1.5 h-4 w-4" />}
                    Rechazar
                  </Button>
                </div>
                {!comentario.trim() && <p className="text-[11px] text-muted-foreground">Escribe un comentario para habilitar las acciones.</p>}
              </div>
            </Card>
          ) : (
            rol === "TALLER" && (
              <Card className="rounded-2xl p-5">
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Esta factura fue auditada automáticamente contra el convenio.{" "}
                  {f.estadoAuditoria === "OBSERVADA"
                    ? "La aseguradora formuló observaciones: revisa los hallazgos y coordina con tu ejecutivo."
                    : f.estadoAuditoria === "APROBADA"
                      ? "Fue aprobada y entrará en el próximo ciclo de pago."
                      : "Fue rechazada: coordina con el perito para corregir el cobro."}
                </p>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p className="mt-0.5 truncate font-medium">{valor}</p>
    </div>
  );
}
