// ─────────────────────────────────────────────────────────────
// Equivalencias con el catálogo (tarifario pactado) · determinista
//
// Cuando una partida de la factura no coincide por CÓDIGO con el
// tarifario, este módulo propone el código más probable a partir del
// texto: normalización (minúsculas, sin tildes, singular, sinónimos
// de taller) + puntuación por tokens comunes, unidad y categoría.
//
// Contrato (#47): esto PROPONE, no decide. La propuesta viaja con su
// confianza, el motivo en palabras y la cita de evidencia; el motor de
// reglas sigue marcando el hallazgo (R4) y el auditor humano aprueba o
// descarta con motivo. Sin dependencias ni aprendizaje: el diccionario
// `equivalencias-sinonimos.json` se edita a mano.
// ─────────────────────────────────────────────────────────────
import diccionario from "@/lib/equivalencias-sinonimos.json";
import type { EquivalenciaPropuesta, EvidenciaCita } from "@/lib/types";

const VACIAS = new Set<string>(diccionario.vacias);
const SINONIMOS = diccionario.sinonimos as Record<string, string>;

/** Confianza mínima para siquiera mostrar una propuesta al auditor. */
export const UMBRAL_EQUIVALENCIA = 0.45;
/** Techo de la propuesta por texto: el 1.00 queda reservado a la coincidencia exacta por código. */
const TECHO_POR_TEXTO = 0.95;

export interface ItemCatalogo {
  codigo: string;
  descripcion: string;
  unidad: string;
  categoria: string;
  precioPactado?: number;
}

export interface PartidaAEquiparar {
  codigo: string;
  descripcion: string;
  unidad: string;
  categoria: string;
}

/** Contexto de la cita: de dónde sale cada lado de la comparación. */
export interface FuentesEquivalencia {
  factura: string; // "Factura FAC-0001"
  localizadorFactura: string; // "línea 3 · Bómper delantero"
  catalogo: string; // "Tarifario pactado · Taller X"
}

/**
 * Raíz aproximada de una palabra en español: quita el plural y la «e» final, de modo que
 * «parachoques», «parachoque» y «bómperes» caigan todas en la misma forma canónica.
 */
function raiz(palabra: string): string {
  let p = palabra;
  if (p.length > 4 && p.endsWith("ces")) p = `${p.slice(0, -3)}z`; // luces → luz
  else if (p.length > 4 && p.endsWith("es")) p = p.slice(0, -2); // faroles → farol
  else if (p.length > 3 && p.endsWith("s")) p = p.slice(0, -1); // faros → faro
  if (p.length > 4 && p.endsWith("e")) p = p.slice(0, -1); // parachoque → parachoqu
  return p;
}

/**
 * Tokens canónicos de un texto: minúsculas, sin tildes ni puntuación, sin palabras
 * vacías, en su raíz y pasados por el diccionario de sinónimos de taller.
 */
export function normalizar(texto: string): string[] {
  const limpio = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tildes y diéresis
    .replace(/\u00f1/g, "n")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!limpio) return [];
  const tokens = limpio
    .split(" ")
    .filter((t) => t.length > 1 && !VACIAS.has(t)) // fuera conectores sueltos («e», «y»)
    .map((t) => raiz(SINONIMOS[t] ?? SINONIMOS[raiz(t)] ?? t))
    .filter((t) => !VACIAS.has(t));
  return [...new Set(tokens)];
}

/** Coeficiente de Sørensen–Dice entre dos conjuntos de tokens (0–1). */
function dice(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  const comunes = a.filter((t) => setB.has(t));
  return (2 * comunes.length) / (a.length + b.length);
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Propone la equivalencia más probable de `partida` dentro de `catalogo`.
 * Devuelve `null` si ningún ítem llega al umbral (el auditor no debería ver ruido).
 */
export function proponerEquivalencia(
  partida: PartidaAEquiparar,
  catalogo: ItemCatalogo[],
  fuentes: FuentesEquivalencia
): EquivalenciaPropuesta | null {
  const cita = (item: ItemCatalogo | null, nota: string): EvidenciaCita[] => [
    { fuente: fuentes.factura, localizador: fuentes.localizadorFactura },
    { fuente: fuentes.catalogo, localizador: item ? `código ${item.codigo} · ${item.descripcion}` : nota },
  ];

  // 1 · Coincidencia exacta por código: no hay nada que proponer, está pactado.
  const exacto = catalogo.find((c) => c.codigo === partida.codigo);
  if (exacto) {
    return {
      codigoPropuesto: exacto.codigo,
      descripcionPropuesta: exacto.descripcion,
      precioPactado: exacto.precioPactado ?? null,
      confianza: 1,
      motivo: `El código ${exacto.codigo} existe tal cual en el tarifario pactado: la partida se compara directamente contra «${exacto.descripcion}».`,
      evidencia: cita(exacto, ""),
    };
  }

  // 2 · Sin código pactado: puntuar por texto normalizado, unidad y categoría.
  const tokensPartida = normalizar(partida.descripcion);
  if (!tokensPartida.length) return null;

  let mejor: { item: ItemCatalogo; puntaje: number; comunes: string[]; mismaUnidad: boolean; mismaCategoria: boolean } | null = null;
  for (const item of catalogo) {
    const tokensItem = normalizar(item.descripcion);
    const comunes = tokensPartida.filter((t) => tokensItem.includes(t));
    if (!comunes.length) continue; // sin una sola palabra en común no hay nada que proponer
    const mismaUnidad = item.unidad === partida.unidad;
    const mismaCategoria = item.categoria === partida.categoria;
    // Multiplicativo: la unidad y la categoría distintas SIEMPRE bajan la confianza.
    const puntaje = Math.min(TECHO_POR_TEXTO, dice(tokensPartida, tokensItem) * (mismaUnidad ? 1 : 0.8) * (mismaCategoria ? 1 : 0.85));
    if (!mejor || puntaje > mejor.puntaje) mejor = { item, puntaje, comunes, mismaUnidad, mismaCategoria };
  }

  if (!mejor || mejor.puntaje < UMBRAL_EQUIVALENCIA) return null;

  // Para el motivo se muestran las palabras como las escribió el taller, no la raíz interna.
  const comoLasEscribio = new Map<string, string>();
  for (const palabra of partida.descripcion.split(/[^\p{L}\p{N}]+/u)) {
    const [token] = normalizar(palabra);
    if (token && !comoLasEscribio.has(token)) comoLasEscribio.set(token, palabra.toLowerCase());
  }
  const motivo = [
    `Descripción equivalente por ${mejor.comunes.length} término(s) en común (${mejor.comunes.map((t) => comoLasEscribio.get(t) ?? t).join(", ")}) tras normalizar el texto`,
    mejor.mismaUnidad ? `misma unidad (${partida.unidad})` : `unidad distinta (factura ${partida.unidad} vs tarifario ${mejor.item.unidad}), lo que baja la confianza`,
    mejor.mismaCategoria ? `misma categoría (${partida.categoria.toLowerCase()})` : `categoría distinta (factura ${partida.categoria.toLowerCase()} vs tarifario ${mejor.item.categoria.toLowerCase()}), lo que baja la confianza`,
  ].join("; ");

  return {
    codigoPropuesto: mejor.item.codigo,
    descripcionPropuesta: mejor.item.descripcion,
    precioPactado: mejor.item.precioPactado ?? null,
    confianza: redondear(mejor.puntaje),
    motivo: `${motivo}. Propuesta para revisión del auditor: el motor no reemplaza el código por su cuenta.`,
    evidencia: cita(mejor.item, ""),
  };
}
