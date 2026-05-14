import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabaseResponse.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const publicPaths = ["/login", "/cadastro", "/tablet/login", "/auth/callback", "/esqueci-senha", "/nova-senha"];

  if (!user && !publicPaths.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/tablet") ? "/tablet/login" : "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated users on regular login pages → go to /perfil (unless profile is incomplete)
  // /tablet/login is intentionally excluded here — the page handles its own redirect
  // Server actions (POST with Next-Action header) must not be redirected
  const isServerAction = request.headers.has("next-action");
  if (user && ["/login", "/cadastro"].includes(pathname) && !isServerAction) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome_completo")
      .eq("id", user.id)
      .single();

    const perfilCompleto = !!(profile?.nome_completo);

    if (perfilCompleto) {
      const url = request.nextUrl.clone();
      url.pathname = "/perfil";
      return NextResponse.redirect(url);
    }

    // Incomplete profile on /login → send to /cadastro to finish onboarding
    if (pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/cadastro";
      return NextResponse.redirect(url);
    }

    // Incomplete profile on /cadastro → allow them to stay and complete Step 3
  }

  return supabaseResponse;
}
