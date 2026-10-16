"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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

  const fechar = () => setAberto(false);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent className="max-w-sm pt-8">
        <div
          className="mx-auto w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-2xl leading-none"
          aria-hidden="true"
        >
          !
        </div>
        <DialogTitle className="mt-4 text-center text-[17px] font-semibold">
          Mensalidade em atraso
        </DialogTitle>
        <DialogDescription className="mt-2 text-center text-[14px] leading-snug text-gray-600">
          {mensagem}
        </DialogDescription>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={fechar}
            className="w-full py-3 rounded-xl border border-gray-200 text-gray-700 text-[15px] font-medium hover:bg-gray-50 transition-colors duration-fast"
          >
            Fechar
          </button>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={fechar}
            className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5b] text-white text-center text-[15px] font-semibold transition-colors duration-fast"
          >
            Falar com Simone
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
