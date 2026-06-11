import { createAdminClient } from "@/lib/supabase/admin";
import { ContasView, type LancamentoComRefs } from "./ContasView";
import { recalcularStatusVencidos } from "./actions";
import type { AlunoCombo, CategoriaFinanceira, FormaPagamento, Fornecedor, Mensalidade } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ContasPage() {
  // Recalcula status "atrasado" antes de listar
  await recalcularStatusVencidos();

  const admin = createAdminClient();
  const [lancRes, fornRes, clientRes, catRes, formaRes, mensRes, alunosRes] = await Promise.all([
    admin
      .from("lancamentos_financeiros")
      .select("*, fornecedores(nome), profiles!lancamentos_financeiros_aluno_id_fkey(nome_completo), categorias_financeiras(nome, parent_id), formas_pagamento(nome)")
      .order("data_vencimento", { ascending: false })
      .limit(500),
    // Só fornecedores (não clientes)
    admin.from("fornecedores").select("*").eq("ativo", true).not("tipo", "eq", "cliente").order("nome"),
    // Clientes externos
    admin.from("fornecedores").select("*").eq("ativo", true).eq("tipo", "cliente").order("nome"),
    admin.from("categorias_financeiras").select("*").eq("ativa", true).order("nome"),
    admin.from("formas_pagamento").select("*").eq("ativa", true).order("ordem"),
    // Mensalidades pendentes/atrasadas para KPI combinado
    admin
      .from("mensalidades")
      .select("id, mes_referencia, data_vencimento, valor, status")
      .in("status", ["pendente", "atrasado"]),
    // Alunos activos para o combo A Receber
    admin
      .from("profiles")
      .select("id, nome_completo, foto_url")
      .eq("perfil", "aluno")
      .eq("status", "ativo")
      .eq("sem_login", false)
      .order("nome_completo"),
  ]);

  return (
    <ContasView
      lancamentos={(lancRes.data ?? []) as LancamentoComRefs[]}
      fornecedores={(fornRes.data ?? []) as Fornecedor[]}
      clientes={(clientRes.data ?? []) as Fornecedor[]}
      categorias={(catRes.data ?? []) as CategoriaFinanceira[]}
      formasPagamento={(formaRes.data ?? []) as FormaPagamento[]}
      mensalidadesPendentes={(mensRes.data ?? []) as Pick<Mensalidade, "id" | "mes_referencia" | "data_vencimento" | "valor" | "status">[]}
      alunos={(alunosRes.data ?? []) as AlunoCombo[]}
    />
  );
}
