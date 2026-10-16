import Link from "next/link";
import { CalendarClock, CalendarPlus, Check, ChevronRight, Users } from "lucide-react";
import type { ProximaAulaHome } from "./home-tipos";
import { Cartao } from "./home-ui";

function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function ProximaAulaCard({ proxima }: { proxima: ProximaAulaHome }) {
  if (proxima.estado !== "ok") {
    const erro = proxima.estado === "erro";
    return (
      <Cartao className="p-4 flex items-center gap-3" data-testid="proxima-aula">
        {/* Em ecrãs ≤ 380 px o ícone sai para o texto e o botão caberem */}
        <div className="hidden min-[381px]:flex w-10 h-10 rounded-xl bg-canvas items-center justify-center shrink-0">
          <CalendarPlus size={18} className="text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-gray-900">
            {erro ? "Não foi possível carregar as reservas" : "Sem aulas reservadas"}
          </p>
          <p className="text-[12px] text-gray-500 mt-0.5">
            {erro ? "Tenta abrir a agenda." : "Reserva o teu lugar nas próximas aulas."}
          </p>
        </div>
        <Link
          href="/aulas"
          className="shrink-0 h-11 px-3.5 rounded-xl border border-brand/30 text-brand text-[13px] font-semibold flex items-center active:bg-brand/10 transition-colors duration-fast"
        >
          {erro ? "Abrir agenda" : "Ver agenda"}
        </Link>
      </Cartao>
    );
  }

  return (
    <Cartao className="overflow-hidden" data-testid="proxima-aula">
      <Link href="/aulas" className="block p-4 active:bg-gray-50 transition-colors duration-fast">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próxima aula</p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700">
            <Check size={12} strokeWidth={3} />
            Reservada
          </span>
        </div>

        <p className="mt-2 text-[16px] font-semibold text-gray-900 leading-snug line-clamp-2">
          {proxima.modalidade ? `${proxima.modalidade} · ${proxima.turma}` : proxima.turma}
        </p>

        <div className="mt-1.5 space-y-1">
          <p className="flex items-center gap-1.5 text-[13px] text-gray-700">
            <CalendarClock size={15} className="text-brand shrink-0" />
            {proxima.quando}
          </p>
          {proxima.para.length > 0 && (
            <p className="flex items-center gap-1.5 text-[13px] text-gray-700 min-w-0">
              <Users size={15} className="text-gray-400 shrink-0" />
              <span className="truncate">Para: {juntarNomes(proxima.para)}</span>
            </p>
          )}
        </div>

        <p className="mt-3 flex items-center justify-between text-[13px] font-medium text-brand">
          {proxima.outras > 0
            ? `+${proxima.outras} ${proxima.outras === 1 ? "reserva" : "reservas"} · ver agenda`
            : "Ver agenda"}
          <ChevronRight size={16} />
        </p>
      </Link>
    </Cartao>
  );
}
