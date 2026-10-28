"use client";

import { useSyncExternalStore } from "react";
import { EVENTO_TEMA, lerPreferencia, type Tema } from "@/lib/tema";

function subscreverClasse(callback: () => void) {
  const obs = new MutationObserver(callback);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

/** Tema que está a ser mostrado agora (classe `dark` no <html>). */
export function useTemaAtivo(): Tema {
  return useSyncExternalStore(
    subscreverClasse,
    () => (document.documentElement.classList.contains("dark") ? "escuro" : "claro"),
    () => "claro",
  );
}

function subscreverPreferencia(callback: () => void) {
  window.addEventListener(EVENTO_TEMA, callback);
  return () => window.removeEventListener(EVENTO_TEMA, callback);
}

/** Escolha guardada neste dispositivo; null = segue o sistema. */
export function usePreferenciaTema(): Tema | null {
  return useSyncExternalStore(subscreverPreferencia, lerPreferencia, () => null);
}
