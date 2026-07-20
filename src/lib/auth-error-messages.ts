import type { AuthError } from "@supabase/supabase-js";

export type AuthErrorContext =
  | "signup"
  | "verify-otp"
  | "resend-otp"
  | "login"
  | "reset-password-request"
  | "reset-password-confirm"
  | "update-email";

const CODE_MESSAGES: Record<string, string> = {
  weak_password:
    "Senha demasiado fraca. Usa pelo menos 6 caracteres e evita palavras óbvias (nomes, datas).",
  user_already_exists: "Este email já está registado. Tenta iniciar sessão.",
  email_exists: "Este email já está registado. Tenta iniciar sessão.",
  over_email_send_rate_limit:
    "Demasiados pedidos seguidos. Aguarda alguns minutos e tenta novamente.",
  over_request_rate_limit:
    "Demasiadas tentativas. Aguarda alguns minutos e tenta novamente.",
  over_sms_send_rate_limit:
    "Demasiados pedidos seguidos. Aguarda alguns minutos e tenta novamente.",
  otp_expired: "Código expirado. Pede um novo código.",
  invalid_otp: "Código incorreto. Verifica e tenta novamente.",
  email_not_confirmed: "Email ainda não confirmado. Verifica a tua caixa de entrada.",
  same_password: "A nova senha tem de ser diferente da atual.",
  session_not_found: "Sessão ou link expirado. Solicita um novo.",
  refresh_token_not_found: "Sessão ou link expirado. Solicita um novo.",
  signup_disabled: "Registos temporariamente desativados. Contacta a academia.",
  email_address_invalid: "Endereço de email inválido.",
  validation_failed: "Dados inválidos. Verifica os campos e tenta novamente.",
};

const DEFAULT_MESSAGES: Record<AuthErrorContext, string> = {
  signup: "Erro ao enviar código. Tenta novamente.",
  "verify-otp": "Código incorreto ou expirado. Tenta novamente.",
  "resend-otp": "Erro ao reenviar código. Tenta novamente.",
  login: "Email ou senha incorretos.",
  "reset-password-request": "Erro ao enviar email. Tenta novamente.",
  "reset-password-confirm": "Erro ao atualizar senha. O link pode ter expirado — solicita um novo.",
  "update-email": "Erro ao atualizar email. Tenta novamente.",
};

export function getAuthErrorMessage(
  error: AuthError | Error | null | undefined,
  context: AuthErrorContext,
): string {
  if (!error) return DEFAULT_MESSAGES[context];

  const code = "code" in error ? (error as AuthError).code : undefined;
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  const message = error.message ?? "";
  if (/email.*(already|exists|registad)/i.test(message)) {
    return CODE_MESSAGES.user_already_exists;
  }
  if (/rate limit/i.test(message)) {
    return CODE_MESSAGES.over_request_rate_limit;
  }
  if (/password.*(weak|short|least)/i.test(message)) {
    return CODE_MESSAGES.weak_password;
  }
  if (/expired/i.test(message)) {
    return CODE_MESSAGES.otp_expired;
  }

  return DEFAULT_MESSAGES[context];
}
