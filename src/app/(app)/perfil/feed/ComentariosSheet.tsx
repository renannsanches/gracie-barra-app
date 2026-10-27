"use client";

import { useEffect, useEffectEvent, useId, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmar } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import {
  ERRO_POST_INEXISTENTE,
  LIMITE_COMENTARIO,
  contarCaracteres,
  podeApagarComentario,
  tempoRelativo,
  validarComentario,
  type ComentarioFeed,
  type Sessao,
} from "@/lib/feed";
import { apagarComentario, comentar, listarComentarios } from "./membro-actions";
import { AvatarAutor } from "./CurtidasSheet";

const ERRO_LIGACAO = "Sem ligação. Tenta outra vez.";

// Montado só com a sheet aberta (o Radix desmonta o conteúdo ao fechar): cada abertura
// volta a carregar a lista.
function Conversa({
  postId,
  sessao,
  onTotal,
  onFalha,
}: {
  postId: string;
  sessao: Sessao;
  onTotal: (n: number) => void;
  onFalha: (erro: string) => void;
}) {
  const [comentarios, setComentarios] = useState<ComentarioFeed[] | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [aApagar, setAApagar] = useState<string | null>(null);
  // Fixado ao abrir: o tempo relativo não muda enquanto a sheet está aberta
  const [agora] = useState(() => new Date());
  const idCampo = useId();
  const idAjuda = useId();

  const falhar = useEffectEvent(onFalha);
  const sincronizarTotal = useEffectEvent(onTotal);

  useEffect(() => {
    let vivo = true;
    listarComentarios(postId)
      .then((r) => {
        if (!vivo) return;
        if (r.ok) {
          setComentarios(r.comentarios);
          // O número do card pode estar desactualizado: acerta-se com o que veio do servidor
          sincronizarTotal(r.comentarios.length);
        } else {
          falhar(r.erro);
        }
      })
      .catch(() => {
        if (vivo) falhar(ERRO_LIGACAO);
      });
    return () => {
      vivo = false;
    };
  }, [postId]);

  const caracteres = contarCaracteres(texto);
  const excede = caracteres > LIMITE_COMENTARIO;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (aEnviar) return;
    const v = validarComentario(texto);
    if (!v.ok) {
      setErro(v.erro);
      return;
    }
    setErro(null);
    setAEnviar(true);
    try {
      const r = await comentar(postId, v.texto);
      if (r.ok) {
        const lista = comentarios ?? [];
        const nova = lista.some((c) => c.id === r.comentario.id) ? lista : [...lista, r.comentario];
        setComentarios(nova);
        setTexto("");
        onTotal(nova.length);
      } else if (r.erro === ERRO_POST_INEXISTENTE) {
        onFalha(r.erro);
      } else {
        setErro(r.erro);
      }
    } catch {
      setErro(ERRO_LIGACAO);
    } finally {
      setAEnviar(false);
    }
  }

  async function apagar(c: ComentarioFeed) {
    if (aApagar) return;
    if (!(await confirmar({ titulo: "Apagar comentário?", destrutivo: true }))) return;
    setAApagar(c.id);
    try {
      const r = await apagarComentario(c.id);
      if (r.ok) {
        const nova = (comentarios ?? []).filter((x) => x.id !== c.id);
        setComentarios(nova);
        onTotal(nova.length);
        toast.success("Comentário apagado.");
      } else {
        toast.error(r.erro ?? "Não foi possível apagar o comentário.");
      }
    } catch {
      toast.error(ERRO_LIGACAO);
    } finally {
      setAApagar(null);
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {comentarios === null ? (
          <div role="status" aria-label="A carregar" className="space-y-4 py-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3.5 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : comentarios.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">Ainda não há comentários. Sê o primeiro.</p>
        ) : (
          <ul className="space-y-4 py-1">
            {comentarios.map((c) => {
              const podeApagar =
                c.podeApagar || (c.autor.id !== null && podeApagarComentario(sessao, c.autor.id));
              return (
                <li key={c.id} className="flex gap-3">
                  <AvatarAutor autor={c.autor} className="mt-0.5 h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold text-fg">{c.autor.nome}</span>{" "}
                      <time dateTime={c.criadoEm} className="text-xs text-fg-muted">
                        {tempoRelativo(c.criadoEm, agora)}
                      </time>
                    </p>
                    <p className="mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed text-fg">
                      {c.texto}
                    </p>
                  </div>
                  {podeApagar && (
                    <button
                      type="button"
                      onClick={() => apagar(c)}
                      disabled={aApagar !== null}
                      aria-label="Apagar comentário"
                      className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors duration-fast hover:bg-canvas hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
                    >
                      {aApagar === c.id ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 size={16} aria-hidden="true" />
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={enviar} noValidate className="mt-4 border-t border-line pt-4">
        <label htmlFor={idCampo} className="sr-only">
          Comentário
        </label>
        <textarea
          id={idCampo}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            if (erro) setErro(null);
          }}
          rows={2}
          placeholder="Escreve um comentário…"
          aria-invalid={erro !== null || excede}
          aria-describedby={idAjuda}
          className={cn(
            "block w-full resize-none rounded-2xl border bg-canvas px-4 py-3 text-base text-fg placeholder:text-fg-muted",
            "focus:outline-none focus:ring-2 focus:ring-brand/30",
            erro || excede ? "border-destructive" : "border-line focus:border-brand",
          )}
        />
        <div id={idAjuda} className="mt-2 flex items-start gap-3">
          <p role="alert" className="min-h-[1rem] flex-1 text-xs text-destructive">
            {erro}
          </p>
          <span
            className={cn("shrink-0 text-xs tabular-nums", excede ? "font-semibold text-brand" : "text-fg-muted")}
          >
            {`${caracteres}/${LIMITE_COMENTARIO}`}
          </span>
        </div>
        <button
          type="submit"
          disabled={aEnviar}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white transition-colors duration-fast hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {aEnviar && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Enviar
        </button>
      </form>
    </>
  );
}

export function ComentariosSheet({
  postId,
  sessao,
  aberto,
  onFechar,
  onTotal,
  onPostApagado,
}: {
  postId: string;
  sessao: Sessao;
  aberto: boolean;
  onFechar: () => void;
  onTotal: (n: number) => void;
  /** Chamado quando o servidor diz que o post já não existe (o card sai da lista) */
  onPostApagado?: () => void;
}) {
  function falhou(erro: string) {
    toast.error(erro);
    onFechar();
    if (erro === ERRO_POST_INEXISTENTE) onPostApagado?.();
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent variant="sheet" aria-describedby={undefined} className="flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-fg">Comentários</DialogTitle>
        </DialogHeader>
        <Conversa postId={postId} sessao={sessao} onTotal={onTotal} onFalha={falhou} />
      </DialogContent>
    </Dialog>
  );
}
