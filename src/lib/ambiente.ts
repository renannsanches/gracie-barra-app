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

export function hostSupabase(url: string | undefined): string {
  const host = parse(url)?.hostname;
  if (!host) throw new Error("NEXT_PUBLIC_SUPABASE_URL em falta ou inválido");
  return host;
}
