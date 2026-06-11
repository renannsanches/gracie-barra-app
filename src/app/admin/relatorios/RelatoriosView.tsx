"use client";

import { useState, useTransition } from "react";
import { FileSpreadsheet, FileText, Loader2, Download } from "lucide-react";
import {
  getRelatorioFinanceiro,
  getRelatorioPresencas,
  getRelatorioLancamentos,
  MensalidadeRelatorio,
  PresencaRelatorio,
  LancamentoRelatorio,
} from "./actions";

type Tab = "financeiro" | "presencas" | "lancamentos";

const STATUS_OPTS = [
  { value: "todos",    label: "Todos os status" },
  { value: "pago",     label: "Pago" },
  { value: "pendente", label: "Pendente" },
  { value: "atrasado", label: "Atrasado" },
];

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

function inicioMes() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-PT").format(d);
}

function formatTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function formatEuro(val: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(val);
}

function statusLabel(s: string) {
  if (s === "pago") return "Pago";
  if (s === "pendente") return "Pendente";
  if (s === "atrasado") return "Atrasado";
  return s;
}

async function fetchLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch("/logo.webp");
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  } catch {
    return null;
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportFinanceiroExcel(dados: MensalidadeRelatorio[], mes: string) {
  const { utils, writeFile } = await import("xlsx");

  const rows = dados.map((r) => ({
    "Nome do Aluno": r.aluno_nome,
    "Mês Referência": r.mes_referencia.slice(0, 7),
    "Vencimento": formatDate(r.data_vencimento),
    "Valor (€)": r.valor,
    "Status": statusLabel(r.status),
    "Data Pagamento": r.data_pagamento ? formatDate(r.data_pagamento) : "—",
  }));

  const totalPago = dados.filter((r) => r.status === "pago").reduce((s, r) => s + r.valor, 0);
  const totalPendente = dados.filter((r) => r.status !== "pago").reduce((s, r) => s + r.valor, 0);

  rows.push({} as any);
  rows.push({
    "Nome do Aluno": "TOTAL PAGO",
    "Mês Referência": "",
    "Vencimento": "",
    "Valor (€)": totalPago,
    "Status": "",
    "Data Pagamento": "",
  });
  rows.push({
    "Nome do Aluno": "TOTAL PENDENTE/ATRASADO",
    "Mês Referência": "",
    "Vencimento": "",
    "Valor (€)": totalPendente,
    "Status": "",
    "Data Pagamento": "",
  });
  rows.push({
    "Nome do Aluno": "TOTAL GERAL",
    "Mês Referência": "",
    "Vencimento": "",
    "Valor (€)": totalPago + totalPendente,
    "Status": "",
    "Data Pagamento": "",
  });

  const ws = utils.json_to_sheet(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Financeiro");

  writeFile(wb, `financeiro-${mes}.xlsx`);
}

async function exportFinanceiroPDF(dados: MensalidadeRelatorio[], mes: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape" });
  const logoB64 = await fetchLogoBase64();

  let y = 14;
  if (logoB64) {
    doc.addImage(logoB64, "WEBP", 14, y, 18, 18);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("GRACIE BARRA FAMALICÃO", 36, y + 7);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatório Financeiro — ${mes}`, 36, y + 14);
    doc.text(`Gerado em ${formatDate(hoje())}`, 36, y + 20);
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("GRACIE BARRA FAMALICÃO — Relatório Financeiro", 14, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Mês: ${mes} · Gerado em ${formatDate(hoje())}`, 14, y + 7);
  }

  y = 40;

  const totalPago = dados.filter((r) => r.status === "pago").reduce((s, r) => s + r.valor, 0);
  const totalPendente = dados.filter((r) => r.status !== "pago").reduce((s, r) => s + r.valor, 0);

  autoTable(doc, {
    startY: y,
    head: [["Nome do Aluno", "Mês Referência", "Vencimento", "Valor", "Status", "Data Pagamento"]],
    body: dados.map((r) => [
      r.aluno_nome,
      r.mes_referencia.slice(0, 7),
      formatDate(r.data_vencimento),
      formatEuro(r.valor),
      statusLabel(r.status),
      r.data_pagamento ? formatDate(r.data_pagamento) : "—",
    ]),
    foot: [
      ["Total Pago", "", "", formatEuro(totalPago), "", ""],
      ["Total Pendente/Atrasado", "", "", formatEuro(totalPendente), "", ""],
      ["Total Geral", "", "", formatEuro(totalPago + totalPendente), "", ""],
    ],
    headStyles: { fillColor: [204, 0, 0] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    styles: { fontSize: 9 },
  });

  doc.save(`financeiro-${mes}.pdf`);
}

async function exportPresencasExcel(dados: PresencaRelatorio[], inicio: string, fim: string) {
  const { utils, writeFile } = await import("xlsx");

  const rows = dados.map((r) => ({
    "Nome do Aluno": r.aluno_nome,
    "Data": formatDate(r.registrado_em),
    "Hora": formatTime(r.registrado_em),
  }));

  const countMap: Record<string, number> = {};
  for (const r of dados) countMap[r.aluno_nome] = (countMap[r.aluno_nome] ?? 0) + 1;
  const resumo = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .map(([nome, total]) => ({ "Nome do Aluno": nome, "Total Presenças": total }));

  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.json_to_sheet(rows), "Presenças");
  utils.book_append_sheet(wb, utils.json_to_sheet(resumo), "Resumo por Aluno");

  writeFile(wb, `presencas-${inicio}_${fim}.xlsx`);
}

async function exportPresencasPDF(dados: PresencaRelatorio[], inicio: string, fim: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape" });
  const logoB64 = await fetchLogoBase64();

  let y = 14;
  if (logoB64) {
    doc.addImage(logoB64, "WEBP", 14, y, 18, 18);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("GRACIE BARRA FAMALICÃO", 36, y + 7);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatório de Presenças — ${formatDate(inicio)} a ${formatDate(fim)}`, 36, y + 14);
    doc.text(`Gerado em ${formatDate(hoje())}`, 36, y + 20);
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("GRACIE BARRA FAMALICÃO — Relatório de Presenças", 14, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Período: ${formatDate(inicio)} a ${formatDate(fim)} · Gerado em ${formatDate(hoje())}`, 14, y + 7);
  }

  y = 40;

  autoTable(doc, {
    startY: y,
    head: [["Nome do Aluno", "Data", "Hora"]],
    body: dados.map((r) => [r.aluno_nome, formatDate(r.registrado_em), formatTime(r.registrado_em)]),
    headStyles: { fillColor: [204, 0, 0] },
    styles: { fontSize: 9 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  const countMap: Record<string, number> = {};
  for (const r of dados) countMap[r.aluno_nome] = (countMap[r.aluno_nome] ?? 0) + 1;
  const resumo = Object.entries(countMap).sort((a, b) => b[1] - a[1]);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo por Aluno", 14, finalY);

  autoTable(doc, {
    startY: finalY + 4,
    head: [["Nome do Aluno", "Total Presenças"]],
    body: resumo,
    headStyles: { fillColor: [204, 0, 0] },
    styles: { fontSize: 9 },
  });

  doc.save(`presencas-${inicio}_${fim}.pdf`);
}

async function exportLancamentosExcel(dados: LancamentoRelatorio[], inicio: string, fim: string) {
  const { utils, writeFile } = await import("xlsx");

  const rows = dados.map((r) => ({
    "Tipo": r.tipo === "pagar" ? "A pagar" : "A receber",
    "Descrição": r.descricao,
    "Fornecedor/Cliente": r.fornecedor_nome,
    "Categoria pai": r.categoria_pai_nome,
    "Categoria": r.categoria_nome,
    "Vencimento": formatDate(r.data_vencimento),
    "Valor (€)": r.valor,
    "Status": statusLabel(r.status),
    "Data Pagamento": r.data_pagamento ? formatDate(r.data_pagamento) : "—",
    "Forma": r.forma_pagamento_nome,
  }));

  const totReceitas = dados.filter((r) => r.tipo === "receber" && r.status === "pago").reduce((s, r) => s + r.valor, 0);
  const totDespesas = dados.filter((r) => r.tipo === "pagar"   && r.status === "pago").reduce((s, r) => s + r.valor, 0);

  rows.push({} as any);
  rows.push({ "Tipo": "TOTAL RECEITAS (pagas)",  "Descrição": "", "Fornecedor/Cliente": "", "Categoria pai": "", "Categoria": "", "Vencimento": "", "Valor (€)": totReceitas,  "Status": "", "Data Pagamento": "", "Forma": "" });
  rows.push({ "Tipo": "TOTAL DESPESAS (pagas)",  "Descrição": "", "Fornecedor/Cliente": "", "Categoria pai": "", "Categoria": "", "Vencimento": "", "Valor (€)": totDespesas,  "Status": "", "Data Pagamento": "", "Forma": "" });
  rows.push({ "Tipo": "SALDO REALIZADO",         "Descrição": "", "Fornecedor/Cliente": "", "Categoria pai": "", "Categoria": "", "Vencimento": "", "Valor (€)": totReceitas - totDespesas, "Status": "", "Data Pagamento": "", "Forma": "" });

  const ws = utils.json_to_sheet(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Lançamentos");
  writeFile(wb, `lancamentos-${inicio}_${fim}.xlsx`);
}

async function exportFluxoCaixaPDF(dados: LancamentoRelatorio[], inicio: string, fim: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait" });
  const logoB64 = await fetchLogoBase64();

  let y = 14;
  if (logoB64) {
    doc.addImage(logoB64, "WEBP", 14, y, 18, 18);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("GRACIE BARRA FAMALICÃO", 36, y + 7);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fluxo de Caixa — ${formatDate(inicio)} a ${formatDate(fim)}`, 36, y + 14);
    doc.text(`Gerado em ${formatDate(hoje())}`, 36, y + 20);
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("GRACIE BARRA FAMALICÃO — Fluxo de Caixa", 14, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Período: ${formatDate(inicio)} a ${formatDate(fim)} · Gerado em ${formatDate(hoje())}`, 14, y + 7);
  }

  // Agrupar por categoria pai
  type Grupo = { receitas: number; despesas: number };
  const porPai: Record<string, Grupo> = {};
  for (const r of dados) {
    if (r.status !== "pago") continue;
    const key = r.categoria_pai_nome || "—";
    if (!porPai[key]) porPai[key] = { receitas: 0, despesas: 0 };
    if (r.tipo === "receber") porPai[key].receitas += r.valor;
    else                       porPai[key].despesas += r.valor;
  }

  const rows = Object.entries(porPai).map(([pai, g]) => [
    pai,
    formatEuro(g.receitas),
    formatEuro(g.despesas),
    formatEuro(g.receitas - g.despesas),
  ]);

  const totRec = Object.values(porPai).reduce((s, g) => s + g.receitas, 0);
  const totDes = Object.values(porPai).reduce((s, g) => s + g.despesas, 0);

  autoTable(doc, {
    startY: 40,
    head: [["Categoria", "Receitas", "Despesas", "Saldo"]],
    body: rows,
    foot: [["Total", formatEuro(totRec), formatEuro(totDes), formatEuro(totRec - totDes)]],
    headStyles: { fillColor: [204, 0, 0] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    styles: { fontSize: 10 },
  });

  // Listagem detalhada na página seguinte
  doc.addPage();
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Detalhe dos lançamentos pagos", 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [["Data Pag.", "Tipo", "Descrição", "Categoria", "Valor"]],
    body: dados.filter((r) => r.status === "pago").map((r) => [
      r.data_pagamento ? formatDate(r.data_pagamento) : "—",
      r.tipo === "pagar" ? "Pagar" : "Receber",
      r.descricao,
      r.categoria_nome,
      formatEuro(r.valor),
    ]),
    headStyles: { fillColor: [204, 0, 0] },
    styles: { fontSize: 8 },
  });

  doc.save(`fluxo-caixa-${inicio}_${fim}.pdf`);
}

const selectClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gb-blue/40";
const inputClass =
  "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gb-blue/40";

export function RelatoriosView({
  turmas,
  categorias,
}: {
  turmas: { id: string; nome: string }[];
  categorias: { id: string; nome: string }[];
}) {
  const [tab, setTab] = useState<Tab>("financeiro");
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // Financeiro filters
  const [mes, setMes] = useState(mesAtual());
  const [status, setStatus] = useState("todos");

  // Presenças filters
  const [dataInicio, setDataInicio] = useState(inicioMes());
  const [dataFim, setDataFim] = useState(hoje());
  const [turmaId, setTurmaId] = useState("");

  // Lançamentos filters
  const [lancInicio, setLancInicio] = useState(inicioMes());
  const [lancFim, setLancFim] = useState(hoje());
  const [lancTipo, setLancTipo] = useState<"todos" | "pagar" | "receber">("todos");
  const [lancCategoria, setLancCategoria] = useState("");

  function handleExport(format: "xlsx" | "pdf", tipo: Tab) {
    setErro(null);
    startTransition(async () => {
      if (tipo === "financeiro") {
        const result = await getRelatorioFinanceiro({ mes, status: status as any });
        if (!result.ok) { setErro(result.erro); return; }
        if (result.dados.length === 0) { setErro("Nenhum registo encontrado para os filtros seleccionados."); return; }
        if (format === "xlsx") await exportFinanceiroExcel(result.dados, mes);
        else await exportFinanceiroPDF(result.dados, mes);
      } else if (tipo === "presencas") {
        const result = await getRelatorioPresencas({
          data_inicio: dataInicio,
          data_fim: dataFim,
          turma_id: turmaId || undefined,
        });
        if (!result.ok) { setErro(result.erro); return; }
        if (result.dados.length === 0) { setErro("Nenhuma presença encontrada para os filtros seleccionados."); return; }
        if (format === "xlsx") await exportPresencasExcel(result.dados, dataInicio, dataFim);
        else await exportPresencasPDF(result.dados, dataInicio, dataFim);
      } else {
        const result = await getRelatorioLancamentos({
          data_inicio: lancInicio,
          data_fim: lancFim,
          tipo: lancTipo,
          categoria_id: lancCategoria || undefined,
        });
        if (!result.ok) { setErro(result.erro); return; }
        if (result.dados.length === 0) { setErro("Nenhum lançamento encontrado para os filtros seleccionados."); return; }
        if (format === "xlsx") await exportLancamentosExcel(result.dados, lancInicio, lancFim);
        else await exportFluxoCaixaPDF(result.dados, lancInicio, lancFim);
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-black text-gb-black mb-6">Relatórios</h1>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 mb-6">
        {(["financeiro", "lancamentos", "presencas"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setErro(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t ? "bg-white shadow text-gb-black" : "text-gray-500 hover:text-gb-black"
            }`}
          >
            {t === "financeiro" ? "Mensalidades" : t === "lancamentos" ? "Lançamentos" : "Presenças"}
          </button>
        ))}
      </div>

      {erro && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {tab === "financeiro" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-bold text-gb-black">Relatório Financeiro</h2>
          <p className="text-sm text-gray-500">Exporta mensalidades com totais por status.</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mês</label>
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className={inputClass + " w-full"}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
                {STATUS_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleExport("xlsx", "financeiro")}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => handleExport("pdf", "financeiro")}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gb-blue text-white text-sm font-semibold hover:bg-gb-blue-dark transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              PDF
            </button>
          </div>
        </div>
      )}

      {tab === "lancamentos" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-bold text-gb-black">Lançamentos avulsos</h2>
          <p className="text-sm text-gray-500">
            Exporta contas a pagar e receber. PDF gera fluxo de caixa agrupado por categoria pai.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data início</label>
              <input
                type="date"
                value={lancInicio}
                onChange={(e) => setLancInicio(e.target.value)}
                className={inputClass + " w-full"}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data fim</label>
              <input
                type="date"
                value={lancFim}
                onChange={(e) => setLancFim(e.target.value)}
                className={inputClass + " w-full"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select value={lancTipo} onChange={(e) => setLancTipo(e.target.value as "todos" | "pagar" | "receber")} className={selectClass}>
                <option value="todos">Todos</option>
                <option value="pagar">A pagar</option>
                <option value="receber">A receber</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
              <select value={lancCategoria} onChange={(e) => setLancCategoria(e.target.value)} className={selectClass}>
                <option value="">Todas as categorias</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleExport("xlsx", "lancamentos")}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => handleExport("pdf", "lancamentos")}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gb-blue text-white text-sm font-semibold hover:bg-gb-blue-dark transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              PDF Fluxo de Caixa
            </button>
          </div>
        </div>
      )}

      {tab === "presencas" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-bold text-gb-black">Relatório de Presenças</h2>
          <p className="text-sm text-gray-500">Exporta presenças por período com resumo por aluno.</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={inputClass + " w-full"}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                max={hoje()}
                className={inputClass + " w-full"}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Turma (opcional)</label>
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className={selectClass}>
              <option value="">Todas as turmas</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleExport("xlsx", "presencas")}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => handleExport("pdf", "presencas")}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gb-blue text-white text-sm font-semibold hover:bg-gb-blue-dark transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
