import { notFound, redirect } from "next/navigation";
import { Images } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import type { Album, Foto } from "@/lib/types";
import { GaleriaAlbumView } from "./GaleriaAlbumView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GaleriaAlbumPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: album }, { data: fotos }] = await Promise.all([
    supabase.from("albuns").select("*").eq("id", id).single(),
    supabase
      .from("fotos")
      .select("*")
      .eq("album_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!album) notFound();

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <PageHeader
        title={(album as Album).titulo}
        icon={<Images size={20} />}
        back={{ href: "/perfil?tab=galeria", label: "Galeria" }}
        subtitle={
          <>
            {(album as Album).descricao && <p className="mt-0.5">{(album as Album).descricao}</p>}
            <p className="text-white/40 text-xs mt-1">
              {(fotos ?? []).length} foto{(fotos ?? []).length !== 1 ? "s" : ""}
            </p>
          </>
        }
      />

      <div className="flex-1 px-4 py-5 pb-bottom-nav">
        <GaleriaAlbumView album={album as Album} fotos={(fotos ?? []) as Foto[]} />
      </div>
    </div>
  );
}
