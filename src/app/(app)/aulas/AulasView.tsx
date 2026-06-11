"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Users, Check, X, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusAula, StatusReserva, CategoriaFaixa } from "@/lib/types";
import { reservar, cancelarMinhaReserva } from "./aulas-actions";
import { getTurmaTag } from "@/lib/turma-tags";

export interface ReservanteDaAula {
  id: string;
  nome_completo: string;
  foto_url: string | null;
}

export interface AulaParaAluno {
  id: string;
  turma_id: string;
  data: string;
  horario: string;
  lotacao_maxima: number;
  status: StatusAula;
  turma: { id: string; nome: string; categoria: CategoriaFaixa } | null;
  reservas_confirmadas: number;
}

export interface DependenteOpcao {
  id: string;
  nome_completo: string;
  categoria: CategoriaFaixa;
  foto_url: string | null;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_COMPLETO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CORES_AVATAR = [
  "bg-red-400", "bg-blue-400", "bg-green-500", "bg-yellow-400",
  "bg-purple-400", "bg-pink-400", "bg-indigo-400", "bg-teal-400",
  "bg-orange-400", "bg-cyan-500",
];

function avatarCor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return CORES_AVATAR[Math.abs(hash) % CORES_AVATAR.length];
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(" ");
  if (partes.length === 1) return partes[0][0]?.toUpperCase() ?? "?";
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

interface AvatarProps {
  reservante: ReservanteDaAula;
  size: "sm" | "md";
  highlight?: boolean;
}

function Avatar({ reservante, size, highlight }: AvatarProps) {
  const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-8 h-8 text-xs";
  const ring = highlight ? "ring-2 ring-gb-blue ring-offset-1" : "";

  if (reservante.foto_url) {
    return (
      <img
        src={reservante.foto_url}
        alt={reservante.nome_completo}
        className={cn("rounded-full object-cover shrink-0 border-2 border-white", dim, ring)}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center shrink-0 border-2 border-white font-bold text-white",
        dim,
        ring,
        avatarCor(reservante.id),
      )}
    >
      {iniciais(reservante.nome_completo)}
    </div>
  );
}

interface QuemReservouProps {
  reservantes: ReservanteDaAula[];
  aulaId: string;
  expandidoId: string | null;
  setExpandidoId: (id: string | null) => void;
  userId: string;
}

function QuemReservou({ reservantes, aulaId, expandidoId, setExpandidoId, userId }: QuemReservouProps) {
  if (reservantes.length === 0) return null;

  const aberto = expandidoId === aulaId;
  const visiveis = reservantes.slice(0, 5);
  const extras = reservantes.length - 5;

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      <button
        type="button"
        onClick={() => setExpandidoId(aberto ? null : aulaId)}
        className="flex items-center gap-2 w-full text-left"
      >
        <div className="flex -space-x-2">
          {visiveis.map((r) => (
            <Avatar key={r.id} reservante={r} size="sm" highlight={r.id === userId} />
          ))}
        </div>
        {extras > 0 && (
          <span className="text-xs text-gray-500 font-medium">+{extras}</span>
        )}
        <span className="text-xs text-gray-400 ml-auto flex items-center gap-0.5">
          {aberto ? "Fechar" : "Ver quem vai"}
          <ChevronDown
            size={12}
            className={cn("transition-transform duration-200", aberto && "rotate-180")}
          />
        </span>
      </button>

      {aberto && (
        <div className="mt-2 space-y-2">
          {reservantes.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5">
              <Avatar reservante={r} size="md" highlight={r.id === userId} />
              <span className="text-xs text-gray-700 font-medium">
                {r.nome_completo.split(" ")[0]}
                {r.nome_completo.split(" ").length > 1 && (
                  <span className="text-gray-400 font-normal"> {r.nome_completo.split(" ").slice(1).join(" ")}</span>
                )}
                {r.id === userId && (
                  <span className="text-gb-blue font-semibold ml-1">(tu)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function parseDateLocal(data: string) {
  const [y, m, d] = data.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatarHorario(h: string) {
  return h.slice(0, 5);
}

interface Props {
  aulas: AulaParaAluno[];
  reservasPorAluno: Record<string, Record<string, { id: string; status: StatusReserva }>>;
  categoriaAluno: CategoriaFaixa;
  userId: string;
  nomeCompleto: string;
  fotoUrl: string | null;
  dependentes: DependenteOpcao[];
  bloqueadosPorFinanceiro: string[];
  reservantesPorAula: Record<string, ReservanteDaAula[]>;
}

export function AulasView({
  aulas: aulasProp,
  reservasPorAluno: reservasProp,
  categoriaAluno,
  userId,
  nomeCompleto,
  fotoUrl,
  dependentes,
  bloqueadosPorFinanceiro,
  reservantesPorAula: reservantesProp,
}: Props) {
  const router = useRouter();
  const [aulas, setAulas] = useState(aulasProp);
  const [reservasPorAluno, setReservasPorAluno] = useState(reservasProp);
  const [reservantesPorAula, setReservantesPorAula] = useState(reservantesProp);
  const [selecionadoId, setSelecionadoId] = useState(userId);
  const [acao, setAcao] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const selecionadoCategoria: CategoriaFaixa = selecionadoId === userId
    ? categoriaAluno
    : (dependentes.find((d) => d.id === selecionadoId)?.categoria ?? categoriaAluno);

  function getSelecionadoInfo(): { nome_completo: string; foto_url: string | null } {
    if (selecionadoId === userId) return { nome_completo: nomeCompleto, foto_url: fotoUrl };
    const dep = dependentes.find((d) => d.id === selecionadoId);
    return { nome_completo: dep?.nome_completo ?? "", foto_url: dep?.foto_url ?? null };
  }

  const dias = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { iso, date: d };
    });
  }, []);

  const [diaAtivo, setDiaAtivo] = useState(dias[0].iso);

  const minhasReservas = reservasPorAluno[selecionadoId] ?? {};
  const bloqueado = bloqueadosPorFinanceiro.includes(selecionadoId);

  const aulasNoDia = useMemo(
    () =>
      aulas
        .filter((a) => {
          if (a.data !== diaAtivo) return false;
          if (selecionadoCategoria === "adulto_infantil") return true;
          return a.turma?.categoria === selecionadoCategoria;
        })
        .sort((a, b) => a.horario.localeCompare(b.horario)),
    [aulas, diaAtivo, selecionadoCategoria],
  );

  const reservasPorDia = useMemo(() => {
    const map: Record<string, number> = {};
    const minhas = reservasPorAluno[selecionadoId] ?? {};
    for (const a of aulas) {
      if (minhas[a.id]?.status === "confirmada" &&
          (selecionadoCategoria === "adulto_infantil" || a.turma?.categoria === selecionadoCategoria)) {
        map[a.data] = (map[a.data] ?? 0) + 1;
      }
    }
    return map;
  }, [aulas, reservasPorAluno, selecionadoId, selecionadoCategoria]);

  function handleSelecionado(id: string) {
    setSelecionadoId(id);
    setErro("");
  }

  async function handleReservar(aulaId: string) {
    setAcao(aulaId);
    setErro("");
    const result = await reservar(aulaId, selecionadoId);
    if (!result.ok) {
      setErro(result.erro ?? "Erro ao reservar.");
    } else {
      const { nome_completo, foto_url } = getSelecionadoInfo();
      setAulas((prev) =>
        prev.map((a) =>
          a.id === aulaId ? { ...a, reservas_confirmadas: a.reservas_confirmadas + 1 } : a,
        ),
      );
      setReservasPorAluno((prev) => ({
        ...prev,
        [selecionadoId]: {
          ...(prev[selecionadoId] ?? {}),
          [aulaId]: { id: result.reservaId!, status: "confirmada" },
        },
      }));
      setReservantesPorAula((prev) => ({
        ...prev,
        [aulaId]: [
          ...(prev[aulaId] ?? []),
          { id: selecionadoId, nome_completo, foto_url },
        ],
      }));
    }
    setAcao(null);
  }

  async function handleCancelar(reservaId: string, aulaId: string) {
    if (!confirm("Cancelar a reserva nesta aula?")) return;
    setAcao(reservaId);
    setErro("");
    const result = await cancelarMinhaReserva(reservaId, selecionadoId);
    if (!result.ok) {
      setErro(result.erro ?? "Erro ao cancelar.");
    } else {
      setAulas((prev) =>
        prev.map((a) =>
          a.id === aulaId ? { ...a, reservas_confirmadas: Math.max(0, a.reservas_confirmadas - 1) } : a,
        ),
      );
      setReservasPorAluno((prev) => {
        const novo = { ...(prev[selecionadoId] ?? {}) };
        delete novo[aulaId];
        return { ...prev, [selecionadoId]: novo };
      });
      setReservantesPorAula((prev) => ({
        ...prev,
        [aulaId]: (prev[aulaId] ?? []).filter((r) => r.id !== selecionadoId),
      }));
    }
    setAcao(null);
  }

  const diaAtivoDate = parseDateLocal(diaAtivo);
  const diaAtivoNome =
    diaAtivoDate.getDate() === new Date().getDate() &&
    diaAtivoDate.getMonth() === new Date().getMonth()
      ? "Hoje"
      : DIAS_COMPLETO[diaAtivoDate.getDay()];

  return (
    <div className="min-h-screen flex flex-col bg-gb-gray">
      <div className="bg-gb-black px-5 pt-10 pb-5">
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => router.push("/perfil")}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            Perfil
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.webp" alt="Gracie Barra" className="w-7 h-7 object-contain" />
            <span className="text-white font-bold text-xs tracking-wide">GRACIE BARRA</span>
          </div>
        </div>

        <h1 className="text-white font-bold text-xl mb-1">Aulas</h1>
        <p className="text-white/50 text-xs capitalize">{selecionadoCategoria}</p>

        {dependentes.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
            <button
              type="button"
              onClick={() => handleSelecionado(userId)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                selecionadoId === userId
                  ? "bg-white text-gb-blue"
                  : "bg-white/10 text-white/70 hover:bg-white/20",
              )}
            >
              Eu
            </button>
            {dependentes.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => handleSelecionado(d.id)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  selecionadoId === d.id
                    ? "bg-white text-gb-blue"
                    : "bg-white/10 text-white/70 hover:bg-white/20",
                )}
              >
                {d.nome_completo.split(" ")[0]}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
          {dias.map(({ iso, date }) => {
            const isToday   = iso === dias[0].iso;
            const isActive  = iso === diaAtivo;
            const temReserva = !!reservasPorDia[iso];
            const temAulas  = aulas.some((a) => a.data === iso && a.turma?.categoria === selecionadoCategoria);

            return (
              <button
                key={iso}
                type="button"
                onClick={() => setDiaAtivo(iso)}
                className={cn(
                  "relative flex flex-col items-center shrink-0 w-12 py-2 rounded-xl transition-all",
                  isActive
                    ? "bg-gb-blue"
                    : temAulas
                    ? "bg-white/10 hover:bg-white/20"
                    : "bg-white/5 hover:bg-white/10",
                )}
              >
                <span className={cn("text-xs font-medium", isActive ? "text-white" : "text-white/50")}>
                  {DIAS_SEMANA[date.getDay()]}
                </span>
                <span className={cn("text-sm font-black tabular-nums", isActive ? "text-white" : "text-white/70")}>
                  {date.getDate()}
                </span>
                {isToday && !isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-gb-blue" />
                )}
                {temReserva && (
                  <span
                    className={cn(
                      "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold",
                      isActive ? "bg-white text-gb-blue" : "bg-green-500 text-white",
                    )}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-4 py-4 pb-8 space-y-3">
        {erro && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{erro}</div>
        )}

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
          {diaAtivoNome}
          {diaAtivoNome !== "Hoje" && ` — ${diaAtivoDate.getDate()} de ${MESES[diaAtivoDate.getMonth()]}`}
        </p>

        {aulasNoDia.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Clock size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">Sem aulas neste dia</p>
            <p className="text-gray-400 text-xs mt-1">Navega nos outros dias para ver mais</p>
          </div>
        ) : (
          aulasNoDia.map((aula) => {
            const reservada       = minhasReservas[aula.id]?.status === "confirmada";
            const minhaReservaId  = minhasReservas[aula.id]?.id ?? null;
            const lotado          = !reservada && aula.reservas_confirmadas >= aula.lotacao_maxima;
            const isLoadingAula   = acao === aula.id;
            const isLoadingCancel = acao === (minhaReservaId ?? "");
            const reservantes     = reservantesPorAula[aula.id] ?? [];

            return (
              <div
                key={aula.id}
                className={cn(
                  "bg-white rounded-2xl border p-4",
                  reservada ? "border-gb-blue/40 shadow-sm shadow-gb-blue/10" : "border-gray-100",
                )}
              >
                <div className="flex items-start gap-4">
                  {(() => {
                    const tag = aula.turma ? getTurmaTag(aula.turma.nome) : null;
                    return tag ? (
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: tag.bg }}
                      >
                        <span className="text-white font-black text-sm leading-none text-center px-1">
                          {tag.code}
                        </span>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "w-16 h-16 rounded-xl flex flex-col items-center justify-center shrink-0",
                          reservada ? "bg-gb-blue" : lotado ? "bg-gray-100" : "bg-gb-blue/10",
                        )}
                      >
                        <span
                          className={cn(
                            "text-lg font-black tabular-nums leading-tight",
                            reservada ? "text-white" : lotado ? "text-gray-400" : "text-gb-blue",
                          )}
                        >
                          {formatarHorario(aula.horario)}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="flex-1 min-w-0">
                    {(() => {
                      const tag = aula.turma ? getTurmaTag(aula.turma.nome) : null;
                      return (
                        <p className="font-bold text-gray-900 text-sm leading-tight">
                          {aula.turma?.nome ?? "—"}
                          {tag && <span className="font-normal text-gray-500"> · {formatarHorario(aula.horario)}</span>}
                        </p>
                      );
                    })()}

                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            aula.reservas_confirmadas >= aula.lotacao_maxima
                              ? "bg-red-400"
                              : aula.reservas_confirmadas / aula.lotacao_maxima > 0.7
                              ? "bg-amber-400"
                              : "bg-green-400",
                          )}
                          style={{ width: `${Math.min(100, (aula.reservas_confirmadas / aula.lotacao_maxima) * 100)}%` }}
                        />
                      </div>
                      <span className={cn("text-xs font-medium whitespace-nowrap", lotado ? "text-red-500" : "text-gray-500")}>
                        {aula.reservas_confirmadas}/{aula.lotacao_maxima}
                      </span>
                      <Users size={11} className={lotado ? "text-red-400" : "text-gray-400"} />
                    </div>

                    {reservada && (
                      <p className="text-xs text-gb-blue font-semibold mt-1.5 flex items-center gap-1">
                        <Check size={11} />
                        Reservado
                      </p>
                    )}
                    {lotado && !reservada && (
                      <p className="text-xs text-red-500 font-medium mt-1.5">Lotado</p>
                    )}
                  </div>
                </div>

                <QuemReservou
                  reservantes={reservantes}
                  aulaId={aula.id}
                  expandidoId={expandidoId}
                  setExpandidoId={setExpandidoId}
                  userId={userId}
                />

                <div className="mt-3 flex gap-2">
                  {!reservada && !lotado && (
                    bloqueado ? (
                      <div className="flex-1 space-y-1.5">
                        <div className="h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-400 text-sm flex items-center justify-center font-medium cursor-not-allowed select-none">
                          Reservar
                        </div>
                        <p className="text-[11px] text-amber-600 text-center leading-tight">
                          Não é possível reservar a aula. Falar com Simone.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReservar(aula.id)}
                        disabled={!!acao}
                        className="flex-1 h-9 rounded-xl bg-gb-blue text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-gb-blue-dark transition-colors disabled:opacity-50"
                      >
                        {isLoadingAula ? <Loader2 size={15} className="animate-spin" /> : null}
                        Reservar
                      </button>
                    )
                  )}
                  {reservada && (
                    <button
                      type="button"
                      onClick={() => handleCancelar(minhaReservaId!, aula.id)}
                      disabled={!!acao}
                      className="flex-1 h-9 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {isLoadingCancel ? <Loader2 size={15} className="animate-spin" /> : <X size={14} />}
                      Cancelar reserva
                    </button>
                  )}
                  {lotado && !reservada && (
                    <div className="flex-1 h-9 rounded-xl bg-gray-100 text-gray-400 text-sm flex items-center justify-center font-medium">
                      Sem vagas
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
