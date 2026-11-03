// Regras puras da presença manual por aula (ficha do aluno, admin).
// `presencas` não guarda a aula: a ligação presença ↔ aula faz-se pelo horário.

export interface AulaHorario {
  id: string;
  data: string;    // YYYY-MM-DD (dia em Lisboa)
  horario: string; // HH:MM ou HH:MM:SS (hora de Lisboa)
}

/** Janela em que uma presença conta para uma aula: até 60 min antes e 90 min depois do início. */
export const JANELA_ANTES_MIN = 60;
export const JANELA_DEPOIS_MIN = 90;

const FMT_LISBOA = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Lisbon",
  hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** Diferença (min) entre a hora de Lisboa e UTC nesse instante: 0 no inverno, 60 no verão. */
function offsetLisboaMin(utcMs: number): number {
  const parts = FMT_LISBOA.formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const comoUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((comoUtc - utcMs) / 60000);
}

/** Instante (ISO UTC) em que começa uma aula marcada para `data` às `horario` de Lisboa. */
export function instanteAulaLisboa(data: string, horario: string): string {
  const [y, m, d] = data.split("-").map(Number);
  const [h, mi] = horario.split(":").map(Number);
  const palpite = Date.UTC(y, m - 1, d, h, mi);
  return new Date(palpite - offsetLisboaMin(palpite) * 60000).toISOString();
}

/** Dia (YYYY-MM-DD) em Lisboa de um instante. */
export function diaLisboa(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });
}

/**
 * Presença manual antiga, gravada sem aula: sempre às 12:00:00.000 UTC certas.
 * Um QR nunca cai no milissegundo exacto, por isso não confunde.
 */
export function ehPresencaAvulsa(iso: string): boolean {
  const d = new Date(iso);
  return d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/**
 * Aulas que já têm presença. Cada presença vai para o horário mais próximo dentro da janela
 * (um QR das 18:50 conta para as 19:00, não para as 18:00) e marca todas as turmas desse
 * horário, porque ninguém treina em duas ao mesmo tempo. Avulsas ficam de fora.
 */
export function atribuirPresencasAAulas(aulas: AulaHorario[], presencas: string[]): Set<string> {
  const inicios = aulas.map((a) => ({ id: a.id, ms: Date.parse(instanteAulaLisboa(a.data, a.horario)) }));
  const registadas = new Set<string>();

  for (const iso of presencas) {
    if (ehPresencaAvulsa(iso)) continue;
    const ms = Date.parse(iso);
    let melhorMs: number | null = null;
    let melhorDist = Infinity;
    for (const a of inicios) {
      const diffMin = (ms - a.ms) / 60000;
      if (diffMin < -JANELA_ANTES_MIN || diffMin > JANELA_DEPOIS_MIN) continue;
      const dist = Math.abs(diffMin);
      if (dist < melhorDist) { melhorDist = dist; melhorMs = a.ms; }
    }
    // Turmas à mesma hora (ex.: GB1 e Kids às 18:00) ficam todas marcadas
    if (melhorMs !== null) for (const a of inicios) if (a.ms === melhorMs) registadas.add(a.id);
  }
  return registadas;
}

/** A turma é da categoria do aluno? (adulto_infantil vê ambas; sem categoria, tudo conta.) */
export function aulaDoAluno(categoriaTurma: string, categoriaAluno: string | null | undefined): boolean {
  if (!categoriaAluno || categoriaAluno === "adulto_infantil") return true;
  return categoriaTurma === categoriaAluno;
}
