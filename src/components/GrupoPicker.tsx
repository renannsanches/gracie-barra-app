"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { GrupoAluno } from "@/lib/types";

/** Até este nº de opções mostra botões lado a lado; acima disso usa um select. */
const MAX_SEGMENTOS = 4;

const selectClass =
  "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 " +
  "focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue disabled:opacity-50";

interface Props {
  id: string;
  grupos: GrupoAluno[];
  value: string;
  onChange: (grupoId: string) => void;
  disabled?: boolean;
  /** id do elemento que rotula o campo (para o radiogroup) */
  labelledBy?: string;
}

/**
 * Escolha do grupo do aluno. Mostra os grupos activos e, se o aluno já estiver
 * num grupo desactivado, mantém esse grupo visível para não o perder ao guardar.
 */
export function GrupoPicker({ id, grupos, value, onChange, disabled, labelledBy }: Props) {
  const opcoes = grupos.filter((g) => g.ativo || g.id === value);

  if (opcoes.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Ainda não há grupos ativos.{" "}
        <Link href="/admin/grupos" className="font-medium text-gb-blue hover:underline">
          Criar grupo
        </Link>
      </p>
    );
  }

  if (opcoes.length > MAX_SEGMENTOS) {
    return (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={selectClass}
      >
        {!value && <option value="">Escolher grupo…</option>}
        {opcoes.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nome}{g.ativo ? "" : " (inativo)"}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div id={id} role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {opcoes.map((g) => {
        const selecionado = g.id === value;
        return (
          <label key={g.id} className={cn("relative flex-1 min-w-[7rem]", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
            <input
              type="radio"
              name={id}
              value={g.id}
              checked={selecionado}
              onChange={() => onChange(g.id)}
              disabled={disabled}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-colors",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-gb-blue/40 peer-focus-visible:ring-offset-2",
                "peer-disabled:opacity-50",
                selecionado
                  ? "border-gb-blue bg-gb-blue text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gb-blue/60",
              )}
            >
              {g.nome}
              {!g.ativo && <span className="ml-1 font-normal opacity-75">(inativo)</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
