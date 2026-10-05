"use client";

import { useEffect, useState } from "react";
import { Award, X } from "lucide-react";

const STORAGE_KEY = "graduacao-modal-ultima-semana";

// Segunda-feira da semana actual (data local, YYYY-MM-DD)
function segundaDaSemana(): string {
  const d = new Date();
  const diasDesdeSegunda = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diasDesdeSegunda);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function GraduacaoAptosModal() {
  const [aberto, setAberto] = useState(false);

  // Mostra no máximo 1x por semana (por dispositivo), no 1º acesso a partir de segunda
  useEffect(() => {
    const semana = segundaDaSemana();
    try {
      if (localStorage.getItem(STORAGE_KEY) === semana) return;
      localStorage.setItem(STORAGE_KEY, semana);
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
        <p className="mt-2 text-center text-[14px] leading-snug text-gray-600">
          Olá, professor. Existem alunos que atingiram os requisitos de tempo e
          estão aptos a graduar. Não se esqueça de conferir.
        </p>

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
