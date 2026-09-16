import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ACCION_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

// POST /api/facturas/[id]/revision
// Revisión POR HALLAZGO (contrato #44): el auditor humano puede
// · ACEPTAR_HALLAZGO     — valida la discrepancia señalada
// · DESCARTAR_HALLAZGO   — la rechaza; motivo obligatorio
// · PEDIR_EVIDENCIA      — solicita el documento/dato exacto; motivo obligatorio
// · REAUDITAR            — vuelve a correr el pipeline (p.ej. tras cargar evidencia)
// El agente NUNCA aprueba ni rechaza pagos; aquí tampoco se liquida nada.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    auditor?: string;
    rol?: string;
    accion?: "ACEPTAR_HALLAZGO" | "DESCARTAR_HALLAZGO" | "PEDIR_EVIDENCIA" | "REAUDITAR";
    comentario?: string;
    hallazgoId?: string;
  } | null;

  if (!body?.accion || !body.auditor) {
    return NextResponse.json({ error: "Se requieren auditor y acción." }, { status: 400 });
  }

  const factura = await db.factura.findUnique({ where: { id }, include: { hallazgos: true } });
  if (!factura) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

  // REAUDITAR no exige hallazgoId
  if (body.accion === "REAUDITAR") {
    const { ejecutarAuditoria } = await import("@/lib/audit-agent");
    const resultado = await ejecutarAuditoria(id);
    await db.revision.create({
      data: {
        facturaId: id,
        auditor: body.auditor,
        rol: body.rol ?? "AUDITOR",
        accion: "REAUDITAR",
        comentario: body.comentario?.trim() || "Re-auditoría ejecutada por el auditor.",
      },
    });
    return NextResponse.json({ ok: true, reauditado: true, ...resultado });
  }

  const comentario = body.comentario?.trim() ?? "";
  const exigeMotivo = body.accion === "DESCARTAR_HALLAZGO" || body.accion === "PEDIR_EVIDENCIA";
  if (!body.hallazgoId) {
    return NextResponse.json({ error: "Se requiere hallazgoId: la revisión es por hallazgo, no por factura." }, { status: 400 });
  }
  if (exigeMotivo && !comentario) {
    return NextResponse.json(
      { error: body.accion === "DESCARTAR_HALLAZGO" ? "Motivo obligatorio para descartar un hallazgo." : "Indica qué evidencia se solicita." },
      { status: 400 }
    );
  }

  const hallazgo = factura.hallazgos.find((h) => h.id === body.hallazgoId);
  if (!hallazgo) return NextResponse.json({ error: "Hallazgo no encontrado en esta factura." }, { status: 404 });

  const nuevoEstado =
    body.accion === "ACEPTAR_HALLAZGO" ? "ACEPTADO" : body.accion === "DESCARTAR_HALLAZGO" ? "DESCARTADO" : "EVIDENCIA_SOLICITADA";

  const [revision] = await db.$transaction([
    db.revision.create({
      data: {
        facturaId: id,
        hallazgoId: body.hallazgoId,
        auditor: body.auditor,
        rol: body.rol ?? "AUDITOR",
        accion: body.accion,
        comentario: comentario || "Hallazgo aceptado por el auditor.",
      },
    }),
    db.hallazgo.update({
      where: { id: body.hallazgoId },
      data: {
        estadoRevision: nuevoEstado,
        comentarioRevision: comentario || null,
        revisadoPor: body.auditor,
        revisadoEn: new Date(),
        ...(body.accion === "PEDIR_EVIDENCIA" ? { evidenciaPendiente: comentario } : {}),
      },
    }),
    db.logAgente.create({
      data: {
        facturaId: id,
        paso: 90,
        etapa: "HUMANO",
        mensaje: `Revisión del auditor (${body.auditor}, ${body.rol ?? "AUDITOR"}): ${ACCION_LABEL[body.accion] ?? body.accion} — hallazgo [${hallazgo.regla}] ${hallazgo.tipo}. ${comentario}`.trim(),
      },
    }),
  ]);

  // Cierre de flujo: cuando NO quedan hallazgos pendientes, el informe queda CERRADA
  // (cierra el ciclo de auditoría; no implica pago aprobado ni rechazado).
  const pendientes = await db.hallazgo.count({ where: { facturaId: id, estadoRevision: "PENDIENTE" } });
  if (pendientes === 0 && factura.estadoAuditoria === "PARA_REVISION") {
    await db.factura.update({ where: { id }, data: { estadoAuditoria: "CERRADA" } });
    await db.logAgente.create({
      data: {
        facturaId: id,
        paso: 91,
        etapa: "HUMANO",
        mensaje: "Todos los hallazgos revisados: informe cerrado. Las decisiones de pago siguen el proceso del asegurador.",
      },
    });
  }

  return NextResponse.json({ ok: true, revisionId: revision.id, estadoHallazgo: nuevoEstado, informeCerrado: pendientes === 0 });
}
