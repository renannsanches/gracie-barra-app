// Próxima aula reservada (do próprio ou de um dependente) para a home.
// Lógica pura — os dados vêm de `reservas` + `aulas` já filtrados por pessoa.

export interface LinhaReserva {
  aluno_id: string;
  aula: {
    id: string;
    data: string;
    horario: string;
    status: string;
    turma: { nome: string; modalidade_id: string | null } | null;
  } | null;
}

export interface ProximaReserva {
  aulaId: string;
  data: string;
  /** HH:MM */
  horario: string;
  turma: string;
  modalidadeId: string | null;
  /** Quem tem reserva nesta aula (próprio e/ou dependentes) */
  alunoIds: string[];
  /** Outras aulas futuras reservadas além desta */
  outras: number;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "Hoje · 19:00", "Amanhã · 19:00" ou "Qui, 17 out · 19:00". */
export function formatarQuando(data: string, horario: string, hoje: string): string {
  const hora = horario.slice(0, 5);
  if (data === hoje) return `Hoje · ${hora}`;
  const d = new Date(`${data}T00:00:00Z`);
  const amanha = new Date(`${hoje}T00:00:00Z`);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  if (d.getTime() === amanha.getTime()) return `Amanhã · ${hora}`;
  return `${DIAS_SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} ${MESES_CURTOS[d.getUTCMonth()]} · ${hora}`;
}

/** Hora actual em Lisboa (HH:MM). */
export function horaLisboa(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(agora);
}

/**
 * Escolhe a próxima aula agendada que ainda não começou.
 * @param hoje       YYYY-MM-DD (Lisboa)
 * @param horaAgora  HH:MM (Lisboa)
 */
export function escolherProximaReserva(
  linhas: LinhaReserva[],
  hoje: string,
  horaAgora: string,
): ProximaReserva | null {
  const porAula = new Map<string, { aula: NonNullable<LinhaReserva["aula"]>; alunoIds: string[] }>();

  for (const l of linhas) {
    const a = l.aula;
    if (!a || a.status !== "agendada") continue;
    const hora = a.horario.slice(0, 5);
    if (a.data < hoje || (a.data === hoje && hora < horaAgora)) continue;

    const atual = porAula.get(a.id);
    if (atual) {
      if (!atual.alunoIds.includes(l.aluno_id)) atual.alunoIds.push(l.aluno_id);
    } else {
      porAula.set(a.id, { aula: a, alunoIds: [l.aluno_id] });
    }
  }

  const ordenadas = [...porAula.values()].sort((x, y) =>
    `${x.aula.data} ${x.aula.horario}`.localeCompare(`${y.aula.data} ${y.aula.horario}`),
  );
  const primeira = ordenadas[0];
  if (!primeira) return null;

  return {
    aulaId: primeira.aula.id,
    data: primeira.aula.data,
    horario: primeira.aula.horario.slice(0, 5),
    turma: primeira.aula.turma?.nome ?? "Aula",
    modalidadeId: primeira.aula.turma?.modalidade_id ?? null,
    alunoIds: primeira.alunoIds,
    outras: ordenadas.length - 1,
  };
}
