import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import type { AlunoCombo, CategoriaFinanceira, FormaPagamento, Fornecedor, LancamentoFinanceiro } from "@/lib/types";
import { LancamentoEditView } from "./LancamentoEditView";

export const dynamic = "force-dynamic";

export default async function LancamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: lanc, error } = await admin
    .from("lancamentos_financeiros")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !lanc) notFound();

  const [grupoRes, fornRes, clientRes, catRes, formaRes, alunosRes] = await Promise.all([
    lanc.grupo_id
      ? admin
          .from("lancamentos_financeiros")
          .select("id, parcela_numero, parcela_total, data_vencimento, valor, status")
          .eq("grupo_id", lanc.grupo_id)
          .order("parcela_numero")
      : Promise.resolve({ data: [] }),
    admin.from("fornecedores").select("*").eq("ativo", true).not("tipo", "eq", "cliente").order("nome"),
    admin.from("fornecedores").select("*").eq("ativo", true).eq("tipo", "cliente").order("nome"),
    admin.from("categorias_financeiras").select("*").eq("ativa", true).order("tipo").order("nome"),
    admin.from("formas_pagamento").select("*").eq("ativa", true).order("ordem"),
    admin.from("profiles").select("id, nome_completo, foto_url").eq("perfil", "aluno").eq("status", "ativo").eq("sem_login", false).order("nome_completo"),
  ]);

  return (
    <LancamentoEditView
      lancamento={lanc as LancamentoFinanceiro}
      grupo={(grupoRes.data ?? []) as Array<Pick<LancamentoFinanceiro, "id" | "parcela_numero" | "parcela_total" | "data_vencimento" | "valor" | "status">>}
      fornecedores={(fornRes.data ?? []) as Fornecedor[]}
      clientes={(clientRes.data ?? []) as Fornecedor[]}
      alunos={(alunosRes.data ?? []) as AlunoCombo[]}
      categorias={(catRes.data ?? []) as CategoriaFinanceira[]}
      formasPagamento={(formaRes.data ?? []) as FormaPagamento[]}
    />
  );
}
