import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ConfiguracionDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/configuracion
export async function GET() {
  let config = await db.configuracion.findUnique({ where: { id: "GLOBAL" } });
  if (!config) {
    config = await db.configuracion.create({ data: { id: "GLOBAL" } });
  }
  const dto: ConfiguracionDTO = {
    toleranciaPct: config.toleranciaPct,
    topeHonorariosPct: config.topeHonorariosPct,
    umbralAutoajuste: config.umbralAutoajuste,
  };
  return NextResponse.json(dto);
}

// PATCH /api/configuracion — parámetros poka-yoke globales (solo admin)
export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<ConfiguracionDTO> | null;
  if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const data = {
    toleranciaPct: Math.max(0, Math.min(50, Number(body.toleranciaPct) || 2)),
    topeHonorariosPct: Math.max(1, Math.min(100, Number(body.topeHonorariosPct) || 20)),
    umbralAutoajuste: Math.max(0, Math.min(5000, Number(body.umbralAutoajuste) || 50)),
  };
  const config = await db.configuracion.upsert({ where: { id: "GLOBAL" }, create: { id: "GLOBAL", ...data }, update: data });
  return NextResponse.json({ ok: true, config });
}
