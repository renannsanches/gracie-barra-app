import { createAdminClient } from "@/lib/supabase/admin";
import type { Fornecedor } from "@/lib/types";
import { FornecedoresView } from "./FornecedoresView";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("fornecedores")
    .select("*")
    .not("tipo", "eq", "cliente")   // clientes têm tab própria
    .order("ativo", { ascending: false })
    .order("nome", { ascending: true });

  return <FornecedoresView fornecedores={(data ?? []) as Fornecedor[]} />;
}
