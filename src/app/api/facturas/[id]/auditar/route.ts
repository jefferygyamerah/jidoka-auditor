import { NextRequest, NextResponse } from "next/server";
import { ejecutarAuditoria } from "@/lib/audit-agent";

export const dynamic = "force-dynamic";

// POST /api/facturas/[id]/auditar — el agente vuelve a correr el pipeline completo
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const resultado = await ejecutarAuditoria(id);
    return NextResponse.json(resultado);
  } catch {
    return NextResponse.json({ error: "No se pudo auditar la factura" }, { status: 500 });
  }
}
