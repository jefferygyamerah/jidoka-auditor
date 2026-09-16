"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/store/app";
import { useApi } from "@/hooks/use-api";
import { usd } from "@/lib/format";
import type { SiniestroDTO, TallerDTO, TarifarioDTO } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { EstadoBadge, SeveridadBadge } from "@/components/auditor/ui-bits";
import { Bot, CircleAlert, FilePlus2, Plus, Search, Sparkles, Trash2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Fila {
  key: number;
  categoria: string;
  codigo: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  precio: string;
}

let contador = 1;
const nuevaFila = (p?: Partial<Fila>): Fila => ({
  key: contador++,
  categoria: "REPUESTO",
  codigo: "",
  descripcion: "",
  cantidad: "1",
  unidad: "UND",
  precio: "",
  ...p,
});

export function NuevaFactura() {
  const { tallerActivoId, abrirFactura, bump } = useApp();
  const { toast } = useToast();
  const { data: talleres } = useApi<TallerDTO[]>("/api/talleres");
  const { data: siniestros } = useApi<SiniestroDTO[]>("/api/siniestros");
  const { data: config } = useApi<{ umbralAutoajuste: number }>("/api/configuracion");

  const tallerId = tallerActivoId ?? talleres?.[0]?.id ?? null;
  const { data: tarifario } = useApi<TarifarioDTO[]>(tallerId ? `/api/tarifario?tallerId=${tallerId}` : null);

  const [siniestroId, setSiniestroId] = useState<string>("");
  const [numero, setNumero] = useState("");
  const [filas, setFilas] = useState<Fila[]>([nuevaFila()]);
  const [totalManual, setTotalManual] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<null | {
    id: string;
    numero: string;
    estado: string;
    riesgo: number;
    montoTotal: number;
    hallazgos: { tipo: string; severidad: string; descripcion: string; montoDiscrepancia: number }[];
  }>(null);

  const siniestro = siniestros?.find((s) => s.id === siniestroId);
  const subtotal = filas.reduce((a, f) => a + (Number(f.cantidad) || 0) * (Number(f.precio) || 0), 0);
  const totalCalculado = Math.round(subtotal * 1.07 * 100) / 100;
  const total = totalManual ? Number(totalManual) : totalCalculado;

  const agregar = (p?: Partial<Fila>) => setFilas((fs) => [...fs, nuevaFila(p)]);
  const quitar = (key: number) => setFilas((fs) => (fs.length > 1 ? fs.filter((f) => f.key !== key) : fs));
  const editar = (key: number, cambio: Partial<Fila>) => setFilas((fs) => fs.map((f) => (f.key === key ? { ...f, ...cambio } : f)));

  const desdeTarifario = (t: TarifarioDTO) => ({
    categoria: t.categoria,
    codigo: t.codigo,
    descripcion: t.descripcion,
    unidad: t.unidad,
    precio: String(t.precioPactado),
  });

  // Demo de un clic: parachoques duplicado + sobreprecio
  const cargarDemoAnomalia = () => {
    const base = tarifario?.find((t) => t.codigo === "R-1001");
    const precio = base?.precioPactado ?? 271;
    setFilas([
      nuevaFila(desdeTarifario(base ?? { categoria: "REPUESTO", codigo: "R-1001", descripcion: "Parachoques delantero", unidad: "UND", precioPactado: precio, id: "" })),
      nuevaFila({ categoria: "REPUESTO", codigo: "R-1001", descripcion: "Parachoques delantero", cantidad: "1", unidad: "UND", precio: String(Math.round(precio * 1.28 * 100) / 100) }),
      nuevaFila({ categoria: "MANO_OBRA", codigo: "M-3001", descripcion: "Desmontaje e instalación de parachoques", cantidad: "3", unidad: "HRS", precio: String(tarifario?.find((t) => t.codigo === "M-3001")?.precioPactado ?? 28) }),
      nuevaFila({ categoria: "INSUMO", codigo: "I-2001", descripcion: "Pintura base poliuretano", cantidad: "2.5", unidad: "GLB", precio: String(tarifario?.find((t) => t.codigo === "I-2001")?.precioPactado ?? 38) }),
      nuevaFila({ categoria: "HONORARIO", codigo: "H-4001", descripcion: "Administración de siniestro", cantidad: "1", unidad: "SRV", precio: String(tarifario?.find((t) => t.codigo === "H-4001")?.precioPactado ?? 65) }),
    ]);
    if (!numero) setNumero(proximoNumero());
    toast({ title: "Ejemplo cargado", description: "Contiene un cobro duplicado y un precio fuera de tarifario: obsérvalo al enviar." });
  };

  function proximoNumero() {
    const n = Math.floor(Math.random() * 900) + 2000;
    return `FAC-2026-${n}`;
  }

  const valido = Boolean(tallerId && siniestroId && numero.trim() && filas.some((f) => f.codigo && Number(f.cantidad) > 0));

  async function enviar() {
    if (!valido || !tallerId) return;
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tallerId,
          siniestroId,
          numero: numero.trim(),
          montoDeclarado: totalManual ? Number(totalManual) : undefined,
          partidas: filas
            .filter((f) => f.codigo)
            .map((f) => ({
              categoria: f.categoria,
              codigo: f.codigo,
              descripcion: f.descripcion,
              cantidad: Number(f.cantidad) || 0,
              unidad: f.unidad,
              precioUnitario: Number(f.precio) || 0,
            })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo registrar la factura");
      setResultado(json);
      bump();
    } catch (e) {
      toast({ title: "Error al registrar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  }

  const siniestrosFiltrados = useMemo(() => siniestros ?? [], [siniestros]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva factura de taller</h1>
        <p className="text-sm text-muted-foreground">
          Registra la factura del siniestro: el agente la audita al instante contra el tarifario pactado y te responde con el veredicto.
        </p>
      </div>

      {resultado ? (
        <Card className="rounded-2xl p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </span>
            <div>
              <p className="text-[15px] font-semibold">
                {resultado.numero} · {usd(resultado.montoTotal)}
              </p>
              <p className="text-[13px] text-muted-foreground">Auditoría completada en milisegundos</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <EstadoBadge estado={resultado.estado} />
              {resultado.hallazgos.length > 0 && resultado.hallazgos[0] && <SeveridadBadge severidad={resultado.hallazgos[0].severidad} />}
            </div>
          </div>
          {resultado.hallazgos.length === 0 ? (
            <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-[13px] text-emerald-800">
              Sin hallazgos: la factura cumple el convenio y se aprobó en flujo directo, sin esperar revisión humana.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              <p className="text-[13px] font-medium">
                El agente detectó {resultado.hallazgos.length} hallazgo(s) — riesgo {resultado.riesgo}/100:
              </p>
              {resultado.hallazgos.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50/60 px-3.5 py-2.5">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-[12.5px] font-semibold">
                      {h.tipo} {h.montoDiscrepancia > 0 && <span className="nums font-normal text-amber-700">· {usd(h.montoDiscrepancia)}</span>}
                    </p>
                    <p className="text-[12px] leading-relaxed text-muted-foreground">{h.descripcion}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 flex gap-2">
            <Button className="rounded-full" onClick={() => abrirFactura(resultado.id)}>
              Ver expediente completo
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setResultado(null);
                setFilas([nuevaFila()]);
                setNumero(proximoNumero());
                setTotalManual("");
              }}
            >
              Registrar otra
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="rounded-2xl p-5">
              <p className="mb-3 text-[13px] font-semibold">Datos generales</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">Taller emisor</Label>
                  <Select value={tallerId ?? ""} onValueChange={() => {}}>
                    <SelectTrigger className="h-9 rounded-xl text-[13px]">
                      <SelectValue />
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
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">Siniestro</Label>
                  <Select value={siniestroId} onValueChange={setSiniestroId}>
                    <SelectTrigger className="h-9 rounded-xl text-[13px]">
                      <SelectValue placeholder="Selecciona el siniestro…" />
                    </SelectTrigger>
                    <SelectContent>
                      {siniestrosFiltrados.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.numero} · {s.vehiculo} · {s.placa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] text-muted-foreground">Número de factura</Label>
                  <div className="flex gap-2">
                    <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="FAC-2026-…" className="nums h-9 rounded-xl" />
                    <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={() => setNumero(proximoNumero())}>
                      Sugerir
                    </Button>
                  </div>
                </div>
                {siniestro && (
                  <div className="rounded-xl bg-secondary/60 px-3 py-2 text-[12px] leading-relaxed text-secondary-foreground">
                    <span className="font-semibold">{siniestro.asegurado}</span> · Reserva {usd(siniestro.montoReserva)} — {siniestro.descripcion}
                  </div>
                )}
              </div>
            </Card>

            <Card className="rounded-2xl p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">Partidas facturadas</p>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 rounded-full">
                        <Plus className="mr-1 h-3.5 w-3.5" /> Añadir del tarifario
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="end">
                      <div className="fino max-h-80 overflow-y-auto">
                        {(tarifario ?? []).map((t) => (
                          <button
                            key={t.id}
                            className="flex w-full items-center justify-between gap-2 border-b border-border/40 px-3 py-2 text-left text-[12px] hover:bg-accent"
                            onClick={() => {
                              agregar(desdeTarifario(t));
                            }}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{t.descripcion}</span>
                              <span className="text-[10.5px] text-muted-foreground">
                                {t.codigo} · pactado {usd(t.precioPactado)}/{t.unidad}
                              </span>
                            </span>
                            <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={() => agregar()}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Línea libre
                  </Button>
                  <Button variant="secondary" size="sm" className="h-8 rounded-full" onClick={cargarDemoAnomalia}>
                    <Wand2 className="mr-1 h-3.5 w-3.5" /> Ejemplo con anomalías
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5">
                {filas.map((f, idx) => (
                  <div key={f.key} className="grid grid-cols-[28px_1fr_68px_88px_36px] items-center gap-2 rounded-xl border border-border/50 p-2 sm:grid-cols-[28px_1.4fr_1fr_64px_64px_88px_36px]">
                    <span className="nums text-center text-[11px] text-muted-foreground">{idx + 1}</span>
                    <div className="space-y-1">
                      <Input
                        value={f.codigo}
                        onChange={(e) => editar(f.key, { codigo: e.target.value.toUpperCase() })}
                        placeholder="Código"
                        className="nums h-7 rounded-lg text-[12px]"
                      />
                      <Input
                        value={f.descripcion}
                        onChange={(e) => editar(f.key, { descripcion: e.target.value })}
                        placeholder="Descripción de la partida"
                        className="h-7 rounded-lg text-[12px]"
                      />
                    </div>
                    <Select value={f.categoria} onValueChange={(v) => editar(f.key, { categoria: v })}>
                      <SelectTrigger className="h-7 rounded-lg text-[11.5px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REPUESTO">Repuesto</SelectItem>
                        <SelectItem value="INSUMO">Insumo</SelectItem>
                        <SelectItem value="MANO_OBRA">Mano de obra</SelectItem>
                        <SelectItem value="HONORARIO">Honorario</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={f.cantidad}
                      onChange={(e) => editar(f.key, { cantidad: e.target.value })}
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Cant."
                      className="nums h-7 rounded-lg text-[12px]"
                    />
                    <Input
                      value={f.unidad}
                      onChange={(e) => editar(f.key, { unidad: e.target.value.toUpperCase() })}
                      placeholder="UND"
                      className="h-7 rounded-lg text-center text-[12px]"
                    />
                    <Input
                      value={f.precio}
                      onChange={(e) => editar(f.key, { precio: e.target.value })}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Precio"
                      className="nums h-7 rounded-lg text-right text-[12px]"
                    />
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-red-600"
                      onClick={() => quitar(f.key)}
                      aria-label="Quitar partida"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Resumen y envío */}
          <div className="space-y-4">
            <Card className="sticky top-20 rounded-2xl p-5">
              <p className="text-[13px] font-semibold">Totales</p>
              <div className="nums mt-3 space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{usd(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ITBMS 7%</span>
                  <span>{usd(totalCalculado - subtotal)}</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-2 text-[15px] font-semibold">
                  <span>Total</span>
                  <span>{usd(total)}</span>
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-[11.5px] text-muted-foreground">Total declarado distinto (opcional, para probar la regla R6)</Label>
                <Input value={totalManual} onChange={(e) => setTotalManual(e.target.value)} type="number" min="0" step="0.01" placeholder="Vacío = calculado" className="nums h-8 rounded-xl text-[12px]" />
              </div>
              <Button className="mt-4 h-10 w-full rounded-full" disabled={!valido || enviando} onClick={enviar}>
                {enviando ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-pulse" /> Auditando…
                  </>
                ) : (
                  <>
                    <FilePlus2 className="mr-2 h-4 w-4" /> Registrar y auditar
                  </>
                )}
              </Button>
              {config && (
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  <Search className="mr-1 inline h-3 w-3" />
                  Parámetros activos: tolerancia de precio, tope de honorarios y umbral de autoajuste ({usd(config.umbralAutoajuste)}) los define la aseguradora.
                </p>
              )}
            </Card>
            <Card className={cn("rounded-2xl border-dashed p-4 text-[12px] leading-relaxed text-muted-foreground")}>
              <p className="font-medium text-foreground">¿Qué pasa al enviar?</p>
              <p className="mt-1">
                El agente normaliza las partidas, calcula la huella anti-duplicados, ejecuta las 9 reglas anti-errores contra el tarifario pactado y decide: aprobar en flujo directo o detener la línea y escalar al revisor humano.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
