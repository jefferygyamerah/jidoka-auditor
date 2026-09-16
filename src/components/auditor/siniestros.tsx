"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/hooks/use-api";
import { usd, fechaCompleta } from "@/lib/format";
import type { SiniestroDTO } from "@/lib/types";
import { ZonaChip } from "@/components/auditor/ui-bits";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SkeletonCard, Vacio } from "@/components/auditor/ui-bits";
import { Car, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const ESTADO_SIN: Record<string, string> = {
  EN_TALLER: "bg-slate-100 text-slate-600",
  EN_AUDITORIA: "bg-amber-50 text-amber-700",
  LIQUIDADO: "bg-emerald-50 text-emerald-700",
  CERRADO: "bg-sky-50 text-sky-700",
};

export function Siniestros() {
  const { data, cargando } = useApi<SiniestroDTO[]>("/api/siniestros");
  const [q, setQ] = useState("");

  const filtrados = useMemo(
    () =>
      (data ?? []).filter((s) =>
        q
          ? `${s.numero} ${s.asegurado} ${s.vehiculo} ${s.placa} ${s.poliza}`.toLowerCase().includes(q.toLowerCase())
          : true
      ),
    [data, q]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Siniestros</h1>
          <p className="text-sm text-muted-foreground">
            Expedientes reportados por los asegurados — el contexto real contra el que el agente juzga cada factura (Genchi Genbutsu).
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar siniestro, asegurado, placa…" className="h-9 w-[260px] rounded-xl pl-8 text-[13px]" />
        </div>
      </div>

      {cargando ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} className="h-48" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Vacio titulo="Sin siniestros" mensaje="No hay expedientes que coincidan con la búsqueda." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((s) => {
            const uso = Math.min(150, (s.montoFacturado / s.montoReserva) * 100);
            return (
              <Card key={s.id} className="flex flex-col rounded-2xl p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="nums text-[14px] font-semibold tracking-tight">{s.numero}</p>
                    <p className="text-[12px] text-muted-foreground">Póliza {s.poliza} · {fechaCompleta(s.fechaOcurrencia)}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", ESTADO_SIN[s.estado] ?? "bg-secondary")}>
                    {s.estado.replace("_", " ").toLowerCase()}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[13px]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                    <Car className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {s.vehiculo} {s.anioVehiculo}
                    </p>
                    <p className="nums text-[11.5px] text-muted-foreground">
                      {s.placa} · {s.asegurado}
                    </p>
                  </div>
                </div>
                <p className="mt-2.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{s.descripcion}</p>
                <div className="mt-3 flex items-center gap-2">
                  <ZonaChip zona={s.zonaDanio} />
                  <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">{s.tipoCobertura}</span>
                  <span className="nums ml-auto text-[11.5px] text-muted-foreground">
                    {s.facturasCount} factura{s.facturasCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-3 border-t border-border/50 pt-3">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground">Reserva</span>
                    <span className="nums font-medium">{usd(s.montoReserva)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground">Aceptado por auditoría</span>
                    <span className="nums font-semibold">{usd(s.montoFacturado)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full", uso > 100 ? "bg-red-500" : uso > 80 ? "bg-amber-400" : "bg-emerald-500")}
                      style={{ width: `${Math.max(3, (uso / 150) * 100)}%` }}
                    />
                  </div>
                  {uso > 100 && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-red-600">
                      <ShieldCheck className="h-3 w-3" /> La auditoría redujo el pago por debajo de la reserva
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
