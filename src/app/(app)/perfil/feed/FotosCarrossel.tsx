"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Fotos do post: deslizar na horizontal com snap; pontos por baixo só com mais de uma foto,
// sincronizados com o scroll. O espaço fica reservado (aspect 4/5) para não haver saltos.
export function FotosCarrossel({ fotos, alt }: { fotos: string[]; alt: string }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [activa, setActiva] = useState(0);
  const varias = fotos.length > 1;

  function aoDeslizar() {
    const el = trilho.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    // O React ignora o set quando o valor não muda
    setActiva(Math.min(Math.max(i, 0), fotos.length - 1));
  }

  if (fotos.length === 0) return null;

  return (
    <div>
      <div
        ref={trilho}
        onScroll={varias ? aoDeslizar : undefined}
        role={varias ? "region" : undefined}
        aria-roledescription={varias ? "carrossel" : undefined}
        aria-label={varias ? `Fotos (${fotos.length})` : undefined}
        tabIndex={varias ? 0 : undefined}
        className={cn(
          "flex overflow-x-auto snap-x snap-mandatory scrollbar-none rounded-xl overscroll-x-contain",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        )}
      >
        {fotos.map((url, i) => (
          <div key={`${i}:${url}`} className="relative snap-center shrink-0 w-full aspect-[4/5] overflow-hidden rounded-xl bg-canvas">
            <Image
              src={url}
              alt={varias ? `${alt} — foto ${i + 1} de ${fotos.length}` : alt}
              fill
              sizes="(max-width: 640px) 100vw, 480px"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {varias && (
        <div aria-hidden="true" className="mt-2 flex justify-center gap-1.5">
          {fotos.map((url, i) => (
            <span
              key={`${i}:${url}`}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors duration-fast",
                i === activa ? "bg-brand" : "bg-line",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
