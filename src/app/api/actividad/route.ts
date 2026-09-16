import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ActividadDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/actividad — bitácora global del agente (tablero andon en vivo)
export async function GET() {
  const logs = await db.logAgente.findMany({
    orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
    take: 40,
    include: { factura: { select: { numero: true, estadoAuditoria: true } } },
  });

  const lista: ActividadDTO[] = logs.map((l) => ({
    id: l.id,
    facturaId: l.facturaId,
    facturaNumero: l.factura.numero,
    estadoAuditoria: l.factura.estadoAuditoria,
    etapa: l.etapa,
    mensaje: l.mensaje,
    creadoEn: l.creadoEn.toISOString(),
  }));

  return NextResponse.json(lista);
}
