"use client";

import { Toaster } from "sonner";
import { ConfirmHost } from "@/components/ConfirmDialog";

// Toasts no topo (longe da barra inferior e dos botões das bottom sheets),
// abaixo do notch. Montado só nos layouts (app) e admin — não no /tablet.
const TOPO = "calc(env(safe-area-inset-top, 0px) + 12px)";

export function FeedbackHosts() {
  return (
    <>
      <Toaster
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
