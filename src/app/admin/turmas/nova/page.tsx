import { createAdminClient } from "@/lib/supabase/admin";
import { NovaTurmaForm } from "./NovaTurmaForm";
import { listarModalidadesRotuladas } from "@/lib/modalidades";

export default async function NovaTurmaPage() {
  const admin = createAdminClient();

  const [{ data: professores }, modalidades] = await Promise.all([
    admin
      .from("profiles")
      .select("id, nome_completo")
      .in("perfil", ["professor", "admin"])
      .order("nome_completo"),
    listarModalidadesRotuladas(admin),
  ]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <NovaTurmaForm
        professores={(professores ?? []) as { id: string; nome_completo: string }[]}
        modalidades={modalidades}
      />
    </div>
  );
}
