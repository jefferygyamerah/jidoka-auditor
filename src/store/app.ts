"use client";

import { create } from "zustand";

export type Rol = "AUDITOR" | "AGENTE" | "TALLER" | "ADMIN";
export type Vista = "andon" | "cola" | "detalle" | "nueva" | "tarifarios" | "siniestros" | "jidoka" | "filosofia";

interface AppState {
  rol: Rol;
  vista: Vista;
  facturaId: string | null;
  tallerActivoId: string | null;
  version: number;
  setRol: (rol: Rol) => void;
  irA: (vista: Vista) => void;
  abrirFactura: (id: string) => void;
  volverDeFactura: () => void;
  setTallerActivo: (id: string) => void;
  bump: () => void;
}

export const useApp = create<AppState>((set, get) => ({
  rol: "AUDITOR",
  vista: "andon",
  facturaId: null,
  tallerActivoId: null,
  version: 0,
  setRol: (rol) => {
    const { vista, facturaId } = get();
    // Al cambiar de rol, vuelve al tablero (a menos que ya esté en vistas comunes)
    const comunes: Vista[] = ["andon", "siniestros", "filosofia", "detalle"];
    const siguiente: Vista = comunes.includes(vista) ? vista : "andon";
    set({ rol, vista: siguiente, facturaId: siguiente === "detalle" ? facturaId : null });
  },
  irA: (vista) => set({ vista, ...(vista !== "detalle" ? { facturaId: null } : {}) }),
  abrirFactura: (id) => set({ vista: "detalle", facturaId: id }),
  volverDeFactura: () => set({ vista: "cola", facturaId: null }),
  setTallerActivo: (id) => set({ tallerActivoId: id }),
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
