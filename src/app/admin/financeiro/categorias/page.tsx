import { createAdminClient } from "@/lib/supabase/admin";
import type { CategoriaFinanceira } from "@/lib/types";
import { CategoriasView } from "./CategoriasView";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("categorias_financeiras")
    .select("*")
    .order("tipo", { ascending: true })
    .order("nome", { ascending: true });

  return <CategoriasView categorias={(data ?? []) as CategoriaFinanceira[]} />;
}
