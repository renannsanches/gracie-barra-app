"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarLancamento } from "../actions";
import { criarFornecedor } from "../../fornecedores/actions";
import { criarCliente } from "../../clientes/actions";
import type { AlunoCombo, Fornecedor, CategoriaFinanceira, TipoLancamento } from "@/lib/types";

interface Props {
  fornecedores: Fornecedor[];
  clientes: Fornecedor[];
  alunos: AlunoCombo[];
  categorias: CategoriaFinanceira[];
}

const inputClass =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue";

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function formatData(iso: string) {
  const [a, m, dia] = iso.split("-");
  return `${dia}/${m}/${a}`;
}

function formatEUR(v: number) {
  return v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

export function NovoLancamentoForm({ fornecedores, clientes, alunos, categorias }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [tipo, setTipo] = useState<TipoLancamento>("pagar");
  const [descricao, setDescricao] = useState("");
  // Destinatário: "f:<id>" para fornecedor/cliente da tabela fornecedores, "a:<id>" para aluno
  const [destinatario, setDestinatario] = useState<string>("");
  const [novoDestinatarioNome, setNovoDestinatarioNome] = useState("");
  const [criandoDestinatario, setCriandoDestinatario] = useState(false);
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [dataVenc, setDataVenc] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [valor, setValor] = useState<string>("");
  const [notas, setNotas] = useState("");

  const [parcelado, setParcelado] = useState(false);
  const [parcelas, setParcelas] = useState(2);
  const [intervalo, setIntervalo] = useState(30);

  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Filtra categorias activas pelo tipo: despesa→pagar, receita→receber
  const categoriasFiltradas = useMemo(() => {
    const tipoCat = tipo === "pagar" ? "despesa" : "receita";
    return categorias.filter((c) => c.tipo === tipoCat);
  }, [categorias, tipo]);

  const preview = useMemo(() => {
    const v = Number(valor);
    if (!parcelado || !dataVenc || !v || parcelas < 2) return [];
    return Array.from({ length: parcelas }, (_, i) => ({
      n: i + 1,
      data: i === 0 ? dataVenc : addDaysISO(dataVenc, intervalo * i),
      valor: v,
    }));
  }, [parcelado, dataVenc, valor, parcelas, intervalo]);

  async function handleCriarDestinatario() {
    if (!novoDestinatarioNome.trim()) return;
    setCriandoDestinatario(true);
    const r = tipo === "pagar"
      ? await criarFornecedor({ nome: novoDestinatarioNome.trim(), tipo: "fornecedor" })
      : await criarCliente({ nome: novoDestinatarioNome.trim() });
    setCriandoDestinatario(false);
    if (!r.ok) { window.alert(r.erro ?? "Erro ao criar."); return; }
    setDestinatario(`f:${r.id!}`);
    setNovoDestinatarioNome("");
    startTransition(() => router.refresh());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const v = Number(valor);
    if (!descricao.trim()) { setErro("Descrição obrigatória."); return; }
    if (!dataVenc) { setErro("Vencimento obrigatório."); return; }
    if (!v || v <= 0) { setErro("Valor deve ser maior que zero."); return; }

    // Resolver destinatário em fornecedor_id ou aluno_id
    let fornecedor_id: string | null = null;
    let aluno_id: string | null = null;
    if (destinatario) {
      const [pfx, pid] = destinatario.split(":");
      if (pfx === "a") aluno_id = pid;
      else fornecedor_id = pid;
    }

    setSubmitting(true);
    const r = await criarLancamento({
      tipo,
      descricao,
      fornecedor_id,
      aluno_id,
      categoria_id: categoriaId || null,
      data_vencimento: dataVenc,
      valor: v,
      notas,
      parcelado,
      parcelas: parcelado ? parcelas : undefined,
      intervalo_dias: parcelado ? intervalo : undefined,
    });
    setSubmitting(false);
    if (!r.ok) { setErro(r.erro ?? "Erro inesperado."); return; }
    router.push("/admin/financeiro/contas");
    startTransition(() => router.refresh());
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/admin/financeiro/contas" className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-bold text-gray-900 text-xl">Novo lançamento</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        {/* Toggle tipo */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { setTipo("pagar"); setCategoriaId(""); }}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-medium text-sm transition-colors ${
              tipo === "pagar"
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            <ArrowDownRight size={16} /> A pagar
          </button>
          <button
            type="button"
            onClick={() => { setTipo("receber"); setCategoriaId(""); }}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-medium text-sm transition-colors ${
              tipo === "receber"
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            <ArrowUpRight size={16} /> A receber
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Descrição *</label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === "pagar" ? "Ex.: Aluguer Junho" : "Ex.: Exame faixa azul"} className="rounded-xl h-10" disabled={submitting} />
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              {tipo === "pagar" ? "Fornecedor" : "Cliente / Aluno"}
            </label>
            {tipo === "pagar" ? (
              <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)} className={inputClass} disabled={submitting}>
                <option value="">— Nenhum —</option>
                {fornecedores.map((f) => <option key={f.id} value={`f:${f.id}`}>{f.nome}</option>)}
              </select>
            ) : (
              <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)} className={inputClass} disabled={submitting}>
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
            <div className="flex gap-1 mt-1">
              <input
                type="text"
                placeholder={tipo === "pagar" ? "Criar fornecedor rapidamente…" : "Criar cliente rapidamente…"}
                value={novoDestinatarioNome}
                onChange={(e) => setNovoDestinatarioNome(e.target.value)}
                className={`${inputClass} h-8 text-xs flex-1`}
                disabled={submitting || criandoDestinatario}
              />
              <button
                type="button"
                onClick={handleCriarDestinatario}
                disabled={!novoDestinatarioNome.trim() || criandoDestinatario || submitting}
                className="px-3 h-8 text-xs rounded-xl bg-gb-blue text-white disabled:opacity-40 hover:bg-gb-blue-dark"
              >
                {criandoDestinatario ? "..." : "Criar"}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Categoria</label>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={inputClass} disabled={submitting}>
              <option value="">— Nenhuma —</option>
              {categoriasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parent_id ? "└ " : ""}{c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Vencimento *</label>
            <input type="date" value={dataVenc} onChange={(e) => setDataVenc(e.target.value)} className={inputClass} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Valor (€) *</label>
            <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={inputClass} disabled={submitting} />
          </div>
        </div>

        {/* Parcelamento */}
        <div className="rounded-xl border border-gray-200 p-3 space-y-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Pagamento parcelado</p>
              <p className="text-xs text-gray-500">Cria várias contas com vencimentos espaçados</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={parcelado}
              onClick={() => setParcelado((v) => !v)}
              disabled={submitting}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${parcelado ? "bg-gb-blue" : "bg-gray-300"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${parcelado ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {parcelado && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Nº de parcelas</label>
                  <input type="number" min="2" max="60" value={parcelas} onChange={(e) => setParcelas(Math.max(2, Number(e.target.value)))} className={inputClass} disabled={submitting} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Intervalo (dias)</label>
                  <input type="number" min="1" max="365" value={intervalo} onChange={(e) => setIntervalo(Math.max(1, Number(e.target.value)))} className={inputClass} disabled={submitting} />
                </div>
              </div>

              {preview.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-100 p-2 max-h-48 overflow-y-auto">
                  <p className="text-xs text-gray-400 px-2 py-1">Previsão das parcelas:</p>
                  <ul className="text-xs divide-y divide-gray-50">
                    {preview.map((p) => (
                      <li key={p.n} className="px-2 py-1.5 flex justify-between">
                        <span>Parcela {p.n}/{preview.length} — {formatData(p.data)}</span>
                        <span className="font-medium">{formatEUR(p.valor)}</span>
                      </li>
                    ))}
                    <li className="px-2 py-1.5 flex justify-between font-semibold text-gray-700 bg-gray-50">
                      <span>Total</span>
                      <span>{formatEUR(preview.reduce((s, p) => s + p.valor, 0))}</span>
                    </li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Notas</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue resize-none" disabled={submitting} />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="flex gap-2 pt-1">
          <Link href="/admin/financeiro/contas" className="flex-1">
            <Button type="button" variant="outline" className="w-full" disabled={submitting}>Cancelar</Button>
          </Link>
          <Button type="submit" className="flex-1 bg-gb-blue hover:bg-gb-blue-dark text-white" disabled={submitting}>
            {submitting ? "A guardar…" : parcelado ? `Criar ${parcelas} parcelas` : "Criar lançamento"}
          </Button>
        </div>
      </form>
    </div>
  );
}
