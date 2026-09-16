import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generarInformeIA } from "@/lib/audit-agent";
import type { InformeIA } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/facturas/[id]/informe — genera (o re-genera) el informe ejecutivo del agente con IA
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { regenerar } = (await req.json().catch(() => ({}))) as { regenerar?: boolean };

  const factura = await db.factura.findUnique({ where: { id }, select: { informeIA: true, informeEnCurso: true } });
  if (!factura) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

  if (factura.informeIA && !regenerar) {
    return NextResponse.json({ informe: JSON.parse(factura.informeIA) as InformeIA, cache: true });
  }
  if (factura.informeEnCurso) {
    return NextResponse.json({ error: "El agente ya está redactando el informe. Intenta en unos segundos." }, { status: 409 });
  }

  await db.factura.update({ where: { id }, data: { informeEnCurso: true } });
  try {
    const informe = await generarInformeIA(id);
    return NextResponse.json({ informe });
  } catch {
    await db.factura.update({ where: { id }, data: { informeEnCurso: false } });
    return NextResponse.json({ error: "El agente no pudo redactar el informe en este momento." }, { status: 502 });
  }
}
