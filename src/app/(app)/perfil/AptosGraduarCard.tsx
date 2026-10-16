"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronRight, Star } from "lucide-react";
import { FaixaBJJ } from "@/components/FaixaBJJ";
import { labelCorFaixa } from "@/lib/utils";
import type { AptoGraduar } from "./home-tipos";
import { Cartao, TituloCartao } from "./home-ui";

const VISIVEIS = 5;

function descreverPromocao(a: AptoGraduar): string {
  const g = (n: number) => `${n} ${n === 1 ? "grau" : "graus"}`;
  if (a.proximaPromocao.faixa === a.faixa) {
    return `${labelCorFaixa(a.faixa)} · ${a.graus} → ${g(a.proximaPromocao.graus)}`;
  }
  return `${labelCorFaixa(a.faixa)} ${g(a.graus)} → ${labelCorFaixa(a.proximaPromocao.faixa)}`;
}

/**
 * Alunos que cumprem os requisitos (a lista e a ordem vêm do servidor, de
 * calcularElegibilidade + ordenarAptosGraduar). Apto não é graduado: a graduação
 * é registada na ficha do aluno.
 */
export function AptosGraduarCard({ aptos }: { aptos: AptoGraduar[] }) {
  const [todos, setTodos] = useState(false);
  const lista = todos ? aptos : aptos.slice(0, VISIVEIS);

  return (
    <Cartao className="overflow-hidden" data-testid="aptos-graduar">
      <TituloCartao
        icon={<Star size={16} className="text-emerald-600" />}
        titulo="Aptos a graduar"
        extra={
          aptos.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
              {aptos.length}
            </span>
          )
        }
      />

      {aptos.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-gray-500">Nenhum aluno apto a graduar de momento.</p>
      ) : (
        <>
          <p className="px-4 pt-2.5 text-xs text-gray-500">
            Presenças e tempo de faixa verificados. A graduação é registada na ficha do aluno.
          </p>
          <ul className="divide-y divide-gray-100">
            {lista.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/alunos/${a.id}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors duration-fast"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2 break-words">
                      {a.nome_completo}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <FaixaBJJ faixa={a.faixa} graus={a.graus} categoria={a.categoria} tamanho="xs" />
                      <ArrowRight size={14} className="text-gray-400 shrink-0" aria-label="para" />
                      <FaixaBJJ
                        faixa={a.proximaPromocao.faixa}
                        graus={a.proximaPromocao.graus}
                        categoria={a.categoria}
                        tamanho="xs"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-600">{descreverPromocao(a)}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                      <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                      {a.semanasQualificadas} semanas qualificadas · mín. {a.semanasNecessarias}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>

          {aptos.length > VISIVEIS && (
            <button
              type="button"
              onClick={() => setTodos((v) => !v)}
              aria-expanded={todos}
              className="w-full h-11 flex items-center justify-center gap-1.5 border-t border-gray-100 text-[13px] font-semibold text-brand active:bg-brand/5 transition-colors duration-fast"
            >
              {todos ? "Mostrar menos" : `Mostrar todos (${aptos.length})`}
              <ChevronDown size={15} className={`transition-transform duration-base ${todos ? "rotate-180" : ""}`} />
            </button>
          )}
        </>
      )}
    </Cartao>
  );
}
