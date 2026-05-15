"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Check, Loader2, User, CalendarDays, CreditCard,
  Plus, RotateCcw, Award, Trash2, Camera, Users,
  ChevronLeft, ChevronRight, TrendingUp, AlertTriangle, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FaixaBJJ, inferCategoria } from "@/components/FaixaBJJ";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PresencasCalendario } from "@/components/PresencasCalendario";
import {
  mascararTelefonePT, formatarData, formatarMoeda, formatarMes, labelCorFaixa,
} from "@/lib/utils";
import type {
  Profile, CorFaixa, StatusAluno, CategoriaFaixa, PerfilUsuario,
  Mensalidade, StatusMensalidade, HistoricoGraduacao,
} from "@/lib/types";
import type { PresencaItem } from "@/components/PresencasCalendario";
import {
  marcarPago as serverMarcarPago,
  desmarcarPago as serverDesmarcarPago,
  gerarProximoMes as serverGerarProximoMes,
  adicionarPresenca as serverAdicionarPresenca,
  excluirPresenca as serverExcluirPresenca,
  adicionarPresencasEmMassa as serverAdicionarPresencasEmMassa,
  zerarAulasManual as serverZerarAulasManual,
} from "./mensalidades-actions";
import { registrarGraduacao, excluirGraduacao } from "./graduacao-actions";
import { uploadFotoAluno } from "./foto-actions";
import { atualizarResponsavel } from "./dependentes-actions";
import type { ProfileSimples } from "./page";

async function comprimirParaWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 500;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) { height = Math.round((height / width) * MAX); width = MAX; }
        else                  { width  = Math.round((width / height) * MAX); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) { reject(new Error("Canvas não suportado")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Falha ao converter imagem")),
        "image/webp", 0.8,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Falha ao carregar imagem")); };
    img.src = url;
  });
}

// ─── Belt lists by category ───────────────────────────────────────────────────
const ADULT_BELTS: CorFaixa[] = [
  "branca", "azul", "roxa", "marrom", "preta", "coral", "vermelha",
];
const KIDS_BELTS: CorFaixa[] = [
  "branca",
  "cinza_branca", "cinza", "cinza_preta",
  "amarela_branca", "amarela", "amarela_preta",
  "laranja_branca", "laranja", "laranja_preta",
  "verde_branca", "verde", "verde_preta",
];

// ─── Shared styles ────────────────────────────────────────────────────────────
const selectClass =
  "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 " +
  "focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue";

const STATUS_MENS_CLASS: Record<StatusMensalidade, string> = {
  pago:     "bg-green-100 text-green-700",
  pendente: "bg-amber-100 text-amber-700",
  atrasado: "bg-red-100 text-red-700",
};
const STATUS_MENS_LABEL: Record<StatusMensalidade, string> = {
  pago: "Pago", pendente: "Pendente", atrasado: "Atrasado",
};

const hoje = new Date().toISOString().split("T")[0];

// ─── Mínimos de aulas por faixa (adultos) para indicador de graduação ─────────
const MINIMOS_POR_FAIXA: Partial<Record<CorFaixa, number>> = {
  azul:   40,
  roxa:   80,
  marrom: 120,
  preta:  200,
};

const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

interface FrequenciaStats {
  totalPresencas: number;
  semanasTotais: number;
  com0: number;
  com1: number;
  com2: number;
  com3mais: number;
  semanasComRequisito: number;
  percentual: number;
  mediaSemanal: number;
  primeiraPresenca: Date | null;
}

function calcularFrequenciaSemanal(presencas: PresencaItem[]): FrequenciaStats {
  const empty: FrequenciaStats = { totalPresencas: 0, semanasTotais: 0, com0: 0, com1: 0, com2: 0, com3mais: 0, semanasComRequisito: 0, percentual: 0, mediaSemanal: 0, primeiraPresenca: null };
  if (presencas.length === 0) return empty;

  const semanas = new Map<string, number>();
  let primeiraData: Date | null = null;

  for (const p of presencas) {
    const d = new Date(p.registrado_em);
    if (!primeiraData || d < primeiraData) primeiraData = d;
    const chave = getISOWeekKey(d);
    semanas.set(chave, (semanas.get(chave) ?? 0) + 1);
  }

  const semanaHoje = getISOWeekKey(new Date());
  let semanasTotais = 0;
  const cursor = new Date(primeiraData!);
  cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() || 7) - 1));
  while (getISOWeekKey(cursor) <= semanaHoje) {
    semanasTotais++;
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  const com1     = [...semanas.values()].filter(n => n === 1).length;
  const com2     = [...semanas.values()].filter(n => n === 2).length;
  const com3mais = [...semanas.values()].filter(n => n >= 3).length;
  const com0     = Math.max(0, semanasTotais - com1 - com2 - com3mais);
  const semanasComRequisito = com2 + com3mais;
  const percentual    = semanasTotais > 0 ? Math.round((semanasComRequisito / semanasTotais) * 100) : 0;
  const mediaSemanal  = semanasTotais > 0 ? Math.round((presencas.length / semanasTotais) * 10) / 10 : 0;

  return { totalPresencas: presencas.length, semanasTotais, com0, com1, com2, com3mais, semanasComRequisito, percentual, mediaSemanal, primeiraPresenca: primeiraData };
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  aluno: Profile;
  presencas: PresencaItem[];
  mensalidades: Mensalidade[];
  graduacoes: HistoricoGraduacao[];
  responsavel: ProfileSimples | null;
  dependentesDoAluno: ProfileSimples[];
  alunosComLogin: ProfileSimples[];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AlunoEditView({
  aluno: alunoProp,
  presencas: presencasProp,
  mensalidades: mensalidadesProp,
  graduacoes: graduacoesProp,
  responsavel: responsavelProp,
  dependentesDoAluno,
  alunosComLogin,
}: Props) {
  const router = useRouter();
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // ── Profile state ──────────────────────────────────────────────────────────
  const [aluno, setAluno] = useState(alunoProp);
  const [fotoUrl, setFotoUrl] = useState(alunoProp.foto_url);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadFotoErro, setUploadFotoErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);
  const [salvoErro, setSalvoErro] = useState("");
  const [form, setForm] = useState({
    nome_completo:   aluno.nome_completo,
    telefone:        aluno.telefone ?? "",
    data_nascimento: aluno.data_nascimento ?? "",
    iban:            aluno.iban ?? "",
    nif:             aluno.nif ?? "",
    aulas_manual:    String(aluno.aulas_manual ?? 0),
    faixa:           aluno.faixa ?? "branca",
    graus:           String(aluno.graus ?? 0),
    categoria:       aluno.categoria,
    perfil:          aluno.perfil,
  });

  // ── Status toggle ──────────────────────────────────────────────────────────
  const [statusAluno, setStatusAluno] = useState<StatusAluno>(alunoProp.status);
  const [toggleSalvando, setToggleSalvando] = useState(false);
  const [toggleFeedback, setToggleFeedback] = useState<"ok" | "erro" | null>(null);

  // ── Mensalidades ───────────────────────────────────────────────────────────
  const [mensalidades, setMensalidades] = useState(mensalidadesProp);
  const [acao, setAcao] = useState<string | null>(null);
  const [acaoErro, setAcaoErro] = useState("");

  // ── Presenças ──────────────────────────────────────────────────────────────
  const [presencas, setPresencas] = useState(presencasProp);
  const [mostraAddPresenca, setMostraAddPresenca] = useState(false);
  const [dataPresenca, setDataPresenca] = useState("");
  const [addPresencaLoading, setAddPresencaLoading] = useState(false);
  const [addPresencaErro, setAddPresencaErro] = useState("");

  // ── Importar presenças em massa ───────────────────────────────────────────
  const [modoImportar, setModoImportar] = useState(false);
  const [datasImportar, setDatasImportar] = useState<Set<string>>(new Set());
  const [mesImportar, setMesImportar] = useState(() => {
    const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() };
  });
  const [importarLoading, setImportarLoading] = useState(false);
  const [importarResultado, setImportarResultado] = useState<{ criadas: number; duplicadas: number } | null>(null);
  const [importarErro, setImportarErro] = useState("");
  const [zerarLoading, setZerarLoading] = useState(false);

  // ── Responsável ───────────────────────────────────────────────────────────
  const [responsavelId, setResponsavelId] = useState(responsavelProp?.id ?? "");
  const [salvandoResp, setSalvandoResp] = useState(false);
  const [respErro, setRespErro] = useState("");
  const [respOk, setRespOk] = useState(false);

  // ── Graduações ─────────────────────────────────────────────────────────────
  const [graduacoes, setGraduacoes] = useState(graduacoesProp);
  const [mostraFormGrad, setMostraFormGrad] = useState(false);
  const [gradForm, setGradForm] = useState({
    categoria: alunoProp.categoria,
    faixa:     (alunoProp.faixa ?? "branca") as CorFaixa,
    graus:     String(alunoProp.graus ?? 0),
    data:      hoje,
    obs:       "",
  });
  const [gradSalvando, setGradSalvando] = useState(false);
  const [gradErro, setGradErro] = useState("");

  const beltOptions = gradForm.categoria === "infantil" ? KIDS_BELTS : ADULT_BELTS;

  // ── Derived ────────────────────────────────────────────────────────────────
  const iniciais = aluno.nome_completo.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  const ativo = statusAluno === "ativo";

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleToggleStatus() {
    const novoStatus: StatusAluno = ativo ? "inativo" : "ativo";
    setToggleSalvando(true);
    setToggleFeedback(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ status: novoStatus }).eq("id", aluno.id);
      if (error) throw error;
      setStatusAluno(novoStatus);
      setAluno((p) => ({ ...p, status: novoStatus }));
      setToggleFeedback("ok");
      setTimeout(() => setToggleFeedback(null), 2500);
    } catch {
      setToggleFeedback("erro");
      setTimeout(() => setToggleFeedback(null), 3000);
    } finally {
      setToggleSalvando(false);
    }
  }

  async function handleSalvar() {
    if (!form.nome_completo.trim()) { setSalvoErro("Nome não pode estar vazio."); return; }
    setSalvando(true); setSalvoErro(""); setSalvoOk(false);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({
        nome_completo:   form.nome_completo.trim(),
        telefone:        form.telefone.trim() || null,
        data_nascimento: form.data_nascimento || null,
        iban:            form.iban.trim() || null,
        nif:             form.nif.trim() || null,
        aulas_manual:    Number(form.aulas_manual),
        faixa:           form.faixa as CorFaixa,
        graus:           Number(form.graus),
        categoria:       form.categoria as CategoriaFaixa,
        status:          statusAluno,
        perfil:          form.perfil as PerfilUsuario,
      }).eq("id", aluno.id);
      if (error) throw error;
      setAluno((p) => ({
        ...p,
        nome_completo:   form.nome_completo.trim(),
        telefone:        form.telefone.trim() || null,
        data_nascimento: form.data_nascimento || null,
        iban:            form.iban.trim() || null,
        nif:             form.nif.trim() || null,
        aulas_manual:    Number(form.aulas_manual),
        faixa:           form.faixa as CorFaixa,
        graus:           Number(form.graus),
        categoria:       form.categoria as CategoriaFaixa,
        status:          statusAluno,
        perfil:          form.perfil as PerfilUsuario,
      }));
      setSalvoOk(true);
      setTimeout(() => setSalvoOk(false), 3000);
    } catch (err) {
      setSalvoErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadFotoErro("Apenas JPG, PNG e WebP são aceitos.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadFotoErro("A imagem deve ter no máximo 2MB.");
      return;
    }
    setUploadingFoto(true);
    setUploadFotoErro("");
    try {
      const blob = await comprimirParaWebP(file);
      const fd = new FormData();
      fd.append("foto", blob, "foto.webp");
      const result = await uploadFotoAluno(aluno.id, fd);
      if (!result.ok) throw new Error(result.erro);
      const urlComCache = `${result.url}?t=${Date.now()}`;
      setFotoUrl(urlComCache);
      setAluno((p) => ({ ...p, foto_url: result.url ?? p.foto_url }));
    } catch (err) {
      setUploadFotoErro(err instanceof Error ? err.message : "Erro ao fazer upload.");
    } finally {
      setUploadingFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = "";
    }
  }

  function handleCategoriaGrad(cat: CategoriaFaixa) {
    const opts = cat === "infantil" ? KIDS_BELTS : ADULT_BELTS;
    const faixa = opts.includes(gradForm.faixa) ? gradForm.faixa : opts[0];
    setGradForm((f) => ({ ...f, categoria: cat, faixa }));
  }

  async function handleGraduar() {
    setGradSalvando(true);
    setGradErro("");
    const result = await registrarGraduacao(
      aluno.id,
      aluno.faixa,
      aluno.graus ?? 0,
      gradForm.faixa,
      Number(gradForm.graus),
      gradForm.categoria,
      gradForm.data,
      gradForm.obs || undefined,
    );
    if (!result.ok) {
      setGradErro(result.erro ?? "Erro ao registar graduação.");
    } else {
      setAluno((p) => ({ ...p, faixa: gradForm.faixa, graus: Number(gradForm.graus), categoria: gradForm.categoria }));
      setGraduacoes((prev) => [result.graduacao, ...prev]);
      setMostraFormGrad(false);
      setGradErro("");
      setGradForm((f) => ({ ...f, obs: "", data: hoje }));
    }
    setGradSalvando(false);
  }

  async function handleExcluirGraduacao(id: string) {
    if (!confirm("Eliminar esta graduação do histórico?")) return;
    const result = await excluirGraduacao(id);
    if (result.ok) setGraduacoes((prev) => prev.filter((g) => g.id !== id));
  }

  async function handleMarcarPago(mensalidadeId: string) {
    setAcao(mensalidadeId); setAcaoErro("");
    const result = await serverMarcarPago(mensalidadeId, aluno.id);
    if (!result.ok) {
      setAcaoErro(result.erro ?? "Erro ao marcar como pago.");
    } else {
      const dia = new Date().toISOString().split("T")[0];
      setMensalidades((prev) =>
        prev.map((m) => m.id === mensalidadeId ? { ...m, status: "pago" as StatusMensalidade, data_pagamento: dia } : m)
      );
    }
    setAcao(null);
  }

  async function handleDesmarcarPago(mensalidadeId: string) {
    if (!confirm("Reverter pagamento para pendente?")) return;
    setAcao(`${mensalidadeId}-desmarcar`); setAcaoErro("");
    const result = await serverDesmarcarPago(mensalidadeId, aluno.id);
    if (!result.ok) {
      setAcaoErro(result.erro ?? "Erro ao reverter pagamento.");
    } else {
      setMensalidades((prev) =>
        prev.map((m) => m.id === mensalidadeId ? { ...m, status: "pendente" as StatusMensalidade, data_pagamento: null } : m)
      );
    }
    setAcao(null);
  }

  async function handleGerarProximoMes() {
    setAcao("gerar"); setAcaoErro("");
    const result = await serverGerarProximoMes(aluno.id);
    if (!result.ok) setAcaoErro(result.erro ?? "Erro ao gerar mensalidade.");
    else if (result.mensalidade) setMensalidades((prev) => [result.mensalidade!, ...prev]);
    setAcao(null);
  }

  async function handleAdicionarPresenca() {
    if (!dataPresenca) return;
    setAddPresencaLoading(true); setAddPresencaErro("");
    const result = await serverAdicionarPresenca(aluno.id, dataPresenca);
    setAddPresencaLoading(false);
    if (!result.ok) { setAddPresencaErro(result.erro ?? "Erro ao adicionar presença."); return; }
    setPresencas((prev) => [{ id: result.presencaId!, registrado_em: result.registrado_em! }, ...prev]);
    setDataPresenca(""); setMostraAddPresenca(false);
  }

  async function handleSalvarResponsavel() {
    setSalvandoResp(true);
    setRespErro("");
    setRespOk(false);
    const result = await atualizarResponsavel(aluno.id, responsavelId || null);
    setSalvandoResp(false);
    if (!result.ok) { setRespErro(result.erro ?? "Erro ao salvar responsável."); return; }
    setRespOk(true);
    setTimeout(() => setRespOk(false), 3000);
  }

  async function handleExcluirPresenca(id: string) {
    const result = await serverExcluirPresenca(id, aluno.id);
    if (!result.ok) throw new Error(result.erro);
    setPresencas((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleImportarPresencas() {
    if (datasImportar.size === 0) return;
    setImportarLoading(true);
    setImportarErro("");
    setImportarResultado(null);
    const result = await serverAdicionarPresencasEmMassa(aluno.id, [...datasImportar]);
    setImportarLoading(false);
    if (!result.ok) { setImportarErro(result.erro ?? "Erro ao importar presenças."); return; }
    setImportarResultado({ criadas: result.criadas!, duplicadas: result.duplicadas! });
    setDatasImportar(new Set());
    // Reload presencas from server via router.refresh (revalidatePath já foi chamado)
    router.refresh();
  }

  async function handleZerarAulasManual() {
    if (!window.confirm(`Zerar o contador de ${aluno.aulas_manual} aulas sem data? Isto não apaga as presenças já adicionadas.`)) return;
    setZerarLoading(true);
    const result = await serverZerarAulasManual(aluno.id);
    setZerarLoading(false);
    if (!result.ok) return;
    setAluno((p) => ({ ...p, aulas_manual: 0 }));
    setForm((f) => ({ ...f, aulas_manual: "0" }));
  }

  function toggleDiaImportar(dia: string) {
    setDatasImportar((prev) => {
      const next = new Set(prev);
      if (next.has(dia)) next.delete(dia); else next.add(dia);
      return next;
    });
  }

  // ─── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">

      {/* ── Back ── */}
      <button
        type="button"
        onClick={() => router.push("/admin/alunos")}
        className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm transition-colors"
      >
        <ArrowLeft size={16} />
        Alunos
      </button>

      {/* ── Header card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
        {/* Avatar clicável */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => !uploadingFoto && fotoInputRef.current?.click()}
            disabled={uploadingFoto}
            aria-label="Alterar foto de perfil"
            className="relative w-14 h-14 rounded-full bg-gb-blue flex items-center justify-center overflow-hidden group focus:outline-none focus:ring-2 focus:ring-gb-blue/40"
          >
            {fotoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={fotoUrl} alt={aluno.nome_completo} className="w-full h-full object-cover" />
              : <span className="text-white font-bold text-xl">{iniciais}</span>
            }
            {uploadingFoto
              ? <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 size={18} className="text-white animate-spin" />
                </div>
              : <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={16} className="text-white" />
                </div>
            }
          </button>
          <button
            type="button"
            onClick={() => !uploadingFoto && fotoInputRef.current?.click()}
            disabled={uploadingFoto}
            aria-label="Alterar foto"
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gb-blue border-2 border-white flex items-center justify-center shadow"
          >
            <Camera size={10} className="text-white" />
          </button>
        </div>

        <input
          ref={fotoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Selecionar foto de perfil"
          className="hidden"
          onChange={handleFotoChange}
        />

        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 text-lg leading-tight">{aluno.nome_completo}</p>
          {aluno.faixa && (
            <div className="mt-2">
              <FaixaBJJ faixa={aluno.faixa} graus={aluno.graus} categoria={aluno.categoria} tamanho="sm" showLabel />
            </div>
          )}
          {uploadFotoErro && (
            <p className="text-xs text-red-500 mt-1">{uploadFotoErro}</p>
          )}
        </div>
      </div>

      {/* ── Status toggle ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Status do aluno</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {ativo ? "Ativo — pode registar presenças" : "Inativo — acesso suspenso"}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {toggleFeedback === "ok" && <span className="text-xs font-medium text-green-600 flex items-center gap-1"><Check size={12} />Salvo</span>}
            {toggleFeedback === "erro" && <span className="text-xs font-medium text-red-600">Erro</span>}
            <button
              type="button"
              role="switch"
              aria-checked={ativo}
              aria-label="Ativar ou inativar aluno"
              disabled={toggleSalvando}
              onClick={handleToggleStatus}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 ${ativo ? "bg-green-500 focus:ring-green-500" : "bg-gray-300 focus:ring-gray-400"}`}
            >
              <span className={`inline-flex h-5 w-5 items-center justify-center transform rounded-full bg-white shadow transition-transform ${ativo ? "translate-x-6" : "translate-x-1"}`}>
                {toggleSalvando && <Loader2 size={10} className={`animate-spin ${ativo ? "text-green-500" : "text-gray-400"}`} />}
              </span>
            </button>
            <span className={`text-sm font-bold min-w-[50px] ${ativo ? "text-green-600" : "text-gray-400"}`}>
              {ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Dados do aluno ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <User size={16} className="text-gb-blue" />
          Dados do aluno
        </h2>

        {salvoOk && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            <Check size={15} className="text-green-600 shrink-0" />
            <p className="text-green-700 text-sm font-medium">Salvo com sucesso!</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="nome_completo">Nome completo</Label>
            <Input id="nome_completo" value={form.nome_completo} onChange={(e) => setForm((f) => ({ ...f, nome_completo: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" type="tel" placeholder="+351 XXX XXX XXX" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: mascararTelefonePT(e.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="data_nascimento">Data de nascimento</Label>
            <Input id="data_nascimento" type="date" title="Data de nascimento" value={form.data_nascimento} onChange={(e) => setForm((f) => ({ ...f, data_nascimento: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nif">NIF</Label>
            <Input id="nif" placeholder="123 456 789" value={form.nif} onChange={(e) => setForm((f) => ({ ...f, nif: e.target.value }))} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="iban">IBAN</Label>
            <Input id="iban" placeholder="PT50 XXXX XXXX XXXX XXXX XXXX X" value={form.iban} onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="aulas_manual">Aulas antes do app <span className="text-gray-400 font-normal">(base manual)</span></Label>
            <Input
              id="aulas_manual"
              type="number"
              min={0}
              step={1}
              placeholder="0"
              value={form.aulas_manual}
              onChange={(e) => setForm((f) => ({ ...f, aulas_manual: e.target.value }))}
            />
            <p className="text-xs text-gray-400">Total exibido ao aluno = este valor + presenças registadas no app</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="faixa_edit">Faixa</Label>
            <select id="faixa_edit" title="Faixa" value={form.faixa} onChange={(e) => setForm((f) => ({ ...f, faixa: e.target.value as CorFaixa }))} className={selectClass}>
              {[...ADULT_BELTS, ...KIDS_BELTS.filter((b) => !ADULT_BELTS.includes(b))].map((c) => (
                <option key={c} value={c}>{labelCorFaixa(c)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="graus_edit">Graus</Label>
            <select id="graus_edit" title="Graus" value={form.graus} onChange={(e) => setForm((f) => ({ ...f, graus: e.target.value }))} className={selectClass}>
              {[0,1,2,3,4].map((g) => <option key={g} value={g}>{g === 0 ? "Sem graus" : `${g} grau${g > 1 ? "s" : ""}`}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categoria_edit">Categoria</Label>
            <select id="categoria_edit" title="Categoria" value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as CategoriaFaixa }))} className={selectClass}>
              <option value="adulto">Adulto</option>
              <option value="infantil">Infantil</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="perfil_edit">Perfil</Label>
            <select id="perfil_edit" title="Perfil" value={form.perfil} onChange={(e) => setForm((f) => ({ ...f, perfil: e.target.value as PerfilUsuario }))} className={selectClass}>
              <option value="aluno">Aluno</option>
              <option value="professor">Professor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>

        {salvoErro && <p className="text-red-600 text-sm">{salvoErro}</p>}

        <Button onClick={handleSalvar} disabled={salvando} className="bg-gb-blue hover:bg-gb-blue-dark text-white">
          {salvando ? <><Loader2 size={15} className="animate-spin mr-2" />Salvando...</> : <><Check size={15} className="mr-2" />Salvar alterações</>}
        </Button>
      </div>

      {/* ── Responsável ── */}
      {aluno.sem_login && <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Users size={16} className="text-gb-blue" />
          Responsável
        </h2>

        {respOk && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            <Check size={15} className="text-green-600 shrink-0" />
            <p className="text-green-700 text-sm font-medium">Responsável atualizado!</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="responsavel" className="text-sm font-medium text-gray-700">
            Responsável pelo aluno
          </label>
          <select
            id="responsavel"
            title="Responsável pelo aluno"
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
            disabled={salvandoResp}
            className={selectClass}
          >
            <option value="">Sem responsável</option>
            {alunosComLogin.map((a) => (
              <option key={a.id} value={a.id}>{a.nome_completo}</option>
            ))}
          </select>
        </div>

        {respErro && <p className="text-red-600 text-sm">{respErro}</p>}

        <Button
          onClick={handleSalvarResponsavel}
          disabled={salvandoResp}
          className="bg-gb-blue hover:bg-gb-blue-dark text-white"
        >
          {salvandoResp
            ? <><Loader2 size={15} className="animate-spin mr-2" />Salvando...</>
            : <><Check size={15} className="mr-2" />Salvar responsável</>
          }
        </Button>
      </div>}

      {/* ── Dependentes ── */}
      {dependentesDoAluno.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Users size={16} className="text-gb-blue" />
            Dependentes
            <span className="text-gray-400 font-normal text-sm">({dependentesDoAluno.length})</span>
          </h2>
          <div className="divide-y divide-gray-50">
            {dependentesDoAluno.map((d) => (
              <Link
                key={d.id}
                href={`/admin/alunos/${d.id}`}
                className="flex items-center gap-2 py-2.5 text-sm text-gray-700 hover:text-gb-blue transition-colors"
              >
                <User size={14} className="text-gray-400 shrink-0" />
                {d.nome_completo}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Painel de Frequência Semanal ── */}
      {(() => {
        const stats = calcularFrequenciaSemanal(presencas);
        const minimoFaixa = aluno.faixa ? MINIMOS_POR_FAIXA[aluno.faixa] : undefined;
        const corPercentual =
          stats.percentual >= 70 ? "text-green-700" :
          stats.percentual >= 50 ? "text-amber-600" :
          stats.percentual > 0   ? "text-red-600"   : "text-gray-400";
        const bgPercentual =
          stats.percentual >= 70 ? "bg-green-50 border-green-200" :
          stats.percentual >= 50 ? "bg-amber-50 border-amber-200" :
          stats.percentual > 0   ? "bg-red-50 border-red-200"     : "bg-gray-50 border-gray-200";
        const labelPercentual =
          stats.percentual >= 70 ? "Excelente frequência" :
          stats.percentual >= 50 ? "Frequência razoável"  :
          stats.percentual > 0   ? "Frequência insuficiente" : "Sem dados suficientes";

        return (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp size={16} className="text-gb-blue" />
              Frequência Semanal
              <span className="text-xs font-normal text-gray-400">(indicadores de graduação)</span>
            </h2>

            {stats.totalPresencas === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Nenhuma presença com data registada.
                {aluno.aulas_manual > 0 && " Use «Importar histórico» para adicionar as datas das fichinhas."}
              </p>
            ) : (
              <>
                {/* Totais */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-0.5">Aulas com data</p>
                    <p className="font-bold text-xl text-gray-900">{stats.totalPresencas}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-gray-500 text-xs mb-0.5">Média semanal</p>
                    <p className="font-bold text-xl text-gray-900">{stats.mediaSemanal}</p>
                  </div>
                  {aluno.aulas_manual > 0 && (
                    <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                      + {aluno.aulas_manual} aulas sem data (não contam para frequência semanal)
                    </div>
                  )}
                </div>

                {/* Distribuição */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Distribuição por semana{stats.primeiraPresenca && ` · desde ${stats.primeiraPresenca.toLocaleDateString("pt-PT", { day:"numeric", month:"short", year:"numeric" })}`}
                  </p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">≥ 2 treinos/semana</span>
                      <span className="font-semibold text-gray-900">{stats.semanasComRequisito} sem. ({stats.percentual}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${stats.percentual >= 70 ? "bg-green-500" : stats.percentual >= 50 ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${stats.percentual}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-1 pt-1 text-xs text-gray-500">
                      <span>{stats.com3mais} sem. com 3+</span>
                      <span className="text-center">{stats.com2} sem. com 2</span>
                      <span className="text-right">{stats.com1} sem. com 1</span>
                    </div>
                    {stats.com0 > 0 && <p className="text-xs text-gray-400">{stats.com0} semanas sem treinos</p>}
                  </div>
                </div>

                {/* Requisito Gracie Barra */}
                <div className={`rounded-xl border p-3 space-y-1.5 ${bgPercentual}`}>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Requisito Gracie Barra</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Mín. 2×/semana</span>
                    <span className={`font-semibold ${corPercentual}`}>{stats.percentual}% · {labelPercentual}</span>
                  </div>
                  {minimoFaixa !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">Mín. aulas para próx. faixa</span>
                      <span className={`font-semibold ${stats.totalPresencas >= minimoFaixa ? "text-green-700" : "text-amber-600"}`}>
                        {stats.totalPresencas}/{minimoFaixa}
                        {stats.totalPresencas < minimoFaixa && ` (faltam ${minimoFaixa - stats.totalPresencas})`}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 pt-1">Decisão final é sempre do professor.</p>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          ── Secção Graduações ──
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Award size={16} className="text-gb-blue" />
            Graduações
            <span className="text-gray-400 font-normal text-sm">({graduacoes.length})</span>
          </h2>
          {!mostraFormGrad && (
            <Button
              size="sm"
              onClick={() => {
                setGradForm((f) => ({ ...f, categoria: aluno.categoria, faixa: aluno.faixa ?? "branca", graus: String(aluno.graus ?? 0), data: hoje, obs: "" }));
                setGradErro("");
                setMostraFormGrad(true);
              }}
              className="bg-gb-blue hover:bg-gb-blue-dark text-white text-xs h-8 px-3"
            >
              <Plus size={12} className="mr-1.5" />
              Registar Graduação
            </Button>
          )}
        </div>

        {/* ── Formulário de nova graduação ── */}
        {mostraFormGrad && (
          <div className="bg-white rounded-2xl border border-gb-blue/30 p-5 space-y-5">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Award size={14} className="text-gb-blue" />
              Nova Graduação
            </h3>

            {/* Categoria (toggle) */}
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <div className="flex gap-2">
                {(["adulto", "infantil"] as CategoriaFaixa[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoriaGrad(cat)}
                    className={`flex-1 h-9 rounded-xl text-sm font-semibold transition-colors border ${
                      gradForm.categoria === cat
                        ? "bg-gb-blue text-white border-gb-blue"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gb-blue/60"
                    }`}
                  >
                    {cat === "adulto" ? "Adulto" : "Infantil"}
                  </button>
                ))}
              </div>
            </div>

            {/* Faixa selector + live preview */}
            <div className="space-y-1.5">
              <Label>Nova faixa</Label>
              <div className="flex items-center gap-3">
                <select
                  title="Nova faixa"
                  value={gradForm.faixa}
                  onChange={(e) => setGradForm((f) => ({ ...f, faixa: e.target.value as CorFaixa }))}
                  className="flex-1 h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue"
                >
                  {beltOptions.map((c) => (
                    <option key={c} value={c}>{labelCorFaixa(c)}</option>
                  ))}
                </select>
                {/* Live preview */}
                <div className="w-44 shrink-0">
                  <FaixaBJJ faixa={gradForm.faixa} graus={Number(gradForm.graus)} categoria={gradForm.categoria} tamanho="sm" />
                </div>
              </div>
            </div>

            {/* Graus */}
            <div className="space-y-1.5">
              <Label htmlFor="grad_graus">Graus</Label>
              <select
                id="grad_graus"
                title="Graus"
                value={gradForm.graus}
                onChange={(e) => setGradForm((f) => ({ ...f, graus: e.target.value }))}
                className={selectClass}
              >
                {[0,1,2,3,4].map((g) => (
                  <option key={g} value={g}>{g === 0 ? "Sem graus" : `${g} grau${g > 1 ? "s" : ""}`}</option>
                ))}
              </select>
            </div>

            {/* Data */}
            <div className="space-y-1.5">
              <Label htmlFor="grad_data">Data da graduação</Label>
              <Input
                id="grad_data"
                type="date"
                title="Data da graduação"
                value={gradForm.data}
                max={hoje}
                onChange={(e) => setGradForm((f) => ({ ...f, data: e.target.value }))}
                className="w-44"
              />
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="grad_obs">Observações <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Input
                id="grad_obs"
                placeholder="Ex: exame de faixa, campeonato..."
                value={gradForm.obs}
                onChange={(e) => setGradForm((f) => ({ ...f, obs: e.target.value }))}
              />
            </div>

            {gradErro && <p className="text-red-600 text-sm">{gradErro}</p>}

            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleGraduar}
                disabled={gradSalvando}
                className="bg-gb-blue hover:bg-gb-blue-dark text-white"
              >
                {gradSalvando
                  ? <><Loader2 size={15} className="animate-spin mr-2" />Registando...</>
                  : <><Award size={15} className="mr-2" />Registar Graduação</>
                }
              </Button>
              <Button
                variant="outline"
                onClick={() => { setMostraFormGrad(false); setGradErro(""); }}
                disabled={gradSalvando}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* ── Timeline vertical de graduações ── */}
        {graduacoes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Award size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Sem graduações registadas</p>
          </div>
        ) : (
          <div className="relative pl-9">
            {/* Vertical connecting line */}
            {graduacoes.length > 1 && (
              <div className="absolute left-3 top-5 bottom-5 w-0.5 bg-gray-200 rounded-full" />
            )}

            {graduacoes.map((g) => (
              <div key={g.id} className="relative mb-4 last:mb-0">
                {/* Timeline dot */}
                <div className="absolute -left-9 top-1 w-7 h-7 rounded-full bg-gb-blue border-2 border-white flex items-center justify-center shadow-sm z-10">
                  <Award size={12} className="text-white" />
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                  {/* Date + delete */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      {formatarData(g.data_graduacao)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleExcluirGraduacao(g.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Eliminar graduação"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Belt progression */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {g.faixa_anterior && (
                      <>
                        <div>
                          <FaixaBJJ
                            faixa={g.faixa_anterior}
                            graus={g.graus_anterior ?? 0}
                            categoria={inferCategoria(g.faixa_anterior)}
                            tamanho="sm"
                            showLabel
                          />
                        </div>
                        <span className="text-gray-400 text-xl font-light shrink-0">→</span>
                      </>
                    )}
                    <div>
                      <FaixaBJJ faixa={g.faixa_nova} graus={g.graus_nova} categoria={inferCategoria(g.faixa_nova)} tamanho="sm" showLabel />
                    </div>
                  </div>

                  {/* Professor + observações */}
                  {(g.professor || g.observacoes) && (
                    <div className="pt-2 border-t border-gray-50 space-y-0.5">
                      {g.professor && (
                        <p className="text-xs text-gray-400 flex items-center gap-1.5">
                          <User size={11} className="shrink-0" />
                          {g.professor.nome_completo}
                        </p>
                      )}
                      {g.observacoes && (
                        <p className="text-xs text-gray-500 italic">&ldquo;{g.observacoes}&rdquo;</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Mensalidades ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <CreditCard size={16} className="text-gb-blue" />
            Mensalidades
            <span className="text-gray-400 font-normal text-sm">({mensalidades.length})</span>
          </h2>
          <Button size="sm" onClick={handleGerarProximoMes} disabled={acao === "gerar"} className="bg-gb-blue hover:bg-gb-blue-dark text-white text-xs h-8 px-3">
            {acao === "gerar" ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Plus size={12} className="mr-1.5" />}
            Gerar próximo mês
          </Button>
        </div>

        {acaoErro && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{acaoErro}</div>}

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {mensalidades.length === 0 ? (
            <div className="p-8 text-center"><CreditCard size={32} className="text-gray-200 mx-auto mb-2" /><p className="text-gray-400 text-sm">Nenhuma mensalidade registada</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Mês</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Vencimento</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Valor</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Pagamento</th>
                    <th className="px-4 py-2.5"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {mensalidades.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{formatarMes(Number(m.mes_referencia.slice(0, 4)), Number(m.mes_referencia.slice(5, 7)))}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatarData(m.data_vencimento)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{m.valor != null ? formatarMoeda(m.valor) : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MENS_CLASS[m.status]}`}>
                          {STATUS_MENS_LABEL[m.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{m.data_pagamento ? formatarData(m.data_pagamento) : "—"}</td>
                      <td className="px-4 py-3">
                        {m.status !== "pago" ? (
                          <button type="button" onClick={() => handleMarcarPago(m.id)} disabled={!!acao} className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium transition-colors disabled:opacity-50">
                            {acao === m.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Pago
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleDesmarcarPago(m.id)} disabled={!!acao} className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium transition-colors disabled:opacity-50">
                            {acao === `${m.id}-desmarcar` ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                            Desmarcar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Histórico de presenças ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays size={16} className="text-gb-blue" />
            Histórico de presenças
            <span className="text-gray-400 font-normal text-sm">({presencas.length} no total)</span>
          </h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setModoImportar((v) => !v); setImportarResultado(null); setImportarErro(""); setDatasImportar(new Set()); }} className="text-xs h-8 px-3 border-gray-200">
              <Plus size={12} className="mr-1.5" />
              Importar histórico
            </Button>
            <Button size="sm" onClick={() => { setMostraAddPresenca((v) => !v); setAddPresencaErro(""); }} className="bg-gb-blue hover:bg-gb-blue-dark text-white text-xs h-8 px-3">
              <Plus size={12} className="mr-1.5" />
              Adicionar presença
            </Button>
          </div>
        </div>

        {/* Alerta de migração de aulas_manual */}
        {aluno.aulas_manual > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-amber-800">
                <span className="font-semibold">{aluno.aulas_manual} aulas sem data registada</span> (contador manual antigo).
                Use &ldquo;Importar histórico&rdquo; para adicionar as datas das fichinhas.
                Após migrar tudo, pode zerar este contador.
              </div>
            </div>
            <div className="pl-5">
              <button
                type="button"
                onClick={handleZerarAulasManual}
                disabled={zerarLoading}
                className="text-xs text-amber-700 underline hover:text-amber-900 disabled:opacity-50"
              >
                {zerarLoading ? "Zerando..." : "Zerar contador"}
              </button>
            </div>
          </div>
        )}

        {/* Painel de importação em massa */}
        {modoImportar && (() => {
          const diasNoMes = new Date(mesImportar.ano, mesImportar.mes + 1, 0).getDate();
          const primeiroDia = new Date(mesImportar.ano, mesImportar.mes, 1).getDay();
          const diasComPresenca = new Set(
            presencas
              .map((p) => { const d = new Date(p.registrado_em); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })
          );

          return (
            <div className="bg-white rounded-2xl border border-gb-blue/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">Importar presenças históricas</h3>
                <button type="button" onClick={() => { setModoImportar(false); setDatasImportar(new Set()); setImportarResultado(null); }} className="text-gray-400 hover:text-gray-700">
                  <X size={16} />
                </button>
              </div>

              {/* Navegação de mês */}
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setMesImportar(({ ano, mes }) => mes === 0 ? { ano: ano - 1, mes: 11 } : { ano, mes: mes - 1 })} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <ChevronLeft size={16} />
                </button>
                <span className="font-medium text-sm text-gray-800">{MESES_PT[mesImportar.mes]} {mesImportar.ano}</span>
                <button type="button" onClick={() => setMesImportar(({ ano, mes }) => mes === 11 ? { ano: ano + 1, mes: 0 } : { ano, mes: mes + 1 })} disabled={mesImportar.ano === new Date().getFullYear() && mesImportar.mes >= new Date().getMonth()} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Grid do calendário */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
                  <div key={d} className="text-xs font-medium text-gray-400 py-1">{d}</div>
                ))}
                {Array.from({ length: primeiroDia }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: diasNoMes }).map((_, i) => {
                  const dia = i + 1;
                  const key = `${mesImportar.ano}-${String(mesImportar.mes+1).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
                  const jaExiste = diasComPresenca.has(key);
                  const selecionado = datasImportar.has(key);
                  const futuro = key > hoje;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={jaExiste || futuro}
                      onClick={() => toggleDiaImportar(key)}
                      className={`text-xs rounded-lg py-1.5 font-medium transition-colors ${
                        jaExiste  ? "bg-gb-blue/80 text-white cursor-default" :
                        selecionado ? "bg-gb-blue text-white" :
                        futuro    ? "text-gray-300 cursor-default" :
                        "hover:bg-gray-100 text-gray-700"
                      }`}
                    >
                      {dia}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-gray-500">
                Dias em vermelho escuro = presença já registada.{" "}
                {datasImportar.size > 0 && <span className="font-semibold text-gray-800">{datasImportar.size} {datasImportar.size === 1 ? "dia selecionado" : "dias selecionados"}.</span>}
              </p>

              {importarErro && <p className="text-sm text-red-600">{importarErro}</p>}

              {importarResultado && (
                <p className="text-sm text-green-700 font-medium">
                  ✓ {importarResultado.criadas} {importarResultado.criadas === 1 ? "presença criada" : "presenças criadas"}
                  {importarResultado.duplicadas > 0 && ` (${importarResultado.duplicadas} já existiam)`}.
                </p>
              )}

              <Button
                type="button"
                onClick={handleImportarPresencas}
                disabled={datasImportar.size === 0 || importarLoading}
                className="w-full bg-gb-blue hover:bg-gb-blue-dark text-white text-sm"
              >
                {importarLoading
                  ? <><Loader2 size={14} className="animate-spin mr-2" />Guardando...</>
                  : <><Check size={14} className="mr-2" />Guardar {datasImportar.size > 0 ? `${datasImportar.size} presenças` : "presenças"}</>
                }
              </Button>
            </div>
          );
        })()}

        {mostraAddPresenca && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
            <Input type="date" value={dataPresenca} max={hoje} title="Data da presença" onChange={(e) => setDataPresenca(e.target.value)} className="w-44" disabled={addPresencaLoading} />
            <Button type="button" onClick={handleAdicionarPresenca} disabled={!dataPresenca || addPresencaLoading} className="bg-gb-blue hover:bg-gb-blue-dark text-white text-xs h-9 px-4">
              {addPresencaLoading ? <><Loader2 size={12} className="animate-spin mr-1.5" />Guardando...</> : <><Check size={12} className="mr-1.5" />Confirmar</>}
            </Button>
            <button type="button" onClick={() => { setMostraAddPresenca(false); setDataPresenca(""); setAddPresencaErro(""); }} className="text-sm text-gray-500 hover:text-gray-900">Cancelar</button>
            {addPresencaErro && <p className="w-full text-sm text-red-600">{addPresencaErro}</p>}
          </div>
        )}

        <PresencasCalendario presencas={presencas} onExcluirPresenca={handleExcluirPresenca} />
      </div>
    </div>
  );
}
