"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarForma, editarForma, apagarForma } from "./actions";
import type { FormaPagamento } from "@/lib/types";

interface Props {
  formas: FormaPagamento[];
}

export function FormasPagamentoView({ formas }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<FormaPagamento | null>(null);
  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState(0);
  const [ativa, setAtiva] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditTarget(null);
    setNome("");
    setOrdem(formas.length + 1);
    setAtiva(true);
    setErro(null);
    setShowModal(true);
  }

  function openEdit(f: FormaPagamento) {
    setEditTarget(f);
    setNome(f.nome);
    setOrdem(f.ordem);
    setAtiva(f.ativa);
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
    const r = editTarget
      ? await editarForma(editTarget.id, nome.trim(), ordem, ativa)
      : await criarForma(nome.trim(), ordem);
    setSubmitting(false);
    if (!r.ok) {
      setErro(r.erro ?? "Erro inesperado.");
      return;
    }
    closeModal();
    startTransition(() => router.refresh());
  }

  async function handleDelete(f: FormaPagamento) {
    if (!window.confirm(`Apagar "${f.nome}"?`)) return;
    setDeletingId(f.id);
    const r = await apagarForma(f.id);
    setDeletingId(null);
    if (!r.ok) {
      window.alert(r.erro ?? "Erro ao apagar.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900 text-xl">Formas de pagamento</h1>
          <p className="text-gray-400 text-sm mt-0.5">{formas.length} forma{formas.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate} className="bg-gb-blue hover:bg-gb-blue-dark text-white">
          <Plus size={16} className="mr-1" /> Nova
        </Button>
      </div>

      {formas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <CreditCard size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sem formas de pagamento</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {formas.map((f) => (
            <div key={f.id} className="flex items-center gap-3 p-3">
              <span className="w-8 text-xs text-gray-400 text-center">{f.ordem}</span>
              <span className="flex-1 font-medium text-gray-900">{f.nome}</span>
              {!f.ativa && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Inactiva</span>}
              <button onClick={() => openEdit(f)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded" aria-label="Editar"><Pencil size={14} /></button>
              <button onClick={() => handleDelete(f)} disabled={deletingId === f.id} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50" aria-label="Apagar"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-4">{editTarget ? "Editar forma" : "Nova forma"}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Nome</label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: MB Way" className="rounded-xl" disabled={submitting} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Ordem</label>
                  <Input type="number" value={ordem} onChange={(e) => setOrdem(Number(e.target.value))} className="rounded-xl" disabled={submitting} />
                </div>
                {editTarget && (
                  <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <p className="text-sm font-medium text-gray-800">Activa</p>
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
