import { describe, expect, it } from "vitest";
import {
  addDias,
  calcularConquistas,
  calcularSequencia,
  grupoRanking,
  hojeLisboa,
  limitesPeriodo,
  mesesPerfeitos,
  mesesTop3,
  nomeRanking,
  ordenarRanking,
  top3DoMes,
} from "./gamificacao";

// Segundas-feiras a partir de uma data (inclusive)
function segundas(inicio: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDias(inicio, i * 7));
}

// 2 aulas (segunda e quarta) em cada semana indicada
function duasPorSemana(segs: string[]): string[] {
  return segs.flatMap((s) => [s, addDias(s, 2)]);
}

const codigos = (r: { codigo: string; referencia: string }[]) =>
  r.map((c) => (c.referencia ? `${c.codigo}:${c.referencia}` : c.codigo));

describe("datas em Lisboa", () => {
  it("23:30Z de 24/10/2026 ainda é dia 25 em Lisboa (verão, UTC+1)", () => {
    expect(hojeLisboa(new Date("2026-10-24T23:30:00Z"))).toBe("2026-10-25");
  });
  it("depois da mudança de hora (25/10), 23:30Z é o próprio dia", () => {
    expect(hojeLisboa(new Date("2026-10-26T23:30:00Z"))).toBe("2026-10-26");
  });
  it("início do horário de verão (29/03/2026)", () => {
    expect(hojeLisboa(new Date("2026-03-28T23:30:00Z"))).toBe("2026-03-28");
    expect(hojeLisboa(new Date("2026-03-29T23:30:00Z"))).toBe("2026-03-30");
  });
  it("limites do mês e do ano", () => {
    expect(limitesPeriodo("mes", "2026-02-10")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
    expect(limitesPeriodo("ano", "2026-02-10")).toEqual({ inicio: "2026-01-01", fim: "2026-12-31" });
  });
});

describe("calcularSequencia", () => {
  const academia = segundas("2026-08-31", 10); // 31/08 … 02/11

  it("conta semanas seguidas com 2+ aulas", () => {
    const dias = duasPorSemana(segundas("2026-08-31", 4));
    const s = calcularSequencia(dias, academia, "2026-09-28");
    expect(s.atual).toBe(4);
    expect(s.melhor).toBe(4);
  });

  it("2 aulas no mesmo dia contam para a meta", () => {
    const s = calcularSequencia(["2026-09-07", "2026-09-07"], academia, "2026-09-14");
    expect(s.atual).toBe(1);
  });

  it("a semana em curso não quebra a sequência", () => {
    const dias = duasPorSemana(segundas("2026-08-31", 3)); // até semana de 14/09
    const s = calcularSequencia([...dias, "2026-09-21"], academia, "2026-09-22");
    expect(s.atual).toBe(3);
    expect(s.semanaAtual).toEqual({ aulas: 1, meta: 2 });
  });

  it("uma semana com 1 aula (academia aberta) quebra a sequência", () => {
    const dias = [...duasPorSemana(segundas("2026-08-31", 3)), "2026-09-21", ...duasPorSemana(["2026-09-28"])];
    const s = calcularSequencia(dias, academia, "2026-10-01");
    expect(s.atual).toBe(1);
    expect(s.melhor).toBe(3);
  });

  it("semana sem ninguém na academia é pausa: não conta nem quebra", () => {
    const semFerias = academia.filter((s) => s !== "2026-09-14");
    const dias = duasPorSemana(["2026-08-31", "2026-09-07", "2026-09-21", "2026-09-28"]);
    const s = calcularSequencia(dias, semFerias, "2026-09-30");
    expect(s.atual).toBe(4);
  });

  it("semana que atravessa o ano", () => {
    const acad = segundas("2026-12-21", 3); // 21/12, 28/12, 04/01
    const dias = ["2026-12-21", "2026-12-23", "2026-12-31", "2027-01-01", "2027-01-05", "2027-01-06"];
    expect(calcularSequencia(dias, acad, "2027-01-08").atual).toBe(3);
  });

  it("guarda o dia em que cada tamanho foi atingido (2.ª aula da semana)", () => {
    const dias = duasPorSemana(segundas("2026-08-31", 4));
    const s = calcularSequencia(dias, academia, "2026-09-28");
    expect(s.atingidaEm.get(4)).toBe("2026-09-23");
  });
});

describe("mesesPerfeitos", () => {
  const academia = segundas("2026-08-31", 12);

  it("todas as semanas de setembro com 2+ aulas", () => {
    const dias = duasPorSemana(segundas("2026-09-07", 4)); // segundas 7, 14, 21, 28
    expect(mesesPerfeitos(dias, academia, "2026-10-05")).toEqual(["2026-09"]);
  });

  it("mês ainda a decorrer não conta", () => {
    const dias = duasPorSemana(segundas("2026-09-07", 4));
    expect(mesesPerfeitos(dias, academia, "2026-09-30")).toEqual([]);
  });

  it("uma semana falhada estraga o mês", () => {
    const dias = duasPorSemana(["2026-09-07", "2026-09-14", "2026-09-28"]);
    expect(mesesPerfeitos(dias, academia, "2026-10-05")).toEqual([]);
  });
});

describe("ranking", () => {
  it("empates partilham posição (1, 1, 3)", () => {
    const r = ordenarRanking([
      { nome: "Carla", aulas: 8 },
      { nome: "Ana", aulas: 10 },
      { nome: "Bruno", aulas: 10 },
    ]);
    expect(r.map((l) => [l.nome, l.posicao])).toEqual([["Ana", 1], ["Bruno", 1], ["Carla", 3]]);
  });

  it("nomes curtos: kids com inicial do apelido", () => {
    expect(nomeRanking("Tomás Pereira da Silva", "infantil")).toBe("Tomás S.");
    expect(nomeRanking("Tomás Pereira da Silva", "adulto")).toBe("Tomás Silva");
    expect(nomeRanking("Madonna", "adulto")).toBe("Madonna");
  });

  it("adulto_infantil com faixa adulta vai para Adultos; faixa infantil vai para Kids", () => {
    expect(grupoRanking("azul", "adulto_infantil")).toBe("adulto");
    expect(grupoRanking("cinza", "adulto_infantil")).toBe("infantil");
    expect(grupoRanking("branca", "infantil")).toBe("infantil");
    expect(grupoRanking(null, null)).toBe("adulto");
  });

  it("Top 3 por grupo, com mínimo de aulas e empates", () => {
    const mes = (n: number) => Array.from({ length: n }, () => "2026-10-05");
    const vencedores = top3DoMes(
      [
        { alunoId: "a", nome: "A", grupo: "adulto", dias: mes(9) },
        { alunoId: "b", nome: "B", grupo: "adulto", dias: mes(9) },
        { alunoId: "c", nome: "C", grupo: "adulto", dias: mes(7) },
        { alunoId: "d", nome: "D", grupo: "adulto", dias: mes(5) },
        { alunoId: "k", nome: "K", grupo: "infantil", dias: mes(3) }, // abaixo do mínimo
      ],
      "2026-10",
    );
    expect([...vencedores].sort()).toEqual(["a", "b", "c"]);
  });

  it("meses de Top 3: do lançamento até ao mês passado", () => {
    expect(mesesTop3("2026-10-20")).toEqual([]);
    expect(mesesTop3("2027-01-02")).toEqual(["2026-10", "2026-11", "2026-12"]);
  });
});

describe("calcularConquistas", () => {
  const base = { semanasAcademia: [], aulasManual: 0, inicioCandidatos: [], mesesTop3: [], hoje: "2026-10-16" };

  it("marco de aulas no dia em que o total chega ao limiar", () => {
    const dias = Array.from({ length: 12 }, (_, i) => addDias("2026-09-01", i));
    const r = calcularConquistas({ ...base, dias });
    expect(r.find((c) => c.codigo === "aulas_10")?.conquistada_em).toBe("2026-09-10");
    expect(codigos(r)).not.toContain("aulas_25");
  });

  it("aulas antes da app contam como base", () => {
    const dias = ["2026-09-01", "2026-09-03", "2026-09-05"];
    const r = calcularConquistas({ ...base, dias, aulasManual: 23 });
    expect(r.find((c) => c.codigo === "aulas_10")?.conquistada_em).toBe("2026-09-01");
    expect(r.find((c) => c.codigo === "aulas_25")?.conquistada_em).toBe("2026-09-03");
  });

  it("2 aulas no mesmo dia contam 2", () => {
    const dias = Array.from({ length: 10 }, () => "2026-09-01");
    expect(codigos(calcularConquistas({ ...base, dias }))).toContain("aulas_10");
  });

  it("sequência, mês perfeito e top 3 com referência", () => {
    const academia = segundas("2026-08-31", 7);
    const dias = duasPorSemana(segundas("2026-08-31", 6)); // 6 semanas até 05/10
    const r = calcularConquistas({ ...base, dias, semanasAcademia: academia, mesesTop3: ["2026-09"] });
    expect(codigos(r)).toEqual(
      expect.arrayContaining(["aulas_10", "sequencia_4", "mes_perfeito:2026-09", "top3_mes:2026-09"]),
    );
    expect(r.find((c) => c.codigo === "top3_mes")?.conquistada_em).toBe("2026-09-30");
  });

  it("aniversários a partir da data mais antiga conhecida", () => {
    const r = calcularConquistas({
      ...base,
      dias: ["2025-03-01"],
      inicioCandidatos: ["2024-10-09T10:00:00+00:00", null],
    });
    expect(codigos(r)).toContain("aniversario_1");
    expect(r.find((c) => c.codigo === "aniversario_1")?.conquistada_em).toBe("2025-10-09");
    expect(r.find((c) => c.codigo === "aniversario_2")?.conquistada_em).toBe("2026-10-09");
    expect(codigos(r)).not.toContain("aniversario_3");
  });

  it("29 de fevereiro passa para 1 de março", () => {
    const r = calcularConquistas({ ...base, dias: ["2024-02-29"], hoje: "2025-03-01" });
    expect(r.find((c) => c.codigo === "aniversario_1")?.conquistada_em).toBe("2025-03-01");
  });
});
