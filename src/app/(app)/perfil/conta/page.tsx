import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Mensalidade } from "@/lib/types";
import { ContaView } from "./ContaView";

export default async function ContaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: mensalidades }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("mensalidades")
      .select("*")
      .eq("aluno_id", user.id)
      .order("mes_referencia", { ascending: false }),
  ]);

  return (
    <ContaView
      profile={profile as Profile | null}
      email={user.email ?? ""}
      mensalidades={(mensalidades ?? []) as Mensalidade[]}
    />
  );
}
