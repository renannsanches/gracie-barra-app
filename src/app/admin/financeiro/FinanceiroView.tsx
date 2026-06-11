"use client";

import { useState, useMemo, useTransition } from "react";
import { marcarPago, desmarcarPago } from "./actions";
import { getEffectiveStatus } from "@/lib/mensalidade-status";
import type { Mensalidade, StatusMensalidade } from "@/lib/types";

type MensalidadeComAluno = Mensalidade & {
  profiles: { nome_completo: string } | null;
};

interface Props {
  mensalidades: MensalidadeComAluno[];
}

function statusBadge(s: StatusMensalidade) {
  if (s === "pago") return { label: "Pago", cls: "bg-green-100 text-green-700" };
  if (s === "atrasado") return { label: "Vencida", cls: "bg-red-100 text-red-700" };
  return { label: "Pendente", cls: "bg-yellow-100 text-yellow-700" };
}

function formatMes(mes: string) {
  const [ano, m] = mes.split("-");
  const d = new Date(Number(ano), Number(m) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatData(d: string | null) {
  if (!d) return "—";
  const [ano, mes, dia] = d.split("-");
  return `${dia}/${mes}/${ano}`;
}

const inputClass =
  "h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue";

const hoje = new Date();
const MES_ATUAL = String(hoje.getMonth() + 1).padStart(2, "0");
const ANO_ATUAL = String(hoje.getFullYear());

export function FinanceiroView({ mensalidades }: Props) {
  const [busca, setBusca] = useState("");
  const [filtroMes, setFiltroMes] = useState(MES_ATUAL);
  const [filtroAno, setFiltroAno] = useState(ANO_ATUAL);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<"" | StatusMensalidade>("");
  const [pending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const temPeriodo = !!(dataInicio || dataFim);

  const anos = useMemo(() => {
    const set = new Set(mensalidades.map((m) => m.mes_referencia.slice(0, 4)));
    set.add(ANO_ATUAL);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [mensalidades]);

  const filtered = useMemo(() => {
    return mensalidades.filter((m) => {
      const nome = m.profiles?.nome_completo ?? "";
      if (busca && !nome.toLowerCase().includes(busca.toLowerCase())) return false;
      if (statusFiltro && getEffectiveStatus(m) !== statusFiltro) return false;
      if (temPeriodo) {
        if (dataInicio && m.data_vencimento < dataInicio) return false;
        if (dataFim && m.data_vencimento > dataFim) return false;
      } else {
        if (filtroAno && !m.mes_referencia.startsWith(filtroAno)) return false;
        if (filtroMes && m.mes_referencia.slice(5, 7) !== filtroMes) return false;
      }
      return true;
    });
  }, [mensalidades, busca, filtroAno, filtroMes, statusFiltro, dataInicio, dataFim, temPeriodo]);

  const totalPago = filtered.filter((m) => m.status === "pago").reduce((s, m) => s + m.valor, 0);
  const totalPendente = filtered.filter((m) => m.status !== "pago").reduce((s, m) => s + m.valor, 0);

  function handleMarcar(id: string) {
    setLoadingId(id);
    startTransition(async () => {
      await marcarPago(id);
      setLoadingId(null);
    });
  }

  function handleDesmarcar(id: string) {
    setLoadingId(id);
    startTransition(async () => {
      await desmarcarPago(id);
      setLoadingId(null);
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-500">{mensalidades.length} mensalidades no total</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 font-medium">
            {filtered.length} registo{filtered.length !== 1 ? "s" : ""}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-green-50 text-green-700 font-medium border border-green-100">
            Pago: {totalPago.toLocaleString("pt-BR", { style: "currency", currency: "EUR" })}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-yellow-50 text-yellow-700 font-medium border border-yellow-100">
            Pendente/Atrasado: {totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "EUR" })}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Buscar aluno..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className={`${inputClass} w-52`}
        />
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
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          title="Filtrar por status"
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value as "" | StatusMensalidade)}
          className={inputClass}
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="atrasado">Atrasado</option>
        </select>
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500" htmlFor="data-inicio">De</label>
          <input
            id="data-inicio"
            type="date"
            title="Período: data inicial (vencimento)"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className={inputClass}
          />
          <label className="text-xs text-gray-500" htmlFor="data-fim">Até</label>
          <input
            id="data-fim"
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

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Aluno</th>
                <th className="text-left px-4 py-3 font-medium">Mês</th>
                <th className="text-left px-4 py-3 font-medium">Vencimento</th>
                <th className="text-right px-4 py-3 font-medium">Valor</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Data Pagamento</th>
                <th className="text-left px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
              {filtered.map((m) => {
                const { label, cls } = statusBadge(getEffectiveStatus(m));
                const isLoading = loadingId === m.id;
                return (
                  <tr key={m.id} data-mensalidade-id={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {m.profiles?.nome_completo ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{formatMes(m.mes_referencia)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatData(m.data_vencimento)}</td>
                    <td className="px-4 py-3 text-gray-900 text-right font-medium">
                      {m.valor.toLocaleString("pt-BR", { style: "currency", currency: "EUR" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatData(m.data_pagamento)}</td>
                    <td className="px-4 py-3">
                      {m.status !== "pago" ? (
                        <button
                          type="button"
                          data-testid="btn-marcar-pago"
                          disabled={isLoading || pending}
                          onClick={() => handleMarcar(m.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-40"
                        >
                          {isLoading ? "..." : "Marcar pago"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid="btn-desmarcar-pago"
                          disabled={isLoading || pending}
                          onClick={() => handleDesmarcar(m.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors disabled:opacity-40"
                        >
                          {isLoading ? "..." : "Desmarcar"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-100 px-4 py-3 flex flex-wrap items-center gap-6 text-sm bg-gray-50">
          <span className="text-gray-400">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
          <span className="font-medium text-green-700">
            Pago: {totalPago.toLocaleString("pt-BR", { style: "currency", currency: "EUR" })}
          </span>
          <span className="font-medium text-yellow-700">
            Pendente/Atrasado: {totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "EUR" })}
          </span>
        </div>
      </div>
    </div>
  );
}
