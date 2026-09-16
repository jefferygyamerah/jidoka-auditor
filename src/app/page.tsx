"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "@/store/app";
import { Shell } from "@/components/auditor/shell";
import { Dashboard } from "@/components/auditor/dashboard";
import { Cola } from "@/components/auditor/cola";
import { DetalleFactura } from "@/components/auditor/detalle";
import { NuevaFactura } from "@/components/auditor/nueva-factura";
import { Tarifarios } from "@/components/auditor/tarifarios";
import { Siniestros } from "@/components/auditor/siniestros";
import { CentroJidoka } from "@/components/auditor/jidoka";
import { Filosofia } from "@/components/auditor/filosofia";

export default function Home() {
  const { vista, facturaId, rol } = useApp();

  const contenido =
    vista === "detalle" && facturaId ? (
      <DetalleFactura key={`detalle-${facturaId}`} />
    ) : vista === "cola" ? (
      <Cola key="cola" />
    ) : vista === "nueva" ? (
      <NuevaFactura key="nueva" />
    ) : vista === "tarifarios" ? (
      <Tarifarios key="tarifarios" />
    ) : vista === "siniestros" ? (
      <Siniestros key="siniestros" />
    ) : vista === "jidoka" ? (
      <CentroJidoka key="jidoka" />
    ) : vista === "filosofia" ? (
      <Filosofia key="filosofia" />
    ) : (
      <Dashboard key="andon" />
    );

  return (
    <Shell>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${rol}-${vista}-${vista === "detalle" ? facturaId : ""}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.25, 0.8, 0.35, 1] }}
        >
          {contenido}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}
