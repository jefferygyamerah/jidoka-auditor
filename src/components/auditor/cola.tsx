"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { useApi } from "@/hooks/use-api";
import { usd, fechaCorta, ESTADO_LABEL } from "@/lib/format";
import type { FacturaListaDTO, TallerDTO } from "@/lib/types";
import { EstadoBadge, RiesgoBar, SeveridadBadge, SkeletonCard, Vacio } from "@/components/auditor/ui-bits";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Car } from "lucide-react";

const COLUMNAS = ["RECIBIDA", "EN_AUDITORIA", "OBSERVADA", "APROBADA", "RECHAZADA"] as const;

const COLUMNA_ESTILO: Record<string, { punto: string; sub: string }> = {
  RECIBIDA: { punto: "bg-slate-300", sub: "Entra al pipeline" },
  EN_AUDITORIA: { punto: "bg-amber-300", sub: "Agente trabajando" },
  OBSERVADA: { punto: "bg-amber-500", sub: "Requiere humano" },
  APROBADA: { punto: "bg-emerald-500", sub: "Flujo directo o ajustada" },
  RECHAZADA: { punto: "bg-red-500", sub: "Línea detenida" },
};

export function Cola() {
  const { rol, version, tallerActivoId, setTallerActivo, abrirFactura } = useApp();
  const [q, setQ] = useState("");
  const { data: talleres } = useApi<TallerDTO[]>("/api/talleres");
  const esTaller = rol === "TALLER";
  const tallerId = esTaller ? tallerActivoId ?? talleres?.[0]?.id ?? null : null;

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (tallerId) params.set("tallerId", tallerId);
    if (q) params.set("q", q);
    return `/api/facturas?${params.toString()}`;
  }, [tallerId, q]);

  const { data: facturas, cargando } = useApi<FacturaListaDTO[]>(url, { refreshKey: version });

  const porEstado = useMemo(() => {
    const mapa: Record<string, FacturaListaDTO[]> = {};
    for (const col of COLUMNAS) mapa[col] = [];
    for (const f of facturas ?? []) (mapa[f.estadoAuditoria] ??= []).push(f);
    return mapa;
  }, [facturas]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{esTaller ? "Mis facturas" : "Cola de auditoría"}</h1>
          <p className="text-sm text-muted-foreground">
            {esTaller
              ? "Cada factura que subes es auditada al instante por el agente contra el tarifario pactado."
              : "Tablero del flujo de auditoría: el agente pre-clasifica todo; tú solo atiendes lo detenido."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {esTaller && talleres && (
            <Select value={tallerActivoId ?? talleres[0]?.id} onValueChange={setTallerActivo}>
              <SelectTrigger className="h-9 w-[220px] rounded-xl text-[13px]">
                <SelectValue placeholder="Identidad del taller" />
              </SelectTrigger>
              <SelectContent>
                {talleres.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar factura, siniestro, placa…"
              className="h-9 w-[240px] rounded-xl pl-8 text-[13px]"
            />
          </div>
        </div>
      </div>

      {cargando ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} className="h-64" />
          ))}
        </div>
      ) : !facturas || facturas.length === 0 ? (
        <Vacio titulo="Sin facturas en la cola" mensaje="Cuando un taller registre una factura, el agente la auditará al instante y aparecerá aquí." />
      ) : (
        <div className="fino -mx-4 flex gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:px-0">
          {COLUMNAS.map((col) => {
            const items = porEstado[col] ?? [];
            return (
              <section key={col} className="w-[286px] shrink-0">
                <div className="mb-2 flex items-center justify-between rounded-xl bg-card px-3 py-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)] border border-border/60">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${COLUMNA_ESTILO[col].punto}`} />
                    <p className="text-[12.5px] font-semibold">{ESTADO_LABEL[col]}</p>
                  </div>
                  <span className="nums rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">{items.length}</span>
                </div>
                <p className="mb-2 px-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">{COLUMNA_ESTILO[col].sub}</p>
                <div className="fino max-h-[calc(100vh-300px)] space-y-2.5 overflow-y-auto pr-0.5">
                  {items.map((f) => (
                    <TarjetaFactura key={f.id} factura={f} onClick={() => abrirFactura(f.id)} />
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-center text-[11px] text-muted-foreground">Vacío</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TarjetaFactura({ factura, onClick }: { factura: FacturaListaDTO; onClick: () => void }) {
  const borde =
    factura.estadoAuditoria === "RECHAZADA"
      ? "border-l-red-500"
      : factura.estadoAuditoria === "OBSERVADA"
        ? "border-l-amber-400"
        : factura.estadoAuditoria === "APROBADA"
          ? "border-l-emerald-500"
          : "border-l-slate-300";

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border border-border/70 border-l-[3px] ${borde} bg-card p-3 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(16,24,40,0.08)]`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="nums text-[13px] font-semibold tracking-tight">{factura.numero}</p>
        <p className="nums text-[13px] font-semibold">{usd(factura.montoTotal)}</p>
      </div>
      <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{factura.taller.nombre}</p>
      <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <Car className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {factura.siniestro.vehiculo} · {factura.siniestro.placa}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="nums text-[11px] text-muted-foreground">{factura.siniestro.numero} · {fechaCorta(factura.fechaIngreso)}</p>
        {factura.hallazgosCount > 0 ? (
          <div className="flex items-center gap-1.5">
            {factura.severidadMaxima && <SeveridadBadge severidad={factura.severidadMaxima} />}
            <span className="nums text-[11px] font-semibold text-amber-700">{factura.hallazgosCount}</span>
          </div>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
            <FileText className="h-3 w-3" /> Limpia
          </span>
        )}
      </div>
      {factura.hallazgosCount > 0 && <RiesgoBar riesgo={factura.riesgo} className="mt-2" />}
      {factura.estadoAuditoria === "APROBADA" && factura.montoSugerido != null && factura.montoSugerido < factura.montoTotal && (
        <p className="nums mt-2 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
          Aprobada por {usd(factura.montoSugerido)} (ajuste de {usd(factura.montoTotal - factura.montoSugerido)})
        </p>
      )}
    </button>
  );
}

export { EstadoBadge };
