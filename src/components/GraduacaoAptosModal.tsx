"use client";

import { useEffect, useState } from "react";
import { Award, X } from "lucide-react";
import { marcarAvisoGraduacaoVisto } from "@/app/(app)/perfil/aviso-graduacao-actions";

// Janela já mostrada nesta sessão — evita reabrir ao voltar a /perfil (cache do router)
let janelaMostrada: string | null = null;

// O servidor só renderiza este modal se a conta ainda não viu a janela actual
// (2x por semana: 1º acesso a partir de segunda e a partir de quinta)
export function GraduacaoAptosModal({ janela }: { janela: string }) {
  const [aberto, setAberto] = useState(() => janelaMostrada !== janela);

  useEffect(() => {
    if (janelaMostrada === janela) return;
    janelaMostrada = janela;
    void marcarAvisoGraduacaoVisto(janela);
  }, [janela]);

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
        aria-labelledby="graduacao-aptos-titulo"
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
          className="mx-auto w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center"
          aria-hidden="true"
        >
          <Award size={24} />
        </div>
        <h2
          id="graduacao-aptos-titulo"
          className="mt-4 text-center text-[17px] font-semibold text-gray-900"
        >
          Alunos aptos a graduar
        </h2>
        <div className="mt-2 space-y-3 text-center text-[14px] leading-snug text-gray-600">
          <p>Olá, professor.</p>
          <p>
            Existem alunos que atingiram os requisitos de tempo e estão aptos a
            graduar. Não se esqueça de conferir.
          </p>
          <p>
            Alunos que já foram graduados precisam ter sua graduação registrada
            na aplicação para uma contagem correta do período até a próxima
            graduação.
          </p>
        </div>

        <button
          type="button"
          onClick={fechar}
          className="mt-6 w-full py-3 rounded-xl bg-gb-blue hover:bg-gb-blue-dark text-white text-[15px] font-semibold transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}
