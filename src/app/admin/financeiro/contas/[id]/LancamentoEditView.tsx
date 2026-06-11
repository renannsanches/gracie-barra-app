"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  editarLancamento,
  marcarLancamentoPago,
  desmarcarLancamentoPago,
  cancelarLancamento,
  apagarLancamento,
} from "../actions";
import type {
  AlunoCombo,
  LancamentoFinanceiro,
  Fornecedor,
  CategoriaFinanceira,
  FormaPagamento,
  StatusLancamento,
} from "@/lib/types";

interface Props {
  lancamento: LancamentoFinanceiro;
  grupo: Array<Pick<LancamentoFinanceiro, "id" | "parcela_numero" | "parcela_total" | "data_vencimento" | "valor" | "status">>;
  fornecedores: Fornecedor[];
  clientes: Fornecedor[];
  alunos: AlunoCombo[];
  categorias: CategoriaFinanceira[];
  formasPagamento: FormaPagamento[];
}

const inputClass = "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue";

function statusBadge(s: StatusLancamento) {
  if (s === "pago")      return { label: "Pago",      cls: "bg-green-100 text-green-700" };
  if (s === "atrasado")  return { label: "Em atraso", cls: "bg-red-100 text-red-700" };
  if (s === "cancelado") return { label: "Cancelado", cls: "bg-gray-100 text-gray-500" };
  return                       { label: "Pendente",  cls: "bg-yellow-100 text-yellow-700" };
}

function formatData(d: string | null) {
  if (!d) return "—";
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

function formatEUR(v: number) {
  return Number(v).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

export function LancamentoEditView({ lancamento: l, grupo, fornecedores, clientes, alunos, categorias, formasPagamento }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [descricao, setDescricao] = useState(l.descricao);
  // Destinatário: "f:<id>" para fornecedor/cliente, "a:<id>" para aluno
  const initDestinatario = l.aluno_id
    ? `a:${l.aluno_id}`
    : l.fornecedor_id
      ? `f:${l.fornecedor_id}`
      : "";
  const [destinatario, setDestinatario] = useState(initDestinatario);
  const [categoriaId, setCategoriaId] = useState(l.categoria_id ?? "");
  const [dataVenc, setDataVenc] = useState(l.data_vencimento);
  const [valor, setValor] = useState(String(l.valor));
  const [notas, setNotas] = useState(l.notas ?? "");
  const [aplicarTodo, setAplicarTodo] = useState(false);

  const [showPay, setShowPay] = useState(false);
  const [payFormaId, setPayFormaId] = useState<string>(formasPagamento[0]?.id ?? "");
  const [payData, setPayData] = useState<string>(() => new Date().toISOString().split("T")[0]);

  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const isParcelado = grupo.length > 1;
  const tipoCat = l.tipo === "pagar" ? "despesa" : "receita";
  const categoriasFiltradas = useMemo(() => categorias.filter((c) => c.tipo === tipoCat), [categorias, tipoCat]);
  const sb = statusBadge(l.status);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setBusy(true);
    let fornecedor_id: string | null = null;
    let aluno_id: string | null = null;
    if (destinatario) {
      const [pfx, pid] = destinatario.split(":");
      if (pfx === "a") aluno_id = pid;
      else fornecedor_id = pid;
    }
    const r = await editarLancamento(l.id, {
      descricao,
      fornecedor_id,
      aluno_id,
      categoria_id: categoriaId || null,
      data_vencimento: dataVenc,
      valor: Number(valor),
      notas,
      aplicarAoGrupoTodo: aplicarTodo,
    });
    setBusy(false);
    if (!r.ok) { setErro(r.erro ?? "Erro inesperado."); return; }
    startTransition(() => router.refresh());
  }

  async function handleMarcarPago() {
    setBusy(true);
    const r = await marcarLancamentoPago(l.id, payFormaId || null, payData);
    setBusy(false);
    if (!r.ok) { window.alert(r.erro ?? "Erro."); return; }
    setShowPay(false);
    startTransition(() => router.refresh());
  }

  async function handleDesmarcar() {
    setBusy(true);
    const r = await desmarcarLancamentoPago(l.id);
    setBusy(false);
    if (!r.ok) { window.alert(r.erro ?? "Erro."); return; }
    startTransition(() => router.refresh());
  }

  async function handleCancelar(grupoTodo: boolean) {
    const msg = grupoTodo
      ? `Cancelar todas as ${grupo.filter((g) => g.status !== "pago").length} parcelas pendentes do grupo?`
      : "Cancelar esta parcela?";
    if (!window.confirm(msg)) return;
    setBusy(true);
    const r = await cancelarLancamento(l.id, grupoTodo);
    setBusy(false);
    if (!r.ok) { window.alert(r.erro ?? "Erro."); return; }
    startTransition(() => router.refresh());
  }

  async function handleApagar(grupoTodo: boolean) {
    const msg = grupoTodo
      ? `Apagar TODAS as ${grupo.length} parcelas? Esta acção é irreversível.`
      : "Apagar este lançamento? Esta acção é irreversível.";
    if (!window.confirm(msg)) return;
    setBusy(true);
    const r = await apagarLancamento(l.id, grupoTodo);
    setBusy(false);
    if (!r.ok) { window.alert(r.erro ?? "Erro."); return; }
    router.push("/admin/financeiro/contas");
    startTransition(() => router.refresh());
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/admin/financeiro/contas" className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-bold text-gray-900 text-xl">{l.descricao}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sb.cls}`}>{sb.label}</span>
            {l.tipo === "pagar"
              ? <span className="inline-flex items-center gap-1 text-red-600 text-xs"><ArrowDownRight size={12} /> A pagar</span>
              : <span className="inline-flex items-center gap-1 text-green-700 text-xs"><ArrowUpRight size={12} /> A receber</span>}
          </div>
          {isParcelado && (
            <p className="text-xs text-gray-400 mt-0.5">Parcela {l.parcela_numero}/{l.parcela_total}</p>
          )}
        </div>
      </div>

      {/* Acções rápidas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-2">
        {l.status === "pago" ? (
          <>
            <div className="flex-1 text-sm">
              <p className="text-gray-500">Pago em {formatData(l.data_pagamento)}</p>
              {l.forma_pagamento_id && (
                <p className="text-xs text-gray-400">via {formasPagamento.find((f) => f.id === l.forma_pagamento_id)?.nome ?? "—"}</p>
              )}
            </div>
            <Button type="button" variant="outline" onClick={handleDesmarcar} disabled={busy}>Desmarcar pago</Button>
          </>
        ) : l.status === "cancelado" ? (
          <p className="text-sm text-gray-500">Este lançamento foi cancelado.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 flex-1">Pendente — vence {formatData(l.data_vencimento)}</p>
            <Button type="button" onClick={() => setShowPay(true)} className="bg-green-600 hover:bg-green-700 text-white" disabled={busy}>Marcar pago</Button>
          </>
        )}
      </div>

      {/* Form de edição */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Detalhes</h2>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Descrição</label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="rounded-xl h-10" disabled={busy} />
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">{l.tipo === "pagar" ? "Fornecedor" : "Cliente / Aluno"}</label>
            {l.tipo === "pagar" ? (
              <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)} className={inputClass} disabled={busy}>
                <option value="">— Nenhum —</option>
                {fornecedores.map((f) => <option key={f.id} value={`f:${f.id}`}>{f.nome}</option>)}
              </select>
            ) : (
              <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)} className={inputClass} disabled={busy}>
                <option value="">— Nenhum —</option>
                {clientes.length > 0 && (
                  <optgroup label="Clientes cadastrados">
                    {clientes.map((c) => <option key={c.id} value={`f:${c.id}`}>{c.nome}</option>)}
                  </optgroup>
                )}
                {alunos.length > 0 && (
                  <optgroup label="Alunos">
                    {alunos.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.nome_completo}</option>)}
                  </optgroup>
                )}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Categoria</label>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={inputClass} disabled={busy}>
              <option value="">— Nenhuma —</option>
              {categoriasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>{c.parent_id ? "└ " : ""}{c.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Vencimento</label>
            <input type="date" value={dataVenc} onChange={(e) => setDataVenc(e.target.value)} className={inputClass} disabled={busy || aplicarTodo} />
            {aplicarTodo && <p className="text-xs text-gray-400">Datas não são alteradas quando aplicado ao grupo todo.</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Valor (€)</label>
            <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} className={inputClass} disabled={busy} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Notas</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue resize-none" disabled={busy} />
        </div>

        {isParcelado && (
          <div className="flex items-center justify-between gap-4 p-3 rounded-xl border border-amber-100 bg-amber-50">
            <div>
              <p className="text-sm font-medium text-amber-900">Aplicar a todas as parcelas do grupo</p>
              <p className="text-xs text-amber-700">Fornecedor, categoria, valor e notas. Datas individuais ficam intactas.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={aplicarTodo}
              onClick={() => setAplicarTodo((v) => !v)}
              disabled={busy}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${aplicarTodo ? "bg-amber-600" : "bg-amber-200"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${aplicarTodo ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" className="bg-gb-blue hover:bg-gb-blue-dark text-white" disabled={busy}>
            {busy ? "A guardar…" : "Guardar alterações"}
          </Button>
        </div>
      </form>

      {/* Grupo de parcelas */}
      {isParcelado && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Parcelas do grupo</h2>
          <div className="divide-y divide-gray-50">
            {grupo.map((g) => {
              const isCurrent = g.id === l.id;
              const sbg = statusBadge(g.status);
              return (
                <Link
                  key={g.id}
                  href={`/admin/financeiro/contas/${g.id}`}
                  className={`flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-gray-50 ${isCurrent ? "bg-gb-blue/5" : ""}`}
                >
                  <span className="w-12 text-xs text-gray-500">{g.parcela_numero}/{g.parcela_total}</span>
                  <span className="flex-1 text-sm text-gray-700">{formatData(g.data_vencimento)}</span>
                  <span className="text-sm font-medium text-gray-900">{formatEUR(Number(g.valor))}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${sbg.cls}`}>{sbg.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Acções perigosas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
        <h2 className="font-semibold text-gray-900 mb-2">Acções</h2>
        <div className="flex flex-wrap gap-2">
          {l.status !== "cancelado" && l.status !== "pago" && (
            <Button type="button" variant="outline" onClick={() => handleCancelar(false)} disabled={busy} className="text-amber-700 border-amber-200 hover:bg-amber-50">
              <X size={14} className="mr-1" /> Cancelar esta parcela
            </Button>
          )}
          {isParcelado && l.status !== "cancelado" && (
            <Button type="button" variant="outline" onClick={() => handleCancelar(true)} disabled={busy} className="text-amber-700 border-amber-200 hover:bg-amber-50">
              <X size={14} className="mr-1" /> Cancelar grupo todo
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => handleApagar(false)} disabled={busy} className="text-red-600 border-red-200 hover:bg-red-50">
            <Trash2 size={14} className="mr-1" /> Apagar parcela
          </Button>
          {isParcelado && (
            <Button type="button" variant="outline" onClick={() => handleApagar(true)} disabled={busy} className="text-red-600 border-red-200 hover:bg-red-50">
              <Trash2 size={14} className="mr-1" /> Apagar grupo todo
            </Button>
          )}
        </div>
      </div>

      {/* Modal marcar pago */}
      {showPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !busy && setShowPay(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Marcar como pago</h2>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Data do pagamento</label>
                  <input type="date" value={payData} onChange={(e) => setPayData(e.target.value)} className={inputClass} disabled={busy} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Forma de pagamento</label>
                  <select value={payFormaId} onChange={(e) => setPayFormaId(e.target.value)} className={inputClass} disabled={busy}>
                    <option value="">— (não registar)</option>
                    {formasPagamento.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowPay(false)} className="flex-1" disabled={busy}>Cancelar</Button>
                <Button onClick={handleMarcarPago} className="flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={busy}>
                  {busy ? "A guardar…" : "Confirmar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
