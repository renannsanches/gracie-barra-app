import { describe, expect, it } from "vitest";
import { resolverTema, rotaTemTema, scriptTema, THEME_COLOR } from "./tema";

describe("rotaTemTema", () => {
  it("aceita as rotas do aluno e as sub-rotas", () => {
    expect(rotaTemTema("/perfil")).toBe(true);
    expect(rotaTemTema("/conta")).toBe(true);
    expect(rotaTemTema("/galeria/abc")).toBe(true);
    expect(rotaTemTema("/presenca")).toBe(true);
    expect(rotaTemTema("/presencas")).toBe(true);
  });

  it("recusa prefixos soltos, admin, tablet e páginas públicas", () => {
    expect(rotaTemTema("/presencasx")).toBe(false);
    expect(rotaTemTema("/admin")).toBe(false);
    expect(rotaTemTema("/admin/alunos")).toBe(false);
    expect(rotaTemTema("/tablet")).toBe(false);
    expect(rotaTemTema("/login")).toBe(false);
    expect(rotaTemTema("/")).toBe(false);
  });
});

describe("resolverTema", () => {
  it("sem preferência segue o sistema", () => {
    expect(resolverTema(null, true)).toBe("escuro");
    expect(resolverTema(null, false)).toBe("claro");
  });

  it("a preferência ganha ao sistema", () => {
    expect(resolverTema("claro", true)).toBe("claro");
    expect(resolverTema("escuro", false)).toBe("escuro");
  });
});

/** Corre o script do <head> isolado, com um DOM mínimo. */
function correrScript(opcoes: {
  path: string;
  guardado?: string | null;
  sistemaEscuro?: boolean;
  storageRebenta?: boolean;
}) {
  const classes = new Set<string>();
  const meta = { content: THEME_COLOR.claro };
  const document = {
    documentElement: {
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
      },
    },
    querySelector: (sel: string) => (sel === 'meta[name="theme-color"]' ? meta : null),
  };
  const localStorage = {
    getItem: () => {
      if (opcoes.storageRebenta) throw new Error("SecurityError");
      return opcoes.guardado ?? null;
    },
  };
  const matchMedia = () => ({ matches: Boolean(opcoes.sistemaEscuro) });
  const location = { pathname: opcoes.path };

  new Function("document", "localStorage", "matchMedia", "location", scriptTema())(
    document,
    localStorage,
    matchMedia,
    location,
  );
  return { escuro: classes.has("dark"), themeColor: meta.content };
}

describe("scriptTema", () => {
  it("põe o escuro antes da hidratação quando a preferência é escuro", () => {
    expect(correrScript({ path: "/perfil", guardado: "escuro" })).toEqual({
      escuro: true,
      themeColor: THEME_COLOR.escuro,
    });
  });

  it("não toca no admin nem no tablet", () => {
    expect(correrScript({ path: "/admin", guardado: "escuro" }).escuro).toBe(false);
    expect(correrScript({ path: "/tablet", sistemaEscuro: true }).escuro).toBe(false);
  });

  it("sem preferência segue o sistema", () => {
    expect(correrScript({ path: "/conta", sistemaEscuro: true }).escuro).toBe(true);
    expect(correrScript({ path: "/conta", sistemaEscuro: false }).escuro).toBe(false);
  });

  it("valor inválido no storage conta como sem preferência", () => {
    expect(correrScript({ path: "/conta", guardado: "roxo", sistemaEscuro: true }).escuro).toBe(true);
  });

  it("storage a rebentar não lança e segue o sistema", () => {
    expect(() => correrScript({ path: "/conta", storageRebenta: true, sistemaEscuro: true })).not.toThrow();
    expect(correrScript({ path: "/conta", storageRebenta: true, sistemaEscuro: true }).escuro).toBe(true);
  });
});
