"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { FaixaBJJ } from "@/components/FaixaBJJ";
import type { AptoGraduar } from "@/lib/aptos-graduar";

// Só staff, no separador Feed do Início. Começa fechado; a lista só é montada quando abre.
export function AptosGraduarCard({ aptos }: { aptos: AptoGraduar[] }) {
  const [aberto, setAberto] = useState(false);
  const listaId = useId();

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={listaId}
        onClick={() => setAberto((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-canvas active:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <Star size={16} className="shrink-0 text-emerald-500" aria-hidden="true" />
            <span className="text-sm font-semibold text-fg">Aptos a graduar</span>
            {aptos.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                {aptos.length}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-fg-muted">presenças e tempo verificados</span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`shrink-0 text-fg-muted transition-transform duration-base ease-out-expo motion-reduce:transition-none ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      <div id={listaId} hidden={!aberto}>
        {aberto &&
          (aptos.length === 0 ? (
            <p className="border-t border-line px-4 py-6 text-center text-sm text-fg-muted">
              Nenhum aluno apto a graduar de momento.
            </p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {aptos.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/alunos/${a.id}`}
                    className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-canvas active:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                  >
                    <span className="flex shrink-0 items-center justify-center">
                      <FaixaBJJ faixa={a.faixa} graus={a.graus} categoria={a.categoria} tamanho="xs" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-fg">{a.nome_completo}</span>
                      <span className="mt-0.5 block text-xs text-fg-muted">
                        {a.semanasQualificadas} semanas qualificadas
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <ChevronRight size={14} className="text-fg-muted" aria-hidden="true" />
                      <span className="sr-only">passa a</span>
                      <FaixaBJJ
                        faixa={a.proximaPromocao.faixa}
                        graus={a.proximaPromocao.graus}
                        categoria={a.categoria}
                        tamanho="xs"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}
