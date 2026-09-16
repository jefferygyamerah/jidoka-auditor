// ─────────────────────────────────────────────────────────────
// Seed · JIDOKA — datos de demostración realistas (Panamá, USD)
// Ejecutar: JIDOKA_DISABLE_IA=1 npx tsx scripts/seed.ts
// ─────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import { generarInformeAgente } from "../src/lib/audit-agent";

const db = new PrismaClient({ log: [] });
const round2 = (n: number) => Math.round(n * 100) / 100;
const HOY = new Date();

// ── Catálogo base (precio de referencia nacional) ─────────────
interface ItemCatalogo {
  codigo: string;
  categoria: "REPUESTO" | "INSUMO" | "MANO_OBRA" | "HONORARIO";
  descripcion: string;
  unidad: string;
  precioBase: number;
}

const CATALOGO: ItemCatalogo[] = [
  { codigo: "R-1001", categoria: "REPUESTO", descripcion: "Parachoques delantero", unidad: "UND", precioBase: 285 },
  { codigo: "R-1002", categoria: "REPUESTO", descripcion: "Parachoques trasero", unidad: "UND", precioBase: 265 },
  { codigo: "R-1003", categoria: "REPUESTO", descripcion: "Parrilla frontal", unidad: "UND", precioBase: 145 },
  { codigo: "R-1004", categoria: "REPUESTO", descripcion: "Faro derecho", unidad: "UND", precioBase: 175 },
  { codigo: "R-1005", categoria: "REPUESTO", descripcion: "Faro izquierdo", unidad: "UND", precioBase: 175 },
  { codigo: "R-1006", categoria: "REPUESTO", descripcion: "Capó", unidad: "UND", precioBase: 320 },
  { codigo: "R-1007", categoria: "REPUESTO", descripcion: "Guardafango derecho", unidad: "UND", precioBase: 185 },
  { codigo: "R-1008", categoria: "REPUESTO", descripcion: "Guardafango izquierdo", unidad: "UND", precioBase: 185 },
  { codigo: "R-1009", categoria: "REPUESTO", descripcion: "Puerta delantera derecha", unidad: "UND", precioBase: 340 },
  { codigo: "R-1010", categoria: "REPUESTO", descripcion: "Puerta delantera izquierda", unidad: "UND", precioBase: 340 },
  { codigo: "R-1011", categoria: "REPUESTO", descripcion: "Puerta trasera derecha", unidad: "UND", precioBase: 315 },
  { codigo: "R-1012", categoria: "REPUESTO", descripcion: "Puerta trasera izquierda", unidad: "UND", precioBase: 315 },
  { codigo: "R-1013", categoria: "REPUESTO", descripcion: "Espejo retrovisor derecho", unidad: "UND", precioBase: 95 },
  { codigo: "R-1014", categoria: "REPUESTO", descripcion: "Espejo retrovisor izquierdo", unidad: "UND", precioBase: 95 },
  { codigo: "R-1015", categoria: "REPUESTO", descripcion: "Parabrisas", unidad: "UND", precioBase: 230 },
  { codigo: "R-1016", categoria: "REPUESTO", descripcion: "Luneta trasera", unidad: "UND", precioBase: 195 },
  { codigo: "R-1017", categoria: "REPUESTO", descripcion: "Radiador", unidad: "UND", precioBase: 260 },
  { codigo: "R-1018", categoria: "REPUESTO", descripcion: "Absorber delantero", unidad: "UND", precioBase: 120 },
  { codigo: "R-1019", categoria: "REPUESTO", descripcion: "Absorber trasero", unidad: "UND", precioBase: 110 },
  { codigo: "R-1020", categoria: "REPUESTO", descripcion: "Faldón lateral derecho", unidad: "UND", precioBase: 88 },
  { codigo: "R-1021", categoria: "REPUESTO", descripcion: "Faldón lateral izquierdo", unidad: "UND", precioBase: 88 },
  { codigo: "I-2001", categoria: "INSUMO", descripcion: "Pintura base poliuretano", unidad: "GLB", precioBase: 38 },
  { codigo: "I-2002", categoria: "INSUMO", descripcion: "Endurecedor", unidad: "LTR", precioBase: 22 },
  { codigo: "I-2003", categoria: "INSUMO", descripcion: "Masilla plástica", unidad: "KG", precioBase: 14 },
  { codigo: "I-2004", categoria: "INSUMO", descripcion: "Lija grano 400", unidad: "UND", precioBase: 1.8 },
  { codigo: "I-2005", categoria: "INSUMO", descripcion: "Cinta masking", unidad: "RLL", precioBase: 4.5 },
  { codigo: "I-2006", categoria: "INSUMO", descripcion: "Thinner estándar", unidad: "GLB", precioBase: 16 },
  { codigo: "I-2007", categoria: "INSUMO", descripcion: "Anticorrosivo", unidad: "GLB", precioBase: 28 },
  { codigo: "I-2008", categoria: "INSUMO", descripcion: "Soldadura MIG", unidad: "KG", precioBase: 12 },
  { codigo: "I-2009", categoria: "INSUMO", descripcion: "Grapas plásticas", unidad: "CAJA", precioBase: 18 },
  { codigo: "I-2010", categoria: "INSUMO", descripcion: "Sellador uretano", unidad: "UND", precioBase: 24 },
  { codigo: "M-3001", categoria: "MANO_OBRA", descripcion: "Desmontaje e instalación de parachoques", unidad: "HRS", precioBase: 28 },
  { codigo: "M-3002", categoria: "MANO_OBRA", descripcion: "Preparación y pintura de panel", unidad: "HRS", precioBase: 32 },
  { codigo: "M-3003", categoria: "MANO_OBRA", descripcion: "Enderezado de chapa", unidad: "HRS", precioBase: 30 },
  { codigo: "M-3004", categoria: "MANO_OBRA", descripcion: "Alineación de suspensión", unidad: "SRV", precioBase: 55 },
  { codigo: "M-3005", categoria: "MANO_OBRA", descripcion: "Diagnóstico electrónico de sensores", unidad: "SRV", precioBase: 45 },
  { codigo: "M-3006", categoria: "MANO_OBRA", descripcion: "Prueba de estanqueidad", unidad: "SRV", precioBase: 35 },
  { codigo: "M-3007", categoria: "MANO_OBRA", descripcion: "Mano de obra mecánica general", unidad: "HRS", precioBase: 26 },
  { codigo: "H-4001", categoria: "HONORARIO", descripcion: "Administración de siniestro", unidad: "SRV", precioBase: 65 },
  { codigo: "H-4002", categoria: "HONORARIO", descripcion: "Peritaje interno", unidad: "SRV", precioBase: 80 },
  { codigo: "H-4003", categoria: "HONORARIO", descripcion: "Traslado de vehículo con grúa", unidad: "SRV", precioBase: 50 },
  { codigo: "H-4004", categoria: "HONORARIO", descripcion: "Fotografía de expediente", unidad: "SRV", precioBase: 20 },
];

const TALLERES = [
  { nombre: "Autocentro Vía España, S.A.", ruc: "1556-328-110", ciudad: "Panamá", telefono: "223-4410", contacto: "Ernesto Saldaña", descuentoPct: 5 },
  { nombre: "Carrocerías Pacífico, S.A.", ruc: "2556-918-221", ciudad: "Panamá Este", telefono: "300-2288", contacto: "Yaritza Cueto", descuentoPct: 8 },
  { nombre: "El Dorado Motors, S.A.", ruc: "4556-227-344", ciudad: "Panamá Oeste", telefono: "261-7702", contacto: "Rubén Vergara", descuentoPct: 4 },
  { nombre: "Serviautos San Isidro, S.A.", ruc: "8556-114-501", ciudad: "Colón", telefono: "441-6633", contacto: "Ana Lucía Petit", descuentoPct: 6 },
  { nombre: "Chapa y Pintura Amador", ruc: "12556-778-617", ciudad: "Arraiján", telefono: "250-9904", contacto: "Óscar Amador Jr.", descuentoPct: 10 },
  { nombre: "Multiservicios Automotriz Chepo", ruc: "4556-590-822", ciudad: "Chepo", telefono: "218-4471", contacto: "Domingo Ríos", descuentoPct: 3 },
  { nombre: "Taller La Junction (sin convenio cargado)", ruc: "7556-401-933", ciudad: "San Miguelito", telefono: "267-1180", contacto: "Héctor Barrios", descuentoPct: 0 },
];

// Varianza determinista de precios pactados por taller (±6%)
function precioPactado(tallerIdx: number, item: ItemCatalogo): number {
  const seed = [...(String(tallerIdx) + item.codigo)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const delta = ((seed % 13) - 6) / 100;
  return round2(item.precioBase * (1 + delta));
}

// ── Siniestros ────────────────────────────────────────────────
const SINIESTROS = [
  { numero: "SIN-2026-0412", poliza: "AUT-2026-88041", asegurado: "Juan Carlos Villarreal", vehiculo: "Toyota Corolla", anioVehiculo: 2022, placa: "C452913", diasAtras: 118, tipoCobertura: "Colisión", zonaDanio: "FRENTE", descripcion: "Colisión frontal leve contra barrera en Corredor Sur. Daños en parachoques delantero, faro derecho y parrilla.", montoReserva: 3850 },
  { numero: "SIN-2026-0431", poliza: "AUT-2026-88267", asegurado: "María Fernanda Ortiz", vehiculo: "Hyundai Tucson", anioVehiculo: 2021, placa: "B781204", diasAtras: 112, tipoCobertura: "Colisión", zonaDanio: "TRASERA", descripcion: "Impacto trasero en cadena de choque en Vía Israel. Parachoques trasero y absorber afectados.", montoReserva: 4200 },
  { numero: "SIN-2026-0455", poliza: "AUT-2026-88590", asegurado: "Roberto Chen Jiménez", vehiculo: "Kia Rio", anioVehiculo: 2019, placa: "D225517", diasAtras: 105, tipoCobertura: "Colisión", zonaDanio: "LATERAL_DER", descripcion: "Rayón lateral derecho en estacionamiento de Multicentro. Puerta delantera derecha y espejo con daños.", montoReserva: 2750 },
  { numero: "SIN-2026-0462", poliza: "AUT-2026-88655", asegurado: "Gabriela Arosemena", vehiculo: "Toyota Hilux", anioVehiculo: 2023, placa: "C918372", diasAtras: 98, tipoCobertura: "Colisión", zonaDanio: "FRENTE", descripcion: "Colisión frontal con poste en Arraiján. Parachoques, radiador y capó comprometidos.", montoReserva: 6900 },
  { numero: "SIN-2026-0478", poliza: "AUT-2026-88802", asegurado: "Luis Enrique Motta", vehiculo: "Honda CR-V", anioVehiculo: 2020, placa: "A556218", diasAtras: 92, tipoCobertura: "Colisión", zonaDanio: "MULTIPLE", descripcion: "Vuelco menor en carretera a El Valle. Daños múltiples en carrocería, laterales y frente.", montoReserva: 8500 },
  { numero: "SIN-2026-0490", poliza: "AUT-2026-89016", asegurado: "Carla De León", vehiculo: "Nissan Sentra", anioVehiculo: 2022, placa: "B103982", diasAtras: 87, tipoCobertura: "Colisión", zonaDanio: "TRASERA", descripcion: "Alcance trasero en semáforo de Transístmica. Parachoques trasero deformado, luneta intacta.", montoReserva: 3100 },
  { numero: "SIN-2026-0501", poliza: "AUT-2026-89144", asegurado: "Felipe Baldizón", vehiculo: "Mazda CX-5", anioVehiculo: 2023, placa: "C744029", diasAtras: 81, tipoCobertura: "Colisión", zonaDanio: "LATERAL_IZQ", descripcion: "Lateral izquierdo rayado por vehículo en movimiento en Punta Pacífica. Puerta y espejo izquierdos.", montoReserva: 4750 },
  { numero: "SIN-2026-0514", poliza: "AUT-2026-89278", asegurado: "Ivonne Castrellón", vehiculo: "Toyota Yaris", anioVehiculo: 2018, placa: "E928114", diasAtras: 74, tipoCobertura: "Vidrios", zonaDanio: "VIDRIOS", descripcion: "Impacto de piedra en autopista, rotura total de parabrisas. Sin daños adicionales.", montoReserva: 950 },
  { numero: "SIN-2026-0522", poliza: "AUT-2026-89355", asegurado: "Alfredo Mizrachi", vehiculo: "Ford Ranger", anioVehiculo: 2021, placa: "C367588", diasAtras: 69, tipoCobertura: "Colisión", zonaDanio: "FRENTE", descripcion: "Choque frontal con camioneta en Tocumen. Daños frontales amplios, absorber incluido.", montoReserva: 7300 },
  { numero: "SIN-2026-0537", poliza: "AUT-2026-89510", asegurado: "Yesenia Morris", vehiculo: "Suzuki Swift", anioVehiculo: 2020, placa: "D884610", diasAtras: 63, tipoCobertura: "Colisión", zonaDanio: "LATERAL_DER", descripcion: "Daño lateral derecho con faldón y puerta trasera derecha en curva de Las Cumbres.", montoReserva: 2400 },
  { numero: "SIN-2026-0545", poliza: "AUT-2026-89622", asegurado: "Héctor Quintero", vehiculo: "Mitsubishi L200", anioVehiculo: 2022, placa: "B997033", diasAtras: 57, tipoCobertura: "Colisión", zonaDanio: "TRASERA", descripcion: "Impacto trasero en Veracruz. Parachoques trasero y absorber, chasis sin deformación.", montoReserva: 5600 },
  { numero: "SIN-2026-0553", poliza: "AUT-2026-89718", asegurado: "Priscilla Fábrega", vehiculo: "Hyundai Accent", anioVehiculo: 2019, placa: "E145879", diasAtras: 51, tipoCobertura: "Colisión", zonaDanio: "LATERAL_IZQ", descripcion: "Rayón largo lateral izquierdo en parqueo de Costa del Este. Puertas y faldón izquierdos.", montoReserva: 2900 },
  { numero: "SIN-2026-0561", poliza: "AUT-2026-89830", asegurado: "Óscar Terán", vehiculo: "Toyota RAV4", anioVehiculo: 2023, placa: "C081156", diasAtras: 45, tipoCobertura: "Colisión", zonaDanio: "MULTIPLE", descripcion: "Colisión múltiple en intersección de Vía España. Frente, lateral derecho y trasera con daños.", montoReserva: 9200 },
  { numero: "SIN-2026-0570", poliza: "AUT-2026-89944", asegurado: "Natalia Young", vehiculo: "Kia Seltos", anioVehiculo: 2022, placa: "B662937", diasAtras: 38, tipoCobertura: "Colisión", zonaDanio: "FRENTE", descripcion: "Frente dañado por objeto en carretera hacia Colón. Parachoques y faro izquierdo.", montoReserva: 5150 },
  { numero: "SIN-2026-0584", poliza: "AUT-2026-90120", asegurado: "Danilo Estrada", vehiculo: "Honda Fit", anioVehiculo: 2018, placa: "E573021", diasAtras: 30, tipoCobertura: "Colisión", zonaDanio: "TRASERA", descripcion: "Alcance trasero en San Miguelito. Parachoques trasero y guardafango trasero.", montoReserva: 2200 },
  { numero: "SIN-2026-0593", poliza: "AUT-2026-90233", asegurado: "Alejandra Díaz", vehiculo: "Nissan Frontier", anioVehiculo: 2021, placa: "C839214", diasAtras: 22, tipoCobertura: "Colisión", zonaDanio: "LATERAL_DER", descripcion: "Lateral derecho con daño en puerta y espejo en zona industrial de Tocumen.", montoReserva: 4400 },
];

// ── Especificación de facturas ───────────────────────────────
interface EspPartida {
  codigo: string;
  cantidad: number;
  precio?: number; // override del precio cobrado (planteo)
  desc?: string; // override de descripción
  contexto?: string; // posición/instancia documentada — repeticiones legítimas
}
interface EspFactura {
  numero: string;
  tallerIdx: number;
  siniestroIdx: number;
  diasAtras: number;
  partidas: EspPartida[];
  deltaTotal?: number; // diferencia planteada entre total y suma de partidas
  revision?: { auditor: string; rol: string; accion: "ACEPTAR_HALLAZGO" | "DESCARTAR_HALLAZGO" | "PEDIR_EVIDENCIA"; hallazgoIdx: number; comentario: string };
}

const P = (codigo: string, cantidad = 1, precio?: number, desc?: string, contexto?: string): EspPartida => ({ codigo, cantidad, precio, desc, contexto });

const FACTURAS: EspFactura[] = [
  { numero: "FAC-2026-0101", tallerIdx: 0, siniestroIdx: 0, diasAtras: 112, partidas: [P("R-1001"), P("R-1003"), P("R-1004"), P("R-1018"), P("M-3001", 3), P("M-3002", 4), P("I-2001", 2.5), P("I-2003", 2), P("I-2004", 6), P("I-2005", 1), P("H-4001")] },
  { numero: "FAC-2026-0102", tallerIdx: 2, siniestroIdx: 2, diasAtras: 101, partidas: [P("R-1009"), P("R-1013"), P("M-3002", 3), P("M-3003", 2), P("I-2001", 1.8), P("I-2004", 5), P("I-2005", 1), P("H-4001")] },
  { numero: "FAC-2026-0103", tallerIdx: 1, siniestroIdx: 1, diasAtras: 98, partidas: [P("R-1002"), P("R-1019"), P("M-3001", 3), P("M-3002", 3), P("I-2001", 2), P("I-2003", 1.5), P("I-2004", 4), P("H-4001")] },
  { numero: "FAC-2026-0104", tallerIdx: 3, siniestroIdx: 3, diasAtras: 94, partidas: [P("R-1001"), P("R-1006"), P("R-1017"), P("M-3001", 4), P("M-3007", 6), P("I-2007", 1), P("I-2008", 2), P("H-4001"), P("H-4003")] },
  { numero: "FAC-2026-0105", tallerIdx: 1, siniestroIdx: 4, diasAtras: 90, partidas: [P("R-1005", 1, 231), P("R-1008"), P("M-3002", 5), P("M-3003", 3), P("I-2001", 3), P("I-2002", 1), P("I-2004", 7), P("H-4001")], revision: { auditor: "Marisol Ortega", rol: "AUDITOR", accion: "ACEPTAR_HALLAZGO", hallazgoIdx: 0, comentario: "Verificado con perito: el desvío del faro corresponde a refacción original con sobreprecio justificado por escasez. Hallazgo aceptado; el ajuste pasa al proceso del asegurador." } },
  { numero: "FAC-2026-0106", tallerIdx: 4, siniestroIdx: 5, diasAtras: 86, partidas: [P("R-1002"), P("M-3001", 3), P("M-3002", 3), P("I-2001", 2.2), P("I-2003", 2), P("I-2004", 5), P("H-4001")] },
  { numero: "FAC-2026-0107", tallerIdx: 5, siniestroIdx: 6, diasAtras: 83, partidas: [P("R-1010"), P("R-1014"), P("R-1021"), P("M-3002", 4), P("M-3003", 3), P("I-2001", 2.5), P("I-2004", 6), P("H-4001")] },
  { numero: "FAC-2026-0108", tallerIdx: 0, siniestroIdx: 7, diasAtras: 79, partidas: [P("R-1015"), P("R-1015"), P("M-3006", 1), P("I-2005", 2), P("H-4001")], revision: { auditor: "Marisol Ortega", rol: "AUDITOR", accion: "ACEPTAR_HALLAZGO", hallazgoIdx: 0, comentario: "Duplicado de parabrisas confirmado como error de digitación del taller; nota de crédito emitida por el taller. Hallazgo aceptado." } },
  { numero: "FAC-2026-0109", tallerIdx: 2, siniestroIdx: 8, diasAtras: 75, partidas: [P("R-1001"), P("R-1018"), P("R-1004"), P("M-3001", 4), P("M-3002", 5), P("M-3007", 3), P("I-2001", 3.5), P("I-2003", 2.5), P("I-2004", 8), P("H-4001"), P("H-4003")] },
  { numero: "FAC-2026-0110", tallerIdx: 3, siniestroIdx: 9, diasAtras: 71, partidas: [P("R-1011"), P("R-1020"), P("M-3003", 3), P("M-3002", 3), P("I-2001", 2), P("I-2004", 5), P("H-4001")] },
  { numero: "FAC-2026-0111", tallerIdx: 2, siniestroIdx: 2, diasAtras: 69, partidas: [P("R-1009"), P("R-1013"), P("M-3002", 3), P("M-3003", 2), P("I-2001", 1.8), P("I-2004", 5), P("I-2005", 1), P("H-4001")], revision: { auditor: "Jorge De Sedas", rol: "SUPERVISOR", accion: "ACEPTAR_HALLAZGO", hallazgoIdx: 0, comentario: "Confirmado por control interno: la factura duplica el contenido de la FAC-2026-0102 para el mismo siniestro. Hallazgo crítico aceptado; recuperación del doble pago en proceso del asegurador." } },
  { numero: "FAC-2026-0112", tallerIdx: 1, siniestroIdx: 10, diasAtras: 66, partidas: [P("R-1002"), P("R-1019"), P("R-1016"), P("M-3001", 4), P("M-3002", 4), P("I-2001", 3), P("I-2003", 2), P("I-2004", 6), P("H-4001")] },
  { numero: "FAC-2026-0113", tallerIdx: 4, siniestroIdx: 11, diasAtras: 62, partidas: [P("R-1010"), P("R-1012"), P("M-3003", 4), P("M-3002", 4), P("I-2001", 2.6), P("I-2004", 6), P("I-2005", 1), P("H-4001")] },
  { numero: "FAC-2026-0114", tallerIdx: 5, siniestroIdx: 12, diasAtras: 58, partidas: [P("R-9999", 1, 420, "Kit de luces LED deportivas"), P("M-3005", 2), P("H-4001")], revision: { auditor: "Jorge De Sedas", rol: "SUPERVISOR", accion: "ACEPTAR_HALLAZGO", hallazgoIdx: 0, comentario: "Accesorio no pactado y sin relación con el daño reportado. Hallazgo aceptado; la partida sale del proceso del asegurador." } },
  { numero: "FAC-2026-0115", tallerIdx: 0, siniestroIdx: 13, diasAtras: 54, partidas: [P("R-1001"), P("R-1005"), P("M-3001", 3), P("M-3002", 4), P("I-2001", 2.5), P("I-2003", 2), P("I-2004", 6), P("H-4001")] },
  { numero: "FAC-2026-0116", tallerIdx: 4, siniestroIdx: 14, diasAtras: 50, partidas: [P("R-1002"), P("M-3001", 3), P("M-3002", 4), P("I-2001", 18), P("I-2003", 3), P("I-2004", 8), P("H-4001")] },
  { numero: "FAC-2026-0117", tallerIdx: 3, siniestroIdx: 15, diasAtras: 47, partidas: [P("R-1009"), P("R-1013"), P("M-3002", 4), P("I-2001", 2.2), P("I-2004", 6), P("H-4001")], deltaTotal: 340 },
  { numero: "FAC-2026-0118", tallerIdx: 1, siniestroIdx: 0, diasAtras: 44, partidas: [P("M-3002", 2), P("I-2001", 1.2), P("I-2004", 4), P("H-4001")] },
  { numero: "FAC-2026-0119", tallerIdx: 4, siniestroIdx: 1, diasAtras: 41, partidas: [P("R-1001", 1, 380), P("M-3001", 3), P("M-3002", 3), P("I-2001", 2), P("I-2004", 5), P("H-4001")], revision: { auditor: "Marisol Ortega", rol: "AUDITOR", accion: "ACEPTAR_HALLAZGO", hallazgoIdx: 0, comentario: "El perito confirma daño colateral frontal durante maniobras en el taller. Hallazgo aceptado con la justificación documentada; referido al proceso del asegurador." } },
  { numero: "FAC-2026-0120", tallerIdx: 2, siniestroIdx: 4, diasAtras: 37, partidas: [P("R-1008"), P("R-1021"), P("M-3003", 4), P("M-3002", 4), P("I-2001", 3), P("I-2004", 7), P("H-4001"), P("H-4003")] },
  { numero: "FAC-2026-0121", tallerIdx: 5, siniestroIdx: 7, diasAtras: 33, partidas: [P("R-1015"), P("M-3006", 1), P("I-2005", 1), P("H-4001", 2), P("H-4002", 3)] },
  { numero: "FAC-2026-0122", tallerIdx: 3, siniestroIdx: 11, diasAtras: 29, partidas: [P("R-1012"), P("M-3003", 2), P("M-3002", 2), P("I-2001", 1.5), P("I-2004", 4), P("H-4001")] },
  { numero: "FAC-2026-0123", tallerIdx: 4, siniestroIdx: 13, diasAtras: 26, partidas: [P("R-1001"), P("R-1001", 1, 355), P("R-1005"), P("M-3001", 4), P("M-3002", 5), P("I-2001", 3), P("I-2004", 8), P("H-4001")], revision: { auditor: "Marisol Ortega", rol: "AUDITOR", accion: "ACEPTAR_HALLAZGO", hallazgoIdx: 0, comentario: "Combinación de sobreprecio y cobro repetido del mismo parachoques. Ambos hallazgos aceptados; se escala al supervisor dentro del proceso del asegurador." } },
  { numero: "FAC-2026-0124", tallerIdx: 0, siniestroIdx: 10, diasAtras: 23, partidas: [P("R-1002"), P("M-3001", 3), P("M-3002", 3), P("I-2001", 2), P("I-2003", 2), P("I-2004", 5), P("H-4001")] },
  { numero: "FAC-2026-0125", tallerIdx: 4, siniestroIdx: 3, diasAtras: 20, partidas: [P("R-1001"), P("R-1006"), P("R-1017"), P("M-3001", 5), P("M-3002", 6), P("M-3007", 8), P("I-2001", 4), P("I-2007", 2), P("I-2004", 10), P("H-4001"), P("H-4003")] },
  { numero: "FAC-2026-0126", tallerIdx: 5, siniestroIdx: 4, diasAtras: 18, partidas: [P("R-1007"), P("R-1020"), P("M-3003", 3), P("M-3002", 3), P("I-2001", 2), P("I-2004", 5), P("H-4001")] },
  { numero: "FAC-2026-0127", tallerIdx: 4, siniestroIdx: 11, diasAtras: 16, partidas: [P("R-1010"), P("R-1012"), P("M-3003", 4), P("M-3002", 4), P("I-2001", 2.6), P("I-2004", 6), P("I-2005", 1), P("H-4001")], revision: { auditor: "Jorge De Sedas", rol: "SUPERVISOR", accion: "ACEPTAR_HALLAZGO", hallazgoIdx: 0, comentario: "Segunda factura con contenido idéntico a la FAC-2026-0113 del mismo taller y siniestro. Doble cobro confirmado; remitido a legales dentro del proceso del asegurador." } },
  { numero: "FAC-2026-0128", tallerIdx: 1, siniestroIdx: 3, diasAtras: 14, partidas: [P("R-1001", 4), P("M-3001", 4), P("I-2001", 3), P("H-4001")], revision: { auditor: "Marisol Ortega", rol: "AUDITOR", accion: "ACEPTAR_HALLAZGO", hallazgoIdx: 0, comentario: "Taller acredita devolución de 3 parachoques al proveedor. Hallazgo de cantidad aceptado; solo la unidad instalada sigue en el proceso." } },
  { numero: "FAC-2026-0129", tallerIdx: 2, siniestroIdx: 14, diasAtras: 11, partidas: [P("R-1002"), P("M-3001", 3), P("M-3002", 3), P("I-2001", 2), P("I-2003", 2), P("I-2004", 5), P("H-4001")] },
  { numero: "FAC-2026-0130", tallerIdx: 4, siniestroIdx: 15, diasAtras: 8, partidas: [P("R-1009", 1, 469), P("R-1013"), P("M-3002", 4), P("I-2001", 2.2), P("I-2004", 6), P("H-4001")] },
  { numero: "FAC-2026-0131", tallerIdx: 5, siniestroIdx: 5, diasAtras: 5, partidas: [P("R-7777", 1, 310, "Alerón deportivo con iluminación"), P("M-3002", 2), P("I-2001", 1.5), P("H-4001")], revision: { auditor: "Jorge De Sedas", rol: "SUPERVISOR", accion: "ACEPTAR_HALLAZGO", hallazgoIdx: 0, comentario: "Alerón deportivo: partida no pactada y sin relación con el alcance trasero. Hallazgo aceptado; llamado de atención formal al taller." } },
  { numero: "FAC-2026-0132", tallerIdx: 0, siniestroIdx: 6, diasAtras: 2, partidas: [P("I-2003", 2, 14.85), P("M-3003", 3), P("M-3002", 3), P("I-2001", 2), P("I-2004", 5), P("H-4001")], deltaTotal: 118.4 },
  // Repetición LEGÍTIMA: mismo código con posiciones documentadas distintas — NO se marca como duplicado
  { numero: "FAC-2026-0133", tallerIdx: 3, siniestroIdx: 12, diasAtras: 21, partidas: [P("R-1012", 1, undefined, undefined, "Puerta trasera derecha (instalación)"), P("R-1012", 1, undefined, undefined, "Puerta trasera izquierda (instalación)"), P("M-3003", 3), P("M-3002", 4), P("I-2001", 2.5), P("I-2004", 6), P("H-4001")] },
  // Regla de parada: taller SIN tarifario cargado — montos quedan sin evaluar de forma visible
  { numero: "FAC-2026-0134", tallerIdx: 6, siniestroIdx: 14, diasAtras: 3, partidas: [P("R-1002", 1, 268), P("M-3001", 3, 29), P("I-2001", 2, 39), P("H-4001", 1, 66)] },
];

async function main() {
  console.log("→ Limpiando base de datos…");
  await db.revision.deleteMany();
  await db.logAgente.deleteMany();
  await db.hallazgo.deleteMany();
  await db.partida.deleteMany();
  await db.factura.deleteMany();
  await db.siniestro.deleteMany();
  await db.tarifarioItem.deleteMany();
  await db.taller.deleteMany();
  await db.configuracion.deleteMany();

  await db.configuracion.create({ data: { id: "GLOBAL", topeHonorariosPct: 20 } });

  console.log("→ Creando talleres y tarifarios pactados…");
  const talleres: Awaited<ReturnType<typeof db.taller.create>>[] = [];
  for (const [i, t] of TALLERES.entries()) {
    const taller = await db.taller.create({ data: t });
    talleres.push(taller);
    // "Taller La Junction (sin convenio cargado)" no tiene tarifario: provoca la regla de parada (R10)
    if (t.nombre.startsWith("Taller La Junction")) continue;
    for (const item of CATALOGO) {
      await db.tarifarioItem.create({
        data: {
          tallerId: taller.id,
          categoria: item.categoria,
          codigo: item.codigo,
          descripcion: item.descripcion,
          unidad: item.unidad,
          precioPactado: precioPactado(i, item),
        },
      });
    }
  }
  console.log(`  ${talleres.length} talleres · ${talleres.length * CATALOGO.length} partidas de tarifario`);

  console.log("→ Creando siniestros…");
  const siniestros: Awaited<ReturnType<typeof db.siniestro.create>>[] = [];
  for (const s of SINIESTROS) {
    const fechaOcurrencia = new Date(HOY.getTime() - s.diasAtras * 24 * 3600 * 1000);
    const siniestro = await db.siniestro.create({
      data: {
        numero: s.numero,
        poliza: s.poliza,
        asegurado: s.asegurado,
        vehiculo: s.vehiculo,
        anioVehiculo: s.anioVehiculo,
        placa: s.placa,
        fechaOcurrencia,
        tipoCobertura: s.tipoCobertura,
        zonaDanio: s.zonaDanio,
        descripcion: s.descripcion,
        montoReserva: s.montoReserva,
      },
    });
    siniestros.push(siniestro);
  }

  console.log("→ Creando facturas (motor determinista sin IA)…");
  const { ejecutarAuditoria } = await import("../src/lib/audit-agent");

  for (const esp of FACTURAS) {
    const taller = talleres[esp.tallerIdx];
    const siniestro = siniestros[esp.siniestroIdx];
    const fechaEmision = new Date(HOY.getTime() - esp.diasAtras * 24 * 3600 * 1000);

    let subtotal = 0;
    const partidasData = esp.partidas.map((p, idx) => {
      const item = CATALOGO.find((c) => c.codigo === p.codigo);
      const pactado = item ? precioPactado(esp.tallerIdx, item) : 0;
      const precio = p.precio ?? pactado;
      const sub = round2(precio * p.cantidad);
      subtotal += sub;
      return {
        linea: idx + 1,
        categoria: item?.categoria ?? "REPUESTO",
        codigo: p.codigo,
        descripcion: p.desc ?? item?.descripcion ?? "Partida sin catálogo",
        cantidad: p.cantidad,
        unidad: item?.unidad ?? "UND",
        precioUnitario: precio,
        subtotal: sub,
        contexto: p.contexto ?? null,
      };
    });

    const totalCalculado = round2(subtotal * 1.07);
    const montoTotal = esp.deltaTotal ? round2(totalCalculado + esp.deltaTotal) : totalCalculado;

    const factura = await db.factura.create({
      data: {
        numero: esp.numero,
        tallerId: taller.id,
        siniestroId: siniestro.id,
        fechaEmision,
        fechaIngreso: new Date(fechaEmision.getTime() + 2 * 24 * 3600 * 1000),
        montoTotal,
        partidas: { create: partidasData },
      },
    });

    const res = await ejecutarAuditoria(factura.id);

    if (esp.revision) {
      const hallazgosCreados = await db.hallazgo.findMany({
        where: { facturaId: factura.id, regla: { not: "R10" } },
        orderBy: { createdAt: "asc" },
      });
      const objetivo = hallazgosCreados[esp.revision.hallazgoIdx];
      const nuevoEstado =
        esp.revision.accion === "ACEPTAR_HALLAZGO" ? "ACEPTADO" : esp.revision.accion === "DESCARTAR_HALLAZGO" ? "DESCARTADO" : "EVIDENCIA_SOLICITADA";
      if (objetivo) {
        await db.hallazgo.update({
          where: { id: objetivo.id },
          data: { estadoRevision: nuevoEstado, comentarioRevision: esp.revision.comentario, revisadoPor: esp.revision.auditor, revisadoEn: new Date() },
        });
      }
      await db.revision.create({
        data: {
          facturaId: factura.id,
          hallazgoId: objetivo?.id ?? null,
          auditor: esp.revision.auditor,
          rol: esp.revision.rol,
          accion: esp.revision.accion,
          comentario: esp.revision.comentario,
          fecha: new Date(factura.fechaIngreso.getTime() + 24 * 3600 * 1000),
        },
      });
      const quedan = await db.hallazgo.count({ where: { facturaId: factura.id, estadoRevision: "PENDIENTE" } });
      await db.factura.update({ where: { id: factura.id }, data: { estadoAuditoria: quedan === 0 ? "CERRADA" : "PARA_REVISION" } });
    }
    const flag = res.sinEvaluar
      ? `■ PARADA · sin evaluar $${res.montoSinEvaluar}`
      : res.hallazgos > 0
        ? `!! ${res.hallazgos} hallazgo(s), riesgo ${res.riesgo}`
        : "OK limpia";
    console.log(`  ${esp.numero} · ${flag} · ${res.estado}`);
  }

  const conteos = await db.factura.groupBy({ by: ["estadoAuditoria"], _count: true });
  console.log("→ Estados finales:", conteos.map((c) => `${c.estadoAuditoria}: ${c._count}`).join(" · "));

  // Informes del agente en serial (SQLite no lleva bien escritas concurrentes durante el seed)
  console.log("→ Redactando informes del agente (serial)…");
  const pendientesInforme = await db.factura.findMany({
    where: { informeAgente: null, informeEnCurso: false },
    select: { id: true, numero: true },
    orderBy: { createdAt: "asc" },
  });
  for (const [i, f] of pendientesInforme.entries()) {
    try {
      await generarInformeAgente(f.id);
      if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${pendientesInforme.length} informes`);
    } catch (e) {
      console.warn(`  aviso: informe de ${f.numero} falló (${(e as Error).message?.slice(0, 80)})`);
      await db.factura.update({ where: { id: f.id }, data: { informeEnCurso: false } });
    }
  }
  console.log("Seed completado");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
