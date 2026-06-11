import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  // Verify caller is admin or professor
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, erro: "Não autenticado" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("perfil")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.perfil !== "admin" && profile.perfil !== "professor")) {
    return NextResponse.json({ ok: false, erro: "Sem permissão" }, { status: 403 });
  }

  let userId: string;
  try {
    ({ userId } = await req.json() as { userId: string });
  } catch {
    return NextResponse.json({ ok: false, erro: "Body inválido" }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json({ ok: false, erro: "userId obrigatório" }, { status: 400 });
  }

  // Try to delete auth user; ignore "not found" so orphan profiles can still be removed
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authError && !authError.message.toLowerCase().includes("not found")) {
    return NextResponse.json({ ok: false, erro: authError.message }, { status: 500 });
  }

  // Always delete profile row directly (handles orphans + cases where cascade isn't set)
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", userId);
  if (profileError) {
    return NextResponse.json({ ok: false, erro: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
