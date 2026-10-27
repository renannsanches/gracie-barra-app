"use client";

import { useId, useRef, useState } from "react";
import { DropdownMenu } from "radix-ui";
import { Heart, Loader2, MessageCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmar } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import {
  ERRO_POST_INEXISTENTE,
  podeApagarPost,
  podeEditarPost,
  tempoRelativo,
  type PostFeed,
  type Sessao,
} from "@/lib/feed";
import { alternarCurtida } from "./membro-actions";
import { apagarPost, type PostEditado } from "./staff-actions";
import { PostComposer } from "./PostComposer";
import { AvatarAutor, CurtidasSheet } from "./CurtidasSheet";
import { ComentariosSheet } from "./ComentariosSheet";
import { FotosCarrossel } from "./FotosCarrossel";

const ITEM_MENU =
  "flex h-11 cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-fast data-[highlighted]:bg-canvas";

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
  // Conteúdo editável: uma edição aplica-se aqui (a lista não remonta com o router.refresh)
  const [conteudo, setConteudo] = useState<Omit<PostEditado, "editadoEm"> & { editadoEm: string | null }>({
    texto: post.texto,
    fotos: post.fotos,
    editadoEm: post.editadoEm,
  });
  const [aEditar, setAEditar] = useState(false);
  const [aApagar, setAApagar] = useState(false);
  // Fixado na montagem: o servidor e o cliente podem diferir uns segundos (ver suppressHydrationWarning)
  const [agora] = useState(() => new Date());
  const idContagemComentarios = useId();

  function postSumiu() {
    setSheet(null);
    setAEditar(false);
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

  async function apagar() {
    if (aApagar) return;
    const ok = await confirmar({
      titulo: "Apagar publicação?",
      descricao: "Os gostos e os comentários também são apagados.",
      destrutivo: true,
    });
    if (!ok) return;
    setAApagar(true);
    try {
      const r = await apagarPost(post.id);
      if (r.ok) {
        toast.success("Publicação apagada");
        onApagado(post.id);
      } else {
        falha(r.erro ?? "Não foi possível apagar a publicação.");
      }
    } catch {
      toast.error("Sem ligação. Tenta outra vez.");
    } finally {
      setAApagar(false);
    }
  }

  const quando = tempoRelativo(post.criadoEm, agora);
  const podeEditar = podeEditarPost(sessao, post.autor.id);
  const podeApagar = podeApagarPost(sessao);

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
            {conteudo.editadoEm && " · editado"}
          </p>
        </div>
        {(podeEditar || podeApagar) && (
          // Não modal: abrir a sheet ou a confirmação a partir do menu não deixa o foco preso
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger
              aria-label="Opções da publicação"
              disabled={aApagar}
              className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors duration-fast hover:bg-canvas hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand data-[state=open]:bg-canvas disabled:opacity-50"
            >
              {aApagar ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <MoreHorizontal size={20} aria-hidden="true" />
              )}
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="z-50 min-w-40 rounded-xl border border-line bg-surface p-1 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
              >
                {podeEditar && (
                  <DropdownMenu.Item onSelect={() => setAEditar(true)} className={cn(ITEM_MENU, "text-fg")}>
                    <Pencil size={16} aria-hidden="true" />
                    Editar
                  </DropdownMenu.Item>
                )}
                {podeApagar && (
                  <DropdownMenu.Item onSelect={() => void apagar()} className={cn(ITEM_MENU, "text-destructive")}>
                    <Trash2 size={16} aria-hidden="true" />
                    Apagar
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </header>

      {conteudo.texto && (
        <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-fg">{conteudo.texto}</p>
      )}

      {conteudo.fotos.length > 0 && (
        <div className="mt-3">
          <FotosCarrossel fotos={conteudo.fotos} alt={`Publicação de ${post.autor.nome}`} />
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
          aria-describedby={idContagemComentarios}
          className={cn(PILULA, "gap-1.5 px-3 hover:bg-line/60")}
        >
          <MessageCircle size={20} aria-hidden="true" />
          <span aria-hidden="true">{comentarios}</span>
          {/* O nome acessível fica "Ver comentários"; a contagem chega como descrição */}
          <span id={idContagemComentarios} className="sr-only">
            {comentarios === 1 ? "1 comentário" : `${comentarios} comentários`}
          </span>
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
      {podeEditar && (
        <PostComposer
          aberto={aEditar}
          onFechar={() => setAEditar(false)}
          post={{ ...post, ...conteudo }}
          onGuardado={setConteudo}
          onPostApagado={postSumiu}
        />
      )}
    </article>
  );
}
