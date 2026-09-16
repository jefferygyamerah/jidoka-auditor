"use client";

import { useEffect, useMemo, useState } from "react";
import { useApi } from "@/hooks/use-api";
import { usd } from "@/lib/format";
import type { TallerDTO, TarifarioDTO, ConfiguracionDTO } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TituloSeccion } from "@/components/auditor/ui-bits";
import { Info, Save, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIAS = ["REPUESTO", "INSUMO", "MANO_OBRA", "HONORARIO"] as const;
const CAT_LABEL: Record<string, string> = {
  REPUESTO: "Repuestos",
  INSUMO: "Insumos",
  MANO_OBRA: "Mano de obra",
  HONORARIO: "Honorarios",
};

export function Tarifarios() {
  const { toast } = useToast();
  const { data: talleres } = useApi<TallerDTO[]>("/api/talleres");
  const { data: config } = useApi<ConfiguracionDTO>("/api/configuracion");
  const [tallerId, setTallerId] = useState<string>("");
  const { data: items, refetch } = useApi<TarifarioDTO[]>(tallerId ? `/api/tarifario?tallerId=${tallerId}` : null);

  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [params, setParams] = useState<ConfiguracionDTO | null>(null);

  useEffect(() => {
    if (talleres?.length && !tallerId) setTallerId(talleres[0].id);
  }, [talleres, tallerId]);

  useEffect(() => {
    if (config) setParams(config);
  }, [config]);

  const sucio = useMemo(
    () => Object.entries(precios).some(([id, v]) => {
      const original = items?.find((i) => i.id === id);
      return original && Number(v) !== original.precioPactado;
    }),
    [precios, items]
  );

  function editar(id: string, valor: string, original: number) {
    setPrecios((p) => ({ ...p, [id]: valor === "" ? String(original) : valor }));
  }

  async function guardar() {
    if (!sucio) return;
    setGuardando(true);
    try {
      const cambios = Object.entries(precios)
        .map(([id, v]) => ({ id, precioPactado: Number(v) }))
        .filter((c) => {
          const original = items?.find((i) => i.id === c.id);
          return original && c.precioPactado !== original.precioPactado && !Number.isNaN(c.precioPactado);
        });
      const res = await fetch("/api/tarifario", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cambios }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Tarifario actualizado", description: `${cambios.length} precio(s) pactado(s) modificado(s). Las nuevas auditorías usarán el estándar actualizado.` });
      setPrecios({});
      await refetch();
    } catch {
      toast({ title: "No se pudo guardar", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  }

  async function guardarParams() {
    if (!params) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/configuracion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Parámetros actualizados", description: "Las próximas auditorías aplicarán los nuevos umbrales del motor." });
    } catch {
      toast({ title: "No se pudo guardar", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  }

  const taller = talleres?.find((t) => t.id === tallerId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tarifarios pactados y parámetros</h1>
          <p className="text-sm text-muted-foreground">
            El estándar (tarifario) es la referencia contra la que el agente juzga cada cobro: mantenerlo vivo alimenta la mejora continua.
          </p>
        </div>
        <Select value={tallerId} onValueChange={setTallerId}>
          <SelectTrigger className="h-9 w-[260px] rounded-xl text-[13px]">
            <SelectValue placeholder="Taller" />
          </SelectTrigger>
          <SelectContent>
            {talleres?.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between p-5 pb-3">
            <TituloSeccion sub={taller ? `${taller.nombre} · RUC ${taller.ruc} · descuento pactado ${taller.descuentoPct}%` : "Selecciona un taller"}>
              Precios pactados por convenio
            </TituloSeccion>
            <Button size="sm" className="h-8 rounded-full" disabled={!sucio || guardando} onClick={guardar}>
              <Save className="mr-1.5 h-3.5 w-3.5" /> Guardar cambios
            </Button>
          </div>
          <div className="fino max-h-[70vh] overflow-y-auto px-5 pb-5">
            {CATEGORIAS.map((cat) => {
              const grupo = (items ?? []).filter((i) => i.categoria === cat);
              if (grupo.length === 0) return null;
              return (
                <div key={cat} className="mb-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{CAT_LABEL[cat]}</p>
                  <div className="overflow-hidden rounded-xl border border-border/60">
                    <table className="w-full text-[12.5px]">
                      <tbody>
                        {grupo.map((i) => {
                          const valor = precios[i.id] ?? String(i.precioPactado);
                          const modificado = Number(valor) !== i.precioPactado;
                          return (
                            <tr key={i.id} className={cn("border-b border-border/40 last:border-0", modificado && "bg-amber-50/70")}>
                              <td className="px-3 py-2">
                                <p className="font-medium leading-tight">{i.descripcion}</p>
                                <p className="nums text-[10.5px] text-muted-foreground">
                                  {i.codigo} · por {i.unidad.toLowerCase()}
                                </p>
                              </td>
                              <td className="w-28 px-3 py-2 text-right">
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
                                  <Input
                                    value={valor}
                                    onChange={(e) => editar(i.id, e.target.value, i.precioPactado)}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="nums h-8 rounded-lg pl-6 text-right text-[12px]"
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl p-5">
            <TituloSeccion sub="Umbrales del motor que aplican a todas las auditorías">
              <span className="flex items-center gap-1.5">
                <Settings2 className="h-4 w-4" /> Parámetros del motor
              </span>
            </TituloSeccion>
            {params && (
              <div className="space-y-4">
                <Parametro
                  etiqueta="Tolerancia de precio (%)"
                  ayuda="Desvío máximo sobre el precio pactado antes de disparar la regla R1."
                  valor={params.toleranciaPct}
                  onChange={(v) => setParams({ ...params, toleranciaPct: v })}
                  sufijo="%"
                  paso={0.5}
                />
                <Parametro
                  etiqueta="Tope de honorarios (%)"
                  ayuda="Honorarios administrativos máximos como % de la base técnica (regla R8)."
                  valor={params.topeHonorariosPct}
                  onChange={(v) => setParams({ ...params, topeHonorariosPct: v })}
                  sufijo="%"
                  paso={1}
                />
                <Parametro
                  etiqueta="Umbral de autoajuste (USD)"
                  ayuda="Si la discrepancia total es menor, el agente propone aprobar con ajuste automático."
                  valor={params.umbralAutoajuste}
                  onChange={(v) => setParams({ ...params, umbralAutoajuste: v })}
                  sufijo="USD"
                  paso={5}
                />
                <Button className="h-9 w-full rounded-full" disabled={guardando} onClick={guardarParams}>
                  <Save className="mr-1.5 h-4 w-4" /> Aplicar parámetros
                </Button>
              </div>
            )}
          </Card>

          <Card className="rounded-2xl border-dashed p-5">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
              <Info className="h-3.5 w-3.5" /> Filosofía del estándar
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              El estándar no es burocracia: es la base de la mejora continua. Al ajustar un precio pactado con datos de mercado, el
              motor de reglas se actualiza al instante — sin recompilar reglas ni reentrenar modelos. Auditoría determinista y
              explicable, siempre.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Parametro({
  etiqueta,
  ayuda,
  valor,
  onChange,
  sufijo,
  paso,
}: {
  etiqueta: string;
  ayuda: string;
  valor: number;
  onChange: (v: number) => void;
  sufijo: string;
  paso: number;
}) {
  return (
    <div>
      <p className="text-[12.5px] font-medium">{etiqueta}</p>
      <p className="mb-1.5 text-[11px] leading-relaxed text-muted-foreground">{ayuda}</p>
      <div className="relative w-32">
        <Input
          value={valor}
          onChange={(e) => onChange(Number(e.target.value))}
          type="number"
          min="0"
          step={paso}
          className="nums h-8 rounded-lg pr-12 text-right text-[12.5px]"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{sufijo}</span>
      </div>
    </div>
  );
}

export { usd };
