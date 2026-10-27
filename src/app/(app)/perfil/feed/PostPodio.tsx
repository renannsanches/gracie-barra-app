"use client";

import { useId } from "react";
import { Trophy } from "lucide-react";
import { FaixaBJJ, inferCategoria } from "@/components/FaixaBJJ";
import { cn } from "@/lib/utils";
import type { DadosPodio, EntradaPodio } from "@/lib/feed";
import { nomeMes } from "@/lib/feed-automatico";
import type { CorFaixa } from "@/lib/types";
import { AvatarAutor } from "./CurtidasSheet";

// As mesmas cores do pódio do /ranking: 1 dourado, 2 prateado, 3 bronze
const COR_MEDALHA: Record<number, string> = {
  1: "bg-yellow-400 text-yellow-900",
  2: "bg-slate-300 text-slate-700",
  3: "bg-orange-400 text-orange-950",
};

function LinhaPodio({ entrada, kids }: { entrada: EntradaPodio; kids: boolean }) {
  // Tolera entradas incompletas (os dados vêm da BD sem validação)
  const faixa = typeof entrada.faixa === "string" && entrada.faixa ? (entrada.faixa as CorFaixa) : null;
  const nome = typeof entrada.nome === "string" ? entrada.nome : "";
  const posicao = typeof entrada.posicao === "number" ? entrada.posicao : 3;
  const aulas = typeof entrada.aulas === "number" ? entrada.aulas : 0;
  return (
    <li className="flex items-center gap-3 py-2.5">
      {/* Empates trazem a mesma posição (1, 1, 3) */}
      <span
        role="img"
        aria-label={`${posicao}.º lugar`}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-black tabular-nums",
          COR_MEDALHA[posicao] ?? COR_MEDALHA[3],
        )}
      >
        {posicao}
      </span>
      <AvatarAutor
        autor={{ id: entrada.alunoId, nome, foto: entrada.foto ?? null }}
        className="h-10 w-10 text-[13px]"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{nome}</p>
        {faixa && (
          <FaixaBJJ
            faixa={faixa}
            graus={entrada.graus ?? 0}
            categoria={kids ? "infantil" : inferCategoria(faixa)}
            tamanho="xs"
            className="mt-0.5"
          />
        )}
      </div>
      <p className="shrink-0 text-xs text-fg-muted">
        <span className="text-sm font-bold tabular-nums text-fg">{aulas}</span>{" "}
        {aulas === 1 ? "aula" : "aulas"}
      </p>
    </li>
  );
}

// Bloco do post automático do pódio do mês: Adultos e Kids, só as secções com gente.
export function PostPodio({ dados }: { dados: DadosPodio }) {
  const idTitulo = useId();
  const seccoes = [
    { titulo: "Adultos", entradas: dados.adultos, kids: false },
    { titulo: "Kids", entradas: dados.kids, kids: true },
  ]
    // Entradas nulas (dados mal formados) não se desenham
    .map((s) => ({ ...s, entradas: s.entradas.filter((e) => typeof e === "object" && e !== null) }))
    .filter((s) => s.entradas.length > 0);

  return (
    <section aria-labelledby={idTitulo} className="rounded-xl bg-canvas px-4 pb-2 pt-4">
      <h3 id={idTitulo} className="flex items-center gap-2 text-base font-semibold text-fg">
        <Trophy size={18} aria-hidden="true" className="shrink-0 text-amber-500" />
        Pódio de {nomeMes(dados.mes)}
      </h3>
      {seccoes.map((s) => (
        <div key={s.titulo} className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{s.titulo}</h4>
          <ol className="divide-y divide-line">
            {s.entradas.map((e, i) => (
              <LinhaPodio key={e.alunoId ?? i} entrada={e} kids={s.kids} />
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
