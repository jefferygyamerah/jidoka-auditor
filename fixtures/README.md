# Expedientes sintéticos con resultado esperado

Cada `expedientes/EXP-NN.json` es un expediente autocontenido: **taller + tarifario pactado
(solo los códigos usados) + siniestro + factura(s)** y el bloque `esperado` con lo que el
motor debe encontrar. Todo es sintético y está rotulado DEMO. Precios en USD, ITBMS 7 %.

| Expediente | Caso | Esperado |
|---|---|---|
| EXP-01 | Factura conforme | 0 hallazgos |
| EXP-02 | Precio sobre tarifario (+28 %) | R1 en línea 1, ALTA, $80 |
| EXP-03 | Faro cobrado dos veces sin contexto | R2 en línea 3, $175 |
| EXP-04 | Pintura de dos paneles con contexto distinto | 0 hallazgos (repetición legítima) |
| EXP-05 | Dos facturas idénticas del mismo taller | R3 en la segunda, CRÍTICA |
| EXP-06 | Código fuera del convenio | R4 en línea 1, $420 |
| EXP-07 | Total declarado $100 por encima | R6 |
| EXP-08 | Parachoques delantero en siniestro trasero | R7 en línea 2 |
| EXP-09 | Honorarios al 64 % de la base técnica | R8, exceso $155.20 |
| EXP-10 | Taller sin tarifario cargado | R10 en las 4 líneas, `sinEvaluar`, informe INCOMPLETO |
| EXP-11 | 18 galones de pintura para un parachoques | R5 en línea 3 |
| EXP-12 | Vidrios: factura 17 % sobre la reserva | R9, $163.87 |
| EXP-13 | «Bómper delantero» con código propio | R4 en línea 1, BAJA, con equivalencia R-1001 propuesta |

`esperado.hallazgos` lista `{regla, linea}` (sin `linea` = hallazgo a nivel de factura).
`riesgo` sigue los pesos del motor (BAJA 4 · MEDIA 12 · ALTA 26 · CRÍTICA 42, tope 100).
`montoDiscrepancia` es la suma de las discrepancias de los hallazgos.

Para añadir un caso: copia un JSON, cambia el `id`, ajusta partidas y `esperado`, y corre
`bun test`. Si la prueba falla, o el fixture está mal calculado o el motor cambió de
comportamiento; ambas cosas deben decidirse a propósito.

Pendientes que el motor aún no cubre (ideas para la siguiente iteración): depreciación de
piezas por antigüedad (Res. DG-SSRP-024-2025), pieza ya comprada por la aseguradora,
adicional por daño oculto sin autorización, factura repetida por CUFE entre expedientes.
