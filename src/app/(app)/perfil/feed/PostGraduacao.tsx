"use client";

import { FaixaBJJ, inferCategoria } from "@/components/FaixaBJJ";
import type { DadosGraduacao } from "@/lib/feed";
import { labelCorFaixa } from "@/lib/utils";

// Bloco do post automático de faixa nova: a faixa desenhada e o nome dela. Quem foi graduado já
// vem no texto do post.
export function PostGraduacao({ dados }: { dados: DadosGraduacao }) {
  // "adulto_infantil" desenha-se pela faixa (as de criança só existem no mapa infantil)
  const categoria = dados.categoria === "infantil" ? "infantil" : inferCategoria(dados.faixa);
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-canvas px-4 py-5">
      <FaixaBJJ faixa={dados.faixa} graus={dados.graus} categoria={categoria} tamanho="md" />
      <p className="text-sm font-medium text-fg-muted">Faixa {labelCorFaixa(dados.faixa)}</p>
    </div>
  );
}
