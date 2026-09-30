"use client";

import { useEffect } from "react";

/**
 * Consola de diagnóstico no próprio dispositivo, para aparelhos onde não há
 * Web Inspector disponível (iPad em iOS 15 exige um Mac para inspecionar).
 *
 * Só carrega quando o URL tem ?debug=1 — fora disso não injeta nada e não
 * pesa no bundle normal. O script é ES5 clássico, funciona em Safari antigo.
 */
export function DebugConsole() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    if (document.getElementById("gb-eruda")) return;

    const script = document.createElement("script");
    script.id = "gb-eruda";
    script.src = "https://cdn.jsdelivr.net/npm/eruda@3.4.1/eruda.js";
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eruda = (window as any).eruda;
      if (eruda?.init) eruda.init();
    };
    document.body.appendChild(script);
  }, []);

  return null;
}
