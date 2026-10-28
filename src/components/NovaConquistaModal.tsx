"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Medalha } from "@/components/Medalha";
import { CONQUISTAS_POR_CODIGO } from "@/lib/gamificacao";
import { marcarConquistasVistas } from "@/app/(app)/conquistas/conquistas-actions";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export interface ConquistaPorVer {
  id: string;
  codigo: string;
  /** Primeiro nome do dependente; ausente quando é do próprio */
  dependente?: string;
}

// Já mostradas nesta sessão — evita reabrir ao voltar a /perfil (cache do router)
const mostradas = new Set<string>();

// O servidor só renderiza este modal quando há medalhas que ainda não foram vistas
// (do próprio ou dos dependentes). Abrir marca-as como vistas.
export function NovaConquistaModal({ conquistas }: { conquistas: ConquistaPorVer[] }) {
  const router = useRouter();
  const [lista] = useState(() => conquistas.filter((c) => !mostradas.has(c.id)));
  const [aberto, setAberto] = useState(lista.length > 0);

  useEffect(() => {
    if (lista.length === 0) return;
    for (const c of lista) mostradas.add(c.id);
    void marcarConquistasVistas(lista.map((c) => c.id));
  }, [lista]);

  if (lista.length === 0) return null;

  const fechar = () => setAberto(false);
  const uma = lista.length === 1 ? lista[0] : null;
  const def = uma ? CONQUISTAS_POR_CODIGO[uma.codigo] : null;
  const dependentes = [...new Set(lista.map((c) => c.dependente).filter(Boolean))];

  let titulo: string;
  let texto: string;
  if (uma) {
    titulo = "Nova medalha!";
    texto = uma.dependente
      ? `${uma.dependente} ganhou a medalha «${def?.titulo}». ${def?.descricao ?? ""}`
      : `Ganhaste a medalha «${def?.titulo}». ${def?.descricao ?? ""}`;
  } else {
    titulo = `${lista.length} novas medalhas!`;
    texto = dependentes.length > 0
      ? `Medalhas novas para ${lista.some((c) => !c.dependente) ? "ti, " : ""}${dependentes.join(", ")}.`
      : "Continua a treinar — cada aula conta.";
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent className="max-w-sm pt-8">
        <div className="flex justify-center items-center gap-2">
          {uma ? (
            <Medalha codigo={uma.codigo} tamanho="lg" className="animate-in zoom-in-50 spin-in-12 duration-500" />
          ) : (
            <>
              {lista.slice(0, 3).map((c, i) => (
                <Medalha
                  key={c.id}
                  codigo={c.codigo}
                  className="animate-in zoom-in-50 duration-500"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
              {lista.length > 3 && (
                <span className="w-14 h-14 rounded-full bg-subtle flex items-center justify-center text-[15px] font-bold text-fg-muted">
                  +{lista.length - 3}
                </span>
              )}
            </>
          )}
        </div>

        <DialogTitle className="mt-5 text-center text-[19px]">{titulo}</DialogTitle>
        <DialogDescription className="mt-2 text-center text-[14px] leading-snug text-fg-muted">{texto}</DialogDescription>

        <button
          type="button"
          onClick={() => {
            fechar();
            router.push("/conquistas");
          }}
          className="mt-6 w-full py-3 rounded-xl bg-gb-blue hover:bg-gb-blue-dark text-white text-[15px] font-semibold transition-colors duration-fast active:scale-[0.98]"
        >
          Ver conquistas
        </button>
        <button
          type="button"
          onClick={fechar}
          className="mt-2 w-full h-11 text-[14px] text-fg-muted hover:text-fg"
        >
          Fechar
        </button>
      </DialogContent>
    </Dialog>
  );
}
