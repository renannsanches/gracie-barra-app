import { describe, expect, it } from "vitest";
import {
  REF_PRODUCAO,
  eProducao,
  exigirBaseUrlDeTeste,
  exigirForaDeProducao,
  hostSupabase,
  padraoSupabase,
  refDoProjeto,
  temSessaoDoProjeto,
} from "./ambiente";

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

describe("exigirBaseUrlDeTeste", () => {
  it("aceita servidores locais e o BASE_URL por defeito", () => {
    for (const url of [undefined, "http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
      expect(() => exigirBaseUrlDeTeste(url)).not.toThrow();
    }
  });

  it("aceita previews da Vercel", () => {
    expect(() => exigirBaseUrlDeTeste("https://gracie-barra-gkh62s1e7-renannsanches.vercel.app")).not.toThrow();
    expect(() => exigirBaseUrlDeTeste("https://gracie-barra-app-git-feat-t2-renannsanches.vercel.app")).not.toThrow();
  });

  it("recusa o domínio de produção e outros hosts", () => {
    const msg = "E2E recusado: BASE_URL não é um servidor local nem um preview da Vercel.";
    expect(() => exigirBaseUrlDeTeste("https://gracie-barra-app.vercel.app")).toThrow(msg);
    expect(() => exigirBaseUrlDeTeste("https://example.com")).toThrow(msg);
    expect(() => exigirBaseUrlDeTeste("lixo")).toThrow(msg);
  });
});

describe("temSessaoDoProjeto", () => {
  it("encontra o cookie de sessão do projecto, inteiro ou em pedaços", () => {
    expect(temSessaoDoProjeto(["sb-luakxrtecetdkccoctzm-auth-token"], STAGING)).toBe(true);
    expect(temSessaoDoProjeto(["x", "sb-luakxrtecetdkccoctzm-auth-token.0"], STAGING)).toBe(true);
  });

  it("não aceita a sessão de outro projecto nem ausência de sessão", () => {
    expect(temSessaoDoProjeto(["sb-fjqiyilzxxyoyposqsfz-auth-token"], STAGING)).toBe(false);
    expect(temSessaoDoProjeto([], STAGING)).toBe(false);
    expect(temSessaoDoProjeto(["sb-luakxrtecetdkccoctzm-auth-token"], undefined)).toBe(false);
  });
});
