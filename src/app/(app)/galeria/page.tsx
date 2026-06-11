import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Images, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function GaleriaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: albuns } = await supabase
    .from("albuns")
    .select("id, titulo, descricao, capa_url, created_at")
    .order("created_at", { ascending: false });

  const albumIds = (albuns ?? []).map((a) => a.id);
  const semCapa = (albuns ?? []).filter((a) => !a.capa_url).map((a) => a.id);

  const countMap = new Map<string, number>();
  const fallbackCoverMap = new Map<string, string>();

  if (albumIds.length > 0) {
    const { data: todasFotos } = await supabase
      .from("fotos")
      .select("album_id, url")
      .in("album_id", albumIds)
      .order("created_at", { ascending: true });

    for (const f of todasFotos ?? []) {
      countMap.set(f.album_id, (countMap.get(f.album_id) ?? 0) + 1);
      if (semCapa.includes(f.album_id) && !fallbackCoverMap.has(f.album_id)) {
        fallbackCoverMap.set(f.album_id, f.url);
      }
    }
  }

  const lista = (albuns ?? []).map((a) => ({
    ...a,
    capa: a.capa_url ?? fallbackCoverMap.get(a.id) ?? null,
    total: countMap.get(a.id) ?? 0,
  }));

  return (
    <div className="min-h-screen flex flex-col bg-gb-gray">
      <div className="bg-gb-black px-6 pt-10 pb-6">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/perfil"
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            Perfil
          </Link>
          <div className="flex items-center gap-2">
            <img src="/logo.webp" alt="Gracie Barra" className="w-7 h-7 object-contain" />
            <span className="text-white font-bold text-xs tracking-wide">GRACIE BARRA</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Images size={20} className="text-gb-blue" />
          <h1 className="text-white font-bold text-xl">Galeria</h1>
        </div>
        <p className="text-white/50 text-sm mt-0.5">
          {lista.length} álbum{lista.length !== 1 ? "ns" : ""}
        </p>
      </div>

      <div className="flex-1 px-4 py-5 pb-8">
        {lista.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center mt-2">
            <Images size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum álbum disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {lista.map((album) => (
              <Link
                key={album.id}
                href={`/galeria/${album.id}`}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="relative aspect-square bg-gray-100">
                  {album.capa ? (
                    <Image
                      src={album.capa}
                      alt={album.titulo}
                      fill
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon size={32} className="text-gray-200" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-gray-900 text-sm leading-snug truncate">
                    {album.titulo}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-400">
                      {album.total} foto{album.total !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-gray-300">{formatDate(album.created_at)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
