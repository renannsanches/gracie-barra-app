"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Loader2, Users, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusAula, StatusReserva, CategoriaFaixa } from "@/lib/types";
import { reservar, cancelarMinhaReserva } from "./turmas-actions";
import { getTurmaTag } from "@/lib/turma-tags";

export interface AulaParaAluno {
  id: string;
  turma_id: string;
  data: string;
  horario: string;
  lotacao_maxima: number;
  status: StatusAula;
  criado_em: string;
  turma: { id: string; nome: string; categoria: CategoriaFaixa } | null;
  reservas_confirmadas: number;
  minha_reserva_id: string | null;
  minha_reserva_status: StatusReserva | null;
}

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatarDataCompleta(data: string) {
  const d = new Date(data + "T12:00:00");
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function formatarHorario(h: string) { return h.slice(0, 5); }

interface Props { aulas: AulaParaAluno[]; }

export function TurmasAlunoView({ aulas: aulasProp }: Props) {
  const router = useRouter();
  const [aulas, setAulas]   = useState(aulasProp);
  const [acao, setAcao]     = useState<string | null>(null);
  const [erro, setErro]     = useState("");

  // Group by date
  const grupos: Record<string, AulaParaAluno[]> = {};
  for (const a of aulas) {
    if (!grupos[a.data]) grupos[a.data] = [];
    grupos[a.data].push(a);
  }
  const datas = Object.keys(grupos).sort();

  async function handleReservar(aulaId: string) {
    setAcao(aulaId);
    setErro("");
    const result = await reservar(aulaId);
    if (!result.ok) {
      setErro(result.erro ?? "Erro ao reservar.");
    } else {
      setAulas((prev) => prev.map((a) =>
        a.id === aulaId
          ? {
              ...a,
              minha_reserva_id:     result.reservaId!,
              minha_reserva_status: "confirmada",
              reservas_confirmadas: a.reservas_confirmadas + 1,
            }
          : a
      ));
    }
    setAcao(null);
  }

  async function handleCancelar(reservaId: string, aulaId: string) {
    if (!confirm("Cancelar a reserva nesta aula?")) return;
    setAcao(reservaId);
    setErro("");
    const result = await cancelarMinhaReserva(reservaId);
    if (!result.ok) {
      setErro(result.erro ?? "Erro ao cancelar.");
    } else {
      setAulas((prev) => prev.map((a) =>
        a.id === aulaId
          ? {
              ...a,
              minha_reserva_id:     null,
              minha_reserva_status: null,
              reservas_confirmadas: Math.max(0, a.reservas_confirmadas - 1),
            }
          : a
      ));
    }
    setAcao(null);
  }

  return (
    <div className="min-h-screen flex flex-col bg-gb-gray">
      {/* Header */}
      <div className="bg-gb-black px-6 pt-10 pb-6">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => router.push("/perfil")}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            Perfil
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.webp" alt="Gracie Barra" className="w-7 h-7 object-contain" />
            <span className="text-white font-bold text-xs tracking-wide">GRACIE BARRA</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-gb-blue" />
          <h1 className="text-white font-bold text-xl">Turmas</h1>
        </div>
        <p className="text-white/50 text-sm mt-0.5">Próximas 3 semanas</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 pb-8 space-y-4">
        {erro && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {datas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Calendar size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sem aulas agendadas</p>
            <p className="text-gray-400 text-sm mt-1">Não há aulas nas próximas 3 semanas</p>
          </div>
        ) : (
          datas.map((data) => (
            <div key={data} className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                {formatarDataCompleta(data)}
              </p>

              {grupos[data].map((aula) => {
                const hasReserva  = aula.minha_reserva_status === "confirmada";
                const lotado      = !hasReserva && aula.reservas_confirmadas >= aula.lotacao_maxima;
                const vagasLivres = aula.lotacao_maxima - aula.reservas_confirmadas;
                const isLoading   = acao === aula.id || acao === (aula.minha_reserva_id ?? "");

                return (
                  <div
                    key={aula.id}
                    className={cn(
                      "bg-white rounded-2xl border p-4 flex items-center gap-4",
                      hasReserva ? "border-gb-blue/30" : "border-gray-100"
                    )}
                  >
                    {/* Thumbnail */}
                    {(() => {
                      const tag = aula.turma ? getTurmaTag(aula.turma.nome) : null;
                      return tag ? (
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: tag.bg }}
                        >
                          <span className="text-white font-black text-xs leading-none text-center px-1">
                            {tag.code}
                          </span>
                        </div>
                      ) : (
                        <div className={cn(
                          "w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0",
                          hasReserva ? "bg-gb-blue text-white" : "bg-gb-blue/10 text-gb-blue"
                        )}>
                          <span className="text-sm font-black tabular-nums">{formatarHorario(aula.horario)}</span>
                        </div>
                      );
                    })()}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(() => {
                          const tag = aula.turma ? getTurmaTag(aula.turma.nome) : null;
                          return (
                            <p className="font-bold text-gray-900 text-sm">
                              {aula.turma?.nome ?? "—"}
                              {tag && <span className="font-normal text-gray-500"> · {formatarHorario(aula.horario)}</span>}
                            </p>
                          );
                        })()}
                        {aula.turma?.categoria && (
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            aula.turma.categoria === "adulto"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          )}>
                            {aula.turma.categoria}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Users size={12} className={lotado ? "text-red-400" : "text-gray-400"} />
                        <span className={cn("text-xs", lotado ? "text-red-500 font-medium" : "text-gray-400")}>
                          {lotado
                            ? "Lotado"
                            : `${vagasLivres} vaga${vagasLivres !== 1 ? "s" : ""} livre${vagasLivres !== 1 ? "s" : ""}`
                          }
                        </span>
                      </div>
                      {hasReserva && (
                        <p className="text-xs text-gb-blue font-medium mt-0.5 flex items-center gap-1">
                          <Check size={11} />
                          Reserva confirmada
                        </p>
                      )}
                    </div>

                    {/* Action */}
                    <div className="shrink-0">
                      {hasReserva ? (
                        <button
                          type="button"
                          onClick={() => handleCancelar(aula.minha_reserva_id!, aula.id)}
                          disabled={isLoading}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50 px-2 py-1.5 rounded-xl hover:bg-red-50"
                        >
                          {isLoading
                            ? <Loader2 size={12} className="animate-spin" />
                            : <X size={12} />
                          }
                          Cancelar
                        </button>
                      ) : lotado ? (
                        <span className="text-xs text-gray-300 font-medium px-2">Lotado</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReservar(aula.id)}
                          disabled={isLoading}
                          className="flex items-center gap-1 text-xs text-gb-blue hover:text-gb-blue-dark font-semibold transition-colors disabled:opacity-50 px-3 py-1.5 rounded-xl bg-gb-blue/10 hover:bg-gb-blue/20"
                        >
                          {isLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                          Reservar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
