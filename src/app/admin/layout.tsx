import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "./AdminSidebar";
import { FeedbackHosts } from "@/components/FeedbackHosts";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("perfil")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.perfil !== "admin" && profile.perfil !== "professor")) {
    redirect("/perfil");
  }

  return (
    <div className="min-h-screen bg-gb-gray">
      <AdminSidebar perfil={profile.perfil as "admin" | "professor"} />
      <div className="md:ml-56 flex flex-col min-h-screen">
        {children}
      </div>
      <FeedbackHosts />
    </div>
  );
}
