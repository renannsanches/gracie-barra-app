"use client";

import { useRouter } from "next/navigation";
import { Plus, Users, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Turma, RecorrenciaTurma, CategoriaFaixa, Modalidade } from "@/lib/types";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const RECORRENCIA_LABEL: Record<RecorrenciaTurma, string> = {
  diario:        "Diário",
  semanal:       "Semanal",
  quinzenal:     "Quinzenal",
  mensal:        "Mensal",
  personalizado: "Custom",
};

const CATEGORIA_CLASS: Record<CategoriaFaixa, string> = {
  adulto:          "bg-blue-100 text-blue-700",
  infantil:        "bg-purple-100 text-purple-700",
  adulto_infantil: "bg-green-100 text-green-700",
};

type TurmaComProfessor = Turma & {
  professor: { id: string; nome_completo: string } | null;
};

interface Props {
  turmas: TurmaComProfessor[];
  modalidades: Modalidade[];
}

function formatarHorario(h: string) {
  return h.slice(0, 5);
}

export function TurmasView({ turmas, modalidades }: Props) {
  const router = useRouter();
  // Badge de modalidade só faz sentido quando há mais de uma
  const nomeModalidade = new Map(modalidades.map((m) => [m.id, m.nome]));
  const mostrarModalidade = modalidades.filter((m) => m.ativo).length > 1;

  const ativas   = turmas.filter((t) => t.ativa);
  const inativas = turmas.filter((t) => !t.ativa);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900 text-xl">Turmas</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {ativas.length} ativa{ativas.length !== 1 ? "s" : ""}
            {inativas.length > 0 && `, ${inativas.length} inativa${inativas.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          onClick={() => router.push("/admin/turmas/nova")}
          className="bg-gb-blue hover:bg-gb-blue-dark text-white"
        >
          <Plus size={16} className="mr-2" />
          Nova turma
        </Button>
      </div>

      {turmas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Calendar size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma turma criada</p>
          <p className="text-gray-400 text-sm mt-1">Cria a primeira turma para começar</p>
          <Button
            onClick={() => router.push("/admin/turmas/nova")}
            className="mt-4 bg-gb-blue hover:bg-gb-blue-dark text-white"
          >
            <Plus size={15} className="mr-2" />
            Criar turma
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {[
            { label: "Ativas", items: ativas },
            ...(inativas.length > 0 ? [{ label: "Inativas", items: inativas }] : []),
          ].map(({ label, items }) => (
            <div key={label} className="space-y-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">{label}</h2>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {items.map((turma, idx) => (
                  <button
                    key={turma.id}
                    type="button"
                    onClick={() => router.push(`/admin/turmas/${turma.id}`)}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left",
                      idx > 0 && "border-t border-gray-50"
                    )}
                  >
                    {/* Day circle */}
                    <div className="w-12 h-12 rounded-xl bg-gb-blue/10 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-gb-blue">{DIAS[turma.dia_semana]}</span>
                      <Clock size={12} className="text-gb-blue mt-0.5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{turma.nome}</span>
                        {mostrarModalidade && nomeModalidade.has(turma.modalidade_id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gb-blue/10 text-gb-blue">
                            {nomeModalidade.get(turma.modalidade_id)}
                          </span>
                        )}
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", CATEGORIA_CLASS[turma.categoria])}>
                          {turma.categoria}
                        </span>
                        {!turma.ativa && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-400">
                            Inativa
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{formatarHorario(turma.horario)}</span>
                        <span>·</span>
                        <span>{RECORRENCIA_LABEL[turma.recorrencia]}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Users size={11} />
                          {turma.lotacao_maxima} vagas
                        </span>
                      </div>
                      {turma.professor && (
                        <p className="text-xs text-gray-400 mt-0.5">{turma.professor.nome_completo}</p>
                      )}
                    </div>

                    <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
