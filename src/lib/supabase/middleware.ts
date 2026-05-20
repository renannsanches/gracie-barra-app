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
  const publicPaths = ["/login", "/cadastro", "/tablet/login", "/auth/callback", "/esqueci-senha", "/nova-senha", "/api/push/send"];

  if (!user && !publicPaths.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/tablet") ? "/tablet/login" : "/login";
    return NextResponse.redirect(url);
  }

  // Server actions must never be redirected
  const isServerAction = request.headers.has("next-action");

  // Flag set in user_metadata during signUp(); cleared after Step 3 is completed.
  // Using session data avoids an extra DB round-trip and is immune to RLS/trigger timing issues.
  const inOnboarding = user?.user_metadata?.onboarding === true;

  // While onboarding is in progress: block every app page except /cadastro itself
  if (user && inOnboarding && !isServerAction
      && pathname !== "/cadastro"
      && !pathname.startsWith("/tablet")
      && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/cadastro";
    return NextResponse.redirect(url);
  }

  // Authenticated users who finished onboarding, landing on auth pages → send to app
  // /tablet/login is excluded — that page handles its own redirect
  if (user && !inOnboarding && ["/login", "/cadastro"].includes(pathname) && !isServerAction) {
    const url = request.nextUrl.clone();
    url.pathname = "/perfil";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
