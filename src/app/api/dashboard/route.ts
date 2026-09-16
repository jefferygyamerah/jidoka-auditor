import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { DashboardDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET() {
  const facturas = await db.factura.findMany({
    include: {
      taller: { select: { id: true, nombre: true } },
      siniestro: { select: { id: true } },
      hallazgos: { select: { tipo: true, severidad: true, montoDiscrepancia: true } },
      revisiones: { orderBy: { fecha: "desc" }, take: 1 },
    },
  });

  const porEstado: Record<string, number> = { RECIBIDA: 0, EN_AUDITORIA: 0, OBSERVADA: 0, APROBADA: 0, RECHAZADA: 0 };
  let montoFacturado = 0;
  let montoDiscrepancia = 0;
  let montoRecuperado = 0;
  let montoEnNegociacion = 0;
  let facturasLimpias = 0;

  const paretoMap = new Map<string, { cantidad: number; monto: number }>();
  const tallerMap = new Map<string, { nombre: string; hallazgos: number; monto: number; facturas: number }>();
  const semanaMap = new Map<string, { facturas: number; conHallazgo: number; monto: number }>();

  for (const f of facturas) {
    porEstado[f.estadoAuditoria] = (porEstado[f.estadoAuditoria] ?? 0) + 1;
    montoFacturado += f.montoTotal;

    const disc = round2(f.hallazgos.reduce((a, h) => a + h.montoDiscrepancia, 0));
    montoDiscrepancia += disc;
    if (f.hallazgos.length === 0) facturasLimpias += 1;

    if (f.estadoAuditoria === "APROBADA" && f.montoSugerido != null && f.montoSugerido < f.montoTotal) {
      montoRecuperado += f.montoTotal - f.montoSugerido;
    } else if (f.estadoAuditoria === "RECHAZADA") {
      montoRecuperado += f.montoTotal;
    } else if (f.estadoAuditoria === "OBSERVADA") {
      montoEnNegociacion += disc;
    }

    for (const h of f.hallazgos) {
      const p = paretoMap.get(h.tipo) ?? { cantidad: 0, monto: 0 };
      p.cantidad += 1;
      p.monto += h.montoDiscrepancia;
      paretoMap.set(h.tipo, p);
    }

    const t = tallerMap.get(f.taller.id) ?? { nombre: f.taller.nombre, hallazgos: 0, monto: 0, facturas: 0 };
    t.facturas += 1;
    t.hallazgos += f.hallazgos.length;
    t.monto += disc;
    tallerMap.set(f.taller.id, t);

    // Semanas relativas (últimas 10) para la tendencia kaizen
    const fecha = new Date(f.fechaIngreso);
    const dias = Math.floor((Date.now() - fecha.getTime()) / (24 * 3600 * 1000));
    if (dias < 70) {
      const idx = Math.floor(dias / 7); // 0 = semana actual
      const etiqueta = idx === 0 ? "Esta sem." : `S-${idx}`;
      const s = semanaMap.get(etiqueta) ?? { facturas: 0, conHallazgo: 0, monto: 0 };
      s.facturas += 1;
      if (f.hallazgos.length > 0) s.conHallazgo += 1;
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

  // Andon: verde = aprobadas limpias, amarillo = en proceso/observadas, rojo = rechazadas
  const andon = {
    verde: facturas.filter((f) => f.estadoAuditoria === "APROBADA" && f.hallazgos.length === 0).length,
    amarillo: facturas.filter((f) => ["OBSERVADA", "RECIBIDA", "EN_AUDITORIA"].includes(f.estadoAuditoria)).length,
    rojo: facturas.filter((f) => f.estadoAuditoria === "RECHAZADA").length,
  };

  const dto: DashboardDTO = {
    totalFacturas: facturas.length,
    porEstado,
    montoFacturado: round2(montoFacturado),
    montoDiscrepancia: round2(montoDiscrepancia),
    montoRecuperado: round2(montoRecuperado),
    montoEnNegociacion: round2(montoEnNegociacion),
    facturasLimpias,
    pctFlujoDirecto: facturas.length ? Math.round((facturasLimpias / facturas.length) * 1000) / 10 : 0,
    horasAhorradas: Math.round((facturasLimpias * 0.75 + (facturas.length - facturasLimpias) * 0.5) * 10) / 10,
    pareto,
    tendencia,
    topTalleres,
    andon,
  };

  return NextResponse.json(dto);
}
