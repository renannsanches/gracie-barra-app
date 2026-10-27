import Link from "next/link";
import Image from "next/image";
import { Images, ImageIcon } from "lucide-react";
import type { AlbumResumo } from "./dados";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AlbunsGrid({ albuns }: { albuns: AlbumResumo[] }) {
  if (albuns.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center mt-2">
        <Images size={36} className="text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Nenhum álbum disponível</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animar-lista">
      {albuns.map((album) => (
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
  );
}
