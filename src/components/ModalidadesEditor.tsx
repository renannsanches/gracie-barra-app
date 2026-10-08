"use client";

import Link from "next/link";
import { Plus, X } from "lucide-react";
import { EuroInput } from "@/components/ui/euro-input";
import { formatarEuro, lerValorEuro, somaItens, valorSugerido } from "@/lib/modalidades";
import type { Modalidade } from "@/lib/types";

/** Linha do plano em edição — valor como texto para aceitar "49,60". */
export interface PlanoRascunho {
  modalidade_id: string;
  valor: string;
}

/** Valida o rascunho; devolve os itens prontos a gravar ou uma mensagem de erro. */
export function lerPlano(
  plano: PlanoRascunho[],
  modalidades: Modalidade[],
): { itens?: { modalidade_id: string; valor: number }[]; erro?: string } {
  const itens: { modalidade_id: string; valor: number }[] = [];
  for (const p of plano) {
    const valor = lerValorEuro(p.valor);
    if (valor === null) {
      const nome = modalidades.find((m) => m.id === p.modalidade_id)?.nome ?? "modalidade";
      return { erro: `Indica o valor de ${nome} (ex.: 20).` };
    }
    itens.push({ modalidade_id: p.modalidade_id, valor });
  }
  return { itens };
}

interface Props {
  modalidades: Modalidade[];
  value: PlanoRascunho[];
  onChange: (plano: PlanoRascunho[]) => void;
  /** Para sugerir o valor de menores de 16 ao adicionar uma modalidade */
  dataNascimento?: string | null;
  disabled?: boolean;
  idPrefix: string;
}

/**
 * Lista editável das modalidades de um aluno, cada uma com o valor que esse aluno paga.
 * O total mensal é a soma.
 */
export function ModalidadesEditor({ modalidades, value, onChange, dataNascimento, disabled, idPrefix }: Props) {
  const porId = new Map(modalidades.map((m) => [m.id, m]));
  const naoInscritas = modalidades.filter((m) => m.ativo && !value.some((v) => v.modalidade_id === m.id));
  const total = somaItens(value.map((v) => ({ valor: lerValorEuro(v.valor) ?? 0 })));

  function mudarValor(id: string, valor: string) {
    onChange(value.map((v) => (v.modalidade_id === id ? { ...v, valor } : v)));
  }

  function remover(id: string) {
    onChange(value.filter((v) => v.modalidade_id !== id));
  }

  function adicionar(m: Modalidade) {
    const sugerido = valorSugerido(m, dataNascimento);
    onChange([...value, { modalidade_id: m.id, valor: String(sugerido).replace(".", ",") }]);
  }

  if (modalidades.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Ainda não há modalidades.{" "}
        <Link href="/admin/modalidades" className="font-medium text-gb-blue hover:underline">Criar modalidade</Link>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500">
          Sem modalidades — escolhe abaixo o que este aluno treina.
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((v) => {
            const m = porId.get(v.modalidade_id);
            const inputId = `${idPrefix}-${v.modalidade_id}`;
            const invalido = lerValorEuro(v.valor) === null;
            return (
              <li key={v.modalidade_id} className="flex items-center gap-2">
                <label htmlFor={inputId} className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
                  {m?.nome ?? "Modalidade"}
                  {m && !m.ativo && <span className="ml-1 font-normal text-gray-500">(inativa)</span>}
                </label>
                <div className="w-28 shrink-0">
                  <EuroInput
                    id={inputId}
                    value={v.valor}
                    onChange={(e) => mudarValor(v.modalidade_id, e.target.value)}
                    disabled={disabled}
                    aria-invalid={invalido}
                    className="text-right"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remover(v.modalidade_id)}
                  disabled={disabled}
                  aria-label={`Tirar ${m?.nome ?? "modalidade"}`}
                  title="Tirar"
                  className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                >
                  <X size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {naoInscritas.length > 0 && (
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
              {m.nome}
              <span className="font-normal text-gray-500">{formatarEuro(valorSugerido(m, dataNascimento))}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-baseline justify-between border-t border-gray-100 pt-3">
        <span className="text-sm text-gray-600">Total mensal</span>
        <span className="text-lg font-bold text-gray-900 tabular-nums">{formatarEuro(total)}</span>
      </div>
    </div>
  );
}
