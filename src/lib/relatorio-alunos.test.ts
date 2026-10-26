import { describe, expect, it } from "vitest";
import {
  alertasDoAluno,
  categoriaRelatorio,
  diasNominais,
  janelaMeses,
  kidsComValorAdulto,
  ordenarLinhas,
  rotuloStatus,
  vencimentoDiferente,
  type LinhaRelatorioAluno,
} from "./relatorio-alunos";

// Calendário de 2026 usado nos testes:
// 05/08 quarta · 05/09 sábado → 07/09 segunda · 05/10 segunda · 15/10 quinta · 05/11 quinta · 05/12 sábado → 07/12 segunda

describe("diasNominais", () => {
  it("dia normal → só o próprio dia", () => {
    expect(diasNominais("2026-11-05")).toEqual([5]);
  });
  it("segunda-feira → pode ser o dia empurrado do fim de semana", () => {
    expect(diasNominais("2026-09-07")).toEqual([7, 6, 5]);
    expect(diasNominais("2026-10-05")).toEqual([5, 4, 3]);
  });
});

describe("vencimentoDiferente", () => {
  it("dia 5 empurrado para segunda conta como dia 5", () => {
    expect(vencimentoDiferente("2026-10-05", ["2026-08-05", "2026-09-07", "2026-11-05"])).toBe(false);
    expect(vencimentoDiferente("2026-12-07", ["2026-10-05", "2026-11-05"])).toBe(false);
  });
  it("dia 15 quando os outros meses são dia 5 → alerta", () => {
    expect(vencimentoDiferente("2026-10-15", ["2026-09-07", "2026-11-05", "2026-12-07"])).toBe(true);
  });
  it("só alerta quando não bate com a maioria", () => {
    expect(vencimentoDiferente("2026-10-15", ["2026-09-15", "2026-11-05", "2026-08-05"])).toBe(true);
    expect(vencimentoDiferente("2026-10-05", ["2026-09-15", "2026-11-05"])).toBe(false);
  });
  it("sem outras mensalidades → sem alerta", () => {
    expect(vencimentoDiferente("2026-10-15", [])).toBe(false);
  });
});

describe("kidsComValorAdulto", () => {
  const modalidades = new Map([
    ["jj", { valor: 50, valor_infantil: 44 }],
    ["capoeira", { valor: 20, valor_infantil: null }],
  ]);
  const jj = (valor: number, cobrar = true) => [{ modalidade_id: "jj", valor, cobrar }];

  it("menor de 16 a pagar o valor de adulto → alerta", () => {
    expect(kidsComValorAdulto(10, jj(50), modalidades)).toBe(true);
  });
  it("valor infantil ou valor próprio mais baixo → sem alerta", () => {
    expect(kidsComValorAdulto(10, jj(44), modalidades)).toBe(false);
    expect(kidsComValorAdulto(10, jj(40), modalidades)).toBe(false);
  });
  it("16 anos ou mais, sem data de nascimento ou pago no local → sem alerta", () => {
    expect(kidsComValorAdulto(16, jj(50), modalidades)).toBe(false);
    expect(kidsComValorAdulto(null, jj(50), modalidades)).toBe(false);
    expect(kidsComValorAdulto(10, jj(50, false), modalidades)).toBe(false);
  });
  it("modalidade sem preço infantil → sem alerta", () => {
    expect(kidsComValorAdulto(10, [{ modalidade_id: "capoeira", valor: 20, cobrar: true }], modalidades)).toBe(false);
  });
});

describe("alertasDoAluno", () => {
  const base = { ativo: true, outrasDatas: [] as string[], plano: 44, temPlano: true, kidsValorAdulto: false };

  it("inactivo sem mensalidade → sem alerta (não paga)", () => {
    expect(alertasDoAluno({ ...base, ativo: false, mensalidade: null })).toEqual([]);
  });
  it("sem mensalidade no mês → alerta", () => {
    expect(alertasDoAluno({ ...base, mensalidade: null })).toEqual(["sem_mensalidade"]);
    expect(alertasDoAluno({ ...base, mensalidade: null, plano: 0, temPlano: false })).toEqual(["sem_mensalidade"]);
  });
  it("plano a 0 € (pago no local) e sem mensalidade → sem alerta", () => {
    expect(alertasDoAluno({ ...base, mensalidade: null, plano: 0 })).toEqual([]);
  });
  it("mensalidade diferente do plano → alerta (compara ao cêntimo)", () => {
    expect(alertasDoAluno({ ...base, mensalidade: { valor: 0.01, data_vencimento: "2026-10-05" } })).toEqual([
      "valor_diferente_plano",
    ]);
    expect(
      alertasDoAluno({ ...base, plano: 49.6, mensalidade: { valor: 49.600000001, data_vencimento: "2026-10-05" } }),
    ).toEqual([]);
  });
  it("vários alertas saem pela ordem fixa", () => {
    expect(
      alertasDoAluno({
        ativo: true,
        mensalidade: { valor: 50, data_vencimento: "2026-10-15" },
        outrasDatas: ["2026-09-07", "2026-11-05"],
        plano: 44,
        temPlano: true,
        kidsValorAdulto: true,
      }),
    ).toEqual(["valor_diferente_plano", "kids_valor_adulto", "vencimento_diferente"]);
  });
});

describe("rotuloStatus", () => {
  it("ativo, inativo e trancado", () => {
    expect(rotuloStatus("ativo")).toBe("Ativo");
    expect(rotuloStatus("inativo")).toBe("Inativo");
    expect(rotuloStatus("trancado")).toBe("Trancado");
  });
});

describe("categoriaRelatorio", () => {
  it("regra da graduação: faixa infantil → Kids", () => {
    expect(categoriaRelatorio("verde", "adulto_infantil")).toBe("Kids");
    expect(categoriaRelatorio("azul", "adulto_infantil")).toBe("Adulto");
    expect(categoriaRelatorio(null, "infantil")).toBe("Kids");
    expect(categoriaRelatorio(null, null)).toBe("Adulto");
  });
});

describe("ordenarLinhas", () => {
  const linha = (nome: string, alertas: LinhaRelatorioAluno["alertas"] = []): LinhaRelatorioAluno => ({
    aluno_id: nome,
    nome,
    status: "Ativo",
    categoria: "Adulto",
    vencimento: null,
    valor: null,
    plano: 0,
    alertas,
  });

  it("alertas primeiro, depois por nome (sem ligar a acentos)", () => {
    const ordem = ordenarLinhas([linha("Bruno"), linha("Zé", ["sem_mensalidade"]), linha("Álvaro"), linha("Ana", ["valor_diferente_plano"])]);
    expect(ordem.map((l) => l.nome)).toEqual(["Ana", "Zé", "Álvaro", "Bruno"]);
  });
});

describe("janelaMeses", () => {
  it("±3 meses, a passar a viragem do ano", () => {
    expect(janelaMeses("2026-10")).toEqual({ inicio: "2026-07-01", fim: "2027-01-01" });
    expect(janelaMeses("2026-01")).toEqual({ inicio: "2025-10-01", fim: "2026-04-01" });
  });
});
