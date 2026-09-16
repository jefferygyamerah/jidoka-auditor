import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { SiniestroDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/siniestros
export async function GET() {
  const siniestros = await db.siniestro.findMany({
    include: {
      facturas: {
        select: { montoTotal: true, montoSugerido: true, estadoAuditoria: true },
      },
    },
    orderBy: { fechaOcurrencia: "desc" },
  });

  const lista: SiniestroDTO[] = siniestros.map((s) => {
    const montoFacturado = round2(
      s.facturas.reduce((a, f) => a + (f.estadoAuditoria === "RECHAZADA" ? 0 : (f.montoSugerido ?? f.montoTotal)), 0)
    );
    return {
      id: s.id,
      numero: s.numero,
      poliza: s.poliza,
      asegurado: s.asegurado,
      vehiculo: s.vehiculo,
      anioVehiculo: s.anioVehiculo,
      placa: s.placa,
      fechaOcurrencia: s.fechaOcurrencia.toISOString(),
      tipoCobertura: s.tipoCobertura,
      zonaDanio: s.zonaDanio,
      descripcion: s.descripcion,
      montoReserva: s.montoReserva,
      estado: s.estado,
      facturasCount: s.facturas.length,
      montoFacturado,
    };
  });

  return NextResponse.json(lista);
}
