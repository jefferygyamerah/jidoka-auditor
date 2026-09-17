"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/store/app";
import { useApi } from "@/hooks/use-api";
import { usd, fechaCompleta, horaCorta, ZONA_LABEL } from "@/lib/format";
import { ACCION_LABEL, ESTADO_HALLAZGO_LABEL, INFORME_ESTADO_LABEL, ROL_LABEL } from "@/lib/labels";
import type { FacturaDetalleDTO, HallazgoDTO } from "@/lib/types";
import { EstadoBadge, SeveridadBadge, TituloSeccion } from "@/components/auditor/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Fingerprint,
  Hourglass,
  ListChecks,
  MessageSquareQuote,
  OctagonX,
  RefreshCw,
  RotateCcw,
  Receipt,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ETAPA_ICONO: Record<string, React.ReactNode> = {
  RECEPCION: <Hourglass className="h-3.5 w-3.5" />,
  NORMALIZACION: <Fingerprint className="h-3.5 w-3.5" />,
  REGLAS: <ListChecks className="h-3.5 w-3.5" />,
  IA: <Brain className="h-3.5 w-3.5" />,
  PARADA: <OctagonX className="h-3.5 w-3.5" />,
  DECISION: <ShieldAlert className="h-3.5 w-3.5" />,
  HUMANO: <CheckCircle2 className="h-3.5 w-3.5" />,
};

const ESTADO_HALLAZGO_ESTILO: Record<string, string> = {
  PENDIENTE: "bg-amber-50 text-amber-700",
  ACEPTADO: "bg-emerald-50 text-emerald-700",
  DESCARTADO: "bg-slate-100 text-slate-600",
  EVIDENCIA_SOLICITADA: "bg-blue-50 text-blue-700",
};

type AccionRevision = "ACEPTAR_HALLAZGO" | "DESCARTAR_HALLAZGO" | "PEDIR_EVIDENCIA";

export function DetalleFactura() {
  const { facturaId, volverDeFactura, rol, bump } = useApp();
  const { data, cargando, refetch } = useApi<FacturaDetalleDTO>(facturaId ? `/api/facturas/${facturaId}` : null, { refreshKey: 1 });
  const { toast } = useToast();

  const [informeEstado, setInformeEstado] = useState<"reposo" | "cargando" | "error">("reposo");
  const [detalleAbierto, setDetalleAbierto] = useState<string | null>(null);
  const [hallazgoActivo, setHallazgoActivo] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);
  const [reauditando, setReauditando] = useState(false);

  async function reauditar() {
    if (!facturaId) return;
    setReauditando(true);
    try {
      await fetch(`/api/facturas/${facturaId}/auditar`, { method: "POST" });
      toast({ title: "Re-auditoría ejecutada", description: "El agente volvió a correr el pipeline y regeneró el informe." });
      bump();
      await refetch();
    } catch {
      toast({ title: "No se pudo re-auditar", variant: "destructive" });
    } finally {
      setReauditando(false);
    }
  }

  const puedeRevisar = rol === "AUDITOR" || rol === "ADMIN";

  useEffect(() => {
    if (data) {
      setComentario("");
      setDetalleAbierto(null);
      setHallazgoActivo(null);
    }
  }, [data?.id]);

  // El informe del agente se genera en cuanto se abre el expediente (si aún no existe)
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
    if (data && !data.informeAgente && !data.informeEnCurso) void generarInforme(false);
  }, [data?.id, data?.informeAgente, data?.informeEnCurso, generarInforme]);

  async function revisar(accion: AccionRevision, hallazgoId: string) {
    if (!facturaId) return;
    setAccionEnCurso(accion + hallazgoId);
    try {
      const res = await fetch(`/api/facturas/${facturaId}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditor: rol === "ADMIN" ? "Administrador" : "Marisol Ortega",
          rol: rol === "ADMIN" ? "ADMIN" : "AUDITOR",
          accion,
          comentario,
          hallazgoId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      toast({
        title: ACCION_LABEL[accion] ?? "Revisión registrada",
        description: json.informeCerrado ? "Todos los hallazgos revisados: informe cerrado." : comentario || "Registrado en la bitácora.",
      });
      setComentario("");
      setHallazgoActivo(null);
      bump();
      await refetch();
    } catch (e) {
      toast({ title: "No se pudo registrar la revisión", description: (e as Error).message, variant: "destructive" });
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
              {f.severidadMaxima && !f.sinEvaluar && <SeveridadBadge severidad={f.severidadMaxima} />}
              {f.sinEvaluar && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  <OctagonX className="h-3 w-3" /> Regla de parada
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {f.taller.nombre} · {f.taller.ciudad} · Siniestro {f.siniestro.numero} · {ZONA_LABEL[f.siniestro.zonaDanio]}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="nums text-2xl font-semibold tracking-tight">{usd(f.montoTotal)}</p>
          {f.montoDiscrepancia > 0 && <p className="nums text-[12px] text-amber-700">Discrepancia señalada: {usd(f.montoDiscrepancia)}</p>}
          {f.montoAjusteProp != null && f.montoAjusteProp !== 0 && (
            <p className="nums text-[12px] text-slate-600">Ajuste propuesto (referencia): {usd(f.montoAjusteProp)}</p>
          )}
          {f.montoSinEvaluar != null && f.sinEvaluar && (
            <p className="nums text-[12px] font-semibold text-red-600">Sin evaluar: {usd(f.montoSinEvaluar)}</p>
          )}
          {rol !== "TALLER" && (
            <Button variant="outline" size="sm" className="mt-2 h-7 rounded-full text-[11.5px]" onClick={reauditar} disabled={reauditando}>
              <RotateCcw className={cn("mr-1 h-3 w-3", reauditando && "animate-spin")} />
              Re-auditar con el agente
            </Button>
          )}
        </div>
      </div>

      {/* Banner de regla de parada (jidoka) */}
      {f.sinEvaluar && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
          <OctagonX className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-[13px] font-semibold text-red-800">Proceso detenido: montos sin evaluar</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-red-700">{f.notaBloqueo ?? "Evidencia compartida faltante o inválida."}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Columna izquierda */}
        <div className="space-y-4 lg:col-span-3">
          {/* Contexto del siniestro (el hecho real contra el que se juzga) */}
          <Card className="rounded-2xl p-5">
            <TituloSeccion sub="Contexto reportado — el agente juzga cada partida contra este hecho real">Siniestro {f.siniestro.numero}</TituloSeccion>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
              <Dato etiqueta="Asegurado" valor={f.siniestro.asegurado} />
              <Dato etiqueta="Vehículo" valor={`${f.siniestro.vehiculo} ${f.siniestro.placa}`} />
              <Dato etiqueta="Zona dañada" valor={ZONA_LABEL[f.siniestro.zonaDanio]} />
              <Dato etiqueta="Reserva" valor={usd(f.siniestro.montoReserva)} />
            </div>
            <p className="mt-3 rounded-xl bg-secondary/70 px-3 py-2 text-[12.5px] leading-relaxed text-secondary-foreground">{f.siniestro.descripcion}</p>
          </Card>

          {/* Partidas vs tarifario */}
          <Card className="overflow-hidden rounded-2xl">
            <div className="p-5 pb-3">
              <TituloSeccion sub="Cada partida cobrada contra el precio pactado en convenio — verificación determinista contra el tarifario">
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
                      <tr key={p.id} className={cn("border-b border-border/40", p.duplicada ? "bg-red-50/60" : p.alerta ? "bg-amber-50/50" : "")}>
                        <td className="px-4 py-2.5">
                          <p className={cn("font-medium leading-tight", p.duplicada && "text-red-700")}>
                            {p.descripcion}
                            {p.duplicada && <span className="ml-2 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">DUPLICADA</span>}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {p.codigo} · {p.categoria.replace("_", " ").toLowerCase()}
                            {p.contexto ? ` · ${p.contexto}` : ""}
                          </p>
                        </td>
                        <td className="nums px-2 py-2.5 text-right">
                          {p.cantidad} {p.unidad}
                        </td>
                        <td className="nums px-2 py-2.5 text-right font-medium">{usd(p.precioUnitario)}</td>
                        <td className="nums px-2 py-2.5 text-right text-muted-foreground">{p.precioPactado != null ? usd(p.precioPactado) : "—"}</td>
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
                        <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">no cuadra (esperado {usd(esperado)})</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Hallazgos con revisión por hallazgo */}
          <Card className="rounded-2xl p-5">
            <TituloSeccion sub={`Motor determinista · riesgo ${f.riesgo}/100 · ${f.hallazgosPendientes} pendiente(s) de revisión`}>
              Hallazgos del agente ({f.hallazgos.length})
            </TituloSeccion>
            {f.hallazgos.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-[13px] text-emerald-800">
                  Sin hallazgos: todas las partidas cumplen el tarifario, no hay duplicados ni inconsistencias con el siniestro.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {f.hallazgos.map((h) => (
                  <HallazgoCard
                    key={h.id}
                    h={h}
                    puedeRevisar={puedeRevisar}
                    activo={hallazgoActivo === h.id}
                    comentario={comentario}
                    setComentario={setComentario}
                    onActivar={() => {
                      setHallazgoActivo(hallazgoActivo === h.id ? null : h.id);
                      setComentario("");
                    }}
                    onRevisar={(accion) => revisar(accion, h.id)}
                    ocupado={accionEnCurso !== null}
                    detalleAbierto={detalleAbierto === h.id}
                    onToggleDetalle={() => setDetalleAbierto(detalleAbierto === h.id ? null : h.id)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4 lg:col-span-2">
          {/* Informe del agente */}
          <Card className="overflow-hidden rounded-2xl border-[oklch(0.32_0.068_255)]/25">
            <div className="flex items-center justify-between bg-[oklch(0.32_0.068_255)] px-5 py-3.5 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <p className="text-[13px] font-semibold">Informe del agente</p>
              </div>
              {f.informeAgente && (
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
              {f.informeAgente ? (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        f.informeAgente.estadoInforme === "LISTO" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      )}
                    >
                      {INFORME_ESTADO_LABEL[f.informeAgente.estadoInforme] ?? f.informeAgente.estadoInforme}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed">{f.informeAgente.resumen}</p>
                  {f.informeAgente.montosSinEvaluar.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                        <OctagonX className="h-3 w-3" /> Montos sin evaluar
                      </p>
                      <ul className="list-inside list-disc space-y-1">
                        {f.informeAgente.montosSinEvaluar.map((m, i) => (
                          <li key={i} className="text-[12.5px] leading-relaxed text-red-700">
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Detalle línea por línea</p>
                    <div className="space-y-1.5">
                      {f.informeAgente.lineas.map((l, i) => (
                        <div key={i} className="rounded-lg border border-border/50 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-medium">
                              {l.linea != null ? `Línea ${l.linea}` : "Verificación"} · {l.descripcion}
                            </p>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide",
                                l.estado === "CONFORME" && "bg-emerald-50 text-emerald-700",
                                l.estado === "DISCREPANCIA" && "bg-amber-50 text-amber-700",
                                l.estado === "SIN_EVALUAR" && "bg-red-50 text-red-700"
                              )}
                            >
                              {l.estado === "CONFORME" ? "Conforme" : l.estado === "DISCREPANCIA" ? "Discrepancia" : "Sin evaluar"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{l.detalle}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="rounded-xl bg-secondary/60 p-3 text-[11.5px] leading-relaxed text-muted-foreground">{f.informeAgente.nota}</p>
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
                  <p className="text-[11px] text-muted-foreground">Redacta el informe línea por línea con evidencia; no decide pagos.</p>
                </div>
              )}
            </div>
          </Card>

          {/* Bitácora del agente */}
          <Card className="rounded-2xl p-5">
            <TituloSeccion sub="Trazabilidad completa del pipeline de auditoría">Bitácora del agente</TituloSeccion>
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

          {/* Revisión humana (historial por hallazgo) */}
          {f.revisiones.length > 0 && (
            <Card className="rounded-2xl p-5">
              <TituloSeccion sub="Registro histórico de revisiones por hallazgo">Revisión humana</TituloSeccion>
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
                          r.accion === "ACEPTAR_HALLAZGO" && "bg-emerald-50 text-emerald-700",
                          r.accion === "DESCARTAR_HALLAZGO" && "bg-slate-100 text-slate-600",
                          r.accion === "PEDIR_EVIDENCIA" && "bg-blue-50 text-blue-700",
                          r.accion === "REAUDITAR" && "bg-amber-50 text-amber-700"
                        )}
                      >
                        {ACCION_LABEL[r.accion] ?? r.accion}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">“{r.comentario}”</p>
                    <p className="nums mt-1.5 text-right text-[10.5px] text-muted-foreground">{fechaCompleta(r.fecha)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Nota para el rol taller */}
          {rol === "TALLER" && (
            <Card className="rounded-2xl p-5">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Esta factura fue auditada automáticamente contra el convenio.{" "}
                {f.sinEvaluar
                  ? "La aseguradora solicitó el tarifario/convenio vigente: coordina con tu ejecutivo para cargarlo y destrabar la evaluación."
                  : f.hallazgosPendientes > 0
                    ? "Hay observaciones en revisión: atiende las solicitudes de evidencia con tu ejecutivo."
                    : "El informe fue cerrado por el auditor; el proceso de pago sigue con la aseguradora."}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function HallazgoCard({
  h,
  puedeRevisar,
  activo,
  comentario,
  setComentario,
  onActivar,
  onRevisar,
  ocupado,
  detalleAbierto,
  onToggleDetalle,
}: {
  h: HallazgoDTO;
  puedeRevisar: boolean;
  activo: boolean;
  comentario: string;
  setComentario: (v: string) => void;
  onActivar: () => void;
  onRevisar: (accion: AccionRevision) => void;
  ocupado: boolean;
  detalleAbierto: boolean;
  onToggleDetalle: () => void;
}) {
  const fuentesDelBloque = new Set(h.equivalencia?.evidencia.map((e) => e.fuente) ?? []);
  const evidenciaRestante = h.evidencia.filter((e) => !fuentesDelBloque.has(e.fuente));
  return (
    <div className={cn("rounded-xl border bg-card p-3.5", h.estadoRevision === "PENDIENTE" ? "border-border/60" : "border-border/40 opacity-95")}>
      <div className="flex flex-wrap items-center gap-2">
        <SeveridadBadge severidad={h.severidad} />
        <p className="text-[13px] font-semibold">{h.tipo}</p>
        <span className="nums rounded-md bg-secondary px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">{h.regla}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", ESTADO_HALLAZGO_ESTILO[h.estadoRevision] ?? "")}>
          {ESTADO_HALLAZGO_LABEL[h.estadoRevision] ?? h.estadoRevision}
        </span>
        {h.montoDiscrepancia > 0 && <span className="nums ml-auto text-[13px] font-semibold text-amber-700">{usd(h.montoDiscrepancia)}</span>}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{h.descripcion}</p>

      <DeDondeSaleEsteMonto h={h} />

      {/* Ajuste propuesto (referencia no vinculante) */}
      {h.ajustePropuesto != null && h.ajustePropuesto !== 0 && (
        <p className="nums mt-1.5 text-[11.5px] text-slate-600">Ajuste de línea propuesto (referencia): {usd(h.ajustePropuesto)}</p>
      )}

      {/* Citas de evidencia (sin repetir las fuentes que ya cita el bloque del monto) */}
      {evidenciaRestante.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Evidencia citada</p>
          <ul className="space-y-1">
            {evidenciaRestante.map((e, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                <MessageSquareQuote className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  <span className="font-medium text-foreground/80">{e.fuente}</span> — {e.localizador}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Evidencia solicitada / motivo de revisión */}
      {h.evidenciaPendiente && h.estadoRevision === "EVIDENCIA_SOLICITADA" && (
        <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-[11.5px] leading-relaxed text-blue-700">
          Evidencia solicitada: {h.evidenciaPendiente}
        </p>
      )}
      {h.comentarioRevision && h.estadoRevision !== "PENDIENTE" && (
        <p className="mt-2 text-[11.5px] italic leading-relaxed text-muted-foreground">
          {h.revisadoPor ? `${h.revisadoPor}: ` : ""}“{h.comentarioRevision}”
        </p>
      )}

      {/* Detalle técnico */}
      {h.detalle && Object.keys(h.detalle).length > 0 && (
        <div className="mt-2">
          <button className="flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline" onClick={onToggleDetalle}>
            Evidencia técnica
            {detalleAbierto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {detalleAbierto && (
            <pre className="nums mt-2 overflow-x-auto rounded-lg bg-secondary/70 p-3 text-[11px] leading-relaxed">{JSON.stringify(h.detalle, null, 2)}</pre>
          )}
        </div>
      )}

      {/* Acciones de revisión por hallazgo */}
      {puedeRevisar && h.estadoRevision === "PENDIENTE" && (
        <div className="mt-3 border-t border-border/50 pt-3">
          {!activo ? (
            <Button variant="outline" size="sm" className="h-7 rounded-full text-[11.5px]" onClick={onActivar} disabled={ocupado}>
              Revisar este hallazgo
            </Button>
          ) : (
            <div className="space-y-2">
              <Label className="text-[11.5px] text-muted-foreground">
                Motivo {h.regla === "R10" || h.evidenciaPendiente ? "(qué evidencia se solicita o cómo se resuelve)" : "(obligatorio para descartar o pedir evidencia)"}
              </Label>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Ej.: el perito confirma la posición documentada de la pieza…"
                className="min-h-[64px] rounded-xl text-[12.5px]"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="h-8 rounded-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={ocupado}
                  onClick={() => onRevisar("ACEPTAR_HALLAZGO")}
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Aceptar hallazgo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full border-blue-200 text-blue-700 hover:bg-blue-50"
                  disabled={ocupado || !comentario.trim()}
                  onClick={() => onRevisar("PEDIR_EVIDENCIA")}
                >
                  <Hourglass className="mr-1.5 h-3.5 w-3.5" /> Pedir evidencia
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full border-slate-200 text-slate-600 hover:bg-slate-50"
                  disabled={ocupado || !comentario.trim()}
                  onClick={() => onRevisar("DESCARTAR_HALLAZGO")}
                >
                  Descartar con motivo
                </Button>
              </div>
              {!comentario.trim() && <p className="text-[11px] text-muted-foreground">Aceptar no exige motivo; descartar y pedir evidencia sí.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * «¿De dónde sale este monto?» — la trazabilidad del hallazgo en un bloque:
 * cobrado vs pactado (o «sin catálogo»), la equivalencia propuesta con su confianza
 * y su motivo, y la cita de evidencia. Nada de esto decide: los botones de arriba sí.
 */
function DeDondeSaleEsteMonto({ h }: { h: HallazgoDTO }) {
  const d = h.detalle as { cobrado?: number; pactado?: number; precioUnitario?: number; cantidad?: number; unidad?: string; subtotal?: number };
  const cobrado = d.cobrado ?? d.precioUnitario;
  const pactadoDirecto = d.pactado ?? null;
  const pactadoEquivalente = pactadoDirecto == null ? h.equivalencia?.precioPactado ?? null : null;
  if (cobrado == null && d.subtotal == null && !h.equivalencia) return null;

  return (
    <div className="mt-2.5 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2.5">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Receipt className="h-3 w-3" /> ¿De dónde sale este monto?
      </p>

      <div className="grid grid-cols-3 gap-x-3 gap-y-1">
        <Cifra
          etiqueta="Cobrado"
          valor={cobrado != null ? usd(cobrado) : usd(d.subtotal ?? 0)}
          nota={cobrado != null && d.cantidad != null ? `× ${d.cantidad} ${d.unidad ?? ""} = ${usd(cobrado * d.cantidad)}` : null}
        />
        <Cifra
          etiqueta="Pactado"
          valor={pactadoDirecto != null ? usd(pactadoDirecto) : pactadoEquivalente != null ? usd(pactadoEquivalente) : "sin catálogo"}
          nota={pactadoDirecto == null ? (pactadoEquivalente != null ? "según la equivalencia propuesta" : "el código no está en el convenio") : null}
          apagado={pactadoDirecto == null}
        />
        <Cifra etiqueta="Diferencia señalada" valor={usd(h.montoDiscrepancia)} destacado />
      </div>

      {h.equivalencia && (
        <div className="mt-2.5 border-t border-border/60 pt-2">
          <p className="text-[12px] font-medium">
            Equivalencia propuesta: <span className="nums">{h.equivalencia.codigoPropuesto}</span> «{h.equivalencia.descripcionPropuesta}»
            <span className="nums ml-1.5 rounded-md bg-card px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
              confianza {Math.round(h.equivalencia.confianza * 100)}%
            </span>
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{h.equivalencia.motivo}</p>
          <ul className="mt-1.5 space-y-0.5">
            {h.equivalencia.evidencia.map((e, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <MessageSquareQuote className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  <span className="font-medium text-foreground/80">{e.fuente}</span> — {e.localizador}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {h.propuestaIA && (
        <p className="mt-2 rounded-lg bg-card px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground/80">Lectura del modelo (no decide):</span> cita del tarifario «{h.propuestaIA.descripcionCitada}» (
          {h.propuestaIA.codigoPropuesto}){h.propuestaIA.coincideConElMotor ? ", coincide con el motor" : ", difiere del motor"}. {h.propuestaIA.motivo}
        </p>
      )}
    </div>
  );
}

function Cifra({ etiqueta, valor, nota, destacado, apagado }: { etiqueta: string; valor: string; nota?: string | null; destacado?: boolean; apagado?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
      <p className={cn("nums text-[13px] font-semibold", destacado && "text-amber-700", apagado && "text-muted-foreground")}>{valor}</p>
      {nota && <p className="nums text-[10.5px] leading-tight text-muted-foreground">{nota}</p>}
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
