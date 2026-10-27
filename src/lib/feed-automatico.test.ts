import { describe, expect, it } from "vitest";
import {
  deveCriarPostGraduacao,
  mesDoPodio,
  montarPodio,
  nomeMes,
  textoGraduacao,
  textoPodio,
} from "./feed-automatico";

describe("deveCriarPostGraduacao", () => {
  const hoje = "2026-10-27";
  const base = { faixaAnterior: "branca", faixaNova: "azul", dataGraduacao: hoje, ocultarRanking: false, hoje } as const;

  it("gera post para faixa nova dentro da janela de 7 dias", () => {
    expect(deveCriarPostGraduacao(base)).toBe(true);
    expect(deveCriarPostGraduacao({ ...base, dataGraduacao: "2026-10-20" })).toBe(true); // 7 dias
  });

  it("não gera fora da janela", () => {
    expect(deveCriarPostGraduacao({ ...base, dataGraduacao: "2026-10-19" })).toBe(false); // 8 dias
    expect(deveCriarPostGraduacao({ ...base, dataGraduacao: "2026-10-28" })).toBe(false); // futuro
  });

  it("não gera só por graus nem no primeiro registo", () => {
    expect(deveCriarPostGraduacao({ ...base, faixaNova: "branca" })).toBe(false); // só graus
    expect(deveCriarPostGraduacao({ ...base, faixaAnterior: null })).toBe(false); // 1.º registo
  });

  it("não gera para quem está oculto do ranking", () => {
    expect(deveCriarPostGraduacao({ ...base, ocultarRanking: true })).toBe(false);
  });
});

describe("textoGraduacao", () => {
  it("usa o rótulo da faixa em minúsculas", () => {
    expect(textoGraduacao("João Silva", "azul")).toBe("João Silva recebeu a faixa azul.");
    expect(textoGraduacao("Ana P.", "cinza_branca")).toBe("Ana P. recebeu a faixa cinza/branca.");
  });
});

describe("nomeMes", () => {
  it("devolve o mês por extenso em minúsculas", () => {
    expect(nomeMes("2026-10")).toBe("outubro");
  });
});

describe("mesDoPodio", () => {
  it("devolve o mês anterior a partir do primeiro mês com pódio", () => {
    expect(mesDoPodio("2026-11-01")).toBe("2026-10");
    expect(mesDoPodio("2027-01-03")).toBe("2026-12");
  });

  it("devolve null quando o mês anterior é anterior ao primeiro pódio", () => {
    expect(mesDoPodio("2026-10-27")).toBeNull(); // setembro < PRIMEIRO_MES_PODIO
  });
});

describe("montarPodio", () => {
  const l = (id: string, nomeCompleto: string, aulas: number, faixa = "azul", categoria = "adulto") => ({
    alunoId: id,
    nomeCompleto,
    foto: null,
    faixa,
    graus: 0,
    categoria,
    aulas,
  });

  it("agrupa por Adultos/Kids, aplica o mínimo de aulas e empates 1, 2, 2", () => {
    const p = montarPodio(
      [
        l("a", "Ana Costa", 18),
        l("b", "Bruno Dias", 14),
        l("c", "Carla Reis", 14),
        l("d", "Duarte Lopes", 12),
        l("e", "Eva Mota", 12),
        l("f", "Filipe Sá", 3),
        l("k", "Kiko Neves", 9, "cinza", "infantil"),
      ],
      "2026-10",
    )!;
    expect(p.adultos.map((x) => [x.alunoId, x.posicao])).toEqual([["a", 1], ["b", 2], ["c", 2]]);
    expect(p.kids.map((x) => [x.nome, x.posicao])).toEqual([["Kiko N.", 1]]);
  });

  it("devolve null se ninguém chega ao mínimo de aulas", () => {
    expect(montarPodio([l("f", "Filipe Sá", 3)], "2026-10")).toBeNull();
  });

  it("empate no 3.º lugar: todos aparecem", () => {
    const e = montarPodio([l("a", "A A", 10), l("b", "B B", 9), l("c", "C C", 8), l("d", "D D", 8)], "2026-10")!;
    expect(e.adultos.map((x) => x.posicao)).toEqual([1, 2, 3, 3]);
  });

  it("leva foto, faixa, graus, categoria e aulas para a entrada", () => {
    const p = montarPodio([{ ...l("a", "Ana Costa", 10), foto: "http://x/a.webp", graus: 2 }], "2026-10")!;
    expect(p.mes).toBe("2026-10");
    expect(p.adultos[0]).toEqual({
      alunoId: "a",
      nome: "Ana Costa",
      foto: "http://x/a.webp",
      faixa: "azul",
      graus: 2,
      categoria: "adulto",
      aulas: 10,
      posicao: 1,
    });
  });
});

describe("textoPodio", () => {
  const l = (id: string, nomeCompleto: string, aulas: number, faixa = "azul", categoria = "adulto") => ({
    alunoId: id,
    nomeCompleto,
    foto: null,
    faixa,
    graus: 0,
    categoria,
    aulas,
  });
  const p = montarPodio(
    [
      l("a", "Ana Costa", 18),
      l("b", "Bruno Dias", 14),
      l("c", "Carla Reis", 14),
      l("d", "Duarte Lopes", 12),
      l("k", "Kiko Neves", 9, "cinza", "infantil"),
    ],
    "2026-10",
  )!;

  it("lista Adultos e Kids", () => {
    expect(textoPodio({ kind: "podio", mes: "2026-10", adultos: p.adultos, kids: p.kids })).toBe(
      "Pódio de outubro 🏆\nAdultos: 1.º Ana Costa, 2.º Bruno Dias, 2.º Carla Reis\nKids: 1.º Kiko N.",
    );
  });

  it("grupo vazio: a linha não aparece", () => {
    expect(textoPodio({ kind: "podio", mes: "2026-10", adultos: p.adultos, kids: [] })).toBe(
      "Pódio de outubro 🏆\nAdultos: 1.º Ana Costa, 2.º Bruno Dias, 2.º Carla Reis",
    );
  });
});
