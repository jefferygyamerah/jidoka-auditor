import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { TallerDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/talleres
export async function GET() {
  const talleres = await db.taller.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });
  const lista: TallerDTO[] = talleres.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    ruc: t.ruc,
    ciudad: t.ciudad,
    telefono: t.telefono,
    contacto: t.contacto,
    descuentoPct: t.descuentoPct,
  }));
  return NextResponse.json(lista);
}
