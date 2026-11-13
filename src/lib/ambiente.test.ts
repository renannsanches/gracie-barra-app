import { describe, expect, it } from "vitest";
import { REF_PRODUCAO, eProducao, exigirForaDeProducao, hostSupabase, padraoSupabase, refDoProjeto } from "./ambiente";

const PRODUCAO = "https://fjqiyilzxxyoyposqsfz.supabase.co";
const STAGING = "https://luakxrtecetdkccoctzm.supabase.co";

describe("refDoProjeto", () => {
  it("extrai o ref do subdomínio supabase.co", () => {
    expect(refDoProjeto(PRODUCAO)).toBe(REF_PRODUCAO);
  });

  it("ignora barra final e caminho", () => {
    expect(refDoProjeto(`${PRODUCAO}/`)).toBe(REF_PRODUCAO);
    expect(refDoProjeto(`${PRODUCAO}/storage/v1/object/public/feed/a.webp`)).toBe(REF_PRODUCAO);
  });

  it("devolve null fora do formato <ref>.supabase.co", () => {
    expect(refDoProjeto("http://localhost:54321")).toBeNull();
    expect(refDoProjeto("lixo")).toBeNull();
    expect(refDoProjeto(undefined)).toBeNull();
  });
});

describe("eProducao", () => {
  it("reconhece o URL de produção, também em maiúsculas", () => {
    expect(eProducao(PRODUCAO)).toBe(true);
    expect(eProducao(PRODUCAO.toUpperCase())).toBe(true);
  });

  it("não confunde staging nem URL em falta com produção", () => {
    expect(eProducao(STAGING)).toBe(false);
    expect(eProducao(undefined)).toBe(false);
  });
});

describe("exigirForaDeProducao", () => {
  it("recusa a produção com mensagem clara", () => {
    expect(() => exigirForaDeProducao(PRODUCAO)).toThrow(
      "E2E recusado: NEXT_PUBLIC_SUPABASE_URL aponta para a produção (fjqiyilzxxyoyposqsfz). Usar o staging."
    );
  });

  it("deixa passar o staging", () => {
    expect(() => exigirForaDeProducao(STAGING)).not.toThrow();
  });
});

describe("hostSupabase", () => {
  it("devolve o hostname do projecto", () => {
    expect(hostSupabase(STAGING)).toBe("luakxrtecetdkccoctzm.supabase.co");
  });

  it("lança com URL em falta ou inválido", () => {
    expect(() => hostSupabase(undefined)).toThrow("NEXT_PUBLIC_SUPABASE_URL em falta ou inválido");
    expect(() => hostSupabase("lixo")).toThrow("NEXT_PUBLIC_SUPABASE_URL em falta ou inválido");
  });
});

describe("padraoSupabase", () => {
  const padrao = padraoSupabase(STAGING);

  it("casa pedidos ao projecto configurado", () => {
    expect(padrao.test("https://luakxrtecetdkccoctzm.supabase.co/storage/v1/object/public/feed/a.webp")).toBe(true);
  });

  it("não casa outro projecto nem um host com o ponto trocado", () => {
    expect(padrao.test("https://fjqiyilzxxyoyposqsfz.supabase.co/rest/v1/x")).toBe(false);
    expect(padrao.test("https://luakxrtecetdkccoctzmXsupabase.co/x")).toBe(false);
  });
});
