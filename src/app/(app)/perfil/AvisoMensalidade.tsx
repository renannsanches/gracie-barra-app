import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";

/**
 * Aviso compacto de mensalidade em atraso (< 5 dias). A partir dos 5 dias o
 * MensalidadeVencidaBanner do layout já avisa em todas as páginas.
 */
export function AvisoMensalidade({ texto }: { texto: string }) {
  return (
    <Link
      href="/perfil/conta#mensalidades"
      className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 min-h-12 py-2.5 active:bg-amber-100 transition-colors duration-fast"
    >
      <AlertTriangle size={18} className="text-amber-700 shrink-0" />
      <span className="flex-1 min-w-0 text-[13px] font-medium text-amber-900">{texto}</span>
      <span className="text-[13px] font-semibold text-amber-900 shrink-0 flex items-center">
        Ver
        <ChevronRight size={16} />
      </span>
    </Link>
  );
}
