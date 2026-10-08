"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, Plus, Tag, X } from "lucide-react";
import { EuroInput } from "@/components/ui/euro-input";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  calcularPlano, formatarEuro, lerValorEuro, ordemModalidades, rotuloModalidade, valorParaInput, valorSugerido,
  type DescontoPlano, type GrupoRef, type LinhaPlano,
} from "@/lib/modalidades";
import type { Modalidade } from "@/lib/types";

// ─── Rascunho (valores como texto para aceitar "49,60") ──────────────────────

export interface LinhaRascunho {
  modalidade_id: string;
  valor: string;
  cobrar: boolean;
}

export interface DescontoRascunho {
  /** Identificador local, só para o React */
  chave: string;
  descricao: string;
  valor: string;
  origem_modalidade_id: string | null;
}

export interface PlanoRascunho {
  linhas: LinhaRascunho[];
  descontos: DescontoRascunho[];
}

let seq = 0;
const novaChave = () => `d${Date.now()}-${seq++}`;

export function planoParaRascunho(linhas: LinhaPlano[], descontos: DescontoPlano[]): PlanoRascunho {
  return {
    linhas: linhas.map((l) => ({ modalidade_id: l.modalidade_id, valor: valorParaInput(l.valor), cobrar: l.cobrar })),
    // Chaves determinísticas: o mesmo HTML no servidor e no cliente (hidratação)
    descontos: descontos.map((d, i) => ({
      chave: `inicial-${i}`,
      descricao: d.descricao,
      valor: valorParaInput(d.valor),
      origem_modalidade_id: d.origem_modalidade_id,
    })),
  };
}

/** Converte o rascunho; devolve as linhas/descontos prontos a gravar ou uma mensagem de erro. */
export function lerPlano(
  plano: PlanoRascunho,
  modalidades: Modalidade[],
): { linhas?: LinhaPlano[]; descontos?: DescontoPlano[]; erro?: string } {
  const linhas: LinhaPlano[] = [];
  for (const l of plano.linhas) {
    const valor = lerValorEuro(l.valor);
    if (valor === null) {
      const nome = modalidades.find((m) => m.id === l.modalidade_id)?.nome ?? "modalidade";
      return { erro: `Indica o valor de ${nome} (ex.: 20).` };
    }
    linhas.push({ modalidade_id: l.modalidade_id, valor, cobrar: l.cobrar });
  }
  const descontos: DescontoPlano[] = [];
  for (const d of plano.descontos) {
    if (!d.descricao.trim()) return { erro: "Escreve a descrição do desconto (ex.: Irmãos)." };
    const valor = lerValorEuro(d.valor);
    if (valor === null || valor <= 0) return { erro: `Indica o valor do desconto "${d.descricao.trim()}".` };
    descontos.push({ descricao: d.descricao.trim(), valor, origem_modalidade_id: d.origem_modalidade_id });
  }
  return { linhas, descontos };
}

// ─── Regra automática do desconto entre locais ───────────────────────────────

/**
 * Quem tem uma modalidade com "desconta noutro local" (ex.: Jiu-Jitsu · Colégio) e também
 * treina noutro local: essa modalidade passa a ser paga no próprio local e o seu valor entra
 * como desconto. Ao deixar de treinar nos dois locais, volta tudo atrás.
 * Corre só quando o admin acrescenta/tira uma modalidade — nunca ao abrir a ficha.
 */
function aplicarRegraLocais(
  plano: PlanoRascunho,
  modalidades: Modalidade[],
  grupos: GrupoRef[],
): { plano: PlanoRascunho; nota: string | null } {
  const porId = new Map(modalidades.map((m) => [m.id, m]));
  const nomeGrupo = (id: string) => grupos.find((g) => g.id === id)?.nome ?? "outro local";
  let { linhas, descontos } = plano;
  let nota: string | null = null;

  for (const linha of plano.linhas) {
    const m = porId.get(linha.modalidade_id);
    if (!m?.desconta_noutro_local) continue;
    const noutroLocal = linhas.some((l) => l.modalidade_id !== m.id && porId.get(l.modalidade_id)?.grupo_id !== m.grupo_id);
    const temDesconto = descontos.some((d) => d.origem_modalidade_id === m.id);
    const local = nomeGrupo(m.grupo_id);

    if (noutroLocal && !temDesconto) {
      linhas = linhas.map((l) => (l.modalidade_id === m.id ? { ...l, cobrar: false } : l));
      descontos = [
        ...descontos,
        { chave: novaChave(), descricao: `Desconto aluno do ${local}`, valor: linha.valor, origem_modalidade_id: m.id },
      ];
      nota = `Desconto do ${local} aplicado: os ${formatarEuro(lerValorEuro(linha.valor) ?? 0)} passam a ser pagos no ${local}.`;
    } else if (!noutroLocal && temDesconto) {
      linhas = linhas.map((l) => (l.modalidade_id === m.id ? { ...l, cobrar: true } : l));
      descontos = descontos.filter((d) => d.origem_modalidade_id !== m.id);
      nota = `Desconto do ${local} retirado: o ${local} volta a ser cobrado na app.`;
    }
  }

  // Desconto cuja modalidade de origem saiu do plano
  const orfaos = descontos.filter(
    (d) => d.origem_modalidade_id && !linhas.some((l) => l.modalidade_id === d.origem_modalidade_id),
  );
  if (orfaos.length > 0) {
    descontos = descontos.filter((d) => !orfaos.includes(d));
    nota = `${orfaos.map((d) => d.descricao).join(", ")} retirado.`;
  }

  return { plano: { linhas, descontos }, nota };
}

// ─── Componente ──────────────────────────────────────────────────────────────

interface Props {
  modalidades: Modalidade[];
  /** Locais (grupos) — para agrupar e rotular "Jiu-Jitsu · Colégio" */
  grupos: GrupoRef[];
  value: PlanoRascunho;
  onChange: (plano: PlanoRascunho) => void;
  /** Para sugerir o valor de menores de 16 ao adicionar uma modalidade */
  dataNascimento?: string | null;
  disabled?: boolean;
  idPrefix: string;
}

/**
 * O que o aluno treina, onde, e quanto paga por cada coisa.
 * A mensalidade na app é a soma do que é cobrado na app menos os descontos.
 */
export function ModalidadesEditor({ modalidades, grupos, value, onChange, dataNascimento, disabled, idPrefix }: Props) {
  const [nota, setNota] = useState<string | null>(null);

  const porId = new Map(modalidades.map((m) => [m.id, m]));
  const rotulos = new Map(modalidades.map((m) => [m.id, rotuloModalidade(m, grupos)]));
  const ordem = ordemModalidades(modalidades, grupos);
  const nomeGrupo = (id: string) => grupos.find((g) => g.id === id)?.nome ?? "";
  // Cabeçalhos por local só quando há modalidades em mais de um local
  const variosLocais = new Set(modalidades.map((m) => m.grupo_id)).size > 1;

  const linhasNum: LinhaPlano[] = value.linhas.map((l) => ({
    modalidade_id: l.modalidade_id, valor: lerValorEuro(l.valor) ?? 0, cobrar: l.cobrar,
  }));
  const descontosNum: DescontoPlano[] = value.descontos.map((d) => ({
    descricao: d.descricao, valor: lerValorEuro(d.valor) ?? 0, origem_modalidade_id: d.origem_modalidade_id,
  }));
  const { total, foraDaApp } = calcularPlano(linhasNum, descontosNum, rotulos);
  const locaisFora = [...new Set(value.linhas.filter((l) => !l.cobrar).map((l) => nomeGrupo(porId.get(l.modalidade_id)?.grupo_id ?? "")))];

  function mudar(plano: PlanoRascunho, comRegra = false) {
    if (!comRegra) { onChange(plano); return; }
    const r = aplicarRegraLocais(plano, modalidades, grupos);
    setNota(r.nota);
    onChange(r.plano);
  }

  function adicionar(m: Modalidade) {
    const valor = valorParaInput(valorSugerido(m, dataNascimento));
    mudar({ ...value, linhas: [...value.linhas, { modalidade_id: m.id, valor, cobrar: true }] }, true);
  }

  function remover(id: string) {
    mudar({ ...value, linhas: value.linhas.filter((l) => l.modalidade_id !== id) }, true);
  }

  function mudarLinha(id: string, patch: Partial<LinhaRascunho>) {
    setNota(null);
    mudar({ ...value, linhas: value.linhas.map((l) => (l.modalidade_id === id ? { ...l, ...patch } : l)) });
  }

  function mudarDesconto(chave: string, patch: Partial<DescontoRascunho>) {
    setNota(null);
    mudar({ ...value, descontos: value.descontos.map((d) => (d.chave === chave ? { ...d, ...patch } : d)) });
  }

  function removerDesconto(chave: string) {
    setNota(null);
    mudar({ ...value, descontos: value.descontos.filter((d) => d.chave !== chave) });
  }

  function adicionarDesconto() {
    setNota(null);
    mudar({ ...value, descontos: [...value.descontos, { chave: novaChave(), descricao: "", valor: "", origem_modalidade_id: null }] });
  }

  if (modalidades.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Ainda não há modalidades.{" "}
        <Link href="/admin/modalidades" className="font-medium text-gb-blue hover:underline">Criar modalidade</Link>
      </p>
    );
  }

  // Linhas agrupadas por local, na ordem estável (local padrão primeiro)
  const linhasOrdenadas = [...value.linhas].sort(
    (a, b) => (ordem.get(a.modalidade_id) ?? 99) - (ordem.get(b.modalidade_id) ?? 99),
  );
  const seccoes: { grupoId: string; linhas: LinhaRascunho[] }[] = [];
  for (const l of linhasOrdenadas) {
    const g = porId.get(l.modalidade_id)?.grupo_id ?? "";
    const s = seccoes.find((x) => x.grupoId === g);
    if (s) s.linhas.push(l); else seccoes.push({ grupoId: g, linhas: [l] });
  }

  const naoInscritas = modalidades
    .filter((m) => m.ativo && !value.linhas.some((l) => l.modalidade_id === m.id))
    .sort((a, b) => (ordem.get(a.id) ?? 99) - (ordem.get(b.id) ?? 99));

  return (
    <div className="space-y-4">
      {value.linhas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500">
          Sem modalidades — escolhe abaixo o que este aluno treina.
        </p>
      ) : (
        seccoes.map((s) => (
          <div key={s.grupoId} className="space-y-2">
            {variosLocais && (
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{nomeGrupo(s.grupoId)}</p>
            )}
            <ul className="space-y-2">
              {s.linhas.map((l) => {
                const m = porId.get(l.modalidade_id);
                const inputId = `${idPrefix}-${l.modalidade_id}`;
                return (
                  <li key={l.modalidade_id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label htmlFor={inputId} className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
                        {m?.nome ?? "Modalidade"}
                        {m && !m.ativo && <span className="ml-1 font-normal text-gray-500">(inativa)</span>}
                      </label>
                      <div className="w-28 shrink-0">
                        <EuroInput
                          id={inputId}
                          value={l.valor}
                          onChange={(e) => mudarLinha(l.modalidade_id, { valor: e.target.value })}
                          disabled={disabled}
                          aria-invalid={lerValorEuro(l.valor) === null}
                          className={cn("text-right", !l.cobrar && "text-gray-500")}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => remover(l.modalidade_id)}
                        disabled={disabled}
                        aria-label={`Tirar ${rotulos.get(l.modalidade_id) ?? "modalidade"}`}
                        title="Tirar"
                        className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {!l.cobrar && (
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                        <span>Pago diretamente no {nomeGrupo(m?.grupo_id ?? "")} — não entra na mensalidade.</span>
                        <button
                          type="button"
                          onClick={() => mudarLinha(l.modalidade_id, { cobrar: true })}
                          disabled={disabled}
                          className="font-medium text-gb-blue hover:underline disabled:opacity-40"
                        >
                          Cobrar na app
                        </button>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      {value.descontos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Descontos</p>
          <ul className="space-y-2">
            {value.descontos.map((d) => {
              const inputId = `${idPrefix}-desc-${d.chave}`;
              const automatico = d.origem_modalidade_id !== null;
              return (
                <li key={d.chave} className="flex items-center gap-2">
                  <Tag size={14} className="shrink-0 text-green-700" aria-hidden />
                  {automatico ? (
                    <label htmlFor={inputId} className="flex-1 min-w-0 text-sm font-medium text-gray-900 break-words">
                      {d.descricao}
                    </label>
                  ) : (
                    <Input
                      value={d.descricao}
                      onChange={(e) => mudarDesconto(d.chave, { descricao: e.target.value })}
                      placeholder="Ex.: Irmãos"
                      maxLength={60}
                      disabled={disabled}
                      aria-label="Descrição do desconto"
                      className="h-10 flex-1 min-w-0 rounded-xl border-gray-200"
                    />
                  )}
                  <div className="w-28 shrink-0">
                    <EuroInput
                      id={inputId}
                      value={d.valor}
                      onChange={(e) => mudarDesconto(d.chave, { valor: e.target.value })}
                      disabled={disabled}
                      aria-invalid={!lerValorEuro(d.valor)}
                      aria-label={`Valor do desconto ${d.descricao}`}
                      className="text-right text-green-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removerDesconto(d.chave)}
                    disabled={disabled}
                    aria-label={`Tirar ${d.descricao || "desconto"}`}
                    title="Tirar desconto"
                    className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {nota && (
        <p role="status" className="flex items-start gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <Info size={14} className="mt-px shrink-0" aria-hidden />
          {nota}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {naoInscritas.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => adicionar(m)}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gb-blue/60 hover:text-gb-blue disabled:opacity-40 transition-colors"
          >
            <Plus size={14} />
            {rotulos.get(m.id)}
            <span className="font-normal text-gray-500">{formatarEuro(valorSugerido(m, dataNascimento))}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={adicionarDesconto}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-green-600 hover:text-green-700 disabled:opacity-40 transition-colors"
        >
          <Tag size={14} />
          Desconto
        </button>
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-0.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-600">Mensalidade na app</span>
          <span className="text-lg font-bold text-gray-900 tabular-nums">{formatarEuro(total)}</span>
        </div>
        {foraDaApp > 0 && (
          <p className="text-right text-xs text-gray-500 tabular-nums">
            + {formatarEuro(foraDaApp)} pagos diretamente no {locaisFora.join(" e ")}
          </p>
        )}
      </div>
    </div>
  );
}
