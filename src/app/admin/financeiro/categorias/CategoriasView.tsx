"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarCategoria, editarCategoria, apagarCategoria } from "./actions";
import type { CategoriaFinanceira, TipoCategoriaFinanceira } from "@/lib/types";

interface Props {
  categorias: CategoriaFinanceira[];
}

type CategoriaComFilhos = CategoriaFinanceira & { filhos: CategoriaFinanceira[] };

function tipoLabel(t: TipoCategoriaFinanceira) {
  return t === "despesa"
    ? { label: "Despesa", cls: "bg-red-50 text-red-600 border-red-100" }
    : { label: "Receita", cls: "bg-green-50 text-green-600 border-green-100" };
}

export function CategoriasView({ categorias }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<CategoriaFinanceira | null>(null);
  const [parentTarget, setParentTarget] = useState<CategoriaFinanceira | null>(null);

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoCategoriaFinanceira>("despesa");
  const [ativa, setAtiva] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(categorias.filter((c) => !c.parent_id).map((c) => c.id)));
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const arvore = useMemo<CategoriaComFilhos[]>(() => {
    const pais = categorias.filter((c) => !c.parent_id);
    return pais.map((p) => ({
      ...p,
      filhos: categorias.filter((c) => c.parent_id === p.id),
    }));
  }, [categorias]);

  function openCreateRoot(t: TipoCategoriaFinanceira) {
    setEditTarget(null);
    setParentTarget(null);
    setNome("");
    setTipo(t);
    setAtiva(true);
    setErro(null);
    setShowModal(true);
  }

  function openCreateChild(pai: CategoriaFinanceira) {
    setEditTarget(null);
    setParentTarget(pai);
    setNome("");
    setTipo(pai.tipo);
    setAtiva(true);
    setErro(null);
    setShowModal(true);
  }

  function openEdit(c: CategoriaFinanceira) {
    setEditTarget(c);
    setParentTarget(null);
    setNome(c.nome);
    setTipo(c.tipo);
    setAtiva(c.ativa);
    setErro(null);
    setShowModal(true);
  }

  function closeModal() {
    if (submitting) return;
    setShowModal(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("Nome obrigatório.");
      return;
    }
    setSubmitting(true);
    setErro(null);
    const result = editTarget
      ? await editarCategoria(editTarget.id, nome.trim(), ativa)
      : await criarCategoria(nome.trim(), tipo, parentTarget?.id ?? null);
    setSubmitting(false);
    if (!result.ok) {
      setErro(result.erro ?? "Erro inesperado.");
      return;
    }
    closeModal();
    startTransition(() => router.refresh());
  }

  async function handleDelete(c: CategoriaFinanceira) {
    if (!window.confirm(`Apagar "${c.nome}"?`)) return;
    setDeletingId(c.id);
    const r = await apagarCategoria(c.id);
    setDeletingId(null);
    if (!r.ok) {
      window.alert(r.erro ?? "Erro ao apagar.");
      return;
    }
    startTransition(() => router.refresh());
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-bold text-gray-900 text-xl">Plano de contas</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {categorias.length} categoria{categorias.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openCreateRoot("despesa")} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
            <Plus size={16} className="mr-1" /> Despesa
          </Button>
          <Button onClick={() => openCreateRoot("receita")} variant="outline" className="text-green-700 border-green-200 hover:bg-green-50">
            <Plus size={16} className="mr-1" /> Receita
          </Button>
        </div>
      </div>

      {arvore.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <ListTree size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sem categorias</p>
          <p className="text-gray-400 text-sm mt-1">Cria a primeira categoria pai</p>
        </div>
      ) : (
        <div className="space-y-3">
          {arvore.map((pai) => {
            const isOpen = expanded.has(pai.id);
            const t = tipoLabel(pai.tipo);
            return (
              <div key={pai.id} className="bg-white rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(pai.id)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400"
                    aria-label="Expandir"
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <span className="font-semibold text-gray-900 flex-1">{pai.nome}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${t.cls}`}>{t.label}</span>
                  {!pai.ativa && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Inactiva</span>
                  )}
                  <button onClick={() => openCreateChild(pai)} className="text-xs text-gb-blue hover:underline px-2 py-1">+ Subcategoria</button>
                  <button onClick={() => openEdit(pai)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded" aria-label="Editar"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(pai)} disabled={deletingId === pai.id} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50" aria-label="Apagar"><Trash2 size={14} /></button>
                </div>
                {isOpen && pai.filhos.length > 0 && (
                  <div className="border-t border-gray-50 divide-y divide-gray-50">
                    {pai.filhos.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 p-3 pl-12">
                        <span className="flex-1 text-sm text-gray-700">{f.nome}</span>
                        {!f.ativa && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Inactiva</span>}
                        <button onClick={() => openEdit(f)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded" aria-label="Editar"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(f)} disabled={deletingId === f.id} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50" aria-label="Apagar"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
                {isOpen && pai.filhos.length === 0 && (
                  <p className="border-t border-gray-50 px-12 py-3 text-xs text-gray-400">Sem subcategorias</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-1">
                {editTarget ? "Editar categoria" : parentTarget ? `Nova subcategoria de "${parentTarget.nome}"` : "Nova categoria"}
              </h2>
              <p className="text-xs text-gray-400 mb-4">
                {editTarget ? "Não é possível alterar o tipo ou pai depois de criar." : "Tipo (despesa/receita) é herdado do pai."}
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Nome</label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Aluguer" className="rounded-xl" disabled={submitting} />
                </div>
                {editTarget && (
                  <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Activa</p>
                      <p className="text-xs text-gray-400">Inactiva = não aparece nos selectores de lançamento</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ativa}
                      onClick={() => setAtiva((v) => !v)}
                      disabled={submitting}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${ativa ? "bg-gb-blue" : "bg-gray-200"}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${ativa ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                )}
                {erro && <p className="text-sm text-red-600">{erro}</p>}
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={closeModal} className="flex-1" disabled={submitting}>Cancelar</Button>
                  <Button type="submit" className="flex-1 bg-gb-blue hover:bg-gb-blue-dark text-white" disabled={submitting}>
                    {submitting ? "A guardar…" : editTarget ? "Guardar" : "Criar"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
