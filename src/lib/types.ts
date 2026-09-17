// Tipos compartidos entre API y cliente
// Contrato alineado al alcance acordado (#44): informe de discrepancias
// línea por línea; el agente nunca decide pagos.
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

export interface SiniestroResumenDTO {
  id: string;
  numero: string;
  vehiculo: string;
  placa: string;
  zonaDanio: string;
  asegurado: string;
  descripcion: string;
  montoReserva: number;
}

export interface HallazgoDTO {
  id: string;
  regla: string;
  tipo: string;
  severidad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  descripcion: string;
  montoDiscrepancia: number;
  detalle: Record<string, unknown>;
  evidencia: EvidenciaCita[];
  equivalencia: EquivalenciaPropuesta | null; // «¿de dónde sale este monto?» cuando la partida no está en el catálogo
  propuestaIA: PropuestaIA | null; // el LLM lee y cita; no decide
  ajustePropuesto: number | null;
  estadoRevision: "PENDIENTE" | "ACEPTADO" | "DESCARTADO" | "EVIDENCIA_SOLICITADA";
  comentarioRevision: string | null;
  revisadoPor: string | null;
  revisadoEn: string | null;
  evidenciaPendiente: string | null;
}

/**
 * Equivalencia con el catálogo propuesta para una partida que no coincide por código.
 * Es una PROPUESTA con evidencia: ni el motor ni el LLM cambian el código; decide el auditor.
 */
export interface EquivalenciaPropuesta {
  codigoPropuesto: string;
  descripcionPropuesta: string;
  precioPactado: number | null;
  confianza: number; // 0–1 (determinista: tokens comunes + unidad + categoría)
  motivo: string;
  evidencia: EvidenciaCita[];
}

/** Alternativa sugerida por el LLM citando la descripción exacta del tarifario. Nunca decide. */
export interface PropuestaIA {
  codigoPropuesto: string;
  descripcionCitada: string; // texto exacto del tarifario citado por el modelo
  motivo: string;
  coincideConElMotor: boolean;
}

export interface EvidenciaCita {
  fuente: string; // p.ej. "Tarifario pactado Taller X v3", "Factura F-001234 p.1 línea 3", "Informe del siniestro S-2026-001"
  localizador: string; // p.ej. "código PAI-4421", "línea 3", "zona FRENTE"
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
  contexto?: string | null;
  precioPactado?: number | null;
  desvioPct?: number | null;
  duplicada?: boolean;
  alerta?: boolean;
}

export interface RevisionDTO {
  id: string;
  hallazgoId: string | null;
  auditor: string;
  rol: string;
  accion: string;
  comentario: string;
  fecha: string;
}

export interface LogAgenteDTO {
  id: string;
  paso: number;
  etapa: string;
  mensaje: string;
  creadoEn: string;
}

/** Informe del agente: resume discrepancias línea por línea. Sin recomendación de pago. */
export interface InformeAgente {
  resumen: string;
  estadoInforme: "LISTO" | "INCOMPLETO";
  lineas: { linea: number | null; descripcion: string; estado: "CONFORME" | "DISCREPANCIA" | "SIN_EVALUAR"; detalle: string }[];
  montosSinEvaluar: string[];
  nota: string;
}

export interface FacturaListaDTO {
  id: string;
  numero: string;
  estadoAuditoria: string;
  riesgo: number;
  montoTotal: number;
  montoAjusteProp: number | null;
  montoSinEvaluar: number | null;
  sinEvaluar: boolean;
  fechaEmision: string;
  fechaIngreso: string;
  informeEnCurso: boolean;
  tieneInforme: boolean;
  taller: { id: string; nombre: string; ciudad: string };
  siniestro: SiniestroResumenDTO;
  hallazgosCount: number;
  hallazgosPendientes: number;
  severidadMaxima: string | null;
  montoDiscrepancia: number;
  ultimaAccion: string | null;
}

export interface FacturaDetalleDTO extends FacturaListaDTO {
  itbmsPct: number;
  huella: string;
  notaBloqueo: string | null;
  partidas: PartidaDTO[];
  hallazgos: HallazgoDTO[];
  logs: LogAgenteDTO[];
  revisiones: RevisionDTO[];
  informeAgente: InformeAgente | null;
}

export interface DashboardDTO {
  totalFacturas: number;
  porEstado: Record<string, number>;
  porEstadoHallazgo: Record<string, number>;
  montoFacturado: number;
  montoDiscrepancia: number;
  montoAceptado: number; // suma de discrepancias de hallazgos ACEPTADOS por el auditor
  montoPendienteRevision: number; // discrepancias aún sin decisión del auditor
  montoSinEvaluar: number; // montos bloqueados por regla de parada
  facturasLimpias: number;
  pctSinHallazgos: number;
  hallazgosResueltos: number;
  hallazgosTotales: number;
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
