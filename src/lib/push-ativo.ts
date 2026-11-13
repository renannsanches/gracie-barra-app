/**
 * Dev e e2e usam o staging (T2), mas as chaves VAPID são as mesmas da produção.
 * Só a produção (VERCEL_ENV === "production") pode enviar push.
 */
export function pushAtivo(vercelEnv: string | undefined): boolean {
  return vercelEnv === "production";
}
