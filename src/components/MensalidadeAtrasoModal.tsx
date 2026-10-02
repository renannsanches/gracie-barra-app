"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "mensalidade-modal-ultimo-dia";
const WHATSAPP_URL = `https://wa.me/14076941856?text=${encodeURIComponent(
  "Olá, Simone, gostaria de regularizar minha mensalidade",
)}`;

type Props = { mensagem: string };

function hojeLocal(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function MensalidadeAtrasoModal({ mensagem }: Props) {
  const [aberto, setAberto] = useState(false);

  // Mostra no máximo 1x por dia (por dispositivo)
  useEffect(() => {
    const hoje = hojeLocal();
    try {
      if (localStorage.getItem(STORAGE_KEY) === hoje) return;
      localStorage.setItem(STORAGE_KEY, hoje);
    } catch {
      // localStorage indisponível — mostra na mesma
    }
    setAberto(true);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [aberto]);

  if (!aberto) return null;

  const fechar = () => setAberto(false);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center px-4"
      onClick={fechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mensalidade-atraso-titulo"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 pt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={fechar}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          aria-label="Fechar"
        >
          <X size={14} />
        </button>

        <div
          className="mx-auto w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-2xl leading-none"
          aria-hidden="true"
        >
          !
        </div>
        <h2
          id="mensalidade-atraso-titulo"
          className="mt-4 text-center text-[17px] font-semibold text-gray-900"
        >
          Mensalidade em atraso
        </h2>
        <p className="mt-2 text-center text-[14px] leading-snug text-gray-600">
          {mensagem}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={fechar}
            className="w-full py-3 rounded-xl border border-gray-200 text-gray-700 text-[15px] font-medium hover:bg-gray-50 transition-colors"
          >
            Fechar
          </button>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={fechar}
            className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5b] text-white text-center text-[15px] font-semibold transition-colors"
          >
            Falar com Simone
          </a>
        </div>
      </div>
    </div>
  );
}
