import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { listarGrupos } from "@/lib/grupos";
import { listarModalidades } from "@/lib/modalidades";
import { NovoAlunoForm } from "./NovoAlunoForm";

export default async function NovoAlunoPage() {
  const supabase = createAdminClient();

  const [{ data }, grupos, modalidades] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome_completo")
      .or("sem_login.is.null,sem_login.eq.false")
      .eq("status", "ativo")
      .order("nome_completo"),
    listarGrupos(supabase),
    listarModalidades(supabase),
  ]);

  const alunosComLogin = (data ?? []) as { id: string; nome_completo: string }[];

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/alunos"
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Alunos
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Novo aluno</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Cria conta de acesso e cadastra os dados do aluno
        </p>
      </div>

      <NovoAlunoForm alunosComLogin={alunosComLogin} grupos={grupos} modalidades={modalidades} />
    </div>
  );
}
