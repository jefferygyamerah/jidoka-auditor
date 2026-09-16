"use client";

import { useApp, type Rol } from "@/store/app";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Bot,
  BookOpen,
  Car,
  ClipboardCheck,
  FilePlus2,
  FileText,
  LayoutDashboard,
  Menu,
  Settings2,
  ChevronDown,
} from "lucide-react";
import type { Vista } from "@/store/app";

const ROLES: { id: Rol; label: string; corto: string }[] = [
  { id: "AUDITOR", label: "Auditor de siniestros", corto: "Auditor" },
  { id: "AGENTE", label: "Agente de IA", corto: "Agente" },
  { id: "TALLER", label: "Taller afiliado", corto: "Taller" },
  { id: "ADMIN", label: "Administrador", corto: "Admin" },
];

const NAV: { vista: Vista; label: string; icon: React.ReactNode; roles: Rol[]; labelTaller?: string }[] = [
  { vista: "andon", label: "Panel de control", icon: <LayoutDashboard className="h-4 w-4" />, roles: ["AUDITOR", "AGENTE", "TALLER", "ADMIN"] },
  { vista: "jidoka", label: "Agente en vivo", icon: <Bot className="h-4 w-4" />, roles: ["AGENTE"] },
  { vista: "cola", label: "Auditoría", labelTaller: "Mis facturas", icon: <ClipboardCheck className="h-4 w-4" />, roles: ["AUDITOR", "AGENTE", "TALLER", "ADMIN"] },
  { vista: "nueva", label: "Nueva factura", icon: <FilePlus2 className="h-4 w-4" />, roles: ["TALLER"] },
  { vista: "tarifarios", label: "Tarifarios y parámetros", icon: <Settings2 className="h-4 w-4" />, roles: ["ADMIN"] },
  { vista: "siniestros", label: "Siniestros", icon: <Car className="h-4 w-4" />, roles: ["AUDITOR", "AGENTE", "TALLER", "ADMIN"] },
  { vista: "filosofia", label: "Diseño y principios", icon: <BookOpen className="h-4 w-4" />, roles: ["AUDITOR", "AGENTE", "TALLER", "ADMIN"] },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { rol, vista, setRol, irA } = useApp();
  const items = NAV.filter((n) => n.roles.includes(rol));
  const rolActual = ROLES.find((r) => r.id === rol)!;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Encabezado vidrio esmerilado */}
      <header className="vidrio sticky top-0 z-40 border-b border-border/60 bg-white/75">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 lg:px-8">
          <button className="flex items-center gap-2.5" onClick={() => irA("andon")}>
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[oklch(0.32_0.068_255)] shadow-sm">
              <Bot className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
            </span>
            <span className="text-left leading-none">
              <span className="block text-[15px] font-semibold tracking-tight">JIDOKA</span>
              <span className="block text-[10.5px] text-muted-foreground">Auditor agéntico de siniestros · Istmo Seguros</span>
            </span>
          </button>

          {/* Selector de rol (escritorio) */}
          <div className="hidden items-center rounded-full border border-border/70 bg-secondary/60 p-0.5 md:flex">
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRol(r.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all",
                  rol === r.id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.corto}
              </button>
            ))}
          </div>

          {/* Selector de rol (móvil) */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 rounded-full text-xs">
                  <Menu className="mr-1 h-3.5 w-3.5" />
                  {rolActual.corto}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {ROLES.map((r) => (
                  <DropdownMenuItem key={r.id} onClick={() => setRol(r.id)} className={cn(r.id === rol && "bg-accent")}>
                    {r.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-6 px-4 lg:px-8">
        {/* Navegación lateral (escritorio) */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-52 shrink-0 flex-col py-6 lg:flex">
          <nav className="flex flex-col gap-0.5">
            {items.map((n) => (
              <button
                key={n.vista}
                onClick={() => irA(n.vista)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
                  vista === n.vista || (vista === "detalle" && n.vista === "cola")
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {n.icon}
                {rol === "TALLER" && n.labelTaller ? n.labelTaller : n.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-border/60 bg-card p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rol activo</p>
            <p className="mt-1 text-[13px] font-medium">{rolActual.label}</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {rol === "AUDITOR" && "Revisa solo lo que el agente detiene: cero revisión de facturas limpias."}
              {rol === "AGENTE" && "Audito cada partida contra el tarifario y detengo la línea ante anomalías."}
              {rol === "TALLER" && "Sube facturas y conoce al instante si cumplen el convenio pactado."}
              {rol === "ADMIN" && "Mantiene tarifarios pactados y parámetros del motor."}
            </p>
          </div>
        </aside>

        {/* Navegación horizontal (móvil) */}
        <div className="fino fixed inset-x-0 top-14 z-30 overflow-x-auto border-b border-border/50 bg-white/85 vidrio lg:hidden">
          <nav className="flex w-max gap-1 px-4 py-2">
            {items.map((n) => (
              <button
                key={n.vista}
                onClick={() => irA(n.vista)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                  vista === n.vista || (vista === "detalle" && n.vista === "cola")
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                {n.icon}
                {rol === "TALLER" && n.labelTaller ? n.labelTaller : n.label}
              </button>
            ))}
          </nav>
        </div>

        <main className="min-w-0 flex-1 py-6 pt-20 lg:pt-6">{children}</main>
      </div>

      <footer className="mt-auto border-t border-border/50 bg-white/60">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-1 px-4 py-4 text-[11px] text-muted-foreground sm:flex-row lg:px-8">
          <p>
            JIDOKA · Auditoría inteligente de facturación de siniestros — demo para hackatón
          </p>
          <p className="nums">USD · ITBMS 7% · Panamá</p>
        </div>
      </footer>
    </div>
  );
}

export { FileText };
