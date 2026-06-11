import { createAdminClient } from "@/lib/supabase/admin";
import type { Fornecedor } from "@/lib/types";
import { ClientesView } from "./ClientesView";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("fornecedores")
    .select("*")
    .eq("tipo", "cliente")
    .order("ativo", { ascending: false })
    .order("nome", { ascending: true });

  return <ClientesView clientes={(data ?? []) as Fornecedor[]} />;
}
