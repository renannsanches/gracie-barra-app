import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FinanceiroTabs } from "./FinanceiroTabs";

export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("perfil")
    .eq("id", user.id)
    .single();

  if (profile?.perfil !== "admin") redirect("/admin");

  return (
    <>
      <FinanceiroTabs />
      {children}
    </>
  );
}
