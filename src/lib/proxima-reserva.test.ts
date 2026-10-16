import { describe, expect, it } from "vitest";
import { escolherProximaReserva, formatarQuando, horaLisboa, type LinhaReserva } from "./proxima-reserva";

function linha(aluno: string, id: string, data: string, horario: string, status = "agendada"): LinhaReserva {
  return { aluno_id: aluno, aula: { id, data, horario, status, turma: { nome: `Turma ${id}`, modalidade_id: "jj" } } };
}

describe("escolherProximaReserva", () => {
  it("devolve null sem reservas futuras", () => {
    expect(escolherProximaReserva([], "2026-10-16", "10:00")).toBeNull();
    expect(escolherProximaReserva([linha("eu", "a", "2026-10-15", "19:00:00")], "2026-10-16", "10:00")).toBeNull();
  });

  it("ignora aulas de hoje que já começaram e aulas canceladas", () => {
    const r = escolherProximaReserva(
      [
        linha("eu", "a", "2026-10-16", "09:00:00"),
        linha("eu", "b", "2026-10-16", "19:00:00", "cancelada"),
        linha("eu", "c", "2026-10-17", "10:00:00"),
      ],
      "2026-10-16",
      "10:00",
    );
    expect(r?.aulaId).toBe("c");
    expect(r?.outras).toBe(0);
  });

  it("escolhe a mais próxima, junta pessoas da mesma aula e conta as outras", () => {
    const r = escolherProximaReserva(
      [
        linha("eu", "b", "2026-10-18", "19:00:00"),
        linha("filho", "a", "2026-10-16", "18:30:00"),
        linha("eu", "a", "2026-10-16", "18:30:00"),
        linha("filho", "c", "2026-10-20", "18:30:00"),
      ],
      "2026-10-16",
      "10:00",
    );
    expect(r).toMatchObject({ aulaId: "a", data: "2026-10-16", horario: "18:30", turma: "Turma a", outras: 2 });
    expect(r?.alunoIds).toEqual(["filho", "eu"]);
  });

  it("a aula de hoje à hora exacta ainda conta", () => {
    expect(escolherProximaReserva([linha("eu", "a", "2026-10-16", "19:00:00")], "2026-10-16", "19:00")?.aulaId).toBe("a");
  });
});

describe("formatarQuando", () => {
  it("diz hoje, amanhã ou dia da semana + data", () => {
    expect(formatarQuando("2026-10-16", "19:00:00", "2026-10-16")).toBe("Hoje · 19:00");
    expect(formatarQuando("2026-10-17", "09:30:00", "2026-10-16")).toBe("Amanhã · 09:30");
    expect(formatarQuando("2026-10-22", "19:00:00", "2026-10-16")).toBe("Qui, 22 out · 19:00");
    expect(formatarQuando("2027-01-01", "10:00:00", "2026-12-31")).toBe("Amanhã · 10:00");
  });
});

describe("horaLisboa", () => {
  it("usa o fuso de Lisboa (verão = UTC+1, inverno = UTC)", () => {
    expect(horaLisboa(new Date("2026-07-01T17:05:00Z"))).toBe("18:05");
    expect(horaLisboa(new Date("2026-12-01T00:30:00Z"))).toBe("00:30");
  });
});
