import type { LoginErro } from "@/app/api/auth/login/route";

export type { LoginErro };

export type RespostaLogin = { ok: boolean; tipoErro?: LoginErro };

const CHAVE_ERRO = "gb:ultimo-erro-login";

/**
 * Autentica via Route Handler (POST normal, Set-Cookie do servidor).
 * Ver src/app/api/auth/login/route.ts para o porquê de não ser Server Action.
 */
export async function autenticar(
  email: string,
  password: string,
  perfilEsperado?: "tablet"
): Promise<RespostaLogin> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, perfilEsperado }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} em /api/auth/login`);

  return (await res.json()) as RespostaLogin;
}

export function mensagemErroLogin(tipoErro?: LoginErro): string {
  switch (tipoErro) {
    case "nao_confirmado":
      return "Email ainda não confirmado. Verifica a tua caixa de entrada e confirma o registo.";
    case "perfil":
      return "Esta conta não tem permissão de acesso ao tablet.";
    default:
      return "Email ou senha incorretos.";
  }
}

/**
 * Guarda o erro antes de navegar/recarregar. Num dispositivo onde a página se
 * recarrega sozinha (service worker, WebKit antigo) a mensagem desaparecia sem
 * deixar rasto — isto garante que reaparece no ecrã de login.
 */
export function guardarErroLogin(mensagem: string) {
  try {
    sessionStorage.setItem(CHAVE_ERRO, mensagem);
  } catch {
    // sessionStorage indisponível (modo privado antigo) — erro só fica em memória
  }
}

export function consumirErroLogin(): string | null {
  try {
    const mensagem = sessionStorage.getItem(CHAVE_ERRO);
    if (mensagem) sessionStorage.removeItem(CHAVE_ERRO);
    return mensagem;
  } catch {
    return null;
  }
}
