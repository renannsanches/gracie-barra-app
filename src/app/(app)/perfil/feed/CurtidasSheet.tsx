"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ERRO_POST_INEXISTENTE, type AutorFeed } from "@/lib/feed";
import { listarCurtidas } from "./membro-actions";

const ERRO_LIGACAO = "Sem ligação. Tenta outra vez.";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

// Avatar de quem aparece no feed (autor do post, quem gostou, quem comentou). <img> e não
// next/image: os avatares são sobrescritos no upload (mesmo URL). O logo da academia (autor
// null) fica inteiro (contain); as fotos de pessoas enchem o círculo.
export function AvatarAutor({ autor, className }: { autor: AutorFeed; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-xs font-semibold text-brand",
        className,
      )}
    >
      {autor.foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={autor.foto}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn("h-full w-full", autor.id === null ? "bg-surface object-contain" : "object-cover")}
        />
      ) : (
        <span aria-hidden="true">{iniciais(autor.nome)}</span>
      )}
    </span>
  );
}

// Montado só com a sheet aberta (o Radix desmonta o conteúdo ao fechar), por isso cada
// abertura começa a carregar de novo.
function ListaCurtidas({
  postId,
  onFalha,
}: {
  postId: string;
  onFalha: (erro: string) => void;
}) {
  const [pessoas, setPessoas] = useState<AutorFeed[] | null>(null);
  const falhar = useEffectEvent(onFalha);

  useEffect(() => {
    let vivo = true;
    listarCurtidas(postId)
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setPessoas(r.pessoas);
        else falhar(r.erro);
      })
      .catch(() => {
        if (vivo) falhar(ERRO_LIGACAO);
      });
    return () => {
      vivo = false;
    };
  }, [postId]);

  if (pessoas === null) {
    return (
      <div role="status" aria-label="A carregar" className="space-y-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex min-h-12 items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (pessoas.length === 0) {
    return <p className="py-6 text-center text-sm text-fg-muted">Ainda ninguém gostou desta publicação.</p>;
  }

  return (
    <ul className="space-y-1">
      {pessoas.map((p, i) => (
        <li key={p.id ?? `academia-${i}`} className="flex min-h-12 items-center gap-3">
          <AvatarAutor autor={p} className="h-9 w-9" />
          <span className="truncate text-sm font-medium text-fg">{p.nome}</span>
        </li>
      ))}
    </ul>
  );
}

export function CurtidasSheet({
  postId,
  aberto,
  onFechar,
  onPostApagado,
}: {
  postId: string;
  aberto: boolean;
  onFechar: () => void;
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
      <DialogContent variant="sheet" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-fg">Gostos</DialogTitle>
        </DialogHeader>
        <ListaCurtidas postId={postId} onFalha={falhou} />
      </DialogContent>
    </Dialog>
  );
}
