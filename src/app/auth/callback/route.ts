import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "recovery" | "signup" | "email" | null;
  const rawNext = searchParams.get("next") ?? "/perfil";
  // Prevent open redirect: only allow relative paths
  const next = rawNext.startsWith("/") ? rawNext : "/perfil";

  // Recuperação por token_hash: NÃO gastar o token num GET. Scanners de email
  // (Gmail, Outlook SafeLinks) abrem o link antes do aluno e invalidariam o token.
  // A página /nova-senha mostra "Continuar" e só o clique chama verifyOtp.
  if (token_hash && type === "recovery") {
    const destino = new URL("/nova-senha", origin);
    destino.searchParams.set("token_hash", token_hash);
    destino.searchParams.set("type", "recovery");
    return NextResponse.redirect(destino);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cookieStore.set(name, value, options as any)
          );
        },
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Falha no fluxo de recuperação (código PKCE inválido ou de outro browser):
  // levar o aluno a pedir um link novo, não ao login.
  if (next === "/nova-senha") {
    return NextResponse.redirect(`${origin}/esqueci-senha?erro=link`);
  }

  return NextResponse.redirect(`${origin}/login?erro=confirmacao`);
}
