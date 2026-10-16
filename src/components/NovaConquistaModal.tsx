"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Medalha } from "@/components/Medalha";
import { CONQUISTAS_POR_CODIGO } from "@/lib/gamificacao";
import { marcarConquistasVistas } from "@/app/(app)/conquistas/conquistas-actions";

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
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center px-4"
      onClick={fechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nova-conquista-titulo"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 pt-8 animate-in fade-in zoom-in-95 duration-300"
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
                <span className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-[15px] font-bold text-gray-600">
                  +{lista.length - 3}
                </span>
              )}
            </>
          )}
        </div>

        <h2 id="nova-conquista-titulo" className="mt-5 text-center text-[19px] font-bold text-gray-900">
          {titulo}
        </h2>
        <p className="mt-2 text-center text-[14px] leading-snug text-gray-600">{texto}</p>

        <button
          type="button"
          onClick={() => {
            fechar();
            router.push("/conquistas");
          }}
          className="mt-6 w-full py-3 rounded-xl bg-gb-blue hover:bg-gb-blue-dark text-white text-[15px] font-semibold transition-colors"
        >
          Ver conquistas
        </button>
        <button
          type="button"
          onClick={fechar}
          className="mt-2 w-full py-2 text-[14px] text-gray-500 hover:text-gray-700"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
