import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ETIQUETA_REGLA_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

// POST /api/facturas/[id]/revision — decisión humana sobre una factura observada
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    auditor?: string;
    rol?: string;
    accion?: "APROBAR" | "RECHAZAR" | "ESCALAR" | "OBSERVAR";
    comentario?: string;
    montoAprobado?: number;
  } | null;

  if (!body?.accion || !body.auditor) {
    return NextResponse.json({ error: "Se requieren auditor y acción." }, { status: 400 });
  }

  const factura = await db.factura.findUnique({ where: { id }, include: { hallazgos: true } });
  if (!factura) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

  if (factura.estadoAuditoria === "APROBADA" && body.accion !== "RECHAZAR") {
    return NextResponse.json({ error: "La factura ya está aprobada." }, { status: 409 });
  }

  const montoAprobado =
    body.accion === "APROBAR"
      ? body.montoAprobado != null
        ? Math.max(0, Math.round(body.montoAprobado * 100) / 100)
        : factura.montoSugerido ?? factura.montoTotal
      : null;

  const [revision] = await db.$transaction([
    db.revision.create({
      data: {
        facturaId: id,
        auditor: body.auditor,
        rol: body.rol ?? "AUDITOR",
        accion: body.accion,
        comentario: body.comentario?.trim() || "Sin comentario.",
        montoAprobado,
      },
    }),
    db.factura.update({
      where: { id },
      data: {
        estadoAuditoria: body.accion === "APROBAR" ? "APROBADA" : body.accion === "RECHAZAR" ? "RECHAZADA" : "OBSERVADA",
        montoSugerido: body.accion === "APROBAR" ? montoAprobado : null,
      },
    }),
    db.logAgente.create({
      data: {
        facturaId: id,
        paso: 90,
        etapa: "HUMANO",
        mensaje: `Decisión humana (${body.auditor}, ${body.rol ?? "AUDITOR"}): ${ETIQUETA_REGLA_LABELS[body.accion] ?? body.accion}. ${body.comentario?.trim() || ""}`.trim(),
      },
    }),
  ]);

  // Si la factura se aprueba, el siniestro pasa a liquidado
  if (body.accion === "APROBAR") {
    const pendientes = await db.factura.count({
      where: { siniestroId: factura.siniestroId, id: { not: id }, estadoAuditoria: { in: ["RECIBIDA", "EN_AUDITORIA", "OBSERVADA"] } },
    });
    if (pendientes === 0) {
      await db.siniestro.update({ where: { id: factura.siniestroId }, data: { estado: "LIQUIDADO" } });
    }
  }

  return NextResponse.json({ ok: true, revisionId: revision.id, montoAprobado });
}
