import { redirect } from "next/navigation";
import { Megaphone, Pin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { AvisosMarkRead } from "@/components/AvisosMarkRead";
import type { Aviso } from "@/lib/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function AvisosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("avisos")
    .select("*")
    .eq("publicado", true)
    .order("fixado", { ascending: false })
    .order("created_at", { ascending: false });

  const avisos = (data ?? []) as Aviso[];

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <AvisosMarkRead />
      <PageHeader
        title="Avisos"
        icon={<Megaphone size={20} />}
        subtitle={`${avisos.length} aviso${avisos.length !== 1 ? "s" : ""}`}
      />

      <div className="flex-1 px-4 py-5 pb-bottom-nav space-y-3 animar-lista">
        {avisos.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-line p-10 text-center">
            <Megaphone size={36} className="text-line mx-auto mb-3" />
            <p className="text-fg-muted font-medium">Nenhum aviso no momento</p>
          </div>
        ) : (
          avisos.map((a) => (
            <div key={a.id} className="bg-surface rounded-2xl border border-line p-5">
              <div className="flex items-start gap-2 mb-2 flex-wrap">
                <h2 className="font-bold text-fg text-base leading-snug flex-1">{a.titulo}</h2>
                {a.fixado && (
                  <Badge className="bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs px-2 py-0.5 shrink-0">
                    <Pin size={10} className="mr-1 inline" />
                    Fixado
                  </Badge>
                )}
              </div>
              <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">{a.conteudo}</p>
              <p className="text-xs text-fg-subtle mt-3">{formatDate(a.created_at)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
