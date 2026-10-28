"use client";

import { Toaster } from "sonner";
import { ConfirmHost } from "@/components/ConfirmDialog";
import { useTemaAtivo } from "@/components/useTema";

// Toasts no topo (longe da barra inferior e dos botões das bottom sheets),
// abaixo do notch. Montado só nos layouts (app) e admin — não no /tablet.
const TOPO = "calc(env(safe-area-inset-top, 0px) + 12px)";

export function FeedbackHosts() {
  const tema = useTemaAtivo();
  return (
    <>
      <Toaster
        theme={tema === "escuro" ? "dark" : "light"}
        position="top-center"
        richColors
        duration={4000}
        offset={{ top: TOPO }}
        mobileOffset={{ top: TOPO, left: 12, right: 12 }}
        toastOptions={{ className: "font-sans" }}
      />
      <ConfirmHost />
    </>
  );
}
