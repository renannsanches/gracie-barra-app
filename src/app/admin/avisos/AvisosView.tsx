"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { confirmar } from "@/components/ConfirmDialog";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pin, Eye, EyeOff, Pencil, Trash2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { criarAviso, editarAviso, apagarAviso, toggleFixado, togglePublicado } from "./avisos-actions";
import type { Aviso } from "@/lib/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface Props {
  avisos: Aviso[];
}

export function AvisosView({ avisos }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Aviso | null>(null);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [fixado, setFixado] = useState(false);
  const [publicado, setPublicado] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function openCreate() {
    setEditTarget(null);
    setTitulo("");
    setConteudo("");
    setFixado(false);
    setPublicado(true);
    setErro(null);
    setShowModal(true);
  }

  function openEdit(a: Aviso) {
    setEditTarget(a);
    setTitulo(a.titulo);
    setConteudo(a.conteudo);
    setFixado(a.fixado);
    setPublicado(a.publicado);
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
    if (!titulo.trim() || !conteudo.trim()) {
      setErro("Título e conteúdo são obrigatórios.");
      return;
    }
    setSubmitting(true);
    setErro(null);
    const result = editTarget
      ? await editarAviso(editTarget.id, titulo.trim(), conteudo.trim(), fixado, publicado)
      : await criarAviso(titulo.trim(), conteudo.trim(), fixado, publicado);
    setSubmitting(false);
    if (!result.ok) {
      setErro(result.erro ?? "Erro inesperado.");
      return;
    }
    toast.success(editTarget ? "Aviso actualizado" : "Aviso criado");
    closeModal();
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    if (!(await confirmar({ titulo: "Apagar este aviso?", descricao: "Esta ação não pode ser desfeita.", destrutivo: true }))) return;
    setDeletingId(id);
    const r = await apagarAviso(id);
    setDeletingId(null);
    if (!r.ok) { toast.error(r.erro ?? "Não foi possível apagar o aviso."); return; }
    toast.success("Aviso apagado");
    startTransition(() => router.refresh());
  }

  async function handleToggleFixado(a: Aviso) {
    setTogglingId(a.id + "-fix");
    await toggleFixado(a.id, !a.fixado);
    setTogglingId(null);
    startTransition(() => router.refresh());
  }

  async function handleTogglePublicado(a: Aviso) {
    setTogglingId(a.id + "-pub");
    await togglePublicado(a.id, !a.publicado);
    setTogglingId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900 text-xl">Avisos</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {avisos.length} aviso{avisos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openCreate} className="bg-gb-blue hover:bg-gb-blue-dark text-white">
          <Plus size={16} className="mr-1" />
          Novo Aviso
        </Button>
      </div>

      {avisos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Megaphone size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum aviso criado</p>
          <p className="text-gray-400 text-sm mt-1">Cria o primeiro aviso para os alunos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {avisos.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="font-semibold text-gray-900">{a.titulo}</h2>
                    {a.fixado && (
                      <Badge className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5">
                        <Pin size={10} className="mr-1 inline" />
                        Fixado
                      </Badge>
                    )}
                    {!a.publicado && (
                      <Badge variant="secondary" className="text-xs px-2 py-0.5">
                        Rascunho
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {a.conteudo.length > 100 ? a.conteudo.slice(0, 100) + "…" : a.conteudo}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">{formatDate(a.created_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50 flex-wrap">
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
                  onClick={() => handleToggleFixado(a)}
                  disabled={togglingId === a.id + "-fix"}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600 disabled:opacity-50"
                >
                  <Pin size={12} />
                  {a.fixado ? "Desafixar" : "Fixar"}
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePublicado(a)}
                  disabled={togglingId === a.id + "-pub"}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600 disabled:opacity-50"
                >
                  {a.publicado ? <EyeOff size={12} /> : <Eye size={12} />}
                  {a.publicado ? "Despublicar" : "Publicar"}
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
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={(aberto) => { if (!aberto) closeModal(); }}>
        <DialogContent showClose={false} aria-describedby={undefined} className="p-0 max-w-lg">
          <div className="p-6">
            <DialogTitle className="font-bold text-gray-900 text-lg mb-4">
              {editTarget ? "Editar Aviso" : "Novo Aviso"}
            </DialogTitle>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Título</label>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Título do aviso"
                  className="rounded-xl"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Conteúdo</label>
                <textarea
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  placeholder="Escreve o aviso aqui…"
                  rows={5}
                  disabled={submitting}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue resize-none disabled:opacity-60"
                />
              </div>
              <div className="flex flex-col gap-3">
                <SwitchRow
                  label="Fixado"
                  description="Aparece no topo da lista"
                  checked={fixado}
                  onChange={setFixado}
                  disabled={submitting}
                />
                <SwitchRow
                  label="Publicado"
                  description="Visível para os alunos"
                  checked={publicado}
                  onChange={setPublicado}
                  disabled={submitting}
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

function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gb-blue/30 disabled:opacity-50 ${
          checked ? "bg-gb-blue" : "bg-gray-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
