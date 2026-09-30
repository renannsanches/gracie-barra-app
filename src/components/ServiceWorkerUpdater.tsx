"use client";

import { useEffect } from "react";

/** Páginas onde um reload a meio do fluxo destrói o que o utilizador está a fazer. */
const ROTAS_SENSIVEIS = ["/login", "/tablet/login", "/cadastro", "/nova-senha", "/esqueci-senha"];

export function ServiceWorkerUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "development") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) reg.unregister();
      });
      return;
    }

    // Se não havia controller, o próximo controllerchange é a PRIMEIRA tomada de
    // controlo (service worker acabado de instalar) — não há versão antiga para
    // substituir, logo recarregar só interrompe o que estiver a acontecer.
    // O iOS purga service workers após ~7 dias sem uso, pelo que num tablet usado
    // esporadicamente isto acontece em quase todas as visitas.
    const tinhaController = Boolean(navigator.serviceWorker.controller);
    let recarregando = false;

    function onControllerChange() {
      if (recarregando || !tinhaController) return;
      if (document.visibilityState !== "visible") return;
      if (ROTAS_SENSIVEIS.some((rota) => window.location.pathname.startsWith(rota))) return;

      recarregando = true;
      window.location.reload();
    }

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
