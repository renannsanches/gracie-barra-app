"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Newspaper } from "lucide-react";
import { toast } from "sonner";
import type { PaginaFeed, PostFeed, Sessao } from "@/lib/feed";
import { carregarMaisPosts } from "./membro-actions";
import { PostCard } from "./PostCard";

// Junta a página nova à lista sem repetir posts (um post novo publicado entre pedidos
// empurra os outros e o mesmo id pode vir em duas páginas)
function juntar(lista: PostFeed[], novos: PostFeed[]): PostFeed[] {
  const vistos = new Set(lista.map((p) => p.id));
  return [...lista, ...novos.filter((p) => !vistos.has(p.id))];
}

export function FeedLista({ paginaInicial, sessao }: { paginaInicial: PaginaFeed; sessao: Sessao }) {
  const [posts, setPosts] = useState<PostFeed[]>(paginaInicial.posts);
  const [cursor, setCursor] = useState<string | null>(paginaInicial.cursor);
  const [aCarregar, setACarregar] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const sentinela = useRef<HTMLDivElement>(null);
  // Guarda contra pedidos simultâneos e cursor actual sem depender do render
  const carregandoRef = useRef(false);
  const cursorRef = useRef<string | null>(paginaInicial.cursor);

  const carregarMais = useCallback(async () => {
    const actual = cursorRef.current;
    if (carregandoRef.current || !actual) return;
    carregandoRef.current = true;
    setACarregar(true);
    setFalhou(false);
    try {
      const r = await carregarMaisPosts(actual);
      if (r.ok) {
        cursorRef.current = r.pagina.cursor;
        setPosts((lista) => juntar(lista, r.pagina.posts));
        setCursor(r.pagina.cursor);
      } else {
        setFalhou(true);
        toast.error(r.erro);
      }
    } catch {
      setFalhou(true);
      toast.error("Sem ligação. Tenta outra vez.");
    } finally {
      carregandoRef.current = false;
      setACarregar(false);
    }
  }, []);

  // Um observador por cursor: depois de cada página, se o sentinela continuar à vista,
  // o novo observador dispara logo e pede a seguinte. Sem cursor, não há mais páginas.
  useEffect(() => {
    if (!cursor || falhou) return;
    const el = sentinela.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) void carregarMais();
      },
      { rootMargin: "600px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, falhou, carregarMais]);

  const tirar = useCallback((id: string) => {
    setPosts((lista) => lista.filter((p) => p.id !== id));
  }, []);

  if (posts.length === 0 && !cursor) {
    return (
      <div data-testid="feed" className="rounded-2xl border border-line bg-surface px-6 py-10 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Newspaper size={22} aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-fg">A academia ainda não publicou nada</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-fg-muted">
          Quando houver graduações, competições ou fotos do treino, aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="feed" className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} sessao={sessao} onApagado={tirar} />
      ))}

      {cursor && <div ref={sentinela} aria-hidden="true" className="h-px" />}

      {aCarregar && (
        <div role="status" className="flex justify-center py-4 text-fg-muted">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          <span className="sr-only">A carregar mais publicações</span>
        </div>
      )}

      {falhou && cursor && !aCarregar && (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={() => void carregarMais()}
            className="h-11 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-fg transition-colors duration-fast hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Tentar outra vez
          </button>
        </div>
      )}

      {!cursor && posts.length > 0 && (
        <p className="py-2 text-center text-xs text-fg-muted">Não há mais publicações.</p>
      )}
    </div>
  );
}
