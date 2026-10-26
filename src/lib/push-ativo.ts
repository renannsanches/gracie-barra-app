/**
 * Dev, e2e e produção partilham a mesma BD e as mesmas chaves VAPID.
 * Só a produção (VERCEL_ENV === "production") pode enviar push.
 */
export function pushAtivo(vercelEnv: string | undefined): boolean {
  return vercelEnv === "production";
}
