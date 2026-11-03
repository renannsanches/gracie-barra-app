"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PhoneInput } from "@/components/PhoneInput";
import { agendarExperimental } from "./actions";

export interface SlotDisponivel {
  aulaId: string;
  turmaNome: string;
  data: string;
  horario: string;
  lotacaoMaxima: number;
  vagasRestantes: number;
}

const WHATSAPP_NUMERO = "351922296501";

const DIAS_COMPLETO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const selectClass =
  "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 " +
  "focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue";

function parseDateLocal(data: string) {
  const [y, m, d] = data.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatarSlotLabel(slot: SlotDisponivel) {
  const d = parseDateLocal(slot.data);
  return `${DIAS_COMPLETO[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]} · ${slot.horario.slice(0, 5)}`;
}

function formatarDataHorarioParaMensagem(slot: SlotDisponivel) {
  const d = parseDateLocal(slot.data);
  const dataFormatada = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return `${DIAS_COMPLETO[d.getDay()]}-feira, ${dataFormatada} às ${slot.horario.slice(0, 5)}`;
}

interface Props {
  slots: SlotDisponivel[];
}

export function AulaExperimentalForm({ slots }: Props) {
  const [tipo, setTipo] = useState<"" | "adulto" | "infantil">("");
  const [idade, setIdade] = useState("");
  const [nome, setNome] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [nomeAluno, setNomeAluno] = useState("");
  const [telefone, setTelefone] = useState("");
  const [aulaId, setAulaId] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [linkWhatsapp, setLinkWhatsapp] = useState("");

  const slotsFiltrados = useMemo(() => {
    if (tipo === "adulto") {
      return slots.filter((s) => s.turmaNome.toLowerCase().includes("adulto"));
    }
    if (tipo === "infantil" && idade) {
      const idadeNum = Number(idade);
      const chave = idadeNum <= 6 ? "kids" : "juniores";
      return slots.filter((s) => s.turmaNome.toLowerCase().includes(chave));
    }
    return [];
  }, [slots, tipo, idade]);

  function mudarTipo(novoTipo: "adulto" | "infantil") {
    setTipo(novoTipo);
    setAulaId("");
    setErro("");
  }

  function mudarIdade(novaIdade: string) {
    setIdade(novaIdade);
    setAulaId("");
  }

  const podeSubmeter =
    !!aulaId &&
    telefone.trim().length > 4 &&
    (tipo === "adulto" ? !!nome.trim() : tipo === "infantil" ? !!idade && !!nomeResponsavel.trim() && !!nomeAluno.trim() : false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeSubmeter) return;
    setErro("");
    setCarregando(true);

    const slot = slots.find((s) => s.aulaId === aulaId);

    const fd = new FormData();
    fd.append("tipo", tipo);
    fd.append("aula_id", aulaId);
    fd.append("telefone", telefone);
    if (tipo === "adulto") {
      fd.append("nome", nome);
    } else {
      fd.append("idade", idade);
      fd.append("nome_responsavel", nomeResponsavel);
      fd.append("nome_aluno", nomeAluno);
    }

    try {
      const result = await agendarExperimental(fd);
      if (!result.ok) {
        setErro(result.erro ?? "Erro ao agendar.");
        return;
      }

      const dataHorario = slot ? formatarDataHorarioParaMensagem(slot) : "";
      const mensagem =
        tipo === "adulto"
          ? `Olá, quero confirmar o agendamento da aula experimental.\n\nNome: ${nome}\nData e horário: ${dataHorario}`
          : `Olá, quero confirmar o agendamento da aula experimental.\n\nNome do responsável: ${nomeResponsavel}\nNome do aluno(a): ${nomeAluno}\nIdade: ${idade}\nData e horário: ${dataHorario}`;

      const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
      setLinkWhatsapp(url);
      setSucesso(true);
      window.open(url, "_blank");
    } finally {
      setCarregando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <Check size={28} className="text-green-600" />
        </div>
        <p className="font-bold text-gray-900 text-lg">Agendamento registado!</p>
        <p className="text-gray-400 text-sm">Confirma pelo WhatsApp para garantires a tua vaga.</p>
        <a
          href={linkWhatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold"
        >
          <MessageCircle size={16} />
          Abrir WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="tipo">Adulto ou Infantil</Label>
        <select
          id="tipo"
          value={tipo}
          onChange={(e) => mudarTipo(e.target.value as "adulto" | "infantil")}
          className={selectClass}
          disabled={carregando}
        >
          <option value="" disabled>Seleciona uma opção</option>
          <option value="adulto">Adulto</option>
          <option value="infantil">Infantil</option>
        </select>
      </div>

      {tipo === "adulto" && (
        <div className="space-y-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome" required placeholder="O teu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={carregando}
          />
        </div>
      )}

      {tipo === "infantil" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="idade">Idade</Label>
            <select
              id="idade"
              value={idade}
              onChange={(e) => mudarIdade(e.target.value)}
              className={selectClass}
              disabled={carregando}
            >
              <option value="" disabled>Seleciona a idade</option>
              {Array.from({ length: 10 }, (_, i) => i + 3).map((i) => (
                <option key={i} value={i}>{i} anos</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nome_responsavel">Nome do responsável</Label>
            <Input
              id="nome_responsavel" required placeholder="Nome do responsável"
              value={nomeResponsavel}
              onChange={(e) => setNomeResponsavel(e.target.value)}
              disabled={carregando}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nome_aluno">Nome do aluno(a)</Label>
            <Input
              id="nome_aluno" required placeholder="Nome do aluno(a)"
              value={nomeAluno}
              onChange={(e) => setNomeAluno(e.target.value)}
              disabled={carregando}
            />
          </div>
        </>
      )}

      {tipo !== "" && (
        <div className="space-y-1.5">
          <Label htmlFor="telefone">Telemóvel (WhatsApp)</Label>
          <PhoneInput
            id="telefone"
            value={telefone || undefined}
            onChange={(v) => setTelefone(v ?? "")}
            disabled={carregando}
          />
        </div>
      )}

      {(tipo === "adulto" || (tipo === "infantil" && idade)) && (
        <div className="space-y-1.5">
          <Label>Selecione a data disponível</Label>
          {slotsFiltrados.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">Sem datas disponíveis de momento.</p>
          ) : (
            <div className="space-y-2">
              {slotsFiltrados.map((slot) => {
                const esgotado = slot.vagasRestantes <= 0;
                const selecionado = aulaId === slot.aulaId;
                return (
                  <button
                    key={slot.aulaId}
                    type="button"
                    disabled={esgotado || carregando}
                    onClick={() => setAulaId(slot.aulaId)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left text-sm transition-colors",
                      esgotado
                        ? "opacity-50 pointer-events-none border-gray-100 bg-gray-50"
                        : selecionado
                          ? "border-gb-blue bg-gb-blue/5"
                          : "border-gray-200 bg-white hover:border-gb-blue/40",
                    )}
                  >
                    <span className={cn("font-medium", selecionado ? "text-gb-blue" : "text-gray-700")}>
                      {formatarSlotLabel(slot)}
                    </span>
                    <span className={cn("text-xs font-medium", esgotado ? "text-gray-400" : "text-gray-500")}>
                      {esgotado ? "Esgotado" : `${slot.vagasRestantes} vaga${slot.vagasRestantes > 1 ? "s" : ""}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {erro && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{erro}</div>
      )}

      <Button type="submit" disabled={!podeSubmeter || carregando} className="w-full">
        {carregando
          ? <><Loader2 size={16} className="animate-spin mr-2" />A agendar…</>
          : "Confirmar agendamento"
        }
      </Button>
    </form>
  );
}
