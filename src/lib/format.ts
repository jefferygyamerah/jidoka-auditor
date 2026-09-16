// Formateadores compartidos (seguros en cliente y servidor)
const usdFmt = new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdFmt0 = new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const usd = (n: number) => usdFmt.format(n);
export const usdK = (n: number) => usdFmt0.format(n);
export const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

export function fechaCorta(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("es-PA", { day: "2-digit", month: "short" });
}

export function fechaCompleta(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("es-PA", { day: "2-digit", month: "short", year: "numeric" });
}

export function horaCorta(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit" });
}

export const ZONA_LABEL: Record<string, string> = {
  FRENTE: "Frente",
  TRASERA: "Trasera",
  LATERAL_IZQ: "Lateral izq.",
  LATERAL_DER: "Lateral der.",
  MULTIPLE: "Múltiple",
  VIDRIOS: "Vidrios",
};

export const ESTADO_LABEL: Record<string, string> = {
  RECIBIDA: "Recibida",
  EN_AUDITORIA: "Auditando",
  PARA_REVISION: "Para revisión",
  CERRADA: "Cerrada",
  // compat con referencias históricas en datos viejos
  OBSERVADA: "Para revisión",
  APROBADA: "Cerrada",
  RECHAZADA: "Cerrada",
};

export const SEVERIDAD_ORDEN: Record<string, number> = { BAJA: 1, MEDIA: 2, ALTA: 3, CRITICA: 4 };

export function severidadMaxima(sevs: string[]): string | null {
  let max: string | null = null;
  for (const s of sevs) if (!max || SEVERIDAD_ORDEN[s] > SEVERIDAD_ORDEN[max]) max = s;
  return max;
}
