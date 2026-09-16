import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { severidadMaxima } from "@/lib/format";
import type { FacturaDetalleDTO, InformeIA } from "@/lib/types";

export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/facturas/[id] — expediente completo con comparación contra tarifario
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const f = await db.factura.findUnique({
    where: { id },
    include: {
      taller: { select: { id: true, nombre: true, ciudad: true } },
      siniestro: { select: { id: true, numero: true, vehiculo: true, placa: true, zonaDanio: true, asegurado: true, montoReserva: true } },
      partidas: { orderBy: { linea: "asc" } },
      hallazgos: { orderBy: [{ severidad: "asc" }, { id: "asc" }] },
      logs: { orderBy: { paso: "asc" } },
      revisiones: { orderBy: { fecha: "desc" } },
    },
  });
  if (!f) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

  const tarifario = await db.tarifarioItem.findMany({ where: { tallerId: f.tallerId } });
  const mapaTarifario = new Map(tarifario.map((t) => [t.codigo, t]));

  // Códigos repetidos dentro de la factura (para marcar visualmente duplicadas)
  const conteoCodigos = new Map<string, number>();
  for (const p of f.partidas) conteoCodigos.set(p.codigo, (conteoCodigos.get(p.codigo) ?? 0) + 1);
  const partidasMarcadas = new Set(f.hallazgos.filter((h) => h.regla === "R2" && h.partidaId).map((h) => h.partidaId));
  const partidasConHallazgo = new Set(f.hallazgos.filter((h) => h.partidaId).map((h) => h.partidaId));

  const detalle: FacturaDetalleDTO = {
    id: f.id,
    numero: f.numero,
    estadoAuditoria: f.estadoAuditoria,
    riesgo: f.riesgo,
    montoTotal: f.montoTotal,
    montoSugerido: f.montoSugerido,
    itbmsPct: f.itbmsPct,
    huella: f.huella,
    fechaEmision: f.fechaEmision.toISOString(),
    fechaIngreso: f.fechaIngreso.toISOString(),
    informeEnCurso: f.informeEnCurso,
    tieneInforme: Boolean(f.informeIA),
    taller: f.taller,
    siniestro: f.siniestro,
    hallazgosCount: f.hallazgos.length,
    severidadMaxima: severidadMaxima(f.hallazgos.map((h) => h.severidad)),
    montoDiscrepancia: round2(f.hallazgos.reduce((a, h) => a + h.montoDiscrepancia, 0)),
    ultimaAccion: f.revisiones[0]?.accion ?? null,
    partidas: f.partidas.map((p) => {
      const pactado = mapaTarifario.get(p.codigo);
      return {
        ...p,
        precioPactado: pactado?.precioPactado ?? null,
        desvioPct: pactado && pactado.precioPactado > 0 ? Math.round(((p.precioUnitario - pactado.precioPactado) / pactado.precioPactado) * 1000) / 10 : null,
        duplicada: partidasMarcadas.has(p.id) || ((conteoCodigos.get(p.codigo) ?? 0) > 1),
        alerta: partidasConHallazgo.has(p.id),
      };
    }),
    hallazgos: f.hallazgos.map((h) => ({
      id: h.id,
      regla: h.regla,
      tipo: h.tipo,
      severidad: h.severidad as FacturaDetalleDTO["hallazgos"][number]["severidad"],
      descripcion: h.descripcion,
      montoDiscrepancia: h.montoDiscrepancia,
      detalle: safeJson(h.detalle),
    })),
    logs: f.logs.map((l) => ({ id: l.id, paso: l.paso, etapa: l.etapa, mensaje: l.mensaje, creadoEn: l.creadoEn.toISOString() })),
    revisiones: f.revisiones.map((r) => ({ id: r.id, auditor: r.auditor, rol: r.rol, accion: r.accion, comentario: r.comentario, montoAprobado: r.montoAprobado, fecha: r.fecha.toISOString() })),
    informeIA: safeJson<InformeIA>(f.informeIA),
  };

  return NextResponse.json(detalle);
}

function safeJson<T>(txt: string | null | undefined): T | null {
  if (!txt) return null;
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}
