import { describe, expect, it } from "vitest";
import { ordenarAptosGraduar } from "./graduacao-rules";

const NOAH = "d71d8851-800d-466e-9b7f-640a337e9a5e";

const apto = (id: string, qualificadas: number, necessarias = 4) => ({
  id,
  semanasQualificadas: qualificadas,
  semanasNecessarias: necessarias,
});

describe("ordenarAptosGraduar", () => {
  it("ordena por sobra de semanas (maior primeiro) quando ninguém está fixado", () => {
    const r = ordenarAptosGraduar([apto("a", 5), apto("b", 9), apto("c", 6)]);
    expect(r.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("põe o Noah em 2.º mesmo estando em último pela sobra", () => {
    const r = ordenarAptosGraduar([apto("a", 20), apto("b", 15), apto(NOAH, 4), apto("c", 10)]);
    expect(r.map((x) => x.id)).toEqual(["a", NOAH, "b", "c"]);
  });

  it("põe o Noah em 2.º mesmo estando em 1.º pela sobra", () => {
    const r = ordenarAptosGraduar([apto(NOAH, 30), apto("a", 10), apto("b", 8)]);
    expect(r.map((x) => x.id)).toEqual(["a", NOAH, "b"]);
  });

  it("com só o Noah, fica em 1.º", () => {
    expect(ordenarAptosGraduar([apto(NOAH, 4)]).map((x) => x.id)).toEqual([NOAH]);
  });

  it("com o Noah e mais um, fica em 2.º", () => {
    const r = ordenarAptosGraduar([apto(NOAH, 30), apto("a", 5)]);
    expect(r.map((x) => x.id)).toEqual(["a", NOAH]);
  });
});
