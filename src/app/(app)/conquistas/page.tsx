import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConquistasView } from "./ConquistasView";
import { carregarConquistas } from "./dados";

export default async function ConquistasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <ConquistasView pessoas={await carregarConquistas(supabase, user.id)} />;
}
