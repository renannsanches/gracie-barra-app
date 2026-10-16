"use client";

import { useState } from "react";
import { Award, ChevronDown } from "lucide-react";
import { FaixaBJJ, inferCategoria } from "@/components/FaixaBJJ";
import { formatarData, labelCorFaixa } from "@/lib/utils";
import type { CategoriaFaixa, CorFaixa, HistoricoGraduacao } from "@/lib/types";
import { Cartao, TituloCartao } from "./home-ui";

interface Props {
  faixa: CorFaixa | null;
  graus: number;
  categoria: CategoriaFaixa;
  totalAulas: number;
  aulasMes: number;
  ultimoTreino: string | null;
  historico: HistoricoGraduacao[];
}

/** Faixa actual + números principais; a evolução detalhada fica recolhida. */
export function FaixaCard({ faixa, graus, categoria, totalAulas, aulasMes, ultimoTreino, historico }: Props) {
  const [evolucaoAberta, setEvolucaoAberta] = useState(false);

  return (
    <Cartao className="overflow-hidden">
      <TituloCartao icon={<Award size={16} />} titulo="Faixa e graduação" />

      {faixa ? (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <FaixaBJJ faixa={faixa} graus={graus} categoria={categoria} tamanho="sm" className="shrink min-w-0 max-w-[60%]" />
            <div className="min-w-0 ml-auto text-right">
              <p className="text-[15px] font-semibold text-gray-900">{labelCorFaixa(faixa)}</p>
              <p className="text-[12px] text-gray-500">
                {graus} {graus === 1 ? "grau" : "graus"} · <span className="capitalize">{categoria.replace("_", " / ")}</span>
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-gray-100 rounded-xl bg-canvas py-2.5">
            <Numero valor={String(totalAulas)} rotulo="Total de aulas" />
            <Numero valor={String(aulasMes)} rotulo="Este mês" />
            <Numero
              valor={ultimoTreino ? formatarData(ultimoTreino).split("/").slice(0, 2).join("/") : "—"}
              rotulo="Último treino"
            />
          </dl>
        </div>
      ) : (
        <div className="px-4 py-5 flex items-center gap-3">
          <Award size={22} className="text-gray-300 shrink-0" />
          <p className="text-[13px] text-gray-500">Graduação a ser definida pelo professor</p>
        </div>
      )}

      {historico.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setEvolucaoAberta((v) => !v)}
            aria-expanded={evolucaoAberta}
            className="w-full h-11 flex items-center justify-center gap-1.5 border-t border-gray-100 text-[13px] font-medium text-gray-700 active:bg-gray-50 transition-colors duration-fast"
          >
            {evolucaoAberta ? "Esconder evolução" : `Ver evolução (${historico.length})`}
            <ChevronDown
              size={15}
              className={`text-gray-400 transition-transform duration-base ${evolucaoAberta ? "rotate-180" : ""}`}
            />
          </button>

          {evolucaoAberta && (
            <div className="px-4 pb-4 pt-1 animar-entrada">
              <div className="relative pl-9">
                {historico.length > 1 && (
                  <div className="absolute left-3 top-5 bottom-5 w-0.5 bg-gray-200 rounded-full" />
                )}
                {historico.map((g) => (
                  <div key={g.id} className="relative mb-5 last:mb-0">
                    <div className="absolute -left-9 top-1 w-7 h-7 rounded-full bg-brand border-2 border-white flex items-center justify-center shadow-sm z-10">
                      <Award size={12} className="text-white" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {formatarData(g.data_graduacao)}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        {g.faixa_anterior && (
                          <>
                            <FaixaBJJ
                              faixa={g.faixa_anterior}
                              graus={g.graus_anterior ?? 0}
                              categoria={inferCategoria(g.faixa_anterior)}
                              tamanho="xs"
                              showLabel
                            />
                            <span className="text-gray-400 text-lg font-light shrink-0" aria-hidden="true">→</span>
                          </>
                        )}
                        <FaixaBJJ faixa={g.faixa_nova} graus={g.graus_nova} categoria={inferCategoria(g.faixa_nova)} tamanho="xs" showLabel />
                      </div>
                      {(g.professor || g.observacoes) && (
                        <div className="space-y-0.5">
                          {g.professor && <p className="text-xs text-gray-500">{g.professor.nome_completo}</p>}
                          {g.observacoes && <p className="text-xs text-gray-500 italic">&ldquo;{g.observacoes}&rdquo;</p>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Cartao>
  );
}

function Numero({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    // dt antes de dd (ordem válida em <dl>); flex-col-reverse põe o número em cima
    <div className="text-center px-1 flex flex-col-reverse">
      <dt className="text-xs text-gray-500 mt-1">{rotulo}</dt>
      <dd className="text-[18px] font-semibold text-gray-900 leading-none tabular-nums">{valor}</dd>
    </div>
  );
}
