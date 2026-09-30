import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TabletLoginForm } from "./TabletLoginForm";

const MENSAGENS: Record<string, string> = {
  credenciais: "Email ou senha incorretos.",
  perfil: "Esta conta não tem permissão de acesso ao tablet.",
  nao_confirmado: "Email ainda não confirmado.",
  generico: "Não foi possível entrar. Tenta novamente.",
};

export default async function TabletLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const erroInicial = erro ? MENSAGENS[erro] ?? MENSAGENS.generico : "";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("perfil")
      .eq("id", user.id)
      .single();

    if (profile?.perfil === "tablet") redirect("/tablet");
  }

  return (
    <div className="min-h-screen bg-gb-black flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <img src="/logo.webp" alt="Gracie Barra" className="h-20 w-auto object-contain mx-auto mb-4" />
          <h1 className="text-white font-bold text-2xl">Tablet Academia</h1>
          <p className="text-white/50 text-sm mt-1">Entre com a conta do tablet</p>
        </div>
        <TabletLoginForm erroInicial={erroInicial} />
      </div>
    </div>
  );
}
