"use client";

import { confirmar } from "@/components/ConfirmDialog";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Dumbbell, X, Loader2 } from "lucide-react";

export interface PresencaItem {
  id?: string;
  registrado_em: string;
  aluno_id?: string;
}

export interface PessoaFiltro {
  id: string;
  nome: string;
  cor: string;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

interface Props {
  presencas: PresencaItem[];
  pessoas?: PessoaFiltro[];
  responsavelId?: string;
  onExcluirPresenca?: (id: string) => Promise<void>;
  initialMes?: number;
  initialAno?: number;
}

export function PresencasCalendario({ presencas, pessoas = [], responsavelId = "", onExcluirPresenca, initialMes, initialAno }: Props) {
  const hoje = new Date();
  const [mes, setMes] = useState(initialMes ?? hoje.getMonth());
  const [ano, setAno] = useState(initialAno ?? hoje.getFullYear());
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [pessoaSelecionada, setPessoaSelecionada] = useState(responsavelId);

  const esMesAtual = mes === hoje.getMonth() && ano === hoje.getFullYear();

  const pessoaAtual = useMemo(
    () => pessoas.find((p) => p.id === pessoaSelecionada) ?? pessoas[0],
    [pessoas, pessoaSelecionada]
  );
  const corAtual = pessoaAtual?.cor ?? "#CC0000";
  const primeiroNome = pessoaAtual?.nome.split(" ")[0] ?? "";

  const presencasFiltradas = useMemo(
    () => pessoaSelecionada
      ? presencas.filter((p) => !p.aluno_id || p.aluno_id === pessoaSelecionada)
      : presencas,
    [presencas, pessoaSelecionada]
  );

  const presencasNoMes = useMemo(
    () => presencasFiltradas.filter((p) => {
      const d = new Date(p.registrado_em);
      return d.getMonth() === mes && d.getFullYear() === ano;
    }),
    [presencasFiltradas, mes, ano]
  );

  const diasTreinados = useMemo(
    () => new Set(presencasNoMes.map((p) => new Date(p.registrado_em).getDate())),
    [presencasNoMes]
  );

  const calendarioCells = useMemo(() => {
    const offset = new Date(ano, mes, 1).getDay();
    const total = new Date(ano, mes + 1, 0).getDate();
    const cells: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [mes, ano]);

  function navMes(delta: number) {
    let m = mes + delta;
    let a = ano;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMes(m);
    setAno(a);
  }

  function formatarHora(iso: string) {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatarDataLista(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long",
    });
  }

  async function handleExcluir(id: string) {
    if (!(await confirmar({ titulo: "Excluir esta presença?", confirmar: "Excluir", destrutivo: true }))) return;
    setExcluindo(id);
    try {
      await onExcluirPresenca?.(id);
    } catch {
      // error is handled by parent; nothing to show here
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Seletor de mês + resumo */}
      <div className="bg-surface rounded-2xl border border-line p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navMes(-1)}
            title="Mês anterior"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-subtle transition-colors"
          >
            <ChevronLeft size={18} className="text-fg-muted" />
          </button>
          <div className="text-center">
            <p className="font-bold text-fg text-sm">{MESES[mes]}</p>
            <p className="text-xs text-fg-subtle">{ano}</p>
          </div>
          <button
            type="button"
            onClick={() => navMes(1)}
            disabled={esMesAtual}
            title="Próximo mês"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-subtle transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} className="text-fg-muted" />
          </button>
        </div>
        <div className="mt-3 text-center">
          <p className="text-2xl font-black tabular-nums" style={{ color: corAtual }}>
            {presencasNoMes.length}
          </p>
          <p className="text-xs text-fg-subtle mt-0.5">
            presença{presencasNoMes.length !== 1 ? "s" : ""} em {MESES[mes].toLowerCase()}
          </p>
        </div>
      </div>

      {/* Filtro por pessoa */}
      {pessoas.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {pessoas.map((p) => {
            const selecionado = pessoaSelecionada === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPessoaSelecionada(p.id)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all"
                style={
                  selecionado
                    ? { backgroundColor: p.cor, color: "#ffffff" }
                    : { backgroundColor: "rgb(var(--surface))", color: "rgb(var(--fg-muted))", border: "1px solid rgb(var(--line))" }
                }
              >
                {p.nome.split(" ")[0]}
              </button>
            );
          })}
        </div>
      )}

      {/* Calendário */}
      <div className="bg-surface rounded-2xl border border-line p-4">
        <div className="grid grid-cols-7 mb-2">
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="text-center text-xs font-semibold text-fg-subtle py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarioCells.map((dia, i) => {
            if (dia === null) return <div key={`e-${i}`} />;
            const treinou = diasTreinados.has(dia);
            const eHoje = esMesAtual && hoje.getDate() === dia;
            return (
              <div
                key={dia}
                className="aspect-square rounded-md flex items-center justify-center text-xs font-medium select-none"
                style={
                  treinou
                    ? { backgroundColor: corAtual, color: "#ffffff", fontWeight: 700 }
                    : eHoje
                    ? { backgroundColor: "rgb(var(--canvas))", border: `2px solid ${corAtual}`, color: corAtual, fontWeight: 700 }
                    : { backgroundColor: "rgb(var(--subtle))", color: "rgb(var(--fg-subtle))" }
                }
              >
                {dia}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: corAtual }} />
            <span className="text-xs text-fg-subtle">Treinou</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-subtle border border-line" />
            <span className="text-xs text-fg-subtle">Sem treino</span>
          </div>
        </div>
      </div>

      {/* Lista */}
      {presencasNoMes.length > 0 ? (
        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h3 className="font-bold text-fg text-sm">Registros de {MESES[mes].toLowerCase()}</h3>
          </div>
          <div className="divide-y divide-line">
            {presencasNoMes.map((p, i) => (
              <div key={p.id ?? i} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${corAtual}1A` }}
                  >
                    <Dumbbell size={12} style={{ color: corAtual }} />
                  </div>
                  <div className="min-w-0">
                    <span
                      className="text-xs font-bold"
                      style={{ color: corAtual }}
                    >
                      {primeiroNome}
                    </span>
                    <p className="text-sm font-medium text-fg capitalize truncate">
                      {formatarDataLista(p.registrado_em)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-2 shrink-0">
                  <span className="text-sm text-fg-subtle tabular-nums">{formatarHora(p.registrado_em)}</span>
                  {onExcluirPresenca && p.id && (
                    <button
                      type="button"
                      onClick={() => handleExcluir(p.id!)}
                      disabled={excluindo === p.id}
                      title="Excluir presença"
                      className="w-6 h-6 rounded-md flex items-center justify-center text-line-strong hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors disabled:opacity-50"
                    >
                      {excluindo === p.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <X size={12} />
                      }
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-line p-8 text-center">
          <CalendarDays size={36} className="text-line mx-auto mb-2" />
          <p className="text-fg-subtle text-sm">Nenhuma presença em {MESES[mes].toLowerCase()}</p>
        </div>
      )}
    </div>
  );
}
