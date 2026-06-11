import { createAdminClient } from "@/lib/supabase/admin";
import type { AlunoCombo, CategoriaFinanceira, Fornecedor } from "@/lib/types";
import { NovoLancamentoForm } from "./NovoLancamentoForm";

export const dynamic = "force-dynamic";

export default async function NovoLancamentoPage() {
  const admin = createAdminClient();
  const [fornRes, clientRes, catRes, alunosRes] = await Promise.all([
    admin.from("fornecedores").select("*").eq("ativo", true).not("tipo", "eq", "cliente").order("nome"),
    admin.from("fornecedores").select("*").eq("ativo", true).eq("tipo", "cliente").order("nome"),
    admin.from("categorias_financeiras").select("*").eq("ativa", true).order("tipo").order("nome"),
    admin.from("profiles").select("id, nome_completo, foto_url").eq("perfil", "aluno").eq("status", "ativo").eq("sem_login", false).order("nome_completo"),
  ]);

  return (
    <NovoLancamentoForm
      fornecedores={(fornRes.data ?? []) as Fornecedor[]}
      clientes={(clientRes.data ?? []) as Fornecedor[]}
      alunos={(alunosRes.data ?? []) as AlunoCombo[]}
      categorias={(catRes.data ?? []) as CategoriaFinanceira[]}
    />
  );
}
