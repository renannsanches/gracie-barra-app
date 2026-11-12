"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTurmaTag } from "@/lib/turma-tags";
import { diaLisboa } from "@/lib/presenca-manual";
import {
  aulasDoMes,
  adicionarPresencasPorAula,
  type AulaDia,
  type DiaPresencas,
} from "./presencas-actions";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

type NovaPresenca = { id: string; registrado_em: string; aluno_id: string };

interface Props {
  alunoId: string;
  aberto: boolean;
  onFechar: () => void;
  onAdicionadas: (novas: NovaPresenca[]) => void;
}

/** "YYYY-MM" a partir de ano e mês (0–11). */
function chaveMes(ano: number, mes: number) {
  return `${ano}-${String(mes + 1).padStart(2, "0")}`;
}

function formatarDiaLongo(data: string) {
  return new Date(`${data}T12:00:00Z`).toLocaleDateString("pt-PT", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}

function formatarDiaCurto(data: string) {
  const d = new Date(`${data}T12:00:00Z`);
  const semana = d.toLocaleDateString("pt-PT", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  return `${semana} ${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

export function AdicionarPresencasDialog({ alunoId, aberto, onFechar, onAdicionadas }: Props) {
  const hoje = useMemo(() => diaLisboa(new Date().toISOString()), []);
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(hoje.slice(5, 7)) - 1);
  const [diaSel, setDiaSel] = useState(hoje);

  const [cache, setCache] = useState<Record<string, Record<string, DiaPresencas>>>({});
  const [erro, setErro] = useState("");

  // Escolhas acumulam entre dias: aulas por dia + dias com presença sem aula
  const [escolhas, setEscolhas] = useState<Record<string, string[]>>({});
  const [avulsas, setAvulsas] = useState<string[]>([]);
  const [mostrarOutras, setMostrarOutras] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const chave = chaveMes(ano, mes);
  const dias = cache[chave];
  const eMesAtual = chave === hoje.slice(0, 7);

  // Carrega o mês visível (uma vez por mês; o erro pára até "Tentar de novo")
  useEffect(() => {
    if (!aberto || cache[chave] || erro) return;
    let cancelado = false;
    aulasDoMes(alunoId, chave)
      .then((r) => {
        if (cancelado) return;
        if (!r.ok || !r.dias) setErro(r.erro ?? "Não foi possível carregar as aulas.");
        else setCache((c) => ({ ...c, [chave]: r.dias! }));
      })
      .catch(() => { if (!cancelado) setErro("Sem ligação. Verifica a rede e tenta de novo."); });
    return () => { cancelado = true; };
  }, [aberto, alunoId, chave, cache, erro]);
  const carregando = !dias && !erro;

  function reset() {
    setEscolhas({});
    setAvulsas([]);
    setMostrarOutras(false);
    setErro("");
    setCache({});
    setAno(Number(hoje.slice(0, 4)));
    setMes(Number(hoje.slice(5, 7)) - 1);
    setDiaSel(hoje);
  }

  function fechar() {
    if (guardando) return;
    reset();
    onFechar();
  }

  function navMes(delta: number) {
    let m = mes + delta;
    let a = ano;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMes(m);
    setAno(a);
    setMostrarOutras(false);
    setErro("");
    // Selecciona o último dia possível do mês novo
    const ultimo = new Date(Date.UTC(a, m + 1, 0)).toISOString().slice(0, 10);
    setDiaSel(ultimo < hoje ? ultimo : hoje);
  }

  function escolherDia(d: string) {
    setDiaSel(d);
    setMostrarOutras(false);
  }

  function alternarAula(data: string, aulaId: string) {
    // Turmas à mesma hora excluem-se: escolher uma tira a outra
    const aulasDia = dias?.[data]?.aulas ?? [];
    const horario = aulasDia.find((a) => a.id === aulaId)?.horario;
    const mesmaHora = new Set(aulasDia.filter((a) => a.horario === horario && a.id !== aulaId).map((a) => a.id));
    setEscolhas((prev) => {
      const atual = prev[data] ?? [];
      const prox = atual.includes(aulaId)
        ? atual.filter((x) => x !== aulaId)
        : [...atual.filter((x) => !mesmaHora.has(x)), aulaId];
      const copia = { ...prev };
      if (prox.length) copia[data] = prox; else delete copia[data];
      return copia;
    });
  }

  function alternarAvulsa(data: string) {
    setAvulsas((prev) => (prev.includes(data) ? prev.filter((x) => x !== data) : [...prev, data]));
  }

  function removerDia(data: string) {
    setEscolhas((prev) => { const c = { ...prev }; delete c[data]; return c; });
    setAvulsas((prev) => prev.filter((x) => x !== data));
  }

  const totalEscolhidas = Object.values(escolhas).reduce((s, l) => s + l.length, 0) + avulsas.length;
  const diasComEscolha = useMemo(() => {
    const todos = new Set([...Object.keys(escolhas), ...avulsas]);
    return [...todos].sort();
  }, [escolhas, avulsas]);

  function contagemDia(d: string) {
    return (escolhas[d]?.length ?? 0) + (avulsas.includes(d) ? 1 : 0);
  }

  async function confirmar() {
    if (!totalEscolhidas) return;
    setGuardando(true);
    try {
      const r = await adicionarPresencasPorAula(alunoId, {
        aulaIds: Object.values(escolhas).flat(),
        avulsas,
      });
      if (!r.ok) { toast.error(r.erro ?? "Não foi possível adicionar as presenças."); return; }
      const n = r.adicionadas ?? 0;
      if (n > 0) {
        onAdicionadas(r.novas ?? []);
        toast.success(n === 1 ? "1 presença adicionada" : `${n} presenças adicionadas`);
      }
      if (r.duplicadas) {
        toast.info(r.duplicadas === 1
          ? "1 aula já tinha presença e não foi repetida."
          : `${r.duplicadas} aulas já tinham presença e não foram repetidas.`);
      }
      reset();
      onFechar();
    } catch {
      toast.error("Sem ligação. As presenças não foram guardadas.");
    } finally {
      setGuardando(false);
    }
  }

  // ── Calendário ──
  const celulas = useMemo(() => {
    const offset = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
    const total = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    const cells: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) cells.push(`${chave}-${String(d).padStart(2, "0")}`);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [ano, mes, chave]);

  const infoDia = dias?.[diaSel];
  const aulasDoAluno = infoDia?.aulas.filter((a) => a.doAluno) ?? [];
  const outrasAulas = infoDia?.aulas.filter((a) => !a.doAluno) ?? [];
  const semAulas = !!dias && (infoDia?.aulas.length ?? 0) === 0;

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent variant="sheet" className="sm:max-w-xl !pb-0">
        <DialogHeader>
          <DialogTitle>Adicionar presenças</DialogTitle>
          <DialogDescription>Escolhe o dia e marca as aulas em que o aluno treinou.</DialogDescription>
        </DialogHeader>

        {/* Mês */}
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => navMes(-1)}
            aria-label="Mês anterior"
            className="w-11 h-11 rounded-full flex items-center justify-center text-fg-muted hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="font-bold text-fg text-sm tabular-nums">{MESES[mes]} {ano}</p>
          <button
            type="button"
            onClick={() => navMes(1)}
            disabled={eMesAtual}
            aria-label="Mês seguinte"
            className="w-11 h-11 rounded-full flex items-center justify-center text-fg-muted hover:bg-subtle disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Calendário */}
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Dias de ${MESES[mes]}`}>
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="text-center text-xs font-semibold text-fg-subtle pb-1">{d}</div>
          ))}
          {celulas.map((d, i) => {
            if (!d) return <div key={`v-${i}`} />;
            const futuro = d > hoje;
            const info = dias?.[d];
            const escolhidas = contagemDia(d);
            const selecionado = d === diaSel;
            const temAulas = (info?.aulas.length ?? 0) > 0;
            return (
              <button
                key={d}
                type="button"
                disabled={futuro || !dias}
                onClick={() => escolherDia(d)}
                aria-pressed={selecionado}
                aria-label={`${formatarDiaLongo(d)}${info?.presencas ? `, ${info.presencas} presença(s)` : ""}${escolhidas ? `, ${escolhidas} escolhida(s)` : ""}`}
                className={cn(
                  "relative aspect-square min-h-[40px] rounded-lg flex flex-col items-center justify-center text-sm tabular-nums transition-colors duration-fast",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
                  futuro && "text-fg-subtle/50 cursor-not-allowed",
                  !futuro && escolhidas > 0 && "bg-brand text-white font-bold",
                  !futuro && !escolhidas && temAulas && "bg-subtle text-fg hover:bg-line",
                  !futuro && !escolhidas && !temAulas && "text-fg-subtle hover:bg-subtle",
                  selecionado && !escolhidas && "ring-2 ring-brand ring-inset font-bold text-brand",
                  selecionado && escolhidas > 0 && "ring-2 ring-brand ring-offset-2",
                )}
              >
                {Number(d.slice(8, 10))}
                {!!info?.presencas && (
                  <span
                    aria-hidden="true"
                    className={cn("absolute bottom-1 h-1 w-1 rounded-full", escolhidas ? "bg-white" : "bg-brand")}
                  />
                )}
                {escolhidas > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-surface text-brand text-xs font-bold leading-[18px] shadow ring-1 ring-brand/30"
                  >
                    {escolhidas}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-fg-subtle">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-brand" />Já tem presença</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-brand" />Escolhido</span>
        </div>

        {/* Aulas do dia */}
        <section className="mt-5 border-t border-line pt-4 min-h-[180px]" aria-live="polite">
          <h3 className="font-bold text-fg text-sm first-letter:uppercase mb-3">{formatarDiaLongo(diaSel)}</h3>

          {carregando && !dias && (
            <div className="space-y-2" aria-label="A carregar aulas">
              {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-subtle animate-pulse" />)}
            </div>
          )}

          {erro && !dias && (
            <div className="rounded-xl bg-subtle p-4 text-sm text-fg-muted">
              <p>{erro}</p>
              <button
                type="button"
                onClick={() => setErro("")}
                className="mt-2 font-semibold text-brand hover:underline"
              >
                Tentar de novo
              </button>
            </div>
          )}

          {dias && (
            <>
              {!!infoDia?.avulsas && (
                <p className="mb-3 text-xs text-fg-muted">
                  {infoDia.avulsas === 1
                    ? "Já há 1 presença sem aula neste dia."
                    : `Já há ${infoDia.avulsas} presenças sem aula neste dia.`}
                </p>
              )}

              {aulasDoAluno.length > 0 && (
                <ul className="space-y-2">
                  {aulasDoAluno.map((a) => (
                    <LinhaAula
                      key={a.id}
                      aula={a}
                      marcada={escolhas[diaSel]?.includes(a.id) ?? false}
                      onAlternar={() => alternarAula(diaSel, a.id)}
                    />
                  ))}
                </ul>
              )}

              {outrasAulas.length > 0 && (
                mostrarOutras || aulasDoAluno.length === 0 ? (
                  <>
                    {aulasDoAluno.length > 0 && (
                      <p className="mt-4 mb-2 text-xs font-semibold text-fg-subtle">Outras aulas do dia</p>
                    )}
                    <ul className="space-y-2">
                      {outrasAulas.map((a) => (
                        <LinhaAula
                          key={a.id}
                          aula={a}
                          marcada={escolhas[diaSel]?.includes(a.id) ?? false}
                          onAlternar={() => alternarAula(diaSel, a.id)}
                        />
                      ))}
                    </ul>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMostrarOutras(true)}
                    className="mt-3 min-h-[44px] text-sm font-semibold text-brand hover:underline"
                  >
                    Mostrar outras aulas do dia ({outrasAulas.length})
                  </button>
                )
              )}

              {semAulas && (
                <div className="rounded-xl border border-dashed border-line-strong p-4 text-center">
                  <p className="text-sm text-fg-muted">Não há aulas no sistema neste dia.</p>
                  <button
                    type="button"
                    onClick={() => alternarAvulsa(diaSel)}
                    aria-pressed={avulsas.includes(diaSel)}
                    className={cn(
                      "mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-fast",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                      avulsas.includes(diaSel)
                        ? "bg-brand text-white"
                        : "bg-subtle text-fg hover:bg-line",
                    )}
                  >
                    {avulsas.includes(diaSel) && <Check size={14} />}
                    {avulsas.includes(diaSel) ? "Presença sem aula escolhida" : "Adicionar presença sem aula"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Rodapé fixo */}
        <div className="sticky bottom-0 -mx-5 sm:-mx-6 mt-5 border-t border-line bg-surface px-5 sm:px-6 pt-3 pb-sheet sm:pb-6">
          {diasComEscolha.length > 0 && (
            <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {diasComEscolha.map((d) => (
                <span
                  key={d}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-brand/10 pl-3 pr-1 text-xs font-semibold text-brand"
                >
                  <button type="button" onClick={() => escolherDia(d)} className="py-1.5 capitalize">
                    {formatarDiaCurto(d)} ({contagemDia(d)})
                  </button>
                  <button
                    type="button"
                    onClick={() => removerDia(d)}
                    aria-label={`Tirar as escolhas de ${formatarDiaLongo(d)}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-brand/15"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={fechar} disabled={guardando} className="h-11">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmar}
              disabled={!totalEscolhidas || guardando}
              className="h-11 flex-1 bg-brand hover:bg-brand-dark text-white"
            >
              {guardando
                ? <><Loader2 size={14} className="animate-spin mr-2" />A guardar…</>
                : totalEscolhidas === 0
                  ? "Escolhe as aulas"
                  : totalEscolhidas === 1 ? "Adicionar 1 presença" : `Adicionar ${totalEscolhidas} presenças`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinhaAula({ aula, marcada, onAlternar }: { aula: AulaDia; marcada: boolean; onAlternar: () => void }) {
  const tag = getTurmaTag(aula.turma);
  const registada = aula.registada;
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={registada || marcada}
        aria-disabled={registada}
        disabled={registada}
        onClick={onAlternar}
        className={cn(
          "w-full min-h-[56px] flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors duration-fast",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          registada && "border-line bg-subtle cursor-default",
          !registada && marcada && "border-brand bg-brand/5",
          !registada && !marcada && "border-line bg-surface hover:border-line-strong",
        )}
      >
        <span
          className={cn(
            "w-14 shrink-0 text-xl font-bold tabular-nums tracking-tight",
            registada ? "text-fg-subtle" : marcada ? "text-brand" : "text-fg",
          )}
        >
          {aula.horario}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm font-medium", registada ? "text-fg-subtle" : "text-fg")}>
            {aula.turma}
          </span>
          {registada && <span className="block text-xs text-fg-subtle">Já registada</span>}
        </span>
        {tag && (
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-xs font-bold text-white" /* tema: fixo */
            style={{ backgroundColor: tag.bg, opacity: registada ? 0.5 : 1 }}
          >
            {tag.code}
          </span>
        )}
        <span
          aria-hidden="true"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-fast",
            registada && "border-fg-subtle/40 bg-fg-subtle/40 text-white",
            !registada && marcada && "border-brand bg-brand text-white",
            !registada && !marcada && "border-line-strong",
          )}
        >
          {(registada || marcada) && <Check size={14} strokeWidth={3} />}
        </span>
      </button>
    </li>
  );
}
