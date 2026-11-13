"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, EyeOff, Trophy } from "lucide-react";
import { FaixaBJJ } from "@/components/FaixaBJJ";
import { PageHeader } from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ordenarRanking, type GrupoRanking } from "@/lib/gamificacao";
import type { CorFaixa } from "@/lib/types";
import { definirVisibilidadeRanking } from "../conquistas/conquistas-actions";
import { carregarPeriodoRanking } from "./ranking-actions";

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
  /** Ranking do mês actual (vem do servidor) */
  mes: LinhaRanking[];
  /** Ranking do ano actual (vem do servidor) */
  ano: LinhaRanking[];
  /** Mês actual, YYYY-MM */
  mesAtual: string;
  /** Meses escolhíveis (YYYY-MM): janeiro até ao mês actual */
  meses: string[];
  rotuloAno: string;
  /** O próprio e os dependentes — linhas destacadas */
  minhasPessoas: string[];
  grupoPadrao: GrupoRanking;
  /** null quando a conta não treina (só responsável, staff) */
  eu: { id: string; oculto: boolean } | null;
  /** Dentro de outra página (início): sem cabeçalho nem altura de página; os segmentos vão para o topo do corpo */
  embutido?: boolean;
}

/** "ano" ou um mês YYYY-MM */
type Periodo = string;

const fmtMesLongo = new Intl.DateTimeFormat("pt-PT", { month: "long", timeZone: "UTC" });
const fmtMesCurto = new Intl.DateTimeFormat("pt-PT", { month: "short", timeZone: "UTC" });

function nomeMes(mes: string, curto = false): string {
  const nome = (curto ? fmtMesCurto : fmtMesLongo).format(new Date(`${mes}-15T12:00:00Z`)).replace(".", "");
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export function RankingView({
  mes,
  ano,
  mesAtual,
  meses,
  rotuloAno,
  minhasPessoas,
  grupoPadrao,
  eu,
  embutido = false,
}: RankingViewProps) {
  const router = useRouter();
  // periodo = o escolhido (rótulo do botão); mostrado = aquele cujas linhas estão no ecrã
  const [periodo, setPeriodo] = useState<Periodo>(mesAtual);
  const [mostrado, setMostrado] = useState<Periodo>(mesAtual);
  // Meses pedidos depois do 1.º render (o mês actual e o ano vêm sempre das props)
  const [outros, setOutros] = useState<Record<string, LinhaRanking[]>>({});
  const ultimoPedido = useRef<Periodo>(mesAtual);
  const [aCarregar, startCarregar] = useTransition();
  const [grupo, setGrupo] = useState<GrupoRanking>(grupoPadrao);
  const [oculto, setOculto] = useState(eu?.oculto ?? false);
  const [erro, setErro] = useState("");
  const [aGuardar, startTransition] = useTransition();

  const linhasDe = (p: Periodo): LinhaRanking[] | undefined => (p === mesAtual ? mes : p === "ano" ? ano : outros[p]);
  const base = linhasDe(mostrado) ?? mes;

  const linhas = useMemo(() => ordenarRanking(base.filter((l) => l.grupo === grupo)), [base, grupo]);

  function buscar(p: Periodo, anterior: Periodo) {
    startCarregar(async () => {
      const r = await carregarPeriodoRanking(p);
      if (r.ok) setOutros((o) => ({ ...o, [p]: r.linhas }));
      if (ultimoPedido.current !== p) return; // entretanto escolheu outro
      if (!r.ok) {
        toast.error(r.erro);
        ultimoPedido.current = anterior;
        setPeriodo(anterior);
        return;
      }
      setMostrado(p);
    });
  }

  function escolherPeriodo(p: Periodo) {
    if (p === periodo) return;
    const anterior = mostrado;
    ultimoPedido.current = p;
    setPeriodo(p);
    if (linhasDe(p)) setMostrado(p);
    else buscar(p, anterior);
  }
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
      // O mês actual e o ano chegam actualizados pelo refresh; os outros meses voltam a ser pedidos
      setOutros({});
      if (mostrado !== mesAtual && mostrado !== "ano") buscar(mostrado, mesAtual);
    });
  }

  const segmentos = (claro: boolean) => (
    <>
      <PeriodoPicker
        claro={claro}
        valor={periodo}
        onChange={escolherPeriodo}
        meses={meses}
        rotuloAno={rotuloAno}
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
    <div className={embutido ? "flex flex-col" : "min-h-screen flex flex-col bg-canvas"}>
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
          <div className="bg-surface rounded-2xl border border-line p-4 flex items-start gap-3" data-testid="ranking-oculto">
            <EyeOff size={18} className="text-fg-subtle mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-fg">Estás oculto do ranking</p>
              <p className="text-[12px] text-fg-muted mt-0.5 leading-snug">
                Os outros alunos não te vêem e não concorres ao Top 3 do mês.
              </p>
            </div>
            <Switch checked={!oculto} onCheckedChange={alterarVisibilidade} disabled={aGuardar} aria-label="Aparecer no ranking" />
          </div>
        )}

        <div
          className={cn("space-y-3 transition-opacity duration-fast", aCarregar && "opacity-60")}
          aria-busy={aCarregar}
          data-testid="ranking-resultados"
        >
          {minhasLinhas.length > 0 && (
            <div className="bg-surface rounded-2xl border border-gb-blue/30 p-3 space-y-1.5">
              {minhasLinhas.map((l) => (
                <p key={l.alunoId} className="text-[13px] text-fg">
                  <span className="font-semibold text-fg">{l.alunoId === eu?.id ? "A tua posição" : l.nome}</span>
                  {": "}
                  <span className="font-bold text-gb-blue">{l.posicao}.º</span> com {l.aulas} aula{l.aulas !== 1 ? "s" : ""}
                </p>
              ))}
            </div>
          )}

          {linhas.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-line p-8 text-center">
              <Trophy size={32} className="mx-auto text-line" />
              <p className="text-[14px] text-fg-muted mt-3">Ainda ninguém treinou neste período.</p>
            </div>
          ) : (
            <>
              <Podio linhas={podio} minhas={minhas} />
              {resto.length > 0 && (
                <div className="bg-surface rounded-2xl border border-line divide-y divide-line" data-testid="ranking-lista">
                  {resto.map((l) => (
                    <LinhaLista key={l.alunoId} linha={l} destaque={minhas.has(l.alunoId)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {eu && !oculto && (
          <div className="flex items-center justify-between gap-3 px-1 pt-2">
            <p className="text-[12px] text-fg-muted leading-snug">
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
                : "text-fg-muted hover:text-fg"
              : valor === o.valor
                ? "bg-surface dark:bg-line-strong text-fg"
                : "text-white/60 hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Botão com o período escolhido; abre uma bottom sheet com "Todo AAAA" e os meses do ano. */
function PeriodoPicker({
  valor,
  onChange,
  meses,
  rotuloAno,
  claro = false,
}: {
  valor: Periodo;
  onChange: (v: Periodo) => void;
  meses: string[];
  rotuloAno: string;
  claro?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const rotulo = valor === "ano" ? `Todo ${rotuloAno}` : nomeMes(valor);

  function escolher(p: Periodo) {
    setAberto(false);
    onChange(p);
  }

  return (
    <>
      {/* Mesmo contentor e altura dos segmentos ao lado */}
      <div className={claro ? "flex bg-surface border border-line rounded-xl p-1" : "flex bg-white/10 rounded-xl p-1"}>
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-haspopup="dialog"
          aria-label={`Período do ranking: ${rotulo}`}
          data-testid="ranking-periodo"
          className={cn(
            "flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[13px] font-semibold transition-colors",
            claro ? "text-fg hover:bg-subtle" : "text-white hover:bg-white/10",
          )}
        >
          <span className="truncate">{rotulo}</span>
          <ChevronDown size={14} className={claro ? "shrink-0 text-fg-muted" : "shrink-0 text-white/70"} />
        </button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent variant="sheet" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Período do ranking</DialogTitle>
          </DialogHeader>
          <button
            type="button"
            onClick={() => escolher("ano")}
            aria-pressed={valor === "ano"}
            className={cn(
              "w-full min-h-11 rounded-xl text-[15px] font-semibold transition-colors",
              valor === "ano" ? "bg-brand text-white" : "bg-subtle text-fg hover:bg-line",
            )}
          >
            Todo {rotuloAno}
          </button>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {meses.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => escolher(m)}
                aria-pressed={valor === m}
                aria-label={nomeMes(m)}
                className={cn(
                  "min-h-11 rounded-xl text-[14px] font-semibold transition-colors",
                  valor === m ? "bg-brand text-white" : "bg-subtle text-fg hover:bg-line",
                )}
              >
                {nomeMes(m, true)}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
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
    <div className="bg-surface rounded-2xl border border-line px-3 pt-5 pb-4 grid grid-cols-3 gap-2 items-end" data-testid="ranking-podio">
      {ordem.map((l) => {
        const primeiro = l === linhas[0];
        return (
          <div key={l.alunoId} className={cn("flex flex-col items-center text-center gap-1.5 min-w-0", primeiro && "-mt-2")}>
            <div className="relative">
              <Avatar linha={l} tamanho={primeiro ? "lg" : "sm"} />
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-black ring-2 ring-surface",
                  COR_PODIO[l.posicao] ?? COR_PODIO[3],
                )}
              >
                {l.posicao}
              </span>
            </div>
            <p className={cn("text-[13px] font-semibold leading-tight w-full truncate", minhas.has(l.alunoId) ? "text-gb-blue" : "text-fg")}>
              {l.nome}
            </p>
            <Faixa linha={l} />
            <p className="text-[12px] text-fg-muted">
              <span className="font-bold text-fg">{l.aulas}</span> aula{l.aulas !== 1 ? "s" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function LinhaLista({ linha, destaque }: { linha: LinhaRanking & { posicao: number }; destaque: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5", destaque && "bg-red-50 dark:bg-red-500/15")}>
      <span className="w-7 text-center text-[14px] font-bold text-fg-subtle tabular-nums">{linha.posicao}</span>
      <Avatar linha={linha} tamanho="sm" />
      <div className="flex-1 min-w-0">
        <p className={cn("text-[14px] font-medium truncate", destaque ? "text-gb-blue" : "text-fg")}>{linha.nome}</p>
        <Faixa linha={linha} />
      </div>
      <span className="text-[14px] font-bold text-fg tabular-nums">{linha.aulas}</span>
    </div>
  );
}
