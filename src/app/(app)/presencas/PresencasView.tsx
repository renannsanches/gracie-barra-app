"use client";

import { CalendarDays } from "lucide-react";
import { PresencasCalendario } from "@/components/PresencasCalendario";
import { PageHeader } from "@/components/PageHeader";

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
  return (
    <div className="min-h-screen flex flex-col bg-gb-gray">
      <PageHeader
        title="Histórico de Presenças"
        icon={<CalendarDays size={20} />}
        subtitle={`${presencas.length} presença${presencas.length !== 1 ? "s" : ""} registada${presencas.length !== 1 ? "s" : ""} na conta`}
      />

      <div className="flex-1 px-4 py-5 pb-bottom-nav animar-entrada">
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
