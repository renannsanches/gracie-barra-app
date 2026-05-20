import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }

  let body: { endpoint: string; p256dh: string; auth: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Body inválido" }, { status: 400 });
  }

  const { endpoint, p256dh, auth } = body;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ erro: "Campos obrigatórios em falta" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: "user_id,endpoint" }
    );

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
