"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ReceiptText, ArrowUpRight, ArrowDownRight, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marcarLancamentoPago, desmarcarLancamentoPago, apagarLancamento } from "./actions";
import type {
  LancamentoFinanceiro,
  Mensalidade,
  Fornecedor,
  AlunoCombo,
  CategoriaFinanceira,
  FormaPagamento,
  StatusLancamento,
  TipoLancamento,
} from "@/lib/types";

export type LancamentoComRefs = LancamentoFinanceiro & {
  fornecedores: { nome: string } | null;
  profiles: { nome_completo: string } | null;   // join para aluno_id
  categorias_financeiras: { nome: string; parent_id: string | null } | null;
  formas_pagamento: { nome: string } | null;
};

interface Props {
  lancamentos: LancamentoComRefs[];
  fornecedores: Fornecedor[];
  clientes: Fornecedor[];
  alunos: AlunoCombo[];
  categorias: CategoriaFinanceira[];
  formasPagamento: FormaPagamento[];
  mensalidadesPendentes: Pick<Mensalidade, "id" | "mes_referencia" | "data_vencimento" | "valor" | "status">[];
}

const inputClass = "h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue";

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
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

export function ContasView({ lancamentos, fornecedores, clientes, alunos, categorias, formasPagamento, mensalidadesPendentes }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const hoje = new Date();
  const MES_ATUAL = String(hoje.getMonth() + 1).padStart(2, "0");
  const ANO_ATUAL = String(hoje.getFullYear());

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"" | TipoLancamento>("");
  const [filtroStatus, setFiltroStatus] = useState<"" | StatusLancamento>("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroFornecedor, setFiltroFornecedor] = useState("");
  const [filtroMes, setFiltroMes] = useState(MES_ATUAL);   // "01"–"12" ou ""
  const [filtroAno, setFiltroAno] = useState(ANO_ATUAL);   // "2026" ou ""
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const temPeriodo = !!(dataInicio || dataFim);

  // Modal "marcar pago"
  const [payTarget, setPayTarget] = useState<LancamentoComRefs | null>(null);
  const [payFormaId, setPayFormaId] = useState<string>("");
  const [payData, setPayData] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [paying, setPaying] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Modal de apagar
  const [deleteTarget, setDeleteTarget] = useState<LancamentoComRefs | null>(null);
  const [deleting, setDeleting] = useState(false);

  const anos = useMemo(() => {
    const s = new Set<string>();
    s.add(ANO_ATUAL);
    lancamentos.forEach((l) => s.add(l.data_vencimento.slice(0, 4)));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [lancamentos]);

  const filtered = useMemo(() => {
    return lancamentos.filter((l) => {
      if (filtroTipo && l.tipo !== filtroTipo) return false;
      if (filtroStatus && l.status !== filtroStatus) return false;
      if (filtroCategoria && l.categoria_id !== filtroCategoria) return false;
      if (filtroFornecedor) {
        const [pfx, pid] = filtroFornecedor.split(":");
        if (pfx === "a") { if (l.aluno_id !== pid) return false; }
        else              { if (l.fornecedor_id !== pid) return false; }
      }
      if (temPeriodo) {
        if (dataInicio && l.data_vencimento < dataInicio) return false;
        if (dataFim   && l.data_vencimento > dataFim)   return false;
      } else {
        if (filtroAno && !l.data_vencimento.startsWith(filtroAno)) return false;
        if (filtroMes && l.data_vencimento.slice(5, 7) !== filtroMes) return false;
      }
      if (busca) {
        const q = busca.toLowerCase();
        const hay = `${l.descricao} ${l.fornecedores?.nome ?? ""} ${l.categorias_financeiras?.nome ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [lancamentos, busca, filtroTipo, filtroStatus, filtroCategoria, filtroFornecedor,
      filtroMes, filtroAno, dataInicio, dataFim, temPeriodo]);

  // Mensalidades filtradas pelo mesmo período
  const mensalidadesFiltradas = useMemo(() => {
    return mensalidadesPendentes.filter((m) => {
      const venc = m.data_vencimento;
      if (temPeriodo) {
        if (dataInicio && venc < dataInicio) return false;
        if (dataFim   && venc > dataFim)   return false;
      } else {
        if (filtroAno && !venc.startsWith(filtroAno)) return false;
        if (filtroMes && venc.slice(5, 7) !== filtroMes) return false;
      }
      return true;
    });
  }, [mensalidadesPendentes, filtroMes, filtroAno, dataInicio, dataFim, temPeriodo]);

  const totais = useMemo(() => {
    let aPagarPendente = 0, aReceberPendente = 0, pagoSaldo = 0;
    for (const l of filtered) {
      if (l.status === "cancelado") continue;
      const valor = Number(l.valor);
      if (l.tipo === "pagar" && l.status !== "pago") aPagarPendente += valor;
      if (l.tipo === "receber" && l.status !== "pago") aReceberPendente += valor;
      if (l.status === "pago") pagoSaldo += l.tipo === "receber" ? valor : -valor;
    }
    // Adicionar mensalidades pendentes/atrasadas (a receber)
    const mensalidadesTotal = mensalidadesFiltradas.reduce((s, m) => s + Number(m.valor), 0);
    return { aPagarPendente, aReceberPendente: aReceberPendente + mensalidadesTotal, pagoSaldo, mensalidadesTotal };
  }, [filtered, mensalidadesFiltradas]);

  function openPay(l: LancamentoComRefs) {
    setPayTarget(l);
    setPayFormaId(formasPagamento[0]?.id ?? "");
    setPayData(new Date().toISOString().split("T")[0]);
  }

  async function confirmPay() {
    if (!payTarget) return;
    setPaying(true);
    const r = await marcarLancamentoPago(payTarget.id, payFormaId || null, payData);
    setPaying(false);
    if (!r.ok) { window.alert(r.erro ?? "Erro ao marcar pago."); return; }
    setPayTarget(null);
    startTransition(() => router.refresh());
  }

  async function handleDesmarcar(id: string) {
    setLoadingId(id);
    await desmarcarLancamentoPago(id);
    setLoadingId(null);
    startTransition(() => router.refresh());
  }

  function handleClickDelete(l: LancamentoComRefs) {
    if (l.grupo_id) {
      // Parcelado → modal com escolha
      setDeleteTarget(l);
    } else {
      // Único → confirmação simples
      if (!window.confirm("Apagar este lançamento? Esta acção é irreversível.")) return;
      execDelete(l.id, false);
    }
  }

  async function execDelete(id: string, grupo: boolean) {
    setDeleting(true);
    const r = await apagarLancamento(id, grupo);
    setDeleting(false);
    setDeleteTarget(null);
    if (!r.ok) { window.alert(r.erro ?? "Erro ao apagar."); return; }
    startTransition(() => router.refresh());
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-bold text-gray-900 text-xl">Contas</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {lancamentos.length} lançamento{lancamentos.length !== 1 ? "s" : ""} • {filtered.length} filtrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/admin/financeiro/contas/novo">
          <Button className="bg-gb-blue hover:bg-gb-blue-dark text-white">
            <Plus size={16} className="mr-1" /> Novo lançamento
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-red-600">
            <ArrowDownRight size={16} />
            <p className="text-xs font-medium uppercase tracking-wide">A pagar pendente</p>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatEUR(totais.aPagarPendente)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-green-600">
            <ArrowUpRight size={16} />
            <p className="text-xs font-medium uppercase tracking-wide">A receber pendente</p>
          </div>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatEUR(totais.aReceberPendente)}</p>
          {totais.mensalidadesTotal > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              inc. {formatEUR(totais.mensalidadesTotal)} mensalidades
            </p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 col-span-2 md:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Saldo realizado (filtro)</p>
          <p className={`text-xl font-bold mt-1 ${totais.pagoSaldo < 0 ? "text-red-700" : "text-green-700"}`}>
            {formatEUR(totais.pagoSaldo)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar descrição/fornecedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={`${inputClass} pl-9 w-64`}
          />
        </div>
        <select title="Tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as "" | TipoLancamento)} className={inputClass}>
          <option value="">Todos (pagar+receber)</option>
          <option value="pagar">A pagar</option>
          <option value="receber">A receber</option>
        </select>
        <select title="Status" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as "" | StatusLancamento)} className={inputClass}>
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="atrasado">Atrasado</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select title="Categoria" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className={inputClass}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select title="Destinatário" value={filtroFornecedor} onChange={(e) => setFiltroFornecedor(e.target.value)} className={inputClass}>
          <option value="">Todos os destinatários</option>
          {fornecedores.length > 0 && (
            <optgroup label="Fornecedores">
              {fornecedores.map((f) => <option key={f.id} value={`f:${f.id}`}>{f.nome}</option>)}
            </optgroup>
          )}
          {clientes.length > 0 && (
            <optgroup label="Clientes">
              {clientes.map((c) => <option key={c.id} value={`f:${c.id}`}>{c.nome}</option>)}
            </optgroup>
          )}
          {alunos.length > 0 && (
            <optgroup label="Alunos">
              {alunos.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.nome_completo}</option>)}
            </optgroup>
          )}
        </select>
        {/* Mês + Ano — desabilitados quando período personalizado activo */}
        <select
          title="Filtrar por mês"
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
          disabled={temPeriodo}
          className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <option value="">Todos os meses</option>
          <option value="01">Janeiro</option>
          <option value="02">Fevereiro</option>
          <option value="03">Março</option>
          <option value="04">Abril</option>
          <option value="05">Maio</option>
          <option value="06">Junho</option>
          <option value="07">Julho</option>
          <option value="08">Agosto</option>
          <option value="09">Setembro</option>
          <option value="10">Outubro</option>
          <option value="11">Novembro</option>
          <option value="12">Dezembro</option>
        </select>
        <select
          title="Filtrar por ano"
          value={filtroAno}
          onChange={(e) => setFiltroAno(e.target.value)}
          disabled={temPeriodo}
          className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <option value="">Todos os anos</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {/* Período personalizado */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500" htmlFor="contas-inicio">De</label>
          <input
            id="contas-inicio"
            type="date"
            title="Período: data inicial (vencimento)"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className={inputClass}
          />
          <label className="text-xs text-gray-500" htmlFor="contas-fim">Até</label>
          <input
            id="contas-fim"
            type="date"
            title="Período: data final (vencimento)"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className={inputClass}
          />
          {temPeriodo && (
            <button
              type="button"
              onClick={() => { setDataInicio(""); setDataFim(""); }}
              className="text-xs px-2 py-1 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-3 font-medium">Tipo</th>
                <th className="text-left px-3 py-3 font-medium">Descrição</th>
                <th className="text-left px-3 py-3 font-medium">Fornecedor</th>
                <th className="text-left px-3 py-3 font-medium">Categoria</th>
                <th className="text-left px-3 py-3 font-medium">Vencimento</th>
                <th className="text-right px-3 py-3 font-medium">Valor</th>
                <th className="text-left px-3 py-3 font-medium">Status</th>
                <th className="text-left px-3 py-3 font-medium">Pagamento</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400">
                    <ReceiptText size={32} className="mx-auto text-gray-200 mb-2" />
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
              {filtered.map((l) => {
                const { label, cls } = statusBadge(l.status);
                const isLoading = loadingId === l.id;
                const isParcelado = l.parcela_total != null;
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      {l.tipo === "pagar"
                        ? <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium"><ArrowDownRight size={12} /> A pagar</span>
                        : <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium"><ArrowUpRight size={12} /> A receber</span>}
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-900">
                      <Link href={`/admin/financeiro/contas/${l.id}`} className="hover:text-gb-blue">{l.descricao}</Link>
                      {isParcelado && (
                        <span className="ml-1 text-xs text-gray-400">parc. {l.parcela_numero}/{l.parcela_total}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {l.aluno_id
                        ? l.profiles?.nome_completo ?? "—"
                        : l.fornecedores?.nome ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-gray-600">{l.categorias_financeiras?.nome ?? "—"}</td>
                    <td className="px-3 py-3 text-gray-600">{formatData(l.data_vencimento)}</td>
                    <td className="px-3 py-3 text-right font-medium text-gray-900">{formatEUR(Number(l.valor))}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {l.status === "pago" ? (
                        <>
                          {formatData(l.data_pagamento)}
                          {l.formas_pagamento?.nome && <div className="text-gray-400">{l.formas_pagamento.nome}</div>}
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1">
                        {l.status === "cancelado" ? (
                          <Link href={`/admin/financeiro/contas/${l.id}`} className="text-xs text-gray-500 hover:underline">Ver</Link>
                        ) : l.status !== "pago" ? (
                          <button
                            type="button"
                            onClick={() => openPay(l)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                          >
                            Marcar pago
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleDesmarcar(l.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200 disabled:opacity-40"
                          >
                            {isLoading ? "..." : "Desmarcar"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleClickDelete(l)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          aria-label="Apagar lançamento"
                          title="Apagar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal apagar parcela */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Apagar lançamento</h2>
              <p className="text-sm text-gray-500 mb-1">
                <span className="font-medium text-gray-800">{deleteTarget.descricao}</span>
              </p>
              <p className="text-sm text-gray-500 mb-5">
                Este é um pagamento parcelado (parcela {deleteTarget.parcela_numero}/{deleteTarget.parcela_total}). O que deseja apagar?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => execDelete(deleteTarget.id, false)}
                  disabled={deleting}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {deleting ? "A apagar…" : "Somente esta conta"}
                </button>
                <button
                  type="button"
                  onClick={() => execDelete(deleteTarget.id, true)}
                  disabled={deleting}
                  className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  {deleting ? "A apagar…" : `Todas as contas do parcelamento (${deleteTarget.parcela_total})`}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="w-full px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal marcar pago */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !paying && setPayTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Marcar como pago</h2>
              <p className="text-sm text-gray-500 mb-4">{payTarget.descricao} • {formatEUR(Number(payTarget.valor))}</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Data do pagamento</label>
                  <input type="date" value={payData} onChange={(e) => setPayData(e.target.value)} className={`${inputClass} w-full`} disabled={paying} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Forma de pagamento</label>
                  <select value={payFormaId} onChange={(e) => setPayFormaId(e.target.value)} className={`${inputClass} w-full`} disabled={paying}>
                    <option value="">— (não registar)</option>
                    {formasPagamento.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setPayTarget(null)} className="flex-1" disabled={paying}>Cancelar</Button>
                <Button onClick={confirmPay} className="flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={paying}>
                  {paying ? "A guardar…" : "Confirmar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
