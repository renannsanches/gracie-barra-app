import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Images } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
    <div className="min-h-screen flex flex-col bg-gb-gray">
      <div className="bg-gb-black px-6 pt-10 pb-6">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/galeria"
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            Galeria
          </Link>
          <div className="flex items-center gap-2">
            <img src="/logo.webp" alt="Gracie Barra" className="w-7 h-7 object-contain" />
            <span className="text-white font-bold text-xs tracking-wide">GRACIE BARRA</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Images size={20} className="text-gb-blue" />
          <h1 className="text-white font-bold text-xl">{(album as Album).titulo}</h1>
        </div>
        {(album as Album).descricao && (
          <p className="text-white/50 text-sm mt-1">{(album as Album).descricao}</p>
        )}
        <p className="text-white/40 text-xs mt-1">
          {(fotos ?? []).length} foto{(fotos ?? []).length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 px-4 py-5 pb-8">
        <GaleriaAlbumView album={album as Album} fotos={(fotos ?? []) as Foto[]} />
      </div>
    </div>
  );
}
