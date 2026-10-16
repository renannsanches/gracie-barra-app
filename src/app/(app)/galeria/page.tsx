import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Images, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";

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
      <PageHeader
        title="Galeria"
        icon={<Images size={20} />}
        back={{ href: "/perfil", label: "Início" }}
        subtitle={`${lista.length} álbum${lista.length !== 1 ? "ns" : ""}`}
      />

      <div className="flex-1 px-4 py-5 pb-bottom-nav">
        {lista.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center mt-2">
            <Images size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum álbum disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animar-lista">
            {lista.map((album) => (
              <Link
                key={album.id}
                href={`/galeria/${album.id}`}
                className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-[box-shadow,transform] duration-fast ease-out-expo active:scale-[0.98]"
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
