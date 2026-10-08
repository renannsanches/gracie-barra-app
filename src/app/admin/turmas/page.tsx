import { createAdminClient } from "@/lib/supabase/admin";
import { TurmasView } from "./TurmasView";
import { listarModalidades } from "@/lib/modalidades";

export default async function TurmasPage() {
  const admin = createAdminClient();

  const [{ data: turmas }, modalidades] = await Promise.all([
    admin
      .from("turmas")
      .select("*, professor:profiles(id, nome_completo)")
      .order("nome"),
    listarModalidades(admin),
  ]);

  return (
    <TurmasView
      turmas={(turmas ?? []) as Parameters<typeof TurmasView>[0]["turmas"]}
      modalidades={modalidades}
    />
  );
}
