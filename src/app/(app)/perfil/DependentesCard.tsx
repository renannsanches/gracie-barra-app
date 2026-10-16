"use client";

import { useState } from "react";
import { ChevronRight, Flame, Users } from "lucide-react";
import { FaixaBJJ } from "@/components/FaixaBJJ";
import { labelCorFaixa } from "@/lib/utils";
import { getEffectiveStatus } from "@/lib/mensalidade-status";
import type { DependentePerfil, StatusMensalidade } from "@/lib/types";
import type { ResumoGamificacao } from "./home-tipos";
import { Cartao, TituloCartao } from "./home-ui";
import { LinksGamificacao } from "./FrequenciaCard";
import { DependenteModal } from "./DependenteModal";
import { iniciaisDe } from "./perfil-labels";

const MENS_CHIP: Record<StatusMensalidade, { label: string; classe: string }> = {
  pago:     { label: "Em dia",   classe: "bg-emerald-500/15 text-emerald-700" },
  pendente: { label: "Pendente", classe: "bg-amber-500/15 text-amber-800" },
  atrasado: { label: "Vencida",  classe: "bg-red-500/15 text-red-700" },
};

interface Props {
  dependentes: DependentePerfil[];
  /** Resumo de gamificação de cada pessoa, ligado por id */
  gamificacao: ResumoGamificacao[];
  /** Responsável que não treina: Ranking/Conquistas ficam aqui */
  comLinksGamificacao: boolean;
}

export function DependentesCard({ dependentes, gamificacao, comLinksGamificacao }: Props) {
  const [lista, setLista] = useState(dependentes);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const selecionado = lista.find((d) => d.id === selecionadoId) ?? null;
  const gamPorId = new Map(gamificacao.map((g) => [g.id, g]));

  return (
    <Cartao className="overflow-hidden" data-testid="card-dependentes">
      <TituloCartao
        icon={<Users size={16} />}
        titulo="Dependentes"
        extra={<span className="text-xs font-medium text-gray-500 shrink-0">({lista.length})</span>}
      />

      <ul className="divide-y divide-gray-100">
        {lista.map((dep) => {
          const ultimaMens = dep.mensalidades[0];
          const chip = ultimaMens ? MENS_CHIP[getEffectiveStatus(ultimaMens)] : null;
          const gam = gamPorId.get(dep.id);
          return (
            <li key={dep.id}>
              <button
                type="button"
                onClick={() => setSelecionadoId(dep.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 transition-colors duration-fast"
                aria-label={`Ver detalhes de ${dep.nome_completo}`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                  {dep.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dep.foto_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-[13px]">{iniciaisDe(dep.nome_completo)}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 leading-snug line-clamp-2 break-words">
                    {dep.nome_completo}
                  </p>
                  {dep.faixa ? (
                    <div className="mt-1 flex items-center gap-2 min-w-0">
                      <FaixaBJJ faixa={dep.faixa} graus={dep.graus} categoria={dep.categoria} tamanho="xs" className="shrink-0" />
                      <span className="text-xs text-gray-500 truncate">
                        {labelCorFaixa(dep.faixa)} · {dep.graus} grau{dep.graus !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-xs text-gray-500">Faixa por definir</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {gam && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                        <Flame size={12} className={gam.sequencia > 0 ? "text-orange-500" : "text-gray-300"} />
                        {gam.sequencia === 1 ? "1 semana seguida" : `${gam.sequencia} semanas seguidas`}
                      </span>
                    )}
                    {chip && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${chip.classe}`}>
                        Mensalidade: {chip.label}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>

      {comLinksGamificacao && <LinksGamificacao />}

      {selecionado && (
        <DependenteModal
          dependente={selecionado}
          onClose={() => setSelecionadoId(null)}
          onFotoAlterada={(id, url) =>
            setLista((prev) => prev.map((d) => (d.id === id ? { ...d, foto_url: url } : d)))
          }
        />
      )}
    </Cartao>
  );
}
