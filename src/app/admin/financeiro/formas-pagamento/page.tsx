import { createAdminClient } from "@/lib/supabase/admin";
import type { FormaPagamento } from "@/lib/types";
import { FormasPagamentoView } from "./FormasPagamentoView";

export const dynamic = "force-dynamic";

export default async function FormasPagamentoPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("formas_pagamento")
    .select("*")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  return <FormasPagamentoView formas={(data ?? []) as FormaPagamento[]} />;
}
