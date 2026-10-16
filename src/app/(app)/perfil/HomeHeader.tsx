"use client";

import NextImage from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Bell } from "lucide-react";
import type { Mensalidade, PerfilUsuario, StatusAluno } from "@/lib/types";
import { NotificacoesModal } from "./NotificacoesModal";
import { PERFIL_LABELS, STATUS_LABELS, iniciaisDe } from "./perfil-labels";

interface Props {
  nome: string;
  fotoUrl: string | null;
  perfil: PerfilUsuario;
  status: StatusAluno;
  mensalidades: Mensalidade[];
  avisosNotif: { id: string; titulo: string; created_at: string }[];
}

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function lerLastSeen(): string | null {
  try {
    return localStorage.getItem("notificacoes_last_seen");
  } catch {
    return null;
  }
}

/**
 * Header compacto da home: logo, saudação, sino de notificações e avatar
 * (abre /perfil/conta — dados pessoais, mensalidades e sair).
 */
export function HomeHeader({ nome, fotoUrl, perfil, status, mensalidades, avisosNotif }: Props) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [vistoAgora, setVistoAgora] = useState(false);
  // undefined no servidor → sem ponto até o cliente ler o localStorage
  const lastSeen = useSyncExternalStore(subscribeStorage, lerLastSeen, () => undefined);

  let hasUnread = false;
  if (!vistoAgora && lastSeen !== undefined) {
    if (!lastSeen) {
      hasUnread = mensalidades.some((m) => m.status !== "pago") || avisosNotif.length > 0;
    } else {
      const lastSeenDate = new Date(lastSeen);
      hasUnread =
        avisosNotif.some((a) => new Date(a.created_at) > lastSeenDate) ||
        mensalidades.some((m) => m.status !== "pago" && new Date(m.data_vencimento + "T09:00:00") > lastSeenDate);
    }
  }

  const staff = perfil === "admin" || perfil === "professor";
  const statusInfo = status !== "ativo" ? STATUS_LABELS[status] : null;
  const primeiroNome = nome.split(" ")[0];

  return (
    <header className="bg-ink px-4 pt-header pb-4">
      <div className="flex items-center gap-3 max-w-lg mx-auto">
        <NextImage src="/logo.webp" alt="Gracie Barra" width={28} height={28} priority className="w-7 h-7 object-contain shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {staff ? (
              <span className="text-xs font-medium px-2 py-px rounded-full bg-white/15 text-white/85 shrink-0">
                {PERFIL_LABELS[perfil]}
              </span>
            ) : (
              <span className="text-xs text-white/50 truncate">Gracie Barra Famalicão</span>
            )}
            {statusInfo && (
              <span className={`text-xs font-medium px-2 py-px rounded-full shrink-0 ${statusInfo.classeEscura}`}>
                {statusInfo.label}
              </span>
            )}
          </div>
          <h1 className="text-white text-[18px] font-semibold leading-tight truncate mt-0.5" title={nome}>
            Olá, {primeiroNome}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => { setNotifOpen(true); setVistoAgora(true); }}
          className="relative w-11 h-11 shrink-0 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors duration-fast"
          aria-label={hasUnread ? "Notificações (há novidades)" : "Notificações"}
        >
          <Bell size={18} className="text-white" />
          {hasUnread && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-brand ring-2 ring-ink" />
          )}
        </button>

        <Link
          href="/perfil/conta"
          aria-label="A minha conta"
          className="w-11 h-11 shrink-0 rounded-full border-2 border-brand bg-white/10 flex items-center justify-center overflow-hidden active:scale-95 transition-transform duration-fast"
        >
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-semibold text-[13px]">{iniciaisDe(nome)}</span>
          )}
        </Link>
      </div>

      {notifOpen && (
        <NotificacoesModal
          mensalidades={mensalidades}
          avisos={avisosNotif}
          onClose={() => setNotifOpen(false)}
        />
      )}
    </header>
  );
}
