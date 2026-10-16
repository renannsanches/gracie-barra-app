export const PERFIL_LABELS: Record<string, string> = {
  aluno:       "Aluno",
  professor:   "Professor",
  admin:       "Administrador",
  tablet:      "Tablet",
  responsavel: "Responsável",
};

/** Estado do aluno: rótulo + cores para fundo claro (`classe`) e escuro (`classeEscura`). */
export const STATUS_LABELS: Record<string, { label: string; classe: string; classeEscura: string }> = {
  ativo:    { label: "Ativo",    classe: "bg-emerald-500/15 text-emerald-700", classeEscura: "bg-emerald-500/20 text-emerald-300" },
  inativo:  { label: "Inativo",  classe: "bg-red-500/15 text-red-700",         classeEscura: "bg-red-500/20 text-red-300" },
  trancado: { label: "Trancado", classe: "bg-amber-500/15 text-amber-700",     classeEscura: "bg-amber-500/20 text-amber-300" },
};

export function iniciaisDe(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
