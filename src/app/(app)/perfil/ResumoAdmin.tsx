import Link from "next/link";
import { AlertTriangle, CalendarCheck, Images, LayoutDashboard, Users } from "lucide-react";
import type { KpisAdmin } from "./home-tipos";

/** Indicadores do /admin em versão pequena. */
export function ResumoAdmin({ kpis }: { kpis: KpisAdmin }) {
  const atraso = kpis.emAtraso;
  return (
    <div className={`grid gap-2 ${atraso === null ? "grid-cols-2" : "grid-cols-3"}`} data-testid="resumo-admin">
      <Kpi href="/admin" icon={<Users size={14} />} valor={kpis.ativos} rotulo="Ativos" titulo="Alunos ativos" />
      <Kpi
        href="/admin"
        icon={<CalendarCheck size={14} />}
        valor={kpis.presencasMes}
        rotulo="Presenças"
        sufixo={`em ${kpis.mes.slice(0, 3).toLowerCase()}`}
        titulo={`Presenças em ${kpis.mes}`}
      />
      {atraso !== null && (
        <Kpi
          href="/admin/financeiro"
          icon={<AlertTriangle size={14} />}
          valor={atraso}
          rotulo="Em atraso"
          titulo="Alunos com mensalidade em atraso"
          alerta={atraso > 0}
        />
      )}
    </div>
  );
}

function Kpi({
  href,
  icon,
  valor,
  rotulo,
  titulo,
  sufixo,
  alerta,
}: {
  href: string;
  icon: React.ReactNode;
  valor: number;
  rotulo: string;
  /** Texto completo para leitores de ecrã quando o rótulo é curto */
  titulo?: string;
  /** Texto pequeno ao lado do número (ex.: "em out") */
  sufixo?: string;
  alerta?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={titulo ? `${titulo}: ${valor}` : undefined}
      className={`rounded-xl border px-3 py-2.5 min-h-[64px] flex flex-col justify-between active:scale-[0.98] transition-transform duration-fast ${
        alerta ? "bg-red-50 border-red-100" : "bg-surface border-gray-100"
      }`}
    >
      <span className={`flex items-center gap-1 text-xs ${alerta ? "text-red-700" : "text-gray-500"}`}>
        <span className="shrink-0 flex">{icon}</span>
        <span className="truncate">{rotulo}</span>
      </span>
      <span className={`text-[20px] font-semibold leading-tight tabular-nums ${alerta ? "text-red-700" : "text-gray-900"}`}>
        {valor}
        {sufixo && <span className="ml-1 text-xs font-normal text-gray-500">{sufixo}</span>}
      </span>
    </Link>
  );
}

/** Acessos compactos do admin: Dashboard e Galeria. */
export function AcessosAdmin() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Acesso href="/admin" icon={<LayoutDashboard size={18} />} rotulo="Dashboard" />
      <Acesso href="/galeria" icon={<Images size={18} />} rotulo="Galeria" />
    </div>
  );
}

function Acesso({ href, icon, rotulo }: { href: string; icon: React.ReactNode; rotulo: string }) {
  return (
    <Link
      href={href}
      className="h-[52px] rounded-xl bg-surface border border-gray-100 px-3 flex items-center gap-2.5 active:scale-[0.98] transition-transform duration-fast"
    >
      <span className="w-8 h-8 rounded-lg bg-canvas text-gray-500 flex items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 truncate text-[14px] font-medium text-gray-900">{rotulo}</span>
    </Link>
  );
}
