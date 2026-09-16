// Etiquetas legibles compartidas
// Estados de flujo de auditoría (NUNCA estados de pago)
export const ESTADO_FLUJO_LABEL: Record<string, string> = {
  RECIBIDA: "Recibida",
  EN_AUDITORIA: "Auditando",
  PARA_REVISION: "Para revisión del auditor",
  CERRADA: "Informe cerrado",
};

export const ESTADO_HALLAZGO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente de revisión",
  ACEPTADO: "Aceptado por el auditor",
  DESCARTADO: "Descartado con motivo",
  EVIDENCIA_SOLICITADA: "Evidencia solicitada",
};

export const ACCION_LABEL: Record<string, string> = {
  ACEPTAR_HALLAZGO: "Hallazgo aceptado",
  DESCARTAR_HALLAZGO: "Hallazgo descartado",
  PEDIR_EVIDENCIA: "Evidencia solicitada",
  REAUDITAR: "Re-auditoría ejecutada",
};

export const INFORME_ESTADO_LABEL: Record<string, string> = {
  LISTO: "Informe completo",
  INCOMPLETO: "Informe incompleto — montos sin evaluar",
  EN_PROCESO: "Informe en preparación",
  SIN_INFORME: "Sin informe",
};

export const ROL_LABEL: Record<string, string> = {
  AUDITOR: "Auditor de siniestros",
  SUPERVISOR: "Supervisor de auditoría",
  ADMIN: "Administrador",
  AGENTE: "Agente de IA",
  TALLER: "Taller afiliado",
};
