"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarTurma } from "./actions";
import { GrupoPicker } from "@/components/GrupoPicker";
import type { CategoriaFaixa, Modalidade, RecorrenciaTurma } from "@/lib/types";

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

const selectClass =
  "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 " +
  "focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue";

interface Props {
  professores: { id: string; nome_completo: string }[];
  modalidades: Modalidade[];
}

export function NovaTurmaForm({ professores, modalidades }: Props) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso]       = useState(false);
  const [erro, setErro]             = useState("");

  const [form, setForm] = useState({
    nome:            "",
    dia_semana:      "1",
    horario:         "18:00",
    recorrencia:     "semanal" as RecorrenciaTurma,
    lotacao_maxima:  "20",
    categoria:       "adulto" as CategoriaFaixa,
    professor_id:    "",
    modalidade_id:   (modalidades.find((m) => m.padrao && m.ativo) ?? modalidades.find((m) => m.ativo))?.id ?? "",
    gerar_semanas:   "4",
    gerar:           true,
  });

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    const fd = new FormData();
    fd.append("nome",           form.nome);
    fd.append("dia_semana",     form.dia_semana);
    fd.append("horario",        form.horario);
    fd.append("recorrencia",    form.recorrencia);
    fd.append("lotacao_maxima", form.lotacao_maxima);
    fd.append("categoria",      form.categoria);
    fd.append("professor_id",   form.professor_id);
    fd.append("modalidade_id",  form.modalidade_id);
    if (form.gerar) fd.append("gerar_semanas", form.gerar_semanas);

    try {
      const result = await criarTurma(fd);
      if (!result.ok) { setErro(result.erro ?? "Erro ao criar turma."); return; }
      setSucesso(true);
      setTimeout(() => router.push(`/admin/turmas/${result.turmaId}`), 1200);
    } finally {
      setCarregando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <Check size={28} className="text-green-600" />
        </div>
        <p className="font-bold text-gray-900 text-lg">Turma criada!</p>
        <p className="text-gray-400 text-sm">A redirecionar...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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

      <h1 className="font-bold text-gray-900 text-xl">Nova turma</h1>

      {/* Identificação */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="text-sm font-bold text-gb-blue uppercase tracking-wide">Identificação</h2>

        <div className="space-y-1.5">
          <Label htmlFor="nome">Nome da turma *</Label>
          <Input
            id="nome" required placeholder="Ex: Adultos Avançado"
            value={form.nome}
            onChange={(e) => set("nome", e.target.value)}
            disabled={carregando}
          />
        </div>

        <div className="space-y-1.5">
          <Label id="modalidade-label">Modalidade</Label>
          <GrupoPicker
            id="modalidade_id"
            labelledBy="modalidade-label"
            grupos={modalidades}
            value={form.modalidade_id}
            onChange={(v) => set("modalidade_id", v)}
            disabled={carregando}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoria</Label>
            <select id="categoria" value={form.categoria} onChange={(e) => set("categoria", e.target.value)} className={selectClass} disabled={carregando}>
              <option value="adulto">Adulto</option>
              <option value="infantil">Infantil</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="professor_id">Professor</Label>
            <select id="professor_id" value={form.professor_id} onChange={(e) => set("professor_id", e.target.value)} className={selectClass} disabled={carregando}>
              <option value="">— Sem professor —</option>
              {professores.map((p) => (
                <option key={p.id} value={p.id}>{p.nome_completo}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Horário */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="text-sm font-bold text-gb-blue uppercase tracking-wide">Horário</h2>

        <div className="grid grid-cols-2 gap-4">
          {form.recorrencia !== "diario" && (
          <div className="space-y-1.5">
            <Label htmlFor="dia_semana">Dia da semana</Label>
            <select id="dia_semana" value={form.dia_semana} onChange={(e) => set("dia_semana", e.target.value)} className={selectClass} disabled={carregando}>
              {DIAS_SEMANA.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="horario">Horário *</Label>
            <Input
              id="horario" type="time" required
              value={form.horario}
              onChange={(e) => set("horario", e.target.value)}
              disabled={carregando}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recorrencia">Recorrência</Label>
            <select id="recorrencia" value={form.recorrencia} onChange={(e) => set("recorrencia", e.target.value)} className={selectClass} disabled={carregando}>
              {RECORRENCIA_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lotacao_maxima">Lotação máxima</Label>
            <Input
              id="lotacao_maxima" type="number" min="1" max="100"
              value={form.lotacao_maxima}
              onChange={(e) => set("lotacao_maxima", e.target.value)}
              disabled={carregando}
            />
          </div>
        </div>
      </div>

      {/* Gerar aulas */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="text-sm font-bold text-gb-blue uppercase tracking-wide">Aulas iniciais</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.gerar}
            onChange={(e) => set("gerar", e.target.checked)}
            disabled={carregando}
            className="w-4 h-4 rounded accent-gb-blue"
          />
          <span className="text-sm text-gray-700">Gerar aulas automaticamente ao criar</span>
        </label>
        {form.gerar && (
          <div className="space-y-1.5">
            <Label htmlFor="gerar_semanas">Quantas semanas?</Label>
            <Input
              id="gerar_semanas" type="number" min="1" max="52"
              value={form.gerar_semanas}
              onChange={(e) => set("gerar_semanas", e.target.value)}
              disabled={carregando}
              className="w-32"
            />
          </div>
        )}
      </div>

      {erro && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{erro}</div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={carregando} className="flex-1 bg-gb-blue hover:bg-gb-blue-dark text-white">
          {carregando
            ? <><Loader2 size={15} className="animate-spin mr-2" />Criando...</>
            : "Criar turma"
          }
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/turmas")} disabled={carregando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
