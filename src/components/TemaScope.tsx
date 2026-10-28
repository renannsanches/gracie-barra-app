"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  EVENTO_TEMA,
  THEME_COLOR,
  aplicarTema,
  lerPreferencia,
  resolverTema,
  sistemaEscuro,
} from "@/lib/tema";

/**
 * Liga o tema nas páginas do aluno. O script do <head> já o pôs no primeiro
 * carregamento; isto cobre as navegações client-side (entrar vindo do admin,
 * sair para o admin) e as mudanças do sistema enquanto a app está aberta.
 */
export function TemaScope() {
  const pathname = usePathname();

  useEffect(() => {
    const atualizar = () => aplicarTema(resolverTema(lerPreferencia(), sistemaEscuro()));
    atualizar();

    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", atualizar);
    window.addEventListener(EVENTO_TEMA, atualizar);
    return () => {
      media.removeEventListener("change", atualizar);
      window.removeEventListener(EVENTO_TEMA, atualizar);
    };
  }, [pathname]);

  // Ao sair do grupo (app) — ex.: Minha conta → Dashboard — volta ao claro.
  useEffect(
    () => () => {
      document.documentElement.classList.remove("dark");
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR.claro);
    },
    [],
  );

  return null;
}
