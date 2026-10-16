"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { confirmar } from "@/components/ConfirmDialog";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Trash2, Images, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarAlbum, editarAlbum, apagarAlbum } from "./albuns-actions";
import type { Album } from "@/lib/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface Props {
  albuns: Album[];
  covers: Record<string, string>;
}

export function AlbunsView({ albuns, covers }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Album | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditTarget(null);
    setTitulo("");
    setDescricao("");
    setErro(null);
    setShowModal(true);
  }

  function openEdit(a: Album) {
    setEditTarget(a);
    setTitulo(a.titulo);
    setDescricao(a.descricao ?? "");
    setErro(null);
    setShowModal(true);
  }

  function closeModal() {
    if (submitting) return;
    setShowModal(false);
    setEditTarget(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) {
      setErro("O título é obrigatório.");
      return;
    }
    setSubmitting(true);
    setErro(null);
    const result = editTarget
      ? await editarAlbum(editTarget.id, titulo.trim(), descricao.trim())
      : await criarAlbum(titulo.trim(), descricao.trim());
    setSubmitting(false);
    if (!result.ok) {
      setErro(result.erro ?? "Erro inesperado.");
      return;
    }
    toast.success(editTarget ? "Álbum actualizado" : "Álbum criado");
    closeModal();
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    if (!(await confirmar({ titulo: "Apagar este álbum?", descricao: "Todas as fotos do álbum também são apagadas. Esta ação não pode ser desfeita.", destrutivo: true }))) return;
    setDeletingId(id);
    const r = await apagarAlbum(id);
    setDeletingId(null);
    if (!r.ok) { toast.error(r.erro ?? "Não foi possível apagar o álbum."); return; }
    toast.success("Álbum apagado");
    startTransition(() => router.refresh());
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900 text-xl">Álbuns</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {albuns.length} álbum{albuns.length !== 1 ? "ns" : ""}
          </p>
        </div>
        <Button onClick={openCreate} className="bg-gb-blue hover:bg-gb-blue-dark text-white">
          <Plus size={16} className="mr-1" />
          Novo Álbum
        </Button>
      </div>

      {albuns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Images size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum álbum criado</p>
          <p className="text-gray-400 text-sm mt-1">Cria o primeiro álbum de fotos da academia</p>
        </div>
      ) : (
        <div className="space-y-3">
          {albuns.map((a) => {
            const capaEfetiva = a.capa_url ?? covers[a.id] ?? null;
            return (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  {capaEfetiva ? (
                    <Image
                      src={capaEfetiva}
                      alt={a.titulo}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon size={20} className="text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900">{a.titulo}</h2>
                  {a.descricao && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {a.descricao.length > 120 ? a.descricao.slice(0, 120) + "…" : a.descricao}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-400">{formatDate(a.created_at)}</span>
                    <span className="text-xs text-gray-400">
                      {a.fotos_count ?? 0} foto{(a.fotos_count ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50 flex-wrap">
                <Link
                  href={`/admin/albuns/${a.id}/fotos`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gb-blue/10 hover:bg-gb-blue/20 transition-colors text-gb-blue"
                >
                  <ImageIcon size={12} />
                  Ver Fotos
                </Link>
                <button
                  type="button"
                  onClick={() => openEdit(a)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
                >
                  <Pencil size={12} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-red-600 disabled:opacity-50 ml-auto"
                >
                  <Trash2 size={12} />
                  {deletingId === a.id ? "A apagar…" : "Apagar"}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={(aberto) => { if (!aberto) closeModal(); }}>
        <DialogContent showClose={false} aria-describedby={undefined} className="p-0 max-w-lg">
          <div className="p-6">
            <DialogTitle className="font-bold text-gray-900 text-lg mb-4">
              {editTarget ? "Editar Álbum" : "Novo Álbum"}
            </DialogTitle>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Título <span className="text-red-500">*</span>
                </label>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Nome do álbum"
                  className="rounded-xl"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Descrição</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descrição opcional…"
                  rows={3}
                  disabled={submitting}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue resize-none disabled:opacity-60"
                />
              </div>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  className="flex-1"
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gb-blue hover:bg-gb-blue-dark text-white"
                  disabled={submitting}
                >
                  {submitting ? "A guardar…" : editTarget ? "Guardar" : "Criar"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
