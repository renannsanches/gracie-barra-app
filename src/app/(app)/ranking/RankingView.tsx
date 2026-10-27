"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Trophy } from "lucide-react";
import { FaixaBJJ } from "@/components/FaixaBJJ";
import { PageHeader } from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ordenarRanking, type GrupoRanking } from "@/lib/gamificacao";
import type { CorFaixa } from "@/lib/types";
import { definirVisibilidadeRanking } from "../conquistas/conquistas-actions";

export interface LinhaRanking {
  alunoId: string;
  nome: string;
  foto: string | null;
  faixa: string | null;
  graus: number;
  grupo: GrupoRanking;
  aulas: number;
}

export interface RankingViewProps {
  mes: LinhaRanking[];
  ano: LinhaRanking[];
  rotuloMes: string;
  rotuloAno: string;
  /** O próprio e os dependentes — linhas destacadas */
  minhasPessoas: string[];
  grupoPadrao: GrupoRanking;
  /** null quando a conta não treina (só responsável, staff) */
  eu: { id: string; oculto: boolean } | null;
  /** Dentro de outra página (início): sem cabeçalho nem altura de página; os segmentos vão para o topo do corpo */
  embutido?: boolean;
}

type Periodo = "mes" | "ano";

export function RankingView({ mes, ano, rotuloMes, rotuloAno, minhasPessoas, grupoPadrao, eu, embutido = false }: RankingViewProps) {
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [grupo, setGrupo] = useState<GrupoRanking>(grupoPadrao);
  const [oculto, setOculto] = useState(eu?.oculto ?? false);
  const [erro, setErro] = useState("");
  const [aGuardar, startTransition] = useTransition();

  const linhas = useMemo(
    () => ordenarRanking((periodo === "mes" ? mes : ano).filter((l) => l.grupo === grupo)),
    [periodo, grupo, mes, ano],
  );
  const minhas = new Set(minhasPessoas);
  const minhasLinhas = linhas.filter((l) => minhas.has(l.alunoId));
  const podio = linhas.filter((l) => l.posicao <= 3).slice(0, 3);
  const resto = linhas.slice(podio.length);

  function alterarVisibilidade(aparecer: boolean) {
    if (!eu) return;
    setErro("");
    setOculto(!aparecer);
    startTransition(async () => {
      const r = await definirVisibilidadeRanking(eu.id, !aparecer);
      if (!r.ok) {
        setOculto(aparecer);
        setErro(r.erro ?? "Não foi possível guardar.");
        return;
      }
      router.refresh();
    });
  }

  const segmentos = (claro: boolean) => (
    <>
      <Segmentos
        claro={claro}
        valor={periodo}
        onChange={setPeriodo}
        opcoes={[
          { valor: "mes", label: rotuloMes.charAt(0).toUpperCase() + rotuloMes.slice(1) },
          { valor: "ano", label: rotuloAno },
        ]}
      />
      <Segmentos
        claro={claro}
        valor={grupo}
        onChange={setGrupo}
        opcoes={[
          { valor: "adulto", label: "Adultos" },
          { valor: "infantil", label: "Kids" },
        ]}
      />
    </>
  );

  return (
    <div className={embutido ? "flex flex-col" : "min-h-screen flex flex-col bg-gb-gray"}>
      {!embutido && (
        <PageHeader
          title="Ranking de presenças"
          icon={<Trophy size={20} />}
          back={{ href: "/perfil", label: "Início" }}
          subtitle="Quem mais treinou — cada aula conta 1"
        >

          <div className="mt-5 grid grid-cols-2 gap-2">{segmentos(false)}</div>
        </PageHeader>
      )}

      <div className={embutido ? "space-y-3 animar-lista" : "flex-1 px-4 py-5 pb-bottom-nav space-y-3 animar-lista"}>
        {embutido && <div className="grid grid-cols-2 gap-2">{segmentos(true)}</div>}

        {eu && oculto && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3" data-testid="ranking-oculto">
            <EyeOff size={18} className="text-gray-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-gray-900">Estás oculto do ranking</p>
              <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">
                Os outros alunos não te vêem e não concorres ao Top 3 do mês.
              </p>
            </div>
            <Switch checked={!oculto} onCheckedChange={alterarVisibilidade} disabled={aGuardar} aria-label="Aparecer no ranking" />
          </div>
        )}

        {minhasLinhas.length > 0 && (
          <div className="bg-white rounded-2xl border border-gb-blue/30 p-3 space-y-1.5">
            {minhasLinhas.map((l) => (
              <p key={l.alunoId} className="text-[13px] text-gray-700">
                <span className="font-semibold text-gray-900">{l.alunoId === eu?.id ? "A tua posição" : l.nome}</span>
                {": "}
                <span className="font-bold text-gb-blue">{l.posicao}.º</span> com {l.aulas} aula{l.aulas !== 1 ? "s" : ""}
              </p>
            ))}
          </div>
        )}

        {linhas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Trophy size={32} className="mx-auto text-gray-200" />
            <p className="text-[14px] text-gray-500 mt-3">Ainda ninguém treinou neste período.</p>
          </div>
        ) : (
          <>
            <Podio linhas={podio} minhas={minhas} />
            {resto.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100" data-testid="ranking-lista">
                {resto.map((l) => (
                  <LinhaLista key={l.alunoId} linha={l} destaque={minhas.has(l.alunoId)} />
                ))}
              </div>
            )}
          </>
        )}

        {eu && !oculto && (
          <div className="flex items-center justify-between gap-3 px-1 pt-2">
            <p className="text-[12px] text-gray-500 leading-snug">
              Aparecer no ranking. Se desligares, não concorres ao Top 3 do mês.
            </p>
            <Switch checked={!oculto} onCheckedChange={alterarVisibilidade} disabled={aGuardar} aria-label="Aparecer no ranking" />
          </div>
        )}
        {erro && <p className="text-[12px] text-red-600 px-1">{erro}</p>}
      </div>
    </div>
  );
}

function Segmentos<T extends string>({
  valor,
  onChange,
  opcoes,
  claro = false,
}: {
  claro?: boolean;
  valor: T;
  onChange: (v: T) => void;
  opcoes: { valor: T; label: string }[];
}) {
  return (
    <div className={claro ? "flex bg-surface border border-line rounded-xl p-1" : "flex bg-white/10 rounded-xl p-1"} role="tablist">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            "flex-1 py-1.5 rounded-lg text-[13px] font-semibold transition-colors",
            claro
              ? valor === o.valor
                ? "bg-brand text-white"
                : "text-fg-muted hover:text-ink"
              : valor === o.valor
                ? "bg-white text-gray-900"
                : "text-white/60 hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Avatar({ linha, tamanho }: { linha: LinhaRanking; tamanho: "sm" | "lg" }) {
  const iniciais = linha.nome.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className={cn(
        "rounded-full bg-ink flex items-center justify-center overflow-hidden shrink-0",
        tamanho === "lg" ? "w-16 h-16" : "w-10 h-10",
      )}
    >
      {linha.foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={linha.foto} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className={cn("text-white font-bold", tamanho === "lg" ? "text-[18px]" : "text-[13px]")}>{iniciais}</span>
      )}
    </div>
  );
}

function Faixa({ linha }: { linha: LinhaRanking }) {
  if (!linha.faixa) return null;
  return (
    <FaixaBJJ
      faixa={linha.faixa as CorFaixa}
      graus={linha.graus}
      categoria={linha.grupo === "infantil" ? "infantil" : "adulto"}
      tamanho="xs"
    />
  );
}

const COR_PODIO = ["", "bg-yellow-400 text-yellow-900", "bg-slate-300 text-slate-700", "bg-orange-400 text-orange-950"];

function Podio({ linhas, minhas }: { linhas: (LinhaRanking & { posicao: number })[]; minhas: Set<string> }) {
  // 2.º à esquerda, 1.º ao centro, 3.º à direita
  const ordem = linhas.length === 3 ? [linhas[1], linhas[0], linhas[2]] : linhas;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-3 pt-5 pb-4 grid grid-cols-3 gap-2 items-end" data-testid="ranking-podio">
      {ordem.map((l) => {
        const primeiro = l === linhas[0];
        return (
          <div key={l.alunoId} className={cn("flex flex-col items-center text-center gap-1.5 min-w-0", primeiro && "-mt-2")}>
            <div className="relative">
              <Avatar linha={l} tamanho={primeiro ? "lg" : "sm"} />
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-black ring-2 ring-white",
                  COR_PODIO[l.posicao] ?? COR_PODIO[3],
                )}
              >
                {l.posicao}
              </span>
            </div>
            <p className={cn("text-[13px] font-semibold leading-tight w-full truncate", minhas.has(l.alunoId) ? "text-gb-blue" : "text-gray-900")}>
              {l.nome}
            </p>
            <Faixa linha={l} />
            <p className="text-[12px] text-gray-500">
              <span className="font-bold text-gray-900">{l.aulas}</span> aula{l.aulas !== 1 ? "s" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function LinhaLista({ linha, destaque }: { linha: LinhaRanking & { posicao: number }; destaque: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5", destaque && "bg-red-50")}>
      <span className="w-7 text-center text-[14px] font-bold text-gray-400 tabular-nums">{linha.posicao}</span>
      <Avatar linha={linha} tamanho="sm" />
      <div className="flex-1 min-w-0">
        <p className={cn("text-[14px] font-medium truncate", destaque ? "text-gb-blue" : "text-gray-900")}>{linha.nome}</p>
        <Faixa linha={linha} />
      </div>
      <span className="text-[14px] font-bold text-gray-900 tabular-nums">{linha.aulas}</span>
    </div>
  );
}
