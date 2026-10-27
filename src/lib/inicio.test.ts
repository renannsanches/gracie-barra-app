import { describe, expect, it } from "vitest";
import { SEPARADORES, separadorValido } from "./inicio";

describe("separadorValido", () => {
  it("sem tab → feed", () => {
    expect(separadorValido(undefined)).toBe("feed");
  });

  it("aceita um separador conhecido", () => {
    expect(separadorValido("ranking")).toBe("ranking");
  });

  it("é sensível a maiúsculas", () => {
    expect(separadorValido("RANKING")).toBe("feed");
  });

  it("valor desconhecido → feed", () => {
    expect(separadorValido("x")).toBe("feed");
  });

  it("todos os separadores são válidos", () => {
    for (const s of SEPARADORES) expect(separadorValido(s)).toBe(s);
  });
});
