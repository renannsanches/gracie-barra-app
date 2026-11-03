import { describe, expect, it } from "vitest";
import {
  atribuirPresencasAAulas,
  aulaDoAluno,
  diaLisboa,
  ehPresencaAvulsa,
  instanteAulaLisboa,
} from "./presenca-manual";

describe("instanteAulaLisboa", () => {
  it("verão: Lisboa = UTC+1", () => {
    expect(instanteAulaLisboa("2026-07-15", "19:00:00")).toBe("2026-07-15T18:00:00.000Z");
  });

  it("inverno: Lisboa = UTC+0", () => {
    expect(instanteAulaLisboa("2026-11-03", "18:00")).toBe("2026-11-03T18:00:00.000Z");
  });

  it("dia seguinte à mudança de hora (25/10/2026) já é inverno", () => {
    expect(instanteAulaLisboa("2026-10-26", "09:30:00")).toBe("2026-10-26T09:30:00.000Z");
    expect(instanteAulaLisboa("2026-10-24", "09:30:00")).toBe("2026-10-24T08:30:00.000Z");
  });
});

describe("diaLisboa", () => {
  it("23:30 UTC no verão já é o dia seguinte em Lisboa", () => {
    expect(diaLisboa("2026-07-15T23:30:00.000Z")).toBe("2026-07-16");
  });

  it("inverno não muda o dia", () => {
    expect(diaLisboa("2026-11-03T23:30:00.000Z")).toBe("2026-11-03");
  });
});

describe("ehPresencaAvulsa", () => {
  it("12:00:00 UTC certo = presença manual antiga, sem aula", () => {
    expect(ehPresencaAvulsa("2026-06-10T12:00:00+00:00")).toBe(true);
    expect(ehPresencaAvulsa("2026-06-10T12:00:00.000Z")).toBe(true);
  });

  it("QR com segundos/milissegundos não é avulsa", () => {
    expect(ehPresencaAvulsa("2026-06-10T12:00:07.123Z")).toBe(false);
    expect(ehPresencaAvulsa("2026-06-10T18:55:00.000Z")).toBe(false);
  });
});

describe("atribuirPresencasAAulas", () => {
  // 3 de novembro de 2026: inverno, hora de Lisboa = UTC
  const aulas = [
    { id: "a12", data: "2026-11-03", horario: "12:00:00" },
    { id: "a18", data: "2026-11-03", horario: "18:00:00" },
    { id: "a19", data: "2026-11-03", horario: "19:00:00" },
  ];

  it("QR das 18:50 vai só para a aula das 19:00 (a mais próxima)", () => {
    expect(atribuirPresencasAAulas(aulas, ["2026-11-03T18:50:12.000Z"])).toEqual(new Set(["a19"]));
  });

  it("até 60 min antes conta; 90 min antes não", () => {
    expect(atribuirPresencasAAulas(aulas, ["2026-11-03T17:05:00.500Z"])).toEqual(new Set(["a18"]));
    expect(atribuirPresencasAAulas(aulas, ["2026-11-03T16:30:00.500Z"])).toEqual(new Set());
  });

  it("até 90 min depois conta", () => {
    expect(atribuirPresencasAAulas(aulas, ["2026-11-03T13:29:00.500Z"])).toEqual(new Set(["a12"]));
    expect(atribuirPresencasAAulas(aulas, ["2026-11-03T13:31:00.500Z"])).toEqual(new Set());
  });

  it("presença à hora certa da aula (gravada por este fluxo) marca essa aula", () => {
    const pres = [instanteAulaLisboa("2026-11-03", "18:00:00"), instanteAulaLisboa("2026-11-03", "19:00:00")];
    expect(atribuirPresencasAAulas(aulas, pres)).toEqual(new Set(["a18", "a19"]));
  });

  it("presença avulsa antiga (12:00 UTC) não marca a aula do meio-dia", () => {
    expect(atribuirPresencasAAulas(aulas, ["2026-11-03T12:00:00+00:00"])).toEqual(new Set());
  });

  it("duas turmas à mesma hora: a presença marca as duas (não se treina em duas ao mesmo tempo)", () => {
    const simultaneas = [
      { id: "kids18", data: "2026-10-27", horario: "18:00:00" },
      { id: "gb1-18", data: "2026-10-27", horario: "18:00:00" },
      { id: "gb2-19", data: "2026-10-27", horario: "19:00:00" },
    ];
    expect(atribuirPresencasAAulas(simultaneas, ["2026-10-27T18:00:00.000Z"])).toEqual(new Set(["kids18", "gb1-18"]));
  });

  it("presença noutro dia não conta", () => {
    expect(atribuirPresencasAAulas(aulas, ["2026-11-04T18:00:00.500Z"])).toEqual(new Set());
  });
});

describe("aulaDoAluno", () => {
  it("adulto vê só turmas de adultos", () => {
    expect(aulaDoAluno("adulto", "adulto")).toBe(true);
    expect(aulaDoAluno("infantil", "adulto")).toBe(false);
  });

  it("infantil vê só turmas infantis", () => {
    expect(aulaDoAluno("infantil", "infantil")).toBe(true);
    expect(aulaDoAluno("adulto", "infantil")).toBe(false);
  });

  it("adulto_infantil vê ambas", () => {
    expect(aulaDoAluno("adulto", "adulto_infantil")).toBe(true);
    expect(aulaDoAluno("infantil", "adulto_infantil")).toBe(true);
  });

  it("sem categoria → tudo conta como do aluno", () => {
    expect(aulaDoAluno("infantil", null)).toBe(true);
  });
});
