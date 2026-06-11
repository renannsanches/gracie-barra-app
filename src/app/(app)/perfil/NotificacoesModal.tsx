"use client";

import { useEffect } from "react";
import { X, CreditCard, Megaphone, BellOff } from "lucide-react";
import type { Mensalidade } from "@/lib/types";

interface AvisoItem {
  id: string;
  titulo: string;
  created_at: string;
}

interface NotifItem {
  id: string;
  titulo: string;
  corpo: string;
  timestamp: string;
  tipo: "mensalidade" | "aviso";
  urgente: boolean;
}

interface Props {
  mensalidades: Mensalidade[];
  avisos: AvisoItem[];
  onClose: () => void;
}

function tempoRelativo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutos = Math.floor(diff / 60_000);
  if (minutos < 60) return minutos <= 1 ? "agora mesmo" : `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}

function derivarNotifMensalidades(mensalidades: Mensalidade[]): NotifItem[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return mensalidades
    .filter((m) => m.status !== "pago")
    .map((m): NotifItem | null => {
      const venc = new Date(m.data_vencimento + "T00:00:00");
      const diffDias = Math.floor((hoje.getTime() - venc.getTime()) / 86_400_000);

      if (diffDias < 0) return null; // ainda não venceu

      let titulo: string;
      let corpo: string;
      let urgente = false;

      if (diffDias === 0) {
        titulo = "Mensalidade a vencer hoje";
        corpo = "A tua mensalidade vence hoje. Fala com a Simone para regularizar.";
      } else if (diffDias <= 5) {
        titulo = "Mensalidade em atraso";
        corpo = `A tua mensalidade está em atraso há ${diffDias} dia${diffDias > 1 ? "s" : ""}. Contacta a academia.`;
        urgente = diffDias >= 3;
      } else {
        titulo = "⚠️ Mensalidade em atraso";
        corpo = "A tua mensalidade está em atraso há mais de 5 dias. O acesso pode ser bloqueado.";
        urgente = true;
      }

      return {
        id: `mens-${m.id}`,
        titulo,
        corpo,
        timestamp: m.data_vencimento + "T09:00:00",
        tipo: "mensalidade",
        urgente,
      };
    })
    .filter((x): x is NotifItem => x !== null);
}

export function NotificacoesModal({ mensalidades, avisos, onClose }: Props) {
  useEffect(() => {
    localStorage.setItem("notificacoes_last_seen", new Date().toISOString());
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const notifMensalidades = derivarNotifMensalidades(mensalidades);

  const notifAvisos: NotifItem[] = avisos.slice(0, 3).map((a) => ({
    id: `aviso-${a.id}`,
    titulo: a.titulo,
    corpo: "Novo aviso publicado pela academia.",
    timestamp: a.created_at,
    tipo: "aviso",
    urgente: false,
  }));

  const todos = [...notifMensalidades, ...notifAvisos]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-[15px] font-semibold text-gray-900">Notificações</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
            aria-label="Fechar"
          >
            <X size={14} />
          </button>
        </div>

        {/* Feed */}
        <div className="divide-y divide-gray-50 max-h-[65vh] overflow-y-auto">
          {todos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
              <BellOff size={28} />
              <p className="text-sm">Sem notificações recentes</p>
            </div>
          ) : (
            todos.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                {/* Icon */}
                <div
                  className={`mt-0.5 w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center ${
                    item.tipo === "mensalidade"
                      ? item.urgente
                        ? "bg-red-100 text-red-600"
                        : "bg-amber-100 text-amber-600"
                      : "bg-blue-50 text-blue-500"
                  }`}
                >
                  {item.tipo === "mensalidade" ? (
                    <CreditCard size={16} />
                  ) : (
                    <Megaphone size={16} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 leading-snug">{item.titulo}</p>
                  <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">{item.corpo}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{tempoRelativo(item.timestamp)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
