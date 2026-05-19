"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, Loader2, Users, Calendar, ChevronDown, ChevronUp,
  RotateCcw, X, Plus, Trash2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Turma, CategoriaFaixa, RecorrenciaTurma, StatusAula, StatusReserva } from "@/lib/types";
import {
  salvarTurma,
  toggleTurmaAtiva,
  gerarAulas,
  buscarAulasComContagem,
  atualizarStatusAula,
  atualizarAula,
  excluirAula,
  excluirTurma,
  adicionarAulaAvulsa,
  buscarReservasPorAula,
  atualizarStatusReserva,
  type AulaComContagem,
  type ReservaComAluno,
} from "./turma-actions";

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

const RECORRENCIA_OPTIONS: { value: RecorrenciaTurma; label: string }[] = [
  { value: "diario",        label: "Diário (Seg–Sex)" },
  { value: "semanal",       label: "Semanal" },
  { value: "quinzenal",     label: "Quinzenal" },
  { value: "mensal",        label: "Mensal" },
  { value: "personalizado", label: "Personalizado" },
];

const STATUS_AULA_CLASS: Record<StatusAula, string> = {
  agendada:  "bg-blue-100 text-blue-700",
  cancelada: "bg-red-100 text-red-700",
  concluida: "bg-green-100 text-green-700",
};

const STATUS_AULA_LABEL: Record<StatusAula, string> = {
  agendada:  "Agendada",
  cancelada: "Cancelada",
  concluida: "Concluída",
};

const STATUS_RESERVA_CLASS: Record<StatusReserva, string> = {
  confirmada: "bg-blue-100 text-blue-700",
  cancelada:  "bg-gray-100 text-gray-500",
  presente:   "bg-green-100 text-green-700",
};

const STATUS_RESERVA_LABEL: Record<StatusReserva, string> = {
  confirmada: "Confirmada",
  cancelada:  "Cancelada",
  presente:   "Presente",
};

const selectClass =
  "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 " +
  "focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue";

function formatarHorario(h: string) { return h.slice(0, 5); }

function formatarDataAula(data: string) {
  const d = new Date(data + "T12:00:00");
  const dias  = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${dias[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")} ${meses[d.getMonth()]}`;
}

interface Props {
  turma: Turma;
  professores: { id: string; nome_completo: string }[];
  aulas: AulaComContagem[];
}

export function TurmaEditView({ turma: turmaProp, professores, aulas: aulasProp }: Props) {
  const router = useRouter();

  const [turma, setTurma]       = useState(turmaProp);
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk]   = useState(false);
  const [salvoErro, setSalvoErro] = useState("");

  const [toggleSalvando, setToggleSalvando] = useState(false);
  const [toggleFeedback, setToggleFeedback] = useState<"ok" | "erro" | null>(null);

  const [aulas, setAulas]           = useState(aulasProp);
  const [semanas, setSemanas]       = useState(4);
  const [gerando, setGerando]       = useState(false);
  const [gerarResult, setGerarResult] = useState<number | null>(null);
  const [gerarErro, setGerarErro]   = useState("");

  // Aula avulsa
  const [mostraAvulsa, setMostraAvulsa] = useState(false);
  const [dataAvulsa, setDataAvulsa]     = useState("");
  const [horarioAvulsa, setHorarioAvulsa] = useState("18:00");
  const [adicionandoAvulsa, setAdicionandoAvulsa] = useState(false);
  const [erroAvulsa, setErroAvulsa]     = useState("");

  const [excluindoTurma, setExcluindoTurma] = useState(false);
  const [excluirTurmaErro, setExcluirTurmaErro] = useState("");

  const [updatingAula, setUpdatingAula] = useState<string | null>(null);
  const [excluindoAula, setExcluindoAula] = useState<string | null>(null);

  const [editandoAula, setEditandoAula] = useState<string | null>(null);
  const [editHorario, setEditHorario]   = useState("");
  const [salvandoAula, setSalvandoAula] = useState(false);

  const [expandedAula, setExpandedAula]     = useState<string | null>(null);
  const [reservasPorAula, setReservasPorAula] = useState<Record<string, ReservaComAluno[]>>({});
  const [carregandoReservas, setCarregandoReservas] = useState<string | null>(null);
  const [updatingReserva, setUpdatingReserva] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome:           turma.nome,
    dia_semana:     String(turma.dia_semana),
    horario:        formatarHorario(turma.horario),
    recorrencia:    turma.recorrencia,
    lotacao_maxima: String(turma.lotacao_maxima),
    categoria:      turma.categoria,
    professor_id:   turma.professor_id ?? "",
  });

  const hoje     = new Date().toISOString().split("T")[0];
  const proximas = aulas.filter((a) => a.data >= hoje).sort((a, b) =>
    a.data !== b.data ? a.data.localeCompare(b.data) : a.horario.localeCompare(b.horario)
  );
  const passadas = aulas.filter((a) => a.data < hoje).sort((a, b) =>
    a.data !== b.data ? b.data.localeCompare(a.data) : a.horario.localeCompare(b.horario)
  );

  async function handleSalvar() {
    if (!form.nome.trim()) { setSalvoErro("Nome é obrigatório."); return; }
    setSalvando(true); setSalvoErro(""); setSalvoOk(false);
    const result = await salvarTurma(turma.id, {
      nome:           form.nome.trim(),
      dia_semana:     Number(form.dia_semana),
      horario:        form.horario,
      recorrencia:    form.recorrencia,
      lotacao_maxima: Number(form.lotacao_maxima),
      categoria:      form.categoria as CategoriaFaixa,
      professor_id:   form.professor_id || null,
    });
    if (!result.ok) {
      setSalvoErro(result.erro ?? "Erro ao salvar.");
    } else {
      setTurma((prev) => ({
        ...prev,
        nome:           form.nome.trim(),
        dia_semana:     Number(form.dia_semana),
        horario:        form.horario,
        recorrencia:    form.recorrencia,
        lotacao_maxima: Number(form.lotacao_maxima),
        categoria:      form.categoria as CategoriaFaixa,
        professor_id:   form.professor_id || null,
      }));
      setSalvoOk(true);
      setTimeout(() => setSalvoOk(false), 3000);
    }
    setSalvando(false);
  }

  async function handleToggleAtiva() {
    setToggleSalvando(true);
    setToggleFeedback(null);
    const result = await toggleTurmaAtiva(turma.id, !turma.ativa);
    if (result.ok) {
      setTurma((prev) => ({ ...prev, ativa: !prev.ativa }));
      setToggleFeedback("ok");
      setTimeout(() => setToggleFeedback(null), 2500);
    } else {
      setToggleFeedback("erro");
      setTimeout(() => setToggleFeedback(null), 3000);
    }
    setToggleSalvando(false);
  }

  async function handleGerarAulas() {
    setGerando(true); setGerarErro(""); setGerarResult(null);
    const result = await gerarAulas(turma.id, semanas);
    if (!result.ok) {
      setGerarErro(result.erro ?? "Erro ao gerar aulas.");
    } else {
      setGerarResult(result.criadas ?? 0);
      const novas = await buscarAulasComContagem(turma.id);
      setAulas(novas);
    }
    setGerando(false);
  }

  async function handleAdicionarAvulsa() {
    if (!dataAvulsa || !horarioAvulsa) return;
    setAdicionandoAvulsa(true); setErroAvulsa("");
    const result = await adicionarAulaAvulsa(turma.id, dataAvulsa, horarioAvulsa, turma.lotacao_maxima);
    if (!result.ok) {
      setErroAvulsa(result.erro ?? "Erro ao adicionar aula.");
    } else if (result.aula) {
      setAulas((prev) => [result.aula!, ...prev]);
      setMostraAvulsa(false);
      setDataAvulsa("");
      setHorarioAvulsa("18:00");
    }
    setAdicionandoAvulsa(false);
  }

  async function handleStatusAula(aulaId: string, status: StatusAula) {
    setUpdatingAula(aulaId);
    const result = await atualizarStatusAula(aulaId, status, turma.id);
    if (result.ok) {
      setAulas((prev) => prev.map((a) => a.id === aulaId ? { ...a, status } : a));
    }
    setUpdatingAula(null);
  }

  async function handleExcluirAula(aula: AulaComContagem) {
    const msg = aula.reservas_confirmadas > 0
      ? `Esta aula tem ${aula.reservas_confirmadas} reserva(s). Excluir irá removê-las permanentemente. Confirmar?`
      : "Excluir esta aula permanentemente?";
    if (!confirm(msg)) return;
    setExcluindoAula(aula.id);
    const result = await excluirAula(aula.id, turma.id);
    if (!result.ok) {
      alert(result.erro ?? "Erro ao excluir.");
    } else {
      setAulas((prev) => prev.filter((a) => a.id !== aula.id));
      if (expandedAula === aula.id) setExpandedAula(null);
    }
    setExcluindoAula(null);
  }

  function iniciarEdicaoAula(aula: AulaComContagem) {
    setEditandoAula(aula.id);
    setEditHorario(aula.horario.slice(0, 5));
  }

  async function handleSalvarEdicaoAula(aulaId: string) {
    setSalvandoAula(true);
    const result = await atualizarAula(aulaId, turma.id, { horario: editHorario + ":00" });
    setSalvandoAula(false);
    if (!result.ok) { alert(result.erro ?? "Erro ao salvar."); return; }
    setEditandoAula(null);
    setAulas((prev) => prev.map((a) => a.id === aulaId ? { ...a, horario: editHorario + ":00" } : a));
  }

  async function handleVerReservas(aulaId: string) {
    if (expandedAula === aulaId) { setExpandedAula(null); return; }
    if (reservasPorAula[aulaId]) { setExpandedAula(aulaId); return; }
    setCarregandoReservas(aulaId);
    const data = await buscarReservasPorAula(aulaId);
    setReservasPorAula((prev) => ({ ...prev, [aulaId]: data }));
    setExpandedAula(aulaId);
    setCarregandoReservas(null);
  }

  async function handleStatusReserva(reservaId: string, aulaId: string, status: StatusReserva) {
    setUpdatingReserva(reservaId);
    const result = await atualizarStatusReserva(reservaId, status, turma.id);
    if (result.ok) {
      setReservasPorAula((prev) => ({
        ...prev,
        [aulaId]: (prev[aulaId] ?? []).map((r) => r.id === reservaId ? { ...r, status } : r),
      }));
      if (status === "confirmada" || status === "cancelada") {
        const delta = status === "confirmada" ? 1 : -1;
        setAulas((prev) => prev.map((a) =>
          a.id === aulaId
            ? { ...a, reservas_confirmadas: Math.max(0, a.reservas_confirmadas + delta) }
            : a
        ));
      }
    }
    setUpdatingReserva(null);
  }

  function renderAula(aula: AulaComContagem) {
    const isExpanded  = expandedAula === aula.id;
    const isLoading   = carregandoReservas === aula.id;
    const reservas    = reservasPorAula[aula.id] ?? [];
    const vagasLivres = aula.lotacao_maxima - aula.reservas_confirmadas;

    return (
      <div className="border-t border-gray-50 first:border-t-0">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{formatarDataAula(aula.data)}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400">{formatarHorario(aula.horario)}</span>
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", STATUS_AULA_CLASS[aula.status])}>
                {STATUS_AULA_LABEL[aula.status]}
              </span>
              <span className={cn("text-xs font-medium", vagasLivres === 0 ? "text-red-500" : "text-gray-400")}>
                {aula.reservas_confirmadas}/{aula.lotacao_maxima} vagas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Ver reservas */}
            <button
              type="button"
              onClick={() => handleVerReservas(aula.id)}
              disabled={isLoading}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gb-blue font-medium transition-colors px-2 py-1 rounded-lg hover:bg-gb-blue/5"
            >
              {isLoading
                ? <Loader2 size={12} className="animate-spin" />
                : isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />
              }
              <Users size={11} />
              {aula.reservas_confirmadas}
            </button>

            {/* Editar horário */}
            {aula.status === "agendada" && (
              <button
                type="button"
                onClick={() => editandoAula === aula.id ? setEditandoAula(null) : iniciarEdicaoAula(aula)}
                title="Editar horário"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Pencil size={12} />
              </button>
            )}

            {/* Concluir / Cancelar / Reabrir */}
            {aula.status === "agendada" && (
              <>
                <button
                  type="button"
                  onClick={() => handleStatusAula(aula.id, "concluida")}
                  disabled={!!updatingAula}
                  title="Marcar como concluída"
                  className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                >
                  {updatingAula === aula.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Check size={12} />
                  }
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusAula(aula.id, "cancelada")}
                  disabled={!!updatingAula}
                  title="Cancelar aula"
                  className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  <X size={12} />
                </button>
              </>
            )}

            {(aula.status === "cancelada" || aula.status === "concluida") && (
              <button
                type="button"
                onClick={() => handleStatusAula(aula.id, "agendada")}
                disabled={!!updatingAula}
                title="Reabrir aula"
                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                <RotateCcw size={12} />
              </button>
            )}

            {/* Excluir */}
            <button
              type="button"
              onClick={() => handleExcluirAula(aula)}
              disabled={excluindoAula === aula.id}
              title="Excluir aula"
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {excluindoAula === aula.id
                ? <Loader2 size={12} className="animate-spin" />
                : <Trash2 size={12} />
              }
            </button>
          </div>
        </div>

        {/* Editar horário inline */}
        {editandoAula === aula.id && (
          <div className="bg-blue-50 border-t border-blue-100 px-4 py-3 flex items-center gap-3 flex-wrap">
            <label className="text-xs font-medium text-gray-600">Horário:</label>
            <input
              type="time"
              value={editHorario}
              onChange={(e) => setEditHorario(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-gb-blue/30"
            />
            <button
              type="button"
              onClick={() => handleSalvarEdicaoAula(aula.id)}
              disabled={salvandoAula}
              className="text-xs font-medium text-white bg-gb-blue px-3 py-1.5 rounded-lg disabled:opacity-50 hover:bg-gb-blue-dark transition-colors"
            >
              {salvandoAula ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setEditandoAula(null)}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Reservas expandidas */}
        {isExpanded && (
          <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
            {reservas.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">Sem reservas</p>
            ) : (
              <div className="space-y-1.5">
                {reservas.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {r.aluno?.nome_completo ?? "—"}
                      </p>
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0", STATUS_RESERVA_CLASS[r.status])}>
                      {STATUS_RESERVA_LABEL[r.status]}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {r.status !== "presente" && (
                        <button
                          type="button"
                          onClick={() => handleStatusReserva(r.id, aula.id, "presente")}
                          disabled={!!updatingReserva}
                          title="Marcar presente"
                          className="p-1 rounded text-green-600 hover:bg-green-50 disabled:opacity-50"
                        >
                          {updatingReserva === r.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        </button>
                      )}
                      {r.status !== "cancelada" && (
                        <button
                          type="button"
                          onClick={() => handleStatusReserva(r.id, aula.id, "cancelada")}
                          disabled={!!updatingReserva}
                          title="Cancelar reserva"
                          className="p-1 rounded text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          <X size={11} />
                        </button>
                      )}
                      {r.status === "cancelada" && (
                        <button
                          type="button"
                          onClick={() => handleStatusReserva(r.id, aula.id, "confirmada")}
                          disabled={!!updatingReserva}
                          title="Reconfirmar reserva"
                          className="p-1 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        >
                          <RotateCcw size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const isPersonalizado = turma.recorrencia === "personalizado";
  const isDiario        = turma.recorrencia === "diario";

  async function handleExcluirTurma() {
    if (!confirm(`Excluir a turma "${turma.nome}" permanentemente?`)) return;
    setExcluindoTurma(true);
    setExcluirTurmaErro("");
    const result = await excluirTurma(turma.id);
    if (!result.ok) {
      setExcluirTurmaErro(result.erro ?? "Erro ao excluir turma.");
      setExcluindoTurma(false);
    } else {
      router.push("/admin/turmas");
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/admin/turmas")}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Turmas
        </button>
      </div>

      {/* Dados da turma */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Calendar size={16} className="text-gb-blue" />
          Dados da turma
        </h2>

        {salvoOk && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            <Check size={15} className="text-green-600 shrink-0" />
            <p className="text-green-700 text-sm font-medium">Salvo com sucesso!</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>

          {form.recorrencia !== "diario" && (
          <div className="space-y-1.5">
            <Label htmlFor="dia_semana">Dia da semana</Label>
            <select
              id="dia_semana" title="Dia da semana"
              value={form.dia_semana}
              onChange={(e) => setForm((f) => ({ ...f, dia_semana: e.target.value }))}
              className={selectClass}
            >
              {DIAS_SEMANA.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="horario">Horário</Label>
            <Input
              id="horario" type="time"
              value={form.horario}
              onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recorrencia">Recorrência</Label>
            <select
              id="recorrencia" title="Recorrência"
              value={form.recorrencia}
              onChange={(e) => setForm((f) => ({ ...f, recorrencia: e.target.value as RecorrenciaTurma }))}
              className={selectClass}
            >
              {RECORRENCIA_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lotacao_maxima">Lotação máxima</Label>
            <Input
              id="lotacao_maxima" type="number" min="1"
              value={form.lotacao_maxima}
              onChange={(e) => setForm((f) => ({ ...f, lotacao_maxima: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoria</Label>
            <select
              id="categoria" title="Categoria"
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as CategoriaFaixa }))}
              className={selectClass}
            >
              <option value="adulto">Adulto</option>
              <option value="infantil">Infantil</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="professor_id">Professor</Label>
            <select
              id="professor_id" title="Professor"
              value={form.professor_id}
              onChange={(e) => setForm((f) => ({ ...f, professor_id: e.target.value }))}
              className={selectClass}
            >
              <option value="">— Sem professor —</option>
              {professores.map((p) => (
                <option key={p.id} value={p.id}>{p.nome_completo}</option>
              ))}
            </select>
          </div>
        </div>

        {salvoErro && <p className="text-red-600 text-sm">{salvoErro}</p>}

        <Button onClick={handleSalvar} disabled={salvando} className="bg-gb-blue hover:bg-gb-blue-dark text-white">
          {salvando
            ? <><Loader2 size={15} className="animate-spin mr-2" />Salvando...</>
            : <><Check size={15} className="mr-2" />Salvar alterações</>
          }
        </Button>
      </div>

      {/* Status toggle */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Status da turma</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {turma.ativa ? "Turma ativa — visível para alunos" : "Turma inativa — oculta para alunos"}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {toggleFeedback === "ok" && (
              <span className="text-xs font-medium text-green-600 flex items-center gap-1"><Check size={12} />Salvo</span>
            )}
            {toggleFeedback === "erro" && (
              <span className="text-xs font-medium text-red-600">Erro</span>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={turma.ativa ? "true" : "false"}
              aria-label="Ativar ou inativar turma"
              disabled={toggleSalvando}
              onClick={handleToggleAtiva}
              className={cn(
                "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60",
                turma.ativa ? "bg-green-500 focus:ring-green-500" : "bg-gray-300 focus:ring-gray-400"
              )}
            >
              <span className={cn(
                "inline-flex h-5 w-5 items-center justify-center transform rounded-full bg-white shadow transition-transform",
                turma.ativa ? "translate-x-6" : "translate-x-1"
              )}>
                {toggleSalvando && <Loader2 size={10} className={cn("animate-spin", turma.ativa ? "text-green-500" : "text-gray-400")} />}
              </span>
            </button>
            <span className={cn("text-sm font-bold min-w-[50px]", turma.ativa ? "text-green-600" : "text-gray-400")}>
              {turma.ativa ? "Ativa" : "Inativa"}
            </span>
          </div>
        </div>
      </div>

      {/* Aulas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={16} className="text-gb-blue" />
            Aulas
            <span className="text-gray-400 font-normal text-sm">({aulas.length})</span>
          </h2>

          {/* Controles: gerar (recorrente) vs avulsa (personalizado) */}
          {isPersonalizado ? (
            <Button
              type="button"
              size="sm"
              onClick={() => { setMostraAvulsa((v) => !v); setErroAvulsa(""); }}
              className="bg-gb-blue hover:bg-gb-blue-dark text-white text-xs h-8 px-3"
            >
              <Plus size={12} className="mr-1.5" />
              Aula avulsa
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="number" min="1" max="52"
                value={semanas}
                onChange={(e) => setSemanas(Number(e.target.value))}
                className="w-16 h-8 text-xs text-center"
                title="Semanas"
                aria-label="Número de semanas"
              />
              <span className="text-xs text-gray-400">sem.</span>
              <Button
                type="button" size="sm"
                onClick={handleGerarAulas}
                disabled={gerando}
                className="bg-gb-blue hover:bg-gb-blue-dark text-white text-xs h-8 px-3"
              >
                {gerando ? <Loader2 size={12} className="animate-spin mr-1.5" /> : null}
                Gerar aulas
              </Button>
            </div>
          )}
        </div>

        {/* Formulário aula avulsa */}
        {mostraAvulsa && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dataAvulsa}
                min={hoje}
                title="Data da aula"
                onChange={(e) => setDataAvulsa(e.target.value)}
                className="w-40"
                disabled={adicionandoAvulsa}
              />
              <Input
                type="time"
                value={horarioAvulsa}
                title="Horário da aula"
                onChange={(e) => setHorarioAvulsa(e.target.value)}
                className="w-28"
                disabled={adicionandoAvulsa}
              />
            </div>
            <Button
              type="button"
              onClick={handleAdicionarAvulsa}
              disabled={!dataAvulsa || !horarioAvulsa || adicionandoAvulsa}
              className="bg-gb-blue hover:bg-gb-blue-dark text-white text-xs h-9 px-4"
            >
              {adicionandoAvulsa
                ? <><Loader2 size={12} className="animate-spin mr-1.5" />Criando...</>
                : <><Check size={12} className="mr-1.5" />Confirmar</>
              }
            </Button>
            <button
              type="button"
              onClick={() => { setMostraAvulsa(false); setDataAvulsa(""); setHorarioAvulsa("18:00"); setErroAvulsa(""); }}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Cancelar
            </button>
            {erroAvulsa && <p className="w-full text-sm text-red-600">{erroAvulsa}</p>}
          </div>
        )}

        {/* Feedback gerar */}
        {gerarResult !== null && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
            {gerarResult === 0
              ? "Nenhuma aula nova (já existiam para esse período)."
              : `${gerarResult} aula${gerarResult !== 1 ? "s" : ""} gerada${gerarResult !== 1 ? "s" : ""}!`
            }
          </div>
        )}
        {gerarErro && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{gerarErro}</div>
        )}

        {/* Próximas aulas */}
        {proximas.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Próximas ({proximas.length})</p>
            </div>
            {proximas.map((aula) => <div key={aula.id}>{renderAula(aula)}</div>)}
          </div>
        )}

        {/* Passadas */}
        {passadas.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Passadas ({passadas.length})</p>
            </div>
            {passadas.map((aula) => <div key={aula.id}>{renderAula(aula)}</div>)}
          </div>
        )}

        {aulas.length === 0 && !mostraAvulsa && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Calendar size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhuma aula criada ainda</p>
            <p className="text-gray-300 text-xs mt-1">
              {isPersonalizado
                ? "Usa o botão \"Aula avulsa\" para adicionar manualmente"
                : `Usa o botão "Gerar aulas" para criar as próximas ${semanas} semanas`
              }
            </p>
          </div>
        )}
      </div>

      {/* Excluir turma */}
      <div className="bg-white rounded-2xl border border-red-100 p-5 space-y-3">
        <div>
          <p className="font-semibold text-red-700 text-sm">Zona de perigo</p>
          <p className="text-xs text-gray-400 mt-0.5">
            A exclusão é permanente. As aulas serão removidas em cascata.
          </p>
        </div>
        {excluirTurmaErro && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
            {excluirTurmaErro}
          </div>
        )}
        <Button
          type="button"
          onClick={handleExcluirTurma}
          disabled={excluindoTurma}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {excluindoTurma
            ? <><Loader2 size={15} className="animate-spin mr-2" />Excluindo...</>
            : <><Trash2 size={15} className="mr-2" />Excluir turma</>
          }
        </Button>
      </div>
    </div>
  );
}
