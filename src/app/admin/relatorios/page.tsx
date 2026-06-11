import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RelatoriosView } from "./RelatoriosView";
import { getTurmasParaRelatorio, getCategoriasParaRelatorio } from "./actions";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("perfil")
    .eq("id", user.id)
    .single();

  if (profile?.perfil !== "admin") redirect("/admin");

  const [turmas, categorias] = await Promise.all([
    getTurmasParaRelatorio(),
    getCategoriasParaRelatorio(),
  ]);

  return <RelatoriosView turmas={turmas} categorias={categorias} />;
}
