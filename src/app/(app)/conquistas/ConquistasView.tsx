"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flame, Medal as MedalIcon, Trophy } from "lucide-react";
import { Medalha } from "@/components/Medalha";
import { PageHeader } from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";
import { cn, formatarData } from "@/lib/utils";
import { CONQUISTAS, progressoConquista, type GrupoConquista } from "@/lib/gamificacao";
import { definirVisibilidadeRanking, marcarConquistasVistas } from "./conquistas-actions";

export interface PessoaConquistas {
  id: string;
  nome: string;
  podeRanking: boolean;
  ocultarRanking: boolean;
  totalAulas: number;
  sequencia: { atual: number; melhor: number; semanaAulas: number; meta: number };
  anos: number;
  conquistas: { id: string; codigo: string; referencia: string; conquistadaEm: string; nova: boolean }[];
}

const GRUPOS: { grupo: GrupoConquista; titulo: string }[] = [
  { grupo: "marcos", titulo: "Marcos de aulas" },
  { grupo: "sequencias", titulo: "Sequências" },
  { grupo: "especiais", titulo: "Especiais" },
];

export function ConquistasView({ pessoas }: { pessoas: PessoaConquistas[] }) {
  const [selId, setSelId] = useState(pessoas[0]?.id ?? "");
  const pessoa = pessoas.find((p) => p.id === selId) ?? pessoas[0];

  // Abrir esta página conta como ver as medalhas novas (o destaque "Nova" mantém-se até sair)
  useEffect(() => {
    const ids = pessoas.flatMap((p) => p.conquistas.filter((c) => c.nova).map((c) => c.id));
    if (ids.length > 0) void marcarConquistasVistas(ids);
  }, [pessoas]);

  return (
    <div className="min-h-screen flex flex-col bg-gb-gray">
      <PageHeader
        title="Conquistas"
        icon={<MedalIcon size={20} />}
        back={{ href: "/perfil", label: "Início" }}
        subtitle="Sequências de treino e medalhas"
      >

        {pessoas.length > 1 && (
          <div className="mt-5 flex gap-2 overflow-x-auto -mx-1 px-1">
            {pessoas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelId(p.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors",
                  p.id === pessoa?.id ? "bg-white text-gray-900" : "bg-white/10 text-white/70 hover:text-white",
                )}
              >
                {p.nome}
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      <div className="flex-1 px-4 py-5 pb-bottom-nav space-y-3 animar-lista">
        {!pessoa ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-[14px] text-gray-500">
            Sem alunos associados a esta conta.
          </div>
        ) : (
          <PainelPessoa key={pessoa.id} pessoa={pessoa} />
        )}
      </div>
    </div>
  );
}

function PainelPessoa({ pessoa }: { pessoa: PessoaConquistas }) {
  const router = useRouter();
  const [oculto, setOculto] = useState(pessoa.ocultarRanking);
  const [erro, setErro] = useState("");
  const [aGuardar, startTransition] = useTransition();
  const { sequencia } = pessoa;

  function alterarVisibilidade(aparecer: boolean) {
    setErro("");
    setOculto(!aparecer);
    startTransition(async () => {
      const r = await definirVisibilidadeRanking(pessoa.id, !aparecer);
      if (!r.ok) {
        setOculto(aparecer);
        setErro(r.erro ?? "Não foi possível guardar.");
        return;
      }
      router.refresh();
    });
  }

  const porCodigo = new Map<string, PessoaConquistas["conquistas"]>();
  for (const c of pessoa.conquistas) porCodigo.set(c.codigo, [...(porCodigo.get(c.codigo) ?? []), c]);
  const estado = { totalAulas: pessoa.totalAulas, melhorSequencia: sequencia.melhor, anos: pessoa.anos };

  return (
    <>
      {/* Sequência */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4" data-testid="card-sequencia">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0",
              sequencia.atual > 0 ? "bg-orange-50 text-orange-500" : "bg-gray-100 text-gray-300",
            )}
          >
            <Flame size={22} />
            <span className="text-[20px] font-black leading-none tabular-nums text-gray-900">{sequencia.atual}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-gray-900">
              {sequencia.atual === 1 ? "1 semana seguida" : `${sequencia.atual} semanas seguidas`}
            </p>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Meta: {sequencia.meta} aulas por semana · Melhor: {sequencia.melhor}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {Array.from({ length: sequencia.meta }, (_, i) => (
                <span
                  key={i}
                  className={cn("w-2.5 h-2.5 rounded-full", i < sequencia.semanaAulas ? "bg-orange-500" : "bg-gray-200")}
                />
              ))}
              <span className="text-[12px] text-gray-500 ml-1">
                Esta semana: {Math.min(sequencia.semanaAulas, sequencia.meta)}/{sequencia.meta}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
          <p className="text-[22px] font-medium text-gray-900 leading-none">{pessoa.totalAulas}</p>
          <p className="text-xs text-gray-400 mt-1">Total de aulas</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-3 text-center">
          <p className="text-[22px] font-medium text-gray-900 leading-none">{pessoa.conquistas.length}</p>
          <p className="text-xs text-gray-400 mt-1">Medalhas</p>
        </div>
      </div>

      {GRUPOS.map(({ grupo, titulo }) => (
        <div key={grupo} className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-3">{titulo}</p>
          <div className="grid grid-cols-3 gap-x-2 gap-y-4">
            {CONQUISTAS.filter((d) => d.grupo === grupo).map((def) => {
              const ganhas = porCodigo.get(def.codigo) ?? [];
              const ganha = ganhas.length > 0;
              const nova = ganhas.some((c) => c.nova);
              const progresso = ganha ? null : progressoConquista(def, estado);
              return (
                <div key={def.codigo} className="flex flex-col items-center text-center gap-1.5" title={def.descricao}>
                  <div className="relative">
                    <Medalha codigo={def.codigo} bloqueada={!ganha} />
                    {def.repetivel && ganhas.length > 1 && (
                      <span className="absolute -top-1 -right-2 bg-gray-900 text-white text-xs font-bold rounded-full px-1.5 py-0.5">
                        ×{ganhas.length}
                      </span>
                    )}
                    {nova && (
                      <span className="absolute -top-1 -left-2 bg-gb-blue text-white text-xs font-bold rounded-full px-1.5 py-0.5">
                        NOVA
                      </span>
                    )}
                  </div>
                  <p className={cn("text-[12px] font-semibold leading-tight", ganha ? "text-gray-900" : "text-gray-400")}>
                    {def.titulo}
                  </p>
                  {ganha ? (
                    <p className="text-xs text-gray-400">{formatarData(ganhas[0].conquistadaEm)}</p>
                  ) : progresso ? (
                    <div className="w-full px-2">
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-400 rounded-full"
                          style={{ width: `${Math.round((progresso.atual / progresso.alvo) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1 tabular-nums">
                        {progresso.atual}/{progresso.alvo}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 leading-tight">{def.descricao}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {pessoa.podeRanking && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
          <Trophy size={18} className="text-gray-400 shrink-0" />
          <div className="flex-1">
            <p className="text-[14px] font-medium text-gray-900">Aparecer no ranking</p>
            <p className="text-[12px] text-gray-500 leading-snug">
              Se desligares, não apareces aos outros alunos e não concorres ao Top 3 do mês.
            </p>
          </div>
          <Switch checked={!oculto} onCheckedChange={alterarVisibilidade} disabled={aGuardar} aria-label="Aparecer no ranking" />
        </div>
      )}
      {erro && <p className="text-[12px] text-red-600 px-1">{erro}</p>}
    </>
  );
}
