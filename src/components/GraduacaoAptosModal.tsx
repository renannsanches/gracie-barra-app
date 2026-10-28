"use client";

import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { marcarAvisoGraduacaoVisto } from "@/app/(app)/perfil/aviso-graduacao-actions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent aria-describedby={undefined} className="max-w-sm pt-8">
        <div
          className="mx-auto w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center"
          aria-hidden="true"
        >
          <Award size={24} />
        </div>
        <DialogTitle className="mt-4 text-center text-[17px] font-semibold">
          Alunos aptos a graduar
        </DialogTitle>
        <div className="mt-2 space-y-3 text-center text-[14px] leading-snug text-fg-muted">
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
          onClick={() => setAberto(false)}
          className="mt-6 w-full py-3 rounded-xl bg-gb-blue hover:bg-gb-blue-dark text-white text-[15px] font-semibold transition-colors duration-fast active:scale-[0.98]"
        >
          OK
        </button>
      </DialogContent>
    </Dialog>
  );
}
