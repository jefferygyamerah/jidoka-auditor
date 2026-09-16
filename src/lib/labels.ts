// Etiquetas legibles compartidas
export const ETIQUETA_REGLA_LABELS: Record<string, string> = {
  APROBAR: "Aprobada por revisor humano",
  RECHAZAR: "Rechazada por revisor humano",
  ESCALAR: "Escalada a supervisor",
  OBSERVAR: "Observada por revisor humano",
};

export const ACCION_LABEL: Record<string, string> = {
  APROBAR: "Aprobada",
  APROBAR_CON_AJUSTE: "Aprobada con ajuste",
  ESCALAR: "Escalar a supervisor",
  RECHAZAR: "Rechazar",
};

export const ROL_LABEL: Record<string, string> = {
  AUDITOR: "Auditor de siniestros",
  SUPERVISOR: "Supervisor de auditoría",
  ADMIN: "Administrador",
  AGENTE: "Agente de IA",
  TALLER: "Taller afiliado",
};
