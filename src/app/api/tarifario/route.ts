import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { TarifarioDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/tarifario?tallerId=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tallerId = searchParams.get("tallerId");
  if (!tallerId) return NextResponse.json({ error: "tallerId requerido" }, { status: 400 });

  const items = await db.tarifarioItem.findMany({
    where: { tallerId },
    orderBy: [{ categoria: "asc" }, { codigo: "asc" }],
  });

  const lista: TarifarioDTO[] = items.map((t) => ({
    id: t.id,
    categoria: t.categoria,
    codigo: t.codigo,
    descripcion: t.descripcion,
    unidad: t.unidad,
    precioPactado: t.precioPactado,
  }));
  return NextResponse.json(lista);
}

// PATCH /api/tarifario — admin ajusta precios pactados
export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { items?: { id: string; precioPactado: number }[] } | null;
  if (!body?.items?.length) return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

  for (const item of body.items) {
    const precio = Math.max(0, Math.round(item.precioPactado * 100) / 100);
    await db.tarifarioItem.update({ where: { id: item.id }, data: { precioPactado: precio } });
  }
  return NextResponse.json({ ok: true, actualizados: body.items.length });
}
