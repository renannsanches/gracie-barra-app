"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { PresencasCalendario } from "@/components/PresencasCalendario";

export type { PresencaItem, PessoaFiltro } from "@/components/PresencasCalendario";
import type { PresencaItem, PessoaFiltro } from "@/components/PresencasCalendario";

interface PresencasViewProps {
  presencas: PresencaItem[];
  pessoas: PessoaFiltro[];
  responsavelId: string;
  initialMes: number;
  initialAno: number;
}

export function PresencasView({ presencas, pessoas, responsavelId, initialMes, initialAno }: PresencasViewProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-gb-gray">
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
          <CalendarDays size={20} className="text-gb-blue" />
          <h1 className="text-white font-bold text-xl">Histórico de Presenças</h1>
        </div>
        <p className="text-white/50 text-sm mt-0.5">
          {presencas.length} presença{presencas.length !== 1 ? "s" : ""} registada{presencas.length !== 1 ? "s" : ""} na conta
        </p>
      </div>

      <div className="flex-1 px-4 py-5 pb-8">
        <PresencasCalendario
          presencas={presencas}
          pessoas={pessoas}
          responsavelId={responsavelId}
          initialMes={initialMes}
          initialAno={initialAno}
        />
      </div>
    </div>
  );
}
