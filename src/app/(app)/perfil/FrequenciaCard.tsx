import Link from "next/link";
import { ChevronRight, Flame, Medal, Trophy } from "lucide-react";
import { META_SEMANAL } from "@/lib/gamificacao";
import type { ResumoGamificacao } from "./home-tipos";
import { Cartao } from "./home-ui";

/** Atalhos discretos para /ranking e /conquistas (usados também no card de dependentes). */
export function LinksGamificacao() {
  return (
    <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
      <Link
        href="/ranking"
        className="flex items-center justify-center gap-1.5 h-11 text-[13px] font-medium text-gray-700 active:bg-gray-50 transition-colors duration-fast"
      >
        <Trophy size={15} className="text-gray-400" />
        Ranking
        <ChevronRight size={14} className="text-gray-300" />
      </Link>
      <Link
        href="/conquistas"
        className="flex items-center justify-center gap-1.5 h-11 text-[13px] font-medium text-gray-700 active:bg-gray-50 transition-colors duration-fast"
      >
        <Medal size={15} className="text-gray-400" />
        Conquistas
        <ChevronRight size={14} className="text-gray-300" />
      </Link>
    </div>
  );
}

/** Frequência semanal do próprio: sequência, aulas desta semana vs. meta e medalhas. */
export function FrequenciaCard({ resumo }: { resumo: ResumoGamificacao }) {
  const feitas = Math.min(resumo.semanaAulas, META_SEMANAL);
  const ativo = resumo.sequencia > 0;

  return (
    <Cartao className="overflow-hidden" data-testid="card-gamificacao">
      <div className="p-4 flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            ativo ? "bg-orange-50 text-orange-500" : "bg-canvas text-gray-300"
          }`}
        >
          <Flame size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-gray-900">
            {resumo.sequencia === 1 ? "1 semana seguida" : `${resumo.sequencia} semanas seguidas`}
          </p>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Esta semana: {feitas}/{META_SEMANAL} aulas · {resumo.medalhas} medalha{resumo.medalhas !== 1 ? "s" : ""}
          </p>
        </div>
        {/* Progresso da semana (o texto ao lado já diz o número — a barra é reforço visual) */}
        <div className="flex gap-1 shrink-0" aria-hidden="true">
          {Array.from({ length: META_SEMANAL }).map((_, i) => (
            <span key={i} className={`w-5 h-2 rounded-full ${i < feitas ? "bg-brand" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>
      <LinksGamificacao />
    </Cartao>
  );
}
