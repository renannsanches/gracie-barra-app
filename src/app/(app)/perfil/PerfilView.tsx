"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Dumbbell, Images } from "lucide-react";
import type { Profile, Mensalidade, HistoricoGraduacao, DependentePerfil } from "@/lib/types";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import type { AptoGraduar, KpisAdmin, ProximaAulaHome, ResumoGamificacao } from "./home-tipos";
import { HomeHeader } from "./HomeHeader";
import { AvisoMensalidade } from "./AvisoMensalidade";
import { ProximaAulaCard } from "./ProximaAulaCard";
import { FrequenciaCard } from "./FrequenciaCard";
import { FaixaCard } from "./FaixaCard";
import { DependentesCard } from "./DependentesCard";
import { AptosGraduarCard } from "./AptosGraduarCard";
import { ResumoAdmin, AcessosAdmin } from "./ResumoAdmin";

export type { ResumoGamificacao } from "./home-tipos";

interface PerfilViewProps {
  profile: Profile | null;
  mensalidades: Mensalidade[];
  historicoGraduacoes: HistoricoGraduacao[];
  totalAulas: number;
  aulasMes: number;
  ultimoTreino: string | null;
  avisosNotif: { id: string; titulo: string; created_at: string }[];
  dependentes: DependentePerfil[];
  aptosGraduar: AptoGraduar[];
  gamificacao: ResumoGamificacao[];
  proximaAula: ProximaAulaHome;
  kpisAdmin: KpisAdmin | null;
  avisoMensalidade: string | null;
}

/**
 * Home da app. Aluno: próxima aula → frequência → faixa → dependentes → galeria.
 * Admin/professor: resumo → aptos a graduar → atalhos → dependentes → "Meu treino" (recolhido).
 * Presença, Aulas, Histórico e Avisos estão na barra inferior; conta e sair no avatar.
 */
export function PerfilView({
  profile,
  mensalidades,
  historicoGraduacoes,
  totalAulas,
  aulasMes,
  ultimoTreino,
  avisosNotif,
  dependentes,
  aptosGraduar,
  gamificacao,
  proximaAula,
  kpisAdmin,
  avisoMensalidade,
}: PerfilViewProps) {
  usePushSubscription();
  const [meuTreinoAberto, setMeuTreinoAberto] = useState(false);

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-canvas">
        <div className="text-center space-y-3">
          <p className="text-gray-500">Perfil não encontrado.</p>
          <Link href="/perfil/conta" className="text-brand font-medium">Abrir a minha conta</Link>
        </div>
      </div>
    );
  }

  const staff = profile.perfil === "admin" || profile.perfil === "professor";
  const treina = profile.perfil !== "responsavel";
  const resumoProprio = gamificacao.find((g) => g.id === profile.id) ?? null;

  const frequencia = treina && resumoProprio ? <FrequenciaCard resumo={resumoProprio} /> : null;
  const faixa = treina ? (
    <FaixaCard
      faixa={profile.faixa}
      graus={profile.graus}
      categoria={profile.categoria}
      totalAulas={totalAulas}
      aulasMes={aulasMes}
      ultimoTreino={ultimoTreino}
      historico={historicoGraduacoes}
    />
  ) : null;
  const dependentesCard = dependentes.length > 0 && (
    <DependentesCard
      dependentes={dependentes}
      gamificacao={gamificacao}
      comLinksGamificacao={!frequencia}
    />
  );

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <HomeHeader
        nome={profile.nome_completo}
        fotoUrl={profile.foto_url}
        perfil={profile.perfil}
        status={profile.status}
        mensalidades={mensalidades}
        avisosNotif={avisosNotif}
      />

      <div className="flex-1 w-full max-w-lg mx-auto px-4 pt-4 space-y-3 pb-bottom-nav animar-lista">
        {avisoMensalidade && <AvisoMensalidade texto={avisoMensalidade} />}

        {staff ? (
          <>
            {kpisAdmin && <ResumoAdmin kpis={kpisAdmin} />}
            <AptosGraduarCard aptos={aptosGraduar} />
            <AcessosAdmin />
            {dependentesCard}

            {/* Meu treino: recolhido por defeito; abre os cards logo abaixo (sem cards dentro de cards) */}
            <button
              type="button"
              onClick={() => setMeuTreinoAberto((v) => !v)}
              aria-expanded={meuTreinoAberto}
              aria-controls="meu-treino"
              className="w-full h-12 rounded-2xl bg-surface border border-gray-100 px-4 flex items-center gap-2 active:bg-gray-50 transition-colors duration-fast"
            >
              <Dumbbell size={16} className="text-gray-400" />
              <span className="shrink-0 text-left text-[14px] font-semibold text-gray-900">Meu treino</span>
              <span className="flex-1 min-w-0 truncate text-right text-xs text-gray-500">
                {meuTreinoAberto ? "Esconder" : "Próxima aula, frequência e faixa"}
              </span>
              <ChevronDown
                size={16}
                className={`text-gray-400 shrink-0 transition-transform duration-base ${meuTreinoAberto ? "rotate-180" : ""}`}
              />
            </button>
            {meuTreinoAberto && (
              <div id="meu-treino" className="space-y-3 animar-lista">
                <ProximaAulaCard proxima={proximaAula} />
                {frequencia}
                {faixa}
              </div>
            )}
          </>
        ) : (
          <>
            <ProximaAulaCard proxima={proximaAula} />
            {frequencia}
            {faixa}
            {dependentesCard}
            <Link
              href="/galeria"
              className="h-[52px] rounded-2xl bg-surface border border-gray-100 px-4 flex items-center gap-3 active:bg-gray-50 transition-colors duration-fast"
            >
              <Images size={18} className="text-gray-400 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-medium text-gray-900">Galeria</span>
                <span className="block text-xs text-gray-500 truncate">Fotos da academia</span>
              </span>
              <ChevronRight size={16} className="text-gray-300 shrink-0" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
