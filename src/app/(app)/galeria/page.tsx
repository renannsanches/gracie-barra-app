import { redirect } from "next/navigation";
import { Images } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { AlbunsGrid } from "./AlbunsGrid";
import { carregarAlbuns } from "./dados";

export default async function GaleriaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const lista = await carregarAlbuns(supabase);

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <PageHeader
        title="Galeria"
        icon={<Images size={20} />}
        back={{ href: "/perfil", label: "Início" }}
        subtitle={`${lista.length} álbum${lista.length !== 1 ? "ns" : ""}`}
      />

      <div className="flex-1 px-4 py-5 pb-bottom-nav">
        <AlbunsGrid albuns={lista} />
      </div>
    </div>
  );
}
