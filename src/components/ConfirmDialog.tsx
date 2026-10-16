"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AlertDialog } from "radix-ui";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/*
 * Substituto do window.confirm():
 *
 *   if (!(await confirmar({ titulo: "Apagar aviso?", destrutivo: true }))) return;
 *
 * Um único <ConfirmHost /> (montado pelos layouts (app) e admin via
 * <FeedbackHosts />) mostra o pedido actual. Sem host montado cai para o
 * window.confirm nativo, para nunca ficar uma promessa pendurada.
 */

export type OpcoesConfirmacao = {
  titulo: string;
  descricao?: React.ReactNode;
  /** Texto do botão de confirmar. Default: "Confirmar" (ou "Apagar" se destrutivo) */
  confirmar?: string;
  /** Texto do botão de cancelar. Default: "Cancelar" */
  cancelar?: string;
  /** Botão de confirmar a vermelho */
  destrutivo?: boolean;
};

type Pedido = OpcoesConfirmacao & { resolver: (ok: boolean) => void };

let pedido: Pedido | null = null;
// O último pedido continua visível durante a animação de saída
let ultimo: Pedido | null = null;
let hostsMontados = 0;
const ouvintes = new Set<() => void>();

function emitir() {
  ouvintes.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
  ouvintes.add(cb);
  return () => ouvintes.delete(cb);
}

export function confirmar(opcoes: OpcoesConfirmacao): Promise<boolean> {
  if (hostsMontados === 0) {
    const texto = [opcoes.titulo, typeof opcoes.descricao === "string" ? opcoes.descricao : ""]
      .filter(Boolean)
      .join("\n\n");
    return Promise.resolve(window.confirm(texto));
  }
  return new Promise((resolver) => {
    pedido?.resolver(false);
    pedido = { ...opcoes, resolver };
    ultimo = pedido;
    emitir();
  });
}

function responder(ok: boolean) {
  if (!pedido) return;
  const p = pedido;
  pedido = null;
  emitir();
  p.resolver(ok);
}

export function ConfirmHost() {
  const atual = useSyncExternalStore(subscribe, () => pedido, () => null);

  useEffect(() => {
    hostsMontados++;
    return () => {
      hostsMontados--;
      responder(false);
    };
  }, []);

  const p = atual ?? ultimo;
  const destrutivo = p?.destrutivo ?? false;

  return (
    <AlertDialog.Root open={atual !== null} onOpenChange={(aberto) => !aberto && responder(false)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-base data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-fast" />
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center p-4">
          <AlertDialog.Content className="pointer-events-auto w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-base data-[state=open]:ease-out-expo data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-fast">
            <AlertDialog.Title className="text-lg font-bold text-gray-900 leading-snug">
              {p?.titulo}
            </AlertDialog.Title>
            {p?.descricao ? (
              <AlertDialog.Description className="mt-2 text-sm text-gray-500 leading-relaxed">
                {p.descricao}
              </AlertDialog.Description>
            ) : (
              <AlertDialog.Description className="sr-only">{p?.titulo}</AlertDialog.Description>
            )}
            <div className="mt-6 flex gap-2">
              <AlertDialog.Cancel className={cn(buttonVariants({ variant: "secondary" }), "flex-1")}>
                {p?.cancelar ?? "Cancelar"}
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className={cn(buttonVariants({ variant: destrutivo ? "destructive" : "default" }), "flex-1")}
                onClick={() => responder(true)}
              >
                {p?.confirmar ?? (destrutivo ? "Apagar" : "Confirmar")}
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
