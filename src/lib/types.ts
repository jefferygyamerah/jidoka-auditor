// Tipos compartidos entre API y cliente
export interface TallerDTO {
  id: string;
  nombre: string;
  ruc: string;
  ciudad: string;
  telefono: string;
  contacto: string;
  descuentoPct: number;
}

export interface SiniestroDTO {
  id: string;
  numero: string;
  poliza: string;
  asegurado: string;
  vehiculo: string;
  anioVehiculo: number;
  placa: string;
  fechaOcurrencia: string;
  tipoCobertura: string;
  zonaDanio: string;
  descripcion: string;
  montoReserva: number;
  estado: string;
  facturasCount: number;
  montoFacturado: number;
}

export interface HallazgoDTO {
  id: string;
  regla: string;
  tipo: string;
  severidad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  descripcion: string;
  montoDiscrepancia: number;
  detalle: Record<string, unknown>;
}

export interface PartidaDTO {
  id: string;
  linea: number;
  categoria: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number;
  precioPactado?: number | null;
  desvioPct?: number | null;
  duplicada?: boolean;
  alerta?: boolean;
}

export interface RevisionDTO {
  id: string;
  auditor: string;
  rol: string;
  accion: string;
  comentario: string;
  montoAprobado: number | null;
  fecha: string;
}

export interface LogAgenteDTO {
  id: string;
  paso: number;
  etapa: string;
  mensaje: string;
  creadoEn: string;
}

export interface InformeIA {
  resumen: string;
  recomendacion: "APROBAR" | "APROBAR_CON_AJUSTE" | "ESCALAR" | "RECHAZAR";
  causaRaiz: string;
  acciones: string[];
  confianza: number;
}

export interface FacturaListaDTO {
  id: string;
  numero: string;
  estadoAuditoria: string;
  riesgo: number;
  montoTotal: number;
  montoSugerido: number | null;
  fechaEmision: string;
  fechaIngreso: string;
  informeEnCurso: boolean;
  tieneInforme: boolean;
  taller: { id: string; nombre: string; ciudad: string };
  siniestro: { id: string; numero: string; vehiculo: string; placa: string; zonaDanio: string; asegurado: string; montoReserva: number };
  hallazgosCount: number;
  severidadMaxima: string | null;
  montoDiscrepancia: number;
  ultimaAccion: string | null;
}

export interface FacturaDetalleDTO extends FacturaListaDTO {
  itbmsPct: number;
  huella: string;
  partidas: PartidaDTO[];
  hallazgos: HallazgoDTO[];
  logs: LogAgenteDTO[];
  revisiones: RevisionDTO[];
  informeIA: InformeIA | null;
}

export interface DashboardDTO {
  totalFacturas: number;
  porEstado: Record<string, number>;
  montoFacturado: number;
  montoDiscrepancia: number;
  montoRecuperado: number;
  montoEnNegociacion: number;
  facturasLimpias: number;
  pctFlujoDirecto: number;
  horasAhorradas: number;
  pareto: { tipo: string; cantidad: number; monto: number }[];
  tendencia: { semana: string; facturas: number; conHallazgo: number; monto: number }[];
  topTalleres: { nombre: string; hallazgos: number; monto: number; facturas: number }[];
  andon: { verde: number; amarillo: number; rojo: number };
}

export interface TarifarioDTO {
  id: string;
  categoria: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioPactado: number;
}

export interface ConfiguracionDTO {
  toleranciaPct: number;
  topeHonorariosPct: number;
  umbralAutoajuste: number;
}

export interface ActividadDTO {
  id: string;
  facturaId: string;
  facturaNumero: string;
  estadoAuditoria: string;
  etapa: string;
  mensaje: string;
  creadoEn: string;
}
