import { describe, expect, it } from "vitest";
import {
  caminhoNoBucket,
  codificarCursor,
  contarCaracteres,
  descodificarCursor,
  nomeCurto,
  podeApagarComentario,
  podeApagarPost,
  podeEditarPost,
  tempoRelativo,
  validarComentario,
  validarPost,
} from "./feed";

const agora = new Date("2026-10-26T12:00:00Z");

describe("contarCaracteres / validarComentario", () => {
  it("conta code points, não unidades UTF-16", () => {
    expect(contarCaracteres("😀".repeat(300))).toBe(300);
  });

  it("rejeita comentário vazio ou só com espaços", () => {
    expect(validarComentario("   ")).toEqual({ ok: false, erro: "Escreve um comentário." });
  });

  it("apara o texto", () => {
    expect(validarComentario("  olá  ")).toEqual({ ok: true, texto: "olá" });
  });

  it("aceita exactamente 300 caracteres (também emojis)", () => {
    expect(validarComentario("a".repeat(300)).ok).toBe(true);
    expect(validarComentario("😀".repeat(300)).ok).toBe(true);
  });

  it("rejeita 301 caracteres", () => {
    expect(validarComentario("a".repeat(301))).toEqual({ ok: false, erro: "Máximo de 300 caracteres." });
  });
});

describe("validarPost", () => {
  it("exige texto ou foto", () => {
    expect(validarPost("  ", 0)).toEqual({ ok: false, erro: "Escreve um texto ou junta uma foto." });
  });

  it("aceita só fotos, sem texto", () => {
    expect(validarPost("", 1)).toEqual({ ok: true, texto: "" });
  });

  it("limita a 10 fotos", () => {
    expect(validarPost("x", 11)).toEqual({ ok: false, erro: "Máximo de 10 fotos por publicação." });
  });

  it("limita o texto a 2000 caracteres", () => {
    expect(validarPost("a".repeat(2001), 0)).toEqual({ ok: false, erro: "Máximo de 2000 caracteres." });
  });
});

describe("tempoRelativo (dias de calendário em Europe/Lisbon)", () => {
  it("menos de 1 minuto é 'agora'", () => {
    expect(tempoRelativo("2026-10-26T11:59:30Z", agora)).toBe("agora");
  });

  it("minutos", () => {
    expect(tempoRelativo("2026-10-26T11:55:00Z", agora)).toBe("há 5 min");
  });

  it("horas", () => {
    expect(tempoRelativo("2026-10-26T09:00:00Z", agora)).toBe("há 3 h");
  });

  it("ontem", () => {
    expect(tempoRelativo("2026-10-25T10:00:00Z", agora)).toBe("ontem");
  });

  it("dias (2 a 6)", () => {
    expect(tempoRelativo("2026-10-22T12:00:00Z", agora)).toBe("há 4 dias");
  });

  it("data curta no mesmo ano", () => {
    expect(tempoRelativo("2026-10-12T12:00:00Z", agora)).toBe("12 out.");
  });

  it("data com ano noutro ano", () => {
    expect(tempoRelativo("2025-12-01T12:00:00Z", agora)).toBe("1 dez. 2025");
  });

  it("data no futuro (relógio desfasado) lê-se 'agora'", () => {
    expect(tempoRelativo("2026-10-26T12:05:00Z", agora)).toBe("agora");
  });
});

describe("nomeCurto", () => {
  it("primeiro + último nome", () => {
    expect(nomeCurto("Renan Silva Sanches")).toBe("Renan Sanches");
  });

  it("nome único, com espaços à volta", () => {
    expect(nomeCurto("  Simone  ")).toBe("Simone");
  });
});

describe("permissões", () => {
  const aluno = { userId: "a", perfil: "aluno" } as const;
  const resp = { userId: "r", perfil: "responsavel" } as const;
  const prof = { userId: "p", perfil: "professor" } as const;
  const admin = { userId: "d", perfil: "admin" } as const;

  it("apagar comentário: o autor ou staff", () => {
    expect(podeApagarComentario(aluno, "a")).toBe(true);
    expect(podeApagarComentario(aluno, "b")).toBe(false);
    expect(podeApagarComentario(resp, "r")).toBe(true);
    expect(podeApagarComentario(prof, "b")).toBe(true);
  });

  it("editar post: só o autor staff, ou staff em posts automáticos", () => {
    expect(podeEditarPost(prof, "p")).toBe(true);
    expect(podeEditarPost(prof, "d")).toBe(false);
    expect(podeEditarPost(admin, null)).toBe(true); // post automático
    expect(podeEditarPost(aluno, "a")).toBe(false);
  });

  it("apagar post: staff apaga qualquer post", () => {
    expect(podeApagarPost(prof)).toBe(true); // spec §4
    expect(podeApagarPost(admin)).toBe(true);
    expect(podeApagarPost(aluno)).toBe(false);
  });
});

describe("cursor", () => {
  it("ida e volta (UTF-8 incluído)", () => {
    const c = codificarCursor("2026-10-26T12:00:00.123456+00:00", "4f1c…uuid");
    expect(descodificarCursor(c)).toEqual({ criadoEm: "2026-10-26T12:00:00.123456+00:00", id: "4f1c…uuid" });
  });

  it("devolve null perante lixo", () => {
    expect(descodificarCursor("lixo")).toBeNull();
  });
});

describe("caminhoNoBucket", () => {
  it("extrai o caminho dentro do bucket feed", () => {
    expect(caminhoNoBucket("https://x.supabase.co/storage/v1/object/public/feed/abc/1.webp")).toBe("abc/1.webp");
  });

  it("ignora outros buckets", () => {
    expect(caminhoNoBucket("https://x.supabase.co/storage/v1/object/public/galeria/abc/1.webp")).toBeNull();
  });
});
