"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, UserCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarCliente, editarCliente, apagarCliente } from "./actions";
import type { Fornecedor } from "@/lib/types";

interface Props {
  clientes: Fornecedor[];
}

const inputClass = "h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue";

export function ClientesView({ clientes }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [busca, setBusca] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Fornecedor | null>(null);
  const [nome, setNome] = useState("");
  const [nif, setNif] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [notas, setNotas] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!busca) return clientes;
    const q = busca.toLowerCase();
    return clientes.filter((c) => {
      const hay = `${c.nome} ${c.nif ?? ""} ${c.email ?? ""} ${c.telefone ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [clientes, busca]);

  function openCreate() {
    setEditTarget(null);
    setNome(""); setNif(""); setEmail(""); setTelefone(""); setNotas(""); setAtivo(true);
    setErro(null);
    setShowModal(true);
  }

  function openEdit(c: Fornecedor) {
    setEditTarget(c);
    setNome(c.nome); setNif(c.nif ?? ""); setEmail(c.email ?? ""); setTelefone(c.telefone ?? ""); setNotas(c.notas ?? "");
    setAtivo(c.ativo);
    setErro(null);
    setShowModal(true);
  }

  function closeModal() {
    if (submitting) return;
    setShowModal(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro("Nome obrigatório."); return; }
    setSubmitting(true);
    setErro(null);
    const r = editTarget
      ? await editarCliente(editTarget.id, { nome, nif, email, telefone, notas, ativo })
      : await criarCliente({ nome, nif, email, telefone, notas });
    setSubmitting(false);
    if (!r.ok) { setErro(r.erro ?? "Erro inesperado."); return; }
    closeModal();
    startTransition(() => router.refresh());
  }

  async function handleDelete(c: Fornecedor) {
    if (!window.confirm(`Apagar cliente "${c.nome}"?`)) return;
    setDeletingId(c.id);
    const r = await apagarCliente(c.id);
    setDeletingId(null);
    if (!r.ok) { window.alert(r.erro ?? "Erro ao apagar."); return; }
    startTransition(() => router.refresh());
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-bold text-gray-900 text-xl">Clientes</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Clientes externos para contas a receber (não são alunos)
            · {clientes.length} registo{clientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openCreate} className="bg-gb-blue hover:bg-gb-blue-dark text-white">
          <Plus size={16} className="mr-1" /> Novo cliente
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={`${inputClass} pl-9 w-52`}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <UserCheck size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum cliente</p>
          <p className="text-gray-400 text-sm mt-1">Cria o primeiro cliente externo</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Nome</th>
                  <th className="text-left px-4 py-3 font-medium">NIF</th>
                  <th className="text-left px-4 py-3 font-medium">Contacto</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-900">{c.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{c.nif ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.email && <div className="text-xs">{c.email}</div>}
                      {c.telefone && <div className="text-xs">{c.telefone}</div>}
                      {!c.email && !c.telefone && "—"}
                    </td>
                    <td className="px-4 py-3">
                      {c.ativo
                        ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700">Activo</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Inactivo</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded mr-1" aria-label="Editar"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(c)} disabled={deletingId === c.id} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50" aria-label="Apagar"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <h2 className="font-bold text-gray-900 text-lg mb-4">{editTarget ? "Editar cliente" : "Novo cliente"}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Nome *</label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Associação Desportiva X" className="rounded-xl" disabled={submitting} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">NIF</label>
                    <Input value={nif} onChange={(e) => setNif(e.target.value)} placeholder="123456789" className="rounded-xl" disabled={submitting} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Telefone</label>
                    <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="+351 …" className="rounded-xl" disabled={submitting} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" disabled={submitting} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Notas</label>
                  <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} disabled={submitting} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue resize-none disabled:opacity-60" />
                </div>
                {editTarget && (
                  <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <p className="text-sm font-medium text-gray-800">Activo</p>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ativo}
                      onClick={() => setAtivo((v) => !v)}
                      disabled={submitting}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${ativo ? "bg-gb-blue" : "bg-gray-200"}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${ativo ? "translate-x-5" : "translate-x-0"}`} />
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
