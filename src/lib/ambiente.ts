/**
 * Em que projecto Supabase estamos (T2).
 * Dev local, E2E e previews usam o staging; só a Vercel de produção usa a produção.
 * Sem imports: é usado por next.config.ts e por e2e/global-setup.ts.
 */

export const REF_PRODUCAO = "fjqiyilzxxyoyposqsfz";

function parse(url: string | undefined): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Ref do projecto em `https://<ref>.supabase.co`; null noutro formato. */
export function refDoProjeto(url: string | undefined): string | null {
  const host = parse(url)?.hostname.toLowerCase();
  const m = host?.match(/^([a-z0-9]+)\.supabase\.co$/);
  return m ? m[1] : null;
}

export function eProducao(url: string | undefined): boolean {
  return refDoProjeto(url) === REF_PRODUCAO;
}

/** O E2E escreve na BD: nunca contra a produção. */
export function exigirForaDeProducao(url: string | undefined): void {
  if (eProducao(url)) {
    throw new Error(
      `E2E recusado: NEXT_PUBLIC_SUPABASE_URL aponta para a produção (${REF_PRODUCAO}). Usar o staging.`
    );
  }
}

/**
 * O E2E faz login pelo servidor em BASE_URL: tem de ser local ou um preview
 * (os previews usam o staging). Nunca o domínio de produção.
 */
export function exigirBaseUrlDeTeste(url: string | undefined): void {
  const host = parse(url ?? "http://localhost:3000")?.hostname.toLowerCase();
  const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  const preview = !!host && /^gracie-barra-[a-z0-9-]+-renannsanches\.vercel\.app$/.test(host);
  if (!local && !preview) {
    throw new Error("E2E recusado: BASE_URL não é um servidor local nem um preview da Vercel.");
  }
}

/**
 * Prova que o servidor testado usa o mesmo projecto que o global-setup:
 * o cookie de sessão do @supabase/ssr chama-se sb-<ref>-auth-token (ou .0, .1… em pedaços).
 */
export function temSessaoDoProjeto(nomesCookies: string[], supabaseUrl: string | undefined): boolean {
  const ref = refDoProjeto(supabaseUrl);
  if (!ref) return false;
  const nome = `sb-${ref}-auth-token`;
  return nomesCookies.some((c) => c === nome || c.startsWith(`${nome}.`));
}

export function hostSupabase(url: string | undefined): string {
  const host = parse(url)?.hostname;
  if (!host) throw new Error("NEXT_PUBLIC_SUPABASE_URL em falta ou inválido");
  return host;
}

/** Pedidos ao projecto Supabase configurado (service worker: NetworkOnly). */
export function padraoSupabase(url: string | undefined): RegExp {
  const host = hostSupabase(url).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^https://${host}/.*`, "i");
}
