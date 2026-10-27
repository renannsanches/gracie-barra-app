import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RankingView } from "./RankingView";
import { carregarRanking } from "./dados";

export default async function RankingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <RankingView {...(await carregarRanking(supabase, user.id))} />;
}
