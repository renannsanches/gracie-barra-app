import { createAdminClient } from "@/lib/supabase/admin";
import { listarGrupos } from "@/lib/grupos";
import { listarModalidades } from "@/lib/modalidades";
import { createClient } from "@/lib/supabase/server";
import { FinanceiroView } from "./FinanceiroView";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("perfil").eq("id", user.id).single();
    if (profile?.perfil !== "admin") redirect("/admin");
  }

  const admin = createAdminClient();

  const [{ data }, grupos, modalidades] = await Promise.all([
    admin
      .from("mensalidades")
      .select("*, profiles(nome_completo, grupo_id)")
      .order("mes_referencia", { ascending: false })
      .order("data_vencimento", { ascending: false }),
    listarGrupos(admin),
    listarModalidades(admin),
  ]);

  return <FinanceiroView mensalidades={data ?? []} grupos={grupos} modalidades={modalidades} />;
}
