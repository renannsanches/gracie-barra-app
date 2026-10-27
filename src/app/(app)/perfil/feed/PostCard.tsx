"use client";

import { useRef, useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ERRO_POST_INEXISTENTE, tempoRelativo, type PostFeed, type Sessao } from "@/lib/feed";
import { alternarCurtida } from "./membro-actions";
import { AvatarAutor, CurtidasSheet } from "./CurtidasSheet";
import { ComentariosSheet } from "./ComentariosSheet";
import { FotosCarrossel } from "./FotosCarrossel";

const PILULA =
  "inline-flex h-11 items-center rounded-full bg-canvas text-sm font-semibold tabular-nums text-fg transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function PostCard({
  post,
  sessao,
  onApagado,
}: {
  post: PostFeed;
  sessao: Sessao;
  onApagado: (id: string) => void;
}) {
  const [curtiEu, setCurtiEu] = useState(post.curtiEu);
  const [curtidas, setCurtidas] = useState(post.curtidas);
  const [comentarios, setComentarios] = useState(post.comentarios);
  // Enquanto a acção corre o coração ignora toques (o ref cobre dois toques no mesmo frame)
  const [aGuardar, setAGuardar] = useState(false);
  const aGuardarRef = useRef(false);
  const [sheet, setSheet] = useState<"curtidas" | "comentarios" | null>(null);
  // Fixado na montagem: o servidor e o cliente podem diferir uns segundos (ver suppressHydrationWarning)
  const [agora] = useState(() => new Date());

  function postSumiu() {
    setSheet(null);
    onApagado(post.id);
  }

  function falha(erro: string) {
    toast.error(erro);
    if (erro === ERRO_POST_INEXISTENTE) postSumiu();
  }

  async function alternar() {
    if (aGuardarRef.current) return;
    aGuardarRef.current = true;
    setAGuardar(true);

    const antes = { curtiEu, curtidas };
    setCurtiEu(!antes.curtiEu);
    setCurtidas(Math.max(0, antes.curtidas + (antes.curtiEu ? -1 : 1)));

    try {
      const r = await alternarCurtida(post.id);
      if (r.ok) {
        // O total vem sempre do servidor (outros podem ter gostado entretanto)
        setCurtiEu(r.curtiu);
        setCurtidas(r.total);
      } else {
        setCurtiEu(antes.curtiEu);
        setCurtidas(antes.curtidas);
        falha(r.erro);
      }
    } catch {
      setCurtiEu(antes.curtiEu);
      setCurtidas(antes.curtidas);
      toast.error("Sem ligação. Tenta outra vez.");
    } finally {
      aGuardarRef.current = false;
      setAGuardar(false);
    }
  }

  const quando = tempoRelativo(post.criadoEm, agora);

  return (
    <article data-testid="post" className="rounded-2xl border border-line bg-surface p-4">
      <header className="flex items-center gap-3">
        <AvatarAutor autor={post.autor} className="h-8 w-8" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-fg">{post.autor.nome}</p>
          <p className="text-xs text-fg-muted">
            <time dateTime={post.criadoEm} suppressHydrationWarning>
              {quando}
            </time>
            {post.editadoEm && " · editado"}
          </p>
        </div>
      </header>

      {post.texto && (
        <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-fg">{post.texto}</p>
      )}

      {post.fotos.length > 0 && (
        <div className="mt-3">
          <FotosCarrossel fotos={post.fotos} alt={`Publicação de ${post.autor.nome}`} />
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <div className="inline-flex items-center rounded-full bg-canvas">
          <button
            type="button"
            onClick={alternar}
            aria-label={curtiEu ? "Retirar gosto" : "Gostar"}
            aria-pressed={curtiEu}
            aria-busy={aGuardar}
            className={cn(PILULA, "group", curtidas > 0 ? "pl-3 pr-1.5" : "px-3", "hover:bg-line/60")}
          >
            <Heart
              size={20}
              aria-hidden="true"
              className={cn(
                "transition-transform duration-fast group-active:scale-90 motion-reduce:transition-none",
                curtiEu ? "fill-brand text-brand" : "text-fg",
              )}
            />
            {curtidas === 0 && <span className="ml-1.5">0</span>}
          </button>
          {curtidas > 0 && (
            <button
              type="button"
              onClick={() => setSheet("curtidas")}
              aria-label={`Ver quem gostou (${curtidas})`}
              className={cn(PILULA, "min-w-11 justify-center pl-1 pr-3 hover:bg-line/60")}
            >
              {curtidas}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSheet("comentarios")}
          aria-label="Ver comentários"
          className={cn(PILULA, "gap-1.5 px-3 hover:bg-line/60")}
        >
          <MessageCircle size={20} aria-hidden="true" />
          {comentarios}
        </button>
      </div>

      <CurtidasSheet
        postId={post.id}
        aberto={sheet === "curtidas"}
        onFechar={() => setSheet(null)}
        onPostApagado={postSumiu}
      />
      <ComentariosSheet
        postId={post.id}
        sessao={sessao}
        aberto={sheet === "comentarios"}
        onFechar={() => setSheet(null)}
        onTotal={setComentarios}
        onPostApagado={postSumiu}
      />
    </article>
  );
}
