import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { DashboardDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET() {
  const facturas = await db.factura.findMany({
    include: {
      taller: { select: { id: true, nombre: true } },
      hallazgos: { select: { tipo: true, severidad: true, montoDiscrepancia: true, estadoRevision: true, regla: true } },
    },
  });

  const porEstado: Record<string, number> = { RECIBIDA: 0, EN_AUDITORIA: 0, PARA_REVISION: 0, CERRADA: 0 };
  const porEstadoHallazgo: Record<string, number> = { PENDIENTE: 0, ACEPTADO: 0, DESCARTADO: 0, EVIDENCIA_SOLICITADA: 0 };
  let montoFacturado = 0;
  let montoDiscrepancia = 0;
  let montoAceptado = 0;
  let montoPendienteRevision = 0;
  let montoSinEvaluar = 0;
  let facturasLimpias = 0;

  const paretoMap = new Map<string, { cantidad: number; monto: number }>();
  const tallerMap = new Map<string, { nombre: string; hallazgos: number; monto: number; facturas: number }>();
  const semanaMap = new Map<string, { facturas: number; conHallazgo: number; monto: number }>();

  for (const f of facturas) {
    porEstado[f.estadoAuditoria] = (porEstado[f.estadoAuditoria] ?? 0) + 1;
    montoFacturado += f.montoTotal;
    if (f.sinEvaluar && f.montoSinEvaluar != null) montoSinEvaluar += f.montoSinEvaluar;

    const activos = f.hallazgos.filter((h) => h.regla !== "R10");
    const disc = round2(activos.reduce((a, h) => a + h.montoDiscrepancia, 0));
    montoDiscrepancia += disc;
    if (activos.length === 0 && !f.sinEvaluar) facturasLimpias += 1;

    for (const h of activos) {
      porEstadoHallazgo[h.estadoRevision] = (porEstadoHallazgo[h.estadoRevision] ?? 0) + 1;
      if (h.estadoRevision === "ACEPTADO") montoAceptado += h.montoDiscrepancia;
      else if (h.estadoRevision === "PENDIENTE" || h.estadoRevision === "EVIDENCIA_SOLICITADA") montoPendienteRevision += h.montoDiscrepancia;
    }

    for (const h of activos) {
      const p = paretoMap.get(h.tipo) ?? { cantidad: 0, monto: 0 };
      p.cantidad += 1;
      p.monto += h.montoDiscrepancia;
      paretoMap.set(h.tipo, p);
    }

    const t = tallerMap.get(f.taller.id) ?? { nombre: f.taller.nombre, hallazgos: 0, monto: 0, facturas: 0 };
    t.facturas += 1;
    t.hallazgos += activos.length;
    t.monto += disc;
    tallerMap.set(f.taller.id, t);

    // Semanas relativas (últimas 10)
    const fecha = new Date(f.fechaIngreso);
    const dias = Math.floor((Date.now() - fecha.getTime()) / (24 * 3600 * 1000));
    if (dias < 70) {
      const idx = Math.floor(dias / 7); // 0 = semana actual
      const etiqueta = idx === 0 ? "Esta sem." : `S-${idx}`;
      const s = semanaMap.get(etiqueta) ?? { facturas: 0, conHallazgo: 0, monto: 0 };
      s.facturas += 1;
      if (activos.length > 0) s.conHallazgo += 1;
      s.monto += disc;
      semanaMap.set(etiqueta, s);
    }
  }

  const pareto = [...paretoMap.entries()]
    .map(([tipo, v]) => ({ tipo, cantidad: v.cantidad, monto: round2(v.monto) }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const semanaOrden = ["Esta sem.", "S-1", "S-2", "S-3", "S-4", "S-5", "S-6", "S-7", "S-8", "S-9"];
  const tendencia = semanaOrden
    .map((semana) => ({ semana, ...(semanaMap.get(semana) ?? { facturas: 0, conHallazgo: 0, monto: 0 }) }))
    .reverse();

  const topTalleres = [...tallerMap.values()]
    .map((t) => ({ ...t, monto: round2(t.monto) }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);

  // Semáforo de flujo de auditoría: verde = sin hallazgos, ámbar = en flujo, rojo = parada activa
  const andon = {
    verde: facturas.filter((f) => !f.sinEvaluar && f.hallazgos.filter((h) => h.regla !== "R10").length === 0).length,
    amarillo: facturas.filter((f) => ["RECIBIDA", "EN_AUDITORIA", "PARA_REVISION"].includes(f.estadoAuditoria) && !(f.sinEvaluar)).length,
    rojo: facturas.filter((f) => f.sinEvaluar).length,
  };

  const hallazgosTotales = [...facturas].reduce((a, f) => a + f.hallazgos.filter((h) => h.regla !== "R10").length, 0);
  const hallazgosResueltos = [...facturas].reduce(
    (a, f) => a + f.hallazgos.filter((h) => h.regla !== "R10" && h.estadoRevision !== "PENDIENTE").length,
    0
  );

  const dto: DashboardDTO = {
    totalFacturas: facturas.length,
    porEstado,
    porEstadoHallazgo,
    montoFacturado: round2(montoFacturado),
    montoDiscrepancia: round2(montoDiscrepancia),
    montoAceptado: round2(montoAceptado),
    montoPendienteRevision: round2(montoPendienteRevision),
    montoSinEvaluar: round2(montoSinEvaluar),
    facturasLimpias,
    pctSinHallazgos: facturas.length ? Math.round((facturasLimpias / facturas.length) * 1000) / 10 : 0,
    hallazgosResueltos,
    hallazgosTotales,
    pareto,
    tendencia,
    topTalleres,
    andon,
  };

  return NextResponse.json(dto);
}
