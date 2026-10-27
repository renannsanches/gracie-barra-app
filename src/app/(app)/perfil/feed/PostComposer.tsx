"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { comprimirFoto } from "@/lib/comprimir-imagem";
import { cn } from "@/lib/utils";
import {
  ERRO_POST_INEXISTENTE,
  LIMITE_ENVIO_BYTES,
  LIMITE_FOTOS,
  LIMITE_TEXTO_POST,
  contarCaracteres,
  validarPost,
  type PostFeed,
} from "@/lib/feed";
import { criarPost, editarPost, type PostEditado } from "./staff-actions";

const ERRO_LIGACAO = "Sem ligação. Tenta outra vez.";
const ERRO_MAX_FOTOS = `Máximo de ${LIMITE_FOTOS} fotos por publicação.`;
const ERRO_DEMASIADO_GRANDE = "As fotos ficam demasiado grandes para enviar de uma vez. Junta menos fotos.";

type FotoNova = { id: number; file: File; preview: string };

// Montado só com a sheet aberta (o Radix desmonta o conteúdo ao fechar): cada abertura começa
// do post (ou em branco) e as pré-visualizações são libertadas ao fechar.
function Formulario({
  post,
  aEnviar,
  setAEnviar,
  onFechar,
  onGuardado,
  onPostApagado,
}: {
  post?: PostFeed;
  aEnviar: boolean;
  setAEnviar: (v: boolean) => void;
  onFechar: () => void;
  onGuardado?: (dados: PostEditado) => void;
  onPostApagado?: () => void;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(post?.texto ?? "");
  // Fotos já guardadas que o post mantém, pela ordem actual
  const [mantidas, setMantidas] = useState<string[]>(post?.fotos ?? []);
  const [novas, setNovas] = useState<FotoNova[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const proximoId = useRef(0);
  const novasRef = useRef<FotoNova[]>([]);
  const ficheiro = useRef<HTMLInputElement>(null);
  const idCampo = useId();
  const idAjuda = useId();

  useEffect(() => {
    novasRef.current = novas;
  }, [novas]);

  // Ao fechar, liberta as pré-visualizações que ainda estiverem na grelha
  useEffect(() => () => novasRef.current.forEach((f) => URL.revokeObjectURL(f.preview)), []);

  const editar = post !== undefined;
  const totalFotos = mantidas.length + novas.length;
  const caracteres = contarCaracteres(texto);
  const excede = caracteres > LIMITE_TEXTO_POST;

  function juntar(lista: FileList | null) {
    const escolhidos = Array.from(lista ?? []);
    if (escolhidos.length === 0) return;
    const livres = LIMITE_FOTOS - totalFotos;
    const entram = escolhidos.slice(0, Math.max(0, livres)).map((file) => ({
      id: proximoId.current++,
      file,
      preview: URL.createObjectURL(file),
    }));
    if (entram.length) setNovas((prev) => [...prev, ...entram]);
    setErro(escolhidos.length > entram.length ? ERRO_MAX_FOTOS : null);
  }

  function removerNova(id: number) {
    setNovas((prev) => {
      const alvo = prev.find((f) => f.id === id);
      if (alvo) URL.revokeObjectURL(alvo.preview);
      return prev.filter((f) => f.id !== id);
    });
    setErro(null);
  }

  function removerMantida(url: string) {
    setMantidas((prev) => prev.filter((u) => u !== url));
    setErro(null);
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (aEnviar) return;
    const v = validarPost(texto, totalFotos);
    if (!v.ok) {
      setErro(v.erro);
      return;
    }
    setErro(null);
    setAEnviar(true);
    try {
      // Comprime tudo antes de enviar: se uma foto não se lê, não sai nada
      const blobs: Blob[] = [];
      for (const f of novas) {
        try {
          // WebP; JPEG nos browsers que não o geram (iPhone)
          blobs.push(await comprimirFoto(f.file, 1600, 0.82));
        } catch {
          setErro(`Não foi possível ler "${f.file.name}". Usa JPG ou PNG.`);
          return;
        }
      }
      if (blobs.reduce((soma, b) => soma + b.size, 0) > LIMITE_ENVIO_BYTES) {
        setErro(ERRO_DEMASIADO_GRANDE);
        return;
      }

      const fd = new FormData();
      fd.set("texto", v.texto);
      blobs.forEach((b, i) =>
        fd.append("fotos", new File([b], `foto-${i}.${b.type === "image/jpeg" ? "jpg" : "webp"}`, { type: b.type })),
      );

      if (editar) {
        fd.set("manter", JSON.stringify(mantidas));
        const r = await editarPost(post.id, fd);
        if (r.ok) {
          toast.success("Publicação actualizada");
          onGuardado?.(r.post);
          onFechar();
        } else if (r.erro === ERRO_POST_INEXISTENTE) {
          toast.error(r.erro);
          onFechar();
          onPostApagado?.();
        } else {
          setErro(r.erro);
        }
      } else {
        const r = await criarPost(fd);
        if (r.ok) {
          toast.success("Publicado");
          onFechar();
          // A lista remonta com a página nova (a key é o id do primeiro post)
          router.refresh();
        } else {
          setErro(r.erro ?? "Não foi possível publicar. Tenta outra vez.");
        }
      }
    } catch {
      setErro(ERRO_LIGACAO);
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <form onSubmit={submeter} noValidate>
      <label htmlFor={idCampo} className="sr-only">
        Texto da publicação
      </label>
      <textarea
        id={idCampo}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          if (erro) setErro(null);
        }}
        rows={5}
        placeholder="Escreve algo para a academia…"
        aria-invalid={excede}
        aria-describedby={idAjuda}
        className={cn(
          "block min-h-32 w-full resize-none rounded-2xl border bg-canvas px-4 py-3 text-base leading-relaxed text-fg placeholder:text-fg-muted",
          "focus:outline-none focus:ring-2 focus:ring-brand/30",
          excede ? "border-destructive" : "border-line focus:border-brand",
        )}
      />
      <div className="mt-1.5 flex justify-end">
        <span className={cn("text-xs tabular-nums", excede ? "font-semibold text-brand" : "text-fg-muted")}>
          {`${caracteres}/${LIMITE_TEXTO_POST}`}
        </span>
      </div>

      {totalFotos > 0 && (
        <ul aria-label="Fotos da publicação" className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {mantidas.map((url, i) => (
            <Miniatura key={url} src={url} alt={`Foto ${i + 1}`} onRemover={() => removerMantida(url)} />
          ))}
          {novas.map((f, i) => (
            <Miniatura
              key={f.id}
              src={f.preview}
              alt={`Foto ${mantidas.length + i + 1}`}
              onRemover={() => removerNova(f.id)}
            />
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-3">
        <input
          ref={ficheiro}
          type="file"
          multiple
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            juntar(e.target.files);
            // Permite voltar a escolher o mesmo ficheiro depois de o remover
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => ficheiro.current?.click()}
          disabled={aEnviar || totalFotos >= LIMITE_FOTOS}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-fg transition-colors duration-fast hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
        >
          <ImagePlus size={18} aria-hidden="true" />
          Juntar fotos
        </button>
        <span className="text-xs tabular-nums text-fg-muted">{`${totalFotos}/${LIMITE_FOTOS} fotos`}</span>
      </div>

      <p id={idAjuda} role="alert" className="mt-3 min-h-[1rem] text-xs text-destructive">
        {erro}
      </p>

      <button
        type="submit"
        disabled={aEnviar}
        aria-busy={aEnviar}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white transition-colors duration-fast hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {aEnviar && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {editar ? "Guardar" : "Publicar"}
      </button>
    </form>
  );
}

function Miniatura({ src, alt, onRemover }: { src: string; alt: string; onRemover: () => void }) {
  return (
    <li className="relative aspect-square overflow-hidden rounded-xl bg-canvas">
      {/* Pré-visualização local (blob:) ou foto já guardada — sem otimização do next/image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemover}
        aria-label="Remover foto"
        className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1.5 focus-visible:outline-none [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-white"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white">
          <X size={16} aria-hidden="true" />
        </span>
      </button>
    </li>
  );
}

export function PostComposer({
  aberto,
  onFechar,
  post,
  onGuardado,
  onPostApagado,
}: {
  aberto: boolean;
  onFechar: () => void;
  /** Com post: edita-o. Sem post: nova publicação. */
  post?: PostFeed;
  /** Edição guardada: o card aplica o resultado sem recarregar a lista */
  onGuardado?: (dados: PostEditado) => void;
  /** O servidor diz que o post já não existe (o card sai da lista) */
  onPostApagado?: () => void;
}) {
  const [aEnviar, setAEnviar] = useState(false);

  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        // Enquanto envia não fecha: o resultado tem de chegar a quem o espera
        if (!o && !aEnviar) onFechar();
      }}
    >
      <DialogContent variant="sheet" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-fg">{post ? "Editar publicação" : "Nova publicação"}</DialogTitle>
        </DialogHeader>
        <Formulario
          post={post}
          aEnviar={aEnviar}
          setAEnviar={setAEnviar}
          onFechar={onFechar}
          onGuardado={onGuardado}
          onPostApagado={onPostApagado}
        />
      </DialogContent>
    </Dialog>
  );
}
