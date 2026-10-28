"use client";

import { useEffect, useRef } from "react";

type Props = { texto: string };

export function MensalidadeVencidaBanner({ texto }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Publica a altura em --banner-h para o que também fica preso ao topo (ex.: pílulas do
  // Início) ficar por baixo do aviso em vez de ser tapado por ele
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const raiz = document.documentElement;
    const publicar = () => raiz.style.setProperty("--banner-h", `${el.offsetHeight}px`);
    publicar();
    const obs = new ResizeObserver(publicar);
    obs.observe(el);
    return () => {
      obs.disconnect();
      raiz.style.removeProperty("--banner-h");
    };
  }, []);

  return (
    <div ref={ref} className="sticky top-0 z-50 w-full bg-amber-50 dark:bg-amber-500/15 border-b border-amber-200 dark:border-amber-500/30 shadow-sm pt-safe">
      <div className="max-w-screen-md mx-auto flex items-center gap-3 px-4 py-3">
        <div
          className="shrink-0 w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-lg leading-none"
          aria-hidden="true"
        >
          !
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-amber-900 dark:text-amber-300 font-semibold text-[14px] leading-tight">
            Atenção!
          </p>
          <p className="text-amber-800 dark:text-amber-300 text-[13px] leading-snug mt-0.5">
            {texto}
          </p>
        </div>
        <a
          href="https://wa.me/14076941856"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-medium whitespace-nowrap"
        >
          Entrar em contato
        </a>
      </div>
    </div>
  );
}
