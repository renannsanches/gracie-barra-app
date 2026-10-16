// Interpretação do resultado de registrar_presenca_por_token no tablet (lógica pura).
//
// A RPC em produção devolve jsonb { sucesso, mensagem, alunos: [...] }; a versão antiga
// (migrations do repo) devolvia TABLE(sucesso, mensagem, aluno_*). Aceitam-se as duas.
// Token inválido, já usado ou expirado vêm como sucesso=false — não como erro do PostgREST.
// O bloqueio financeiro vem como excepção ('mensalidade_bloqueada').
import type { CorFaixa } from "@/lib/types";

export interface AlunoInfo {
  nome_completo: string;
  foto_url: string | null;
  cor_faixa: CorFaixa | null;
  graus: number;
}

export interface ErroInfo {
  titulo: string;
  mensagem: string;
}

interface AlunoRpc {
  aluno_nome?: string | null;
  aluno_foto?: string | null;
  aluno_faixa?: CorFaixa | null;
  aluno_graus?: number | null;
}

interface ResultadoRpc extends AlunoRpc {
  sucesso?: boolean;
  mensagem?: string | null;
  alunos?: AlunoRpc[] | null;
}

const FALHA_GENERICA = "Não foi possível registrar a presença.";

/** Título e texto do ecrã vermelho, a partir da mensagem da RPC ou da excepção. */
export function erroDoRegisto(texto: string, code = "", fallback = FALHA_GENERICA): ErroInfo {
  const msg = texto.toLowerCase();
  if (msg.includes("mensalidade_bloqueada") || msg.includes("falar com simone")) {
    return { titulo: "Presença Não Registada", mensagem: "Não foi possível registar presença. Falar com Simone." };
  }
  if (msg.includes("expir")) {
    return { titulo: "QR Code Expirado", mensagem: "O código expirou. Peça ao aluno gerar um novo." };
  }
  if (msg.includes("utilizado") || msg.includes("usado") || msg.includes("used")) {
    return { titulo: "QR Code Já Usado", mensagem: "Este código já foi lido. Peça ao aluno gerar um novo." };
  }
  if (code === "23505" || msg.includes("já registr") || msg.includes("already") || msg.includes("duplicate")) {
    return { titulo: "Já Registrado", mensagem: "Presença já registrada hoje para este aluno." };
  }
  if (msg.includes("inválid") || msg.includes("invalid") || msg.includes("não encontr") || msg.includes("not found")) {
    return { titulo: "QR Code Inválido", mensagem: "Código não reconhecido. Peça ao aluno gerar um novo." };
  }
  return { titulo: "Não Registrado", mensagem: fallback };
}

export function interpretarResultadoQr(
  data: unknown,
  error: { message?: string; code?: string } | null,
): { ok: true; alunos: AlunoInfo[] } | { ok: false; erro: ErroInfo } {
  if (error) return { ok: false, erro: erroDoRegisto(error.message ?? "", error.code ?? "") };

  const res = (Array.isArray(data) ? data[0] : data) as ResultadoRpc | null | undefined;
  if (!res?.sucesso) {
    const texto = res?.mensagem ?? "";
    return { ok: false, erro: erroDoRegisto(texto, "", texto || FALHA_GENERICA) };
  }

  // QR de família traz vários alunos
  const alunos = (res.alunos ?? [res])
    .filter((a): a is AlunoRpc & { aluno_nome: string } => !!a.aluno_nome)
    .map((a) => ({
      nome_completo: a.aluno_nome,
      foto_url: a.aluno_foto ?? null,
      cor_faixa: a.aluno_faixa ?? null,
      graus: a.aluno_graus ?? 0,
    }));
  return { ok: true, alunos };
}
