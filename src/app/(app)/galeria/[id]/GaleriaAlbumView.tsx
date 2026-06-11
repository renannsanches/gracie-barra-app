"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import type { Foto, Album } from "@/lib/types";

interface Props {
  album: Album;
  fotos: Foto[];
}

export function GaleriaAlbumView({ album, fotos }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const open = useCallback((idx: number) => setLightboxIndex(idx), []);
  const close = useCallback(() => setLightboxIndex(null), []);

  const prev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i - 1 + fotos.length) % fotos.length));
  }, [fotos.length]);

  const next = useCallback(() => {
    setLightboxIndex((i) => (i === null ? null : (i + 1) % fotos.length));
  }, [fotos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxIndex, close, prev, next]);

  const fotoAtiva = lightboxIndex !== null ? fotos[lightboxIndex] : null;

  return (
    <>
      {fotos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <ImageIcon size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma foto neste álbum</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {fotos.map((foto, idx) => (
            <button
              key={foto.id}
              type="button"
              onClick={() => open(idx)}
              className="group relative aspect-square bg-gray-100 rounded-xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-gb-blue"
            >
              <Image
                src={foto.url}
                alt={foto.legenda ?? `Foto ${idx + 1}`}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {foto.legenda && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">{foto.legenda}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {fotoAtiva && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onClick={close}
        >
          <div className="flex items-center justify-between px-4 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
            <p className="text-white/60 text-sm">
              {lightboxIndex + 1} / {fotos.length}
            </p>
            {fotoAtiva.legenda && (
              <p className="text-white/80 text-sm flex-1 text-center px-4 truncate">{fotoAtiva.legenda}</p>
            )}
            <button
              type="button"
              onClick={close}
              className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center relative min-h-0" onClick={(e) => e.stopPropagation()}>
            {fotos.length > 1 && (
              <button
                type="button"
                onClick={prev}
                className="absolute left-2 z-10 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Anterior"
              >
                <ChevronLeft size={32} />
              </button>
            )}

            <div className="relative w-full h-full">
              <Image
                src={fotoAtiva.url}
                alt={fotoAtiva.legenda ?? `Foto ${lightboxIndex + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
                priority
              />
            </div>

            {fotos.length > 1 && (
              <button
                type="button"
                onClick={next}
                className="absolute right-2 z-10 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Próxima"
              >
                <ChevronRight size={32} />
              </button>
            )}
          </div>

          {fotos.length > 1 && (
            <div
              className="shrink-0 flex justify-center gap-1.5 py-4 px-4 overflow-x-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {fotos.map((f, idx) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  className={`relative w-12 h-12 shrink-0 rounded-lg overflow-hidden transition-all ${
                    idx === lightboxIndex
                      ? "ring-2 ring-white ring-offset-1 ring-offset-black opacity-100"
                      : "opacity-40 hover:opacity-70"
                  }`}
                  aria-label={`Ir para foto ${idx + 1}`}
                >
                  <Image
                    src={f.url}
                    alt={f.legenda ?? `Foto ${idx + 1}`}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
