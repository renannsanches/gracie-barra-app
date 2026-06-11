"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QrCode, RefreshCw, Loader2, Clock, ArrowLeft, CheckCircle2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { Profile, DependentePerfil } from "@/lib/types";

interface PresencaViewProps {
  profile: Profile;
  dependentes: DependentePerfil[];
}

type Estado = "carregando" | "idle" | "gerando" | "exibindo" | "expirado" | "confirmado" | "bloqueado" | "erro";

const INTERVALO_MIN_MS = 30 * 60 * 1000;

export function PresencaView({ profile, dependentes }: PresencaViewProps) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("carregando");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [segundos, setSegundos] = useState(60);
  const [erroMsg, setErroMsg] = useState("");
  const [minutosRestantes, setMinutosRestantes] = useState(0);
  const [modalAberto, setModalAberto] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const limparTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const limparPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  const limparCountdown = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  useEffect(() => () => { limparTimer(); limparPolling(); limparCountdown(); }, [limparTimer, limparPolling, limparCountdown]);

  function calcMinutos(desde: Date): number {
    return Math.ceil((desde.getTime() + INTERVALO_MIN_MS - Date.now()) / 60000);
  }

  const iniciarBloqueio = useCallback((desde: Date) => {
    limparCountdown();
    const minutos = calcMinutos(desde);
    if (minutos <= 0) { setEstado("idle"); return; }
    setMinutosRestantes(minutos);
    setEstado("bloqueado");

    countdownRef.current = setInterval(() => {
      const restante = calcMinutos(desde);
      if (restante <= 0) {
        limparCountdown();
        setEstado("idle");
      } else {
        setMinutosRestantes(restante);
      }
    }, 30000);
  }, [limparCountdown]);

  const verificarBloqueio = useCallback(async () => {
    try {
      const supabase = createClient();
      const intervaloAtras = new Date(Date.now() - INTERVALO_MIN_MS).toISOString();
      const agora = new Date().toISOString();
      const { data } = await supabase
        .from("presencas")
        .select("registrado_em")
        .eq("aluno_id", profile.id)
        .gte("registrado_em", intervaloAtras)
        .lte("registrado_em", agora)
        .order("registrado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        iniciarBloqueio(new Date(data.registrado_em));
      } else {
        setEstado("idle");
      }
    } catch {
      setEstado("idle");
    }
  }, [iniciarBloqueio, profile.id]);

  useEffect(() => { verificarBloqueio(); }, [verificarBloqueio]);

  const iniciarPolling = useCallback((aPartirDe: Date, alunoIds: string[]) => {
    pollingRef.current = setInterval(async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("presencas")
          .select("registrado_em")
          .in("aluno_id", alunoIds)
          .gte("registrado_em", aPartirDe.toISOString())
          .limit(1)
          .maybeSingle();

        if (data) {
          limparTimer();
          limparPolling();
          setEstado("confirmado");
          iniciarBloqueio(new Date(data.registrado_em));
        }
      } catch {
        // ignora erros de polling silenciosamente
      }
    }, 2500);
  }, [limparTimer, limparPolling, iniciarBloqueio]);

  async function gerarQR(alunoIds: string[]) {
    limparTimer();
    limparPolling();
    setEstado("gerando");
    setErroMsg("");

    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc("gerar_qr_token", { p_aluno_ids: alunoIds });

      if (error) {
        setErroMsg("Não foi possível gerar o QR Code. Tente novamente.");
        setEstado("erro");
        return;
      }

      if (!data?.token) {
        setErroMsg("Não foi possível gerar o QR Code. Tente novamente.");
        setEstado("erro");
        return;
      }

      const qrGeradoEm = new Date();

      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(data.token, {
        width: 280,
        margin: 2,
        color: { dark: "#0A0A0A", light: "#FFFFFF" },
        errorCorrectionLevel: "M",
      });

      setQrDataUrl(dataUrl);
      setSegundos(60);
      setEstado("exibindo");

      timerRef.current = setInterval(() => {
        setSegundos((prev) => {
          if (prev <= 1) {
            limparTimer();
            limparPolling();
            setEstado("expirado");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      iniciarPolling(qrGeradoEm, alunoIds);
    } catch {
      setErroMsg("Erro inesperado. Tente novamente.");
      setEstado("erro");
    }
  }

  function handleGerarQR() {
    if (dependentes.length > 0) {
      setSelecionados([profile.id, ...dependentes.map((d) => d.id)]);
      setModalAberto(true);
    } else {
      gerarQR([profile.id]);
    }
  }

  function toggleSelecionado(id: string) {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function confirmarSelecao() {
    setModalAberto(false);
    if (selecionados.length > 0) {
      gerarQR(selecionados);
    }
  }

  const primeiroNome = profile.nome_completo.split(" ")[0];
  const urgente = segundos <= 10;

  const iniciais = (nome: string) =>
    nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-gb-gray">
      <div className="bg-gb-black px-6 pt-10 pb-6">
        <div className="flex items-center justify-between mb-6">
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
        <h1 className="text-white font-bold text-xl">Registrar Presença</h1>
        <p className="text-white/60 text-sm mt-0.5">Olá, {primeiroNome}!</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">

        {estado === "carregando" && (
          <Loader2 size={40} className="animate-spin text-gb-blue" />
        )}

        {estado === "idle" && (
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            <div className="w-28 h-28 rounded-full bg-gb-blue/10 border-2 border-gb-blue/20 flex items-center justify-center">
              <QrCode size={52} className="text-gb-blue" />
            </div>
            <div className="text-center">
              <p className="text-gray-800 font-bold text-xl">Gerar QR Code</p>
              <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                Mostre o QR Code ao tablet da academia para registrar sua presença no treino
              </p>
            </div>
            <Button
              data-testid="btn-gerar-qr"
              onClick={handleGerarQR}
              className="w-full bg-gb-blue hover:bg-gb-blue-dark text-white h-14 text-base font-bold rounded-2xl shadow-lg"
            >
              <QrCode size={20} className="mr-2" />
              Gerar QR Code
            </Button>
          </div>
        )}

        {estado === "gerando" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={52} className="animate-spin text-gb-blue" />
            <p className="text-gray-500 font-medium">Gerando QR Code...</p>
          </div>
        )}

        {estado === "exibindo" && (
          <div className="w-full max-w-sm flex flex-col items-center gap-5">
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img data-testid="qr-image" src={qrDataUrl} alt="QR Code de presença" width={280} height={280} />
            </div>

            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <div className="flex items-center gap-2">
                <Clock size={18} className={urgente ? "text-red-500" : "text-gb-blue"} />
                <span className={`font-bold text-2xl tabular-nums ${urgente ? "text-red-500" : "text-gray-700"}`}>
                  {segundos}s
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full w-full rounded-full origin-left transition-transform duration-1000 ${urgente ? "bg-red-500" : "bg-gb-blue"}`}
                  style={{ transform: `scaleX(${segundos / 60})` }}
                />
              </div>
            </div>

            <p className="text-gray-400 text-xs text-center">
              Mostre este código ao tablet da academia
            </p>
          </div>
        )}

        {estado === "confirmado" && (
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            <div className="w-32 h-32 rounded-full bg-green-500 flex items-center justify-center shadow-xl">
              <CheckCircle2 size={64} className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-green-600 font-black text-3xl leading-tight">Presença</p>
              <p className="text-green-600 font-black text-3xl leading-tight">Registrada!</p>
              <p className="text-gray-500 text-lg mt-3 font-medium">Bom treino! 🥋</p>
            </div>
            <Button
              onClick={() => router.push("/perfil")}
              variant="outline"
              className="w-full h-12 border-green-300 text-green-700 hover:bg-green-50"
            >
              Voltar ao perfil
            </Button>
          </div>
        )}

        {estado === "bloqueado" && (
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            <div className="w-28 h-28 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
              <CheckCircle2 size={52} className="text-green-500" />
            </div>
            <div className="text-center">
              <p className="text-gray-800 font-bold text-xl">Presença registrada!</p>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                Você poderá registrar novamente em{" "}
                <span className="font-bold text-gray-600">
                  {minutosRestantes} minuto{minutosRestantes !== 1 ? "s" : ""}
                </span>
              </p>
            </div>
            <Button
              onClick={() => router.push("/perfil")}
              variant="outline"
              className="w-full h-12"
            >
              Voltar ao perfil
            </Button>
          </div>
        )}

        {estado === "expirado" && (
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            <div className="w-28 h-28 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center">
              <Clock size={52} className="text-orange-400" />
            </div>
            <div className="text-center">
              <p className="text-gray-800 font-bold text-xl">QR Code expirado</p>
              <p className="text-gray-400 text-sm mt-1">O código de 60 segundos expirou</p>
            </div>
            <Button
              onClick={handleGerarQR}
              className="w-full bg-gb-blue hover:bg-gb-blue-dark text-white h-14 text-base font-bold rounded-2xl"
            >
              <RefreshCw size={20} className="mr-2" />
              Gerar Novo QR Code
            </Button>
          </div>
        )}

        {estado === "erro" && (
          <div className="w-full max-w-sm flex flex-col items-center gap-5">
            <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 w-full text-center">
              {erroMsg}
            </div>
            <Button
              onClick={handleGerarQR}
              variant="outline"
              className="w-full h-12"
            >
              <RefreshCw size={16} className="mr-2" />
              Tentar novamente
            </Button>
          </div>
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalAberto(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-t-3xl px-5 pt-5 pb-8">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="font-bold text-gray-900 text-lg mb-1">Registrar presença para quem?</h2>
            <p className="text-sm text-gray-400 mb-5">Selecione quem vai treinar hoje</p>

            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={selecionados.includes(profile.id)}
                  onChange={() => toggleSelecionado(profile.id)}
                  className="h-5 w-5 rounded border-gray-300 text-gb-blue focus:ring-gb-blue/30 shrink-0"
                />
                <div className="w-10 h-10 rounded-full bg-gb-blue flex items-center justify-center overflow-hidden shrink-0">
                  {profile.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.foto_url} alt={profile.nome_completo} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-sm">{iniciais(profile.nome_completo)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{profile.nome_completo}</p>
                  <p className="text-xs text-gray-400">Eu</p>
                </div>
                {selecionados.includes(profile.id) && (
                  <div className="ml-auto w-5 h-5 rounded-full bg-gb-blue flex items-center justify-center shrink-0">
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </label>

              {dependentes.map((dep) => (
                <label key={dep.id} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={selecionados.includes(dep.id)}
                    onChange={() => toggleSelecionado(dep.id)}
                    className="h-5 w-5 rounded border-gray-300 text-gb-blue focus:ring-gb-blue/30 shrink-0"
                  />
                  <div className="w-10 h-10 rounded-full bg-gb-blue/20 flex items-center justify-center overflow-hidden shrink-0">
                    {dep.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={dep.foto_url} alt={dep.nome_completo} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gb-blue font-bold text-sm">{iniciais(dep.nome_completo)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{dep.nome_completo}</p>
                    <p className="text-xs text-gray-400">Dependente</p>
                  </div>
                  {selecionados.includes(dep.id) && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-gb-blue flex items-center justify-center shrink-0">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={confirmarSelecao}
                disabled={selecionados.length === 0}
                className="flex-1 bg-gb-blue hover:bg-gb-blue-dark text-white h-12 font-bold rounded-2xl"
              >
                Confirmar
              </Button>
              <Button
                variant="outline"
                onClick={() => setModalAberto(false)}
                className="h-12 px-5 rounded-2xl"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
