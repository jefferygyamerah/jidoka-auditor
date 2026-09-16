import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calcularHuella } from "@/lib/audit-rules";
import { ejecutarAuditoria } from "@/lib/audit-agent";
import { severidadMaxima } from "@/lib/format";
import type { FacturaListaDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/facturas?estado=&tallerId=&q=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado") ?? undefined;
  const tallerId = searchParams.get("tallerId") ?? undefined;
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const facturas = await db.factura.findMany({
    where: {
      ...(estado ? { estadoAuditoria: estado } : {}),
      ...(tallerId ? { tallerId } : {}),
    },
    include: {
      taller: { select: { id: true, nombre: true, ciudad: true } },
      siniestro: { select: { id: true, numero: true, vehiculo: true, placa: true, zonaDanio: true, asegurado: true, montoReserva: true } },
      hallazgos: { select: { severidad: true, montoDiscrepancia: true } },
      revisiones: { orderBy: { fecha: "desc" }, take: 1 },
    },
    orderBy: { fechaIngreso: "desc" },
  });

  const lista: FacturaListaDTO[] = facturas
    .filter((f) =>
      q
        ? f.numero.toLowerCase().includes(q) ||
          f.siniestro.numero.toLowerCase().includes(q) ||
          f.siniestro.vehiculo.toLowerCase().includes(q) ||
          f.siniestro.placa.toLowerCase().includes(q) ||
          f.taller.nombre.toLowerCase().includes(q)
        : true
    )
    .map((f) => ({
      id: f.id,
      numero: f.numero,
      estadoAuditoria: f.estadoAuditoria,
      riesgo: f.riesgo,
      montoTotal: f.montoTotal,
      montoSugerido: f.montoSugerido,
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
    }));

  return NextResponse.json(lista);
}

interface PartidaInput {
  categoria: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
}

// POST /api/facturas — el taller sube una factura y el agente la audita al instante
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { tallerId, siniestroId, numero, montoDeclarado, partidas } = body as {
    tallerId?: string;
    siniestroId?: string;
    numero?: string;
    montoDeclarado?: number;
    partidas?: PartidaInput[];
  };

  if (!tallerId || !siniestroId || !numero || !partidas?.length) {
    return NextResponse.json({ error: "Faltan datos: taller, siniestro, número y al menos una partida." }, { status: 400 });
  }

  const existente = await db.factura.findUnique({ where: { numero } });
  if (existente) return NextResponse.json({ error: `El número de factura ${numero} ya fue registrado.` }, { status: 409 });

  const siniestro = await db.siniestro.findUnique({ where: { id: siniestroId } });
  if (!siniestro) return NextResponse.json({ error: "Siniestro no encontrado" }, { status: 404 });

  const limpias = partidas.map((p, i) => ({
    linea: i + 1,
    categoria: String(p.categoria ?? "REPUESTO"),
    codigo: String(p.codigo ?? "").trim().toUpperCase(),
    descripcion: String(p.descripcion ?? "").trim() || "Partida sin descripción",
    cantidad: Math.max(0, Number(p.cantidad) || 0),
    unidad: String(p.unidad ?? "UND"),
    precioUnitario: Math.max(0, round2(Number(p.precioUnitario) || 0)),
  }));
  for (const p of limpias) p.descripcion = p.descripcion;
  const subtotales = limpias.map((p) => ({ ...p, subtotal: round2(p.cantidad * p.precioUnitario) }));
  const subtotal = round2(subtotales.reduce((a, p) => a + p.subtotal, 0));
  const montoTotal = montoDeclarado != null && montoDeclarado > 0 ? round2(montoDeclarado) : round2(subtotal * 1.07);

  const huella = calcularHuella(
    tallerId,
    limpias.map((p) => ({ codigo: p.codigo, cantidad: p.cantidad, precioUnitario: p.precioUnitario }))
  );

  const factura = await db.factura.create({
    data: {
      numero,
      tallerId,
      siniestroId,
      montoTotal,
      huella,
      fechaEmision: new Date(),
      partidas: { create: subtotales },
    },
  });

  const resultado = await ejecutarAuditoria(factura.id);
  const completa = await db.factura.findUniqueOrThrow({ where: { id: factura.id }, include: { hallazgos: true } });

  return NextResponse.json({
    id: factura.id,
    numero: factura.numero,
    montoTotal,
    ...resultado,
    hallazgos: completa.hallazgos.map((h) => ({ tipo: h.tipo, severidad: h.severidad, descripcion: h.descripcion, montoDiscrepancia: h.montoDiscrepancia })),
  });
}
