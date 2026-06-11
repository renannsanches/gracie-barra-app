import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, DependentePerfil } from "@/lib/types";
import { PresencaView } from "./PresencaView";

export default async function PresencaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: dependentesData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("dependentes")
      .select("dependente:profiles!dependentes_dependente_id_fkey(id, nome_completo, foto_url, faixa, graus, categoria)")
      .eq("responsavel_id", user.id),
  ]);

  const dependentes: DependentePerfil[] = (dependentesData ?? [])
    .map((d) => d.dependente as unknown as DependentePerfil)
    .filter(Boolean);

  return <PresencaView profile={profile as Profile} dependentes={dependentes} />;
}
