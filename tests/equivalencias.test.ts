/// <reference types="bun-types" />
// Equivalencias con el catálogo (#47): la propuesta es DETERMINISTA y con cita.
// Se prueba el módulo puro y, al final, el flujo completo sobre un expediente de
// fixtures: partida con descripción distinta → hallazgo R4 con equivalencia y evidencia.
//   bun test tests/
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { PrismaClient } from "@prisma/client";
import { normalizar, proponerEquivalencia, UMBRAL_EQUIVALENCIA, type ItemCatalogo } from "@/lib/equivalencias";
import { cargarExpediente, leerFixtures, verificarEsperado } from "@/lib/fixtures";
import type { EquivalenciaPropuesta } from "@/lib/types";
import { crearDbTemporal } from "./db-temporal";

const tmp = crearDbTemporal();
process.env.DATABASE_URL = tmp.url;
process.env.JIDOKA_DISABLE_IA = "1"; // el motor decide; el LLM no participa en las pruebas

const FUENTES = { factura: "Factura FAC-TEST", localizadorFactura: "línea 1", catalogo: "Tarifario pactado · Taller DEMO" };

const CATALOGO: ItemCatalogo[] = [
  { codigo: "R-1001", categoria: "REPUESTO", descripcion: "Parachoques delantero", unidad: "UND", precioPactado: 320 },
  { codigo: "R-1002", categoria: "REPUESTO", descripcion: "Faro delantero izquierdo", unidad: "UND", precioPactado: 175 },
  { codigo: "I-2001", categoria: "INSUMO", descripcion: "Pintura automotriz base agua", unidad: "GLB", precioPactado: 62 },
  { codigo: "M-3001", categoria: "MANO_OBRA", descripcion: "Desmontaje e instalación de parachoques", unidad: "HRS", precioPactado: 28 },
];

describe("equivalencias · propuesta determinista", () => {
  test("coincidencia exacta por código: confianza 1 y sin nada que proponer", () => {
    const eq = proponerEquivalencia({ codigo: "R-1001", descripcion: "Bómper del.", unidad: "UND", categoria: "REPUESTO" }, CATALOGO, FUENTES);
    expect(eq?.codigoPropuesto).toBe("R-1001");
    expect(eq?.confianza).toBe(1);
    expect(eq?.motivo).toContain("existe tal cual en el tarifario");
    expect(eq?.evidencia).toHaveLength(2);
  });

  test("descripción con tilde y plural: «Faros delanteros izquierdos» → R-1002", () => {
    expect(normalizar("Faros delanteros izquierdos")).toEqual(normalizar("Faro delantero izquierdo"));
    const eq = proponerEquivalencia({ codigo: "X-0001", descripcion: "Faros delanteros izquierdos", unidad: "UND", categoria: "REPUESTO" }, CATALOGO, FUENTES);
    expect(eq?.codigoPropuesto).toBe("R-1002");
    expect(eq!.confianza).toBeGreaterThanOrEqual(0.8);
  });

  test("sinónimo del diccionario: «bómper» → parachoques (R-1001) con cita del catálogo", () => {
    expect(normalizar("Bómper frontal")).toEqual(normalizar("Parachoques delantero")); // sinónimo + término de zona
    const eq = proponerEquivalencia({ codigo: "X-0002", descripcion: "Bómper frontal", unidad: "UND", categoria: "REPUESTO" }, CATALOGO, FUENTES);
    expect(eq?.codigoPropuesto).toBe("R-1001");
    expect(eq!.confianza).toBeGreaterThanOrEqual(UMBRAL_EQUIVALENCIA);
    expect(eq?.evidencia[1]).toEqual({ fuente: FUENTES.catalogo, localizador: "código R-1001 · Parachoques delantero" });
  });

  test("unidad distinta baja la confianza sobre la misma descripción", () => {
    const partida = { codigo: "X-0003", descripcion: "Pintura automotriz base agua", categoria: "INSUMO" };
    const igual = proponerEquivalencia({ ...partida, unidad: "GLB" }, CATALOGO, FUENTES)!;
    const distinta = proponerEquivalencia({ ...partida, unidad: "LTR" }, CATALOGO, FUENTES)!;
    expect(distinta.codigoPropuesto).toBe(igual.codigoPropuesto);
    expect(distinta.confianza).toBeLessThan(igual.confianza);
    expect(distinta.motivo).toContain("unidad distinta");
  });

  test("sin candidato razonable devuelve null (no se le muestra ruido al auditor)", () => {
    expect(proponerEquivalencia({ codigo: "X-0004", descripcion: "Kit de luces LED deportivas", unidad: "UND", categoria: "REPUESTO" }, CATALOGO, FUENTES)).toBeNull();
    expect(proponerEquivalencia({ codigo: "X-0005", descripcion: "   ", unidad: "UND", categoria: "REPUESTO" }, CATALOGO, FUENTES)).toBeNull();
    expect(proponerEquivalencia({ codigo: "X-0006", descripcion: "Parachoques delantero", unidad: "UND", categoria: "REPUESTO" }, [], FUENTES)).toBeNull();
  });
});

// ── Flujo completo sobre un expediente: el motor sigue marcando R4 y adjunta la propuesta.
describe("equivalencias · expediente EXP-13 de punta a punta", () => {
  let db: PrismaClient;
  let ejecutarAuditoria: (id: string) => Promise<unknown>;
  let generarInformeAgente: (id: string) => Promise<unknown>;
  const exp = leerFixtures().find((f) => f.id === "EXP-13")!;

  beforeAll(async () => {
    tmp.push();
    ({ db } = await import("@/lib/db"));
    ({ ejecutarAuditoria, generarInformeAgente } = await import("@/lib/audit-agent"));
    await db.configuracion.create({ data: { id: "GLOBAL" } });
  });

  afterAll(async () => {
    await db?.$disconnect();
    tmp.limpiar();
  });

  test("partida con descripción distinta al catálogo → R4 con equivalencia propuesta y evidencia", async () => {
    const ids = await cargarExpediente(db, exp);
    for (const f of exp.facturas) await ejecutarAuditoria(ids[f.numero]);
    await generarInformeAgente(ids[exp.esperado.factura]); // evita que el informe en segundo plano escriba tras el cierre
    expect(await verificarEsperado(db, exp, ids[exp.esperado.factura])).toEqual([]);

    const h = await db.hallazgo.findFirstOrThrow({ where: { facturaId: ids[exp.esperado.factura], regla: "R4" } });
    const detalle = JSON.parse(h.detalle) as { equivalencia: EquivalenciaPropuesta | null; propuestaIA: unknown };
    const eq = detalle.equivalencia!;
    expect(eq.codigoPropuesto).toBe("R-1001");
    expect(eq.precioPactado).toBe(320);
    expect(eq.confianza).toBeGreaterThanOrEqual(UMBRAL_EQUIVALENCIA);
    expect(eq.evidencia.map((e) => e.fuente)).toEqual([`Factura ${exp.esperado.factura}`, `Tarifario pactado · ${exp.taller.nombre}`]);
    expect(detalle.propuestaIA).toBeUndefined(); // JIDOKA_DISABLE_IA=1: el LLM no participa
    expect(h.estadoRevision).toBe("PENDIENTE"); // decide el auditor, no el agente
  });
});
