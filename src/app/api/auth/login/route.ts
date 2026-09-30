import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { PerfilUsuario } from "@/lib/types";

export type LoginErro = "credenciais" | "nao_confirmado" | "perfil" | "generico";

/**
 * Login por Route Handler em vez de Server Action.
 *
 * Motivo: em WebKit antigo (Safari 15 do iPad da recepção) o caminho das Server
 * Actions + router RSC não estabelecia sessão — o cookie não chegava ao pedido
 * seguinte e o middleware devolvia o utilizador ao ecrã de login. Um POST normal
 * com Set-Cookie do servidor, seguido de navegação dura no cliente, é o caminho
 * mais compatível. Também evita o corte de 7 dias que o ITP do Safari aplica a
 * cookies escritos via document.cookie.
 *
 * Aceita dois formatos, de propósito:
 *  - application/json            → responde JSON (caminho normal, com JavaScript)
 *  - application/x-www-form-...  → responde com redirect (submissão nativa do
 *                                  <form>, funciona mesmo se o JS do cliente
 *                                  morrer — que é o que acontece no iPad)
 */
export async function POST(request: NextRequest) {
  const ehFormulario = !(request.headers.get("content-type") ?? "").includes("application/json");

  let email = "";
  let password = "";
  let perfilEsperado: PerfilUsuario | null = null;
  let destino = "/perfil";

  try {
    if (ehFormulario) {
      const form = await request.formData();
      email = String(form.get("email") ?? "");
      password = String(form.get("senha") ?? "");
      perfilEsperado = (form.get("perfilEsperado") as PerfilUsuario | null) || null;
      destino = caminhoSeguro(form.get("destino"));
    } else {
      const body = await request.json();
      email = typeof body.email === "string" ? body.email : "";
      password = typeof body.password === "string" ? body.password : "";
      perfilEsperado =
        typeof body.perfilEsperado === "string" ? (body.perfilEsperado as PerfilUsuario) : null;
      destino = caminhoSeguro(body.destino);
    }
  } catch {
    return responder(request, ehFormulario, perfilEsperado, "generico");
  }

  email = email.trim().toLowerCase();

  if (!email || !password) {
    return responder(request, ehFormulario, perfilEsperado, "credenciais");
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

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const tipo: LoginErro = error?.message.includes("Email not confirmed")
      ? "nao_confirmado"
      : "credenciais";
    return responder(request, ehFormulario, perfilEsperado, tipo);
  }

  // Verificação de perfil server-side (ex.: só a conta do tablet entra em /tablet)
  if (perfilEsperado) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("perfil")
      .eq("id", data.user.id)
      .single();

    if (profile?.perfil !== perfilEsperado) {
      await supabase.auth.signOut();
      return responder(request, ehFormulario, perfilEsperado, "perfil");
    }
  }

  if (ehFormulario) {
    // 303 força o browser a seguir com GET — sem isto reenviava o POST
    return NextResponse.redirect(new URL(destino, request.url), 303);
  }

  return NextResponse.json({ ok: true });
}

/** Evita open redirect: só caminhos relativos deste site. */
function caminhoSeguro(valor: unknown): string {
  return typeof valor === "string" && valor.startsWith("/") && !valor.startsWith("//")
    ? valor
    : "/perfil";
}

function responder(
  request: NextRequest,
  ehFormulario: boolean,
  perfilEsperado: PerfilUsuario | null,
  tipoErro: LoginErro
) {
  if (!ehFormulario) {
    return NextResponse.json({ ok: false, tipoErro }, { status: 200 });
  }

  const url = new URL(perfilEsperado === "tablet" ? "/tablet/login" : "/login", request.url);
  url.searchParams.set("erro", tipoErro);
  return NextResponse.redirect(url, 303);
}
