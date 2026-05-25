"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, XCircle, Loader2, SwitchCamera, ArrowLeft, Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FaixaBJJ, inferCategoria } from "@/components/FaixaBJJ";
import type { CorFaixa } from "@/lib/types";
import {
  buscarAlunos,
  buscarAulasDisponiveis,
  registrarPresencaManual,
  type AlunoOpcao,
  type AulaOpcao,
} from "./tablet-actions";
import { matchesSearch } from "@/lib/search-utils";

type Estado = "camera" | "processando" | "sucesso" | "erro" | "manual";

interface AlunoInfo {
  nome_completo: string;
  foto_url: string | null;
  cor_faixa: CorFaixa | null;
  graus: number;
}

interface ErroInfo {
  titulo: string;
  mensagem: string;
}

export default function TabletScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const processandoRef = useRef(false);

  const [estado, setEstado] = useState<Estado>("camera");
  const [cameraOk, setCameraOk] = useState(false);
  const [cameraErro, setCameraErro] = useState("");
  const [cameraFrontal, setCameraFrontal] = useState(true);
  const [alunoInfo, setAlunoInfo] = useState<AlunoInfo | null>(null);
  const [erroInfo, setErroInfo] = useState<ErroInfo | null>(null);

  // Manual attendance state
  const [alunos, setAlunos] = useState<AlunoOpcao[]>([]);
  const [aulasDisponiveis, setAulasDisponiveis] = useState<AulaOpcao[]>([]);
  const [filtroNome, setFiltroNome] = useState("");
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoOpcao | null>(null);
  const [aulaSelecionada, setAulaSelecionada] = useState<AulaOpcao | null>(null);
  const [carregandoManual, setCarregandoManual] = useState(false);
  const [erroManual, setErroManual] = useState("");
  const [sucessoManual, setSucessoManual] = useState(false);

  const voltarCamera = useCallback(() => {
    processandoRef.current = false;
    setEstado("camera");
    setAlunoInfo(null);
    setErroInfo(null);
  }, []);

  const processarToken = useCallback(
    async (token: string) => {
      if (processandoRef.current) return;
      processandoRef.current = true;
      setEstado("processando");

      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("registrar_presenca_por_token", {
          p_token: token,
        });

        if (error) {
          const msg = (error.message ?? "").toLowerCase();
          const code = error.code ?? "";

          let titulo = "Não Registrado";
          let mensagem = "Não foi possível registrar a presença.";

          if (msg.includes("mensalidade_bloqueada") || msg.includes("falar com simone")) {
            titulo = "Presença Não Registada";
            mensagem = "Não foi possível registar presença. Falar com Simone.";
          } else if (msg.includes("expir") || msg.includes("expired")) {
            titulo = "QR Code Expirado";
            mensagem = "O código expirou. Peça ao aluno gerar um novo.";
          } else if (
            code === "23505" ||
            msg.includes("já registr") ||
            msg.includes("already") ||
            msg.includes("duplicate")
          ) {
            titulo = "Já Registrado";
            mensagem = "Presença já registrada hoje para este aluno.";
          } else if (
            msg.includes("inválid") ||
            msg.includes("invalid") ||
            msg.includes("não encontr") ||
            msg.includes("not found")
          ) {
            titulo = "QR Code Inválido";
            mensagem = "Código não reconhecido. Peça ao aluno gerar um novo.";
          }

          setErroInfo({ titulo, mensagem });
          setEstado("erro");
          setTimeout(voltarCamera, 3000);
          return;
        }

        // RPC returns TABLE → array; pick first row
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.sucesso && row.aluno_nome) {
          setAlunoInfo({
            nome_completo: row.aluno_nome,
            foto_url:      row.aluno_foto  ?? null,
            cor_faixa:     row.aluno_faixa ?? null,
            graus:         row.aluno_graus ?? 0,
          });
        }

        setEstado("sucesso");
        setTimeout(voltarCamera, 5000);
      } catch {
        setErroInfo({ titulo: "Erro", mensagem: "Erro inesperado. Tente novamente." });
        setEstado("erro");
        setTimeout(voltarCamera, 3000);
      }
    },
    [voltarCamera]
  );

  const voltarCameraDoManual = useCallback(() => {
    setEstado("camera");
    setAlunoSelecionado(null);
    setAulaSelecionada(null);
    setFiltroNome("");
    setErroManual("");
    setSucessoManual(false);
  }, []);

  const entrarModoManual = useCallback(async () => {
    setEstado("manual");
    setFiltroNome("");
    setAlunoSelecionado(null);
    setAulaSelecionada(null);
    setErroManual("");
    setSucessoManual(false);
    setCarregandoManual(true);
    try {
      const [alunosData, aulasData] = await Promise.all([
        buscarAlunos(),
        buscarAulasDisponiveis(),
      ]);
      setAlunos(alunosData);
      setAulasDisponiveis(aulasData);
    } finally {
      setCarregandoManual(false);
    }
  }, []);

  const submeterPresencaManual = useCallback(async () => {
    if (!alunoSelecionado || !aulaSelecionada) return;
    setCarregandoManual(true);
    setErroManual("");
    try {
      const result = await registrarPresencaManual(alunoSelecionado.id, aulaSelecionada.id);
      if (!result.ok) {
        setErroManual(result.erro ?? "Erro ao registar presença.");
      } else {
        setSucessoManual(true);
        setTimeout(() => {
          voltarCameraDoManual();
        }, 3000);
      }
    } finally {
      setCarregandoManual(false);
    }
  }, [alunoSelecionado, aulaSelecionada, voltarCameraDoManual]);

  useEffect(() => {
    let mounted = true;
    setCameraOk(false);

    async function iniciarCamera() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (!mounted || !videoRef.current) return;

        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: cameraFrontal ? "user" : "environment" } },
          videoRef.current,
          (result) => {
            if (result && !processandoRef.current) {
              processarToken(result.getText());
            }
          }
        );

        if (mounted) {
          controlsRef.current = controls;
          setCameraOk(true);
        } else {
          controls.stop();
        }
      } catch (err) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : "";
          setCameraErro(
            msg.includes("Permission") || msg.includes("NotAllowed")
              ? "Permissão de câmera negada. Verifique as configurações do navegador."
              : "Não foi possível iniciar a câmera."
          );
        }
      }
    }

    iniciarCamera();

    return () => {
      mounted = false;
      controlsRef.current?.stop();
    };
  }, [processarToken, cameraFrontal]);

  const alunosFiltrados = alunos.filter((a) =>
    matchesSearch(a.nome_completo, filtroNome)
  );

  return (
    <div className="fixed inset-0 bg-gb-black overflow-hidden">
      {/* Camera feed — always mounted so @zxing keeps the stream alive */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          estado === "camera" ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* ── CAMERA STATE ── */}
      {estado === "camera" && (
        <div className="absolute inset-0 flex flex-col">
          {/* Top bar */}
          <div className="bg-gradient-to-b from-black/80 to-transparent px-8 pt-8 pb-16">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo.webp" alt="Gracie Barra" className="w-12 h-12 object-contain" />
                <div>
                  <p className="text-white font-bold text-xl tracking-wide">GRACIE BARRA</p>
                  <p className="text-white/50 text-sm">Leitor de Presença</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCameraFrontal((prev) => !prev)}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors"
                aria-label="Trocar câmera"
              >
                <SwitchCamera size={22} className="text-white" />
              </button>
            </div>
          </div>

          {/* Scan frame */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-72 h-72">
              {/* Frame border */}
              <div className="absolute inset-0 border-2 border-white/20 rounded-2xl" />
              {/* Corners */}
              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-gb-blue rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-gb-blue rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-gb-blue rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-gb-blue rounded-br-2xl" />
              {/* Scan line */}
              {cameraOk && (
                <div className="absolute left-4 right-4 h-0.5 bg-gb-blue shadow-[0_0_8px_#CC0000] animate-scan-line" />
              )}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="bg-gradient-to-t from-black/80 to-transparent px-8 pt-16 pb-10 text-center">
            {cameraErro ? (
              <p className="text-red-400 font-medium">{cameraErro}</p>
            ) : !cameraOk ? (
              <div className="flex items-center justify-center gap-2 text-white/50">
                <Loader2 size={18} className="animate-spin" />
                <span>Iniciando câmera...</span>
              </div>
            ) : (
              <>
                <p className="text-white/60 text-lg">
                  Aponte a câmera para o QR Code do aluno
                </p>
                <button
                  type="button"
                  onClick={entrarModoManual}
                  className="mt-6 flex items-center gap-2 mx-auto px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/80 text-sm font-medium transition-colors border border-white/20"
                >
                  <Users size={16} />
                  Registar presença manualmente
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PROCESSANDO ── */}
      {estado === "processando" && (
        <div className="absolute inset-0 bg-gb-black/95 flex flex-col items-center justify-center gap-6">
          <Loader2 size={72} className="animate-spin text-gb-blue" />
          <p className="text-white text-2xl font-bold">Registrando presença...</p>
        </div>
      )}

      {/* ── SUCESSO ── */}
      {estado === "sucesso" && (
        <div className="absolute inset-0 bg-green-600 flex flex-col items-center justify-center p-10">
          <CheckCircle2 size={96} className="text-white mb-6 drop-shadow-lg" />
          <h1 className="text-white font-black text-5xl tracking-tight mb-1">PRESENÇA</h1>
          <h2 className="text-white font-black text-5xl tracking-tight mb-10">REGISTRADA!</h2>

          {alunoInfo ? (
            <div className="bg-white/20 backdrop-blur-sm rounded-3xl p-8 flex flex-col items-center gap-5 w-full max-w-md border border-white/30">
              {/* Avatar */}
              <div className="w-28 h-28 rounded-full overflow-hidden bg-white/30 border-4 border-white/50 flex items-center justify-center">
                {alunoInfo.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={alunoInfo.foto_url}
                    alt={alunoInfo.nome_completo}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-black text-4xl">
                    {alunoInfo.nome_completo
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-white font-bold text-3xl text-center leading-tight">
                {alunoInfo.nome_completo}
              </p>
              {alunoInfo.cor_faixa && (
                <FaixaBJJ faixa={alunoInfo.cor_faixa} graus={alunoInfo.graus} categoria={inferCategoria(alunoInfo.cor_faixa)} tamanho="lg" showLabel />
              )}
            </div>
          ) : (
            <div className="bg-white/20 rounded-3xl px-10 py-6 text-center border border-white/30">
              <p className="text-white text-2xl font-semibold">Bom treino! 🥋</p>
            </div>
          )}

          <p className="text-white/50 text-base mt-8">Voltando em instantes...</p>
        </div>
      )}

      {/* ── ERRO ── */}
      {estado === "erro" && (
        <div className="absolute inset-0 bg-red-600 flex flex-col items-center justify-center p-10">
          <XCircle size={96} className="text-white mb-6 drop-shadow-lg" />
          <h1 className="text-white font-black text-5xl tracking-tight mb-4 text-center">
            {erroInfo?.titulo ?? "Erro"}
          </h1>
          <p className="text-white/80 text-2xl text-center leading-snug max-w-md">
            {erroInfo?.mensagem}
          </p>
          <p className="text-white/40 text-base mt-10">Voltando automaticamente...</p>
        </div>
      )}

      {/* ── MANUAL ── */}
      {estado === "manual" && (
        <div className="absolute inset-0 bg-gb-black/98 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gb-black px-6 pt-8 pb-4 flex items-center gap-4 shrink-0 border-b border-white/10">
            <button
              type="button"
              onClick={voltarCameraDoManual}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Voltar à câmera"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div>
              <p className="text-white font-bold text-lg">Presença Manual</p>
              <p className="text-white/50 text-sm">Selecione aluno e aula</p>
            </div>
          </div>

          {/* Success state */}
          {sucessoManual ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-10">
              <CheckCircle2 size={80} className="text-green-400" />
              <div className="text-center">
                <p className="text-white font-black text-3xl">Presença Registada!</p>
                <p className="text-white/60 text-lg mt-2">{alunoSelecionado?.nome_completo}</p>
                <p className="text-white/40 text-base mt-1">
                  {aulaSelecionada?.horario} — {aulaSelecionada?.turma?.nome ?? "Aula"}
                </p>
              </div>
              <p className="text-white/30 text-sm mt-4">Voltando automaticamente...</p>
            </div>
          ) : carregandoManual && alunos.length === 0 ? (
            /* Initial loading */
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={48} className="animate-spin text-gb-blue" />
            </div>
          ) : (
            /* Main form */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Error banner */}
              {erroManual && (
                <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm">
                  {erroManual}
                </div>
              )}

              {/* Student search + list */}
              <div className="flex-1 flex flex-col overflow-hidden px-6 pt-4 min-h-0">
                <p className="text-white/70 text-xs font-semibold mb-3 uppercase tracking-wider shrink-0">
                  Aluno
                </p>

                {/* Search input */}
                <div className="relative mb-3 shrink-0">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Pesquisar por nome..."
                    value={filtroNome}
                    onChange={(e) => setFiltroNome(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl pl-9 pr-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-gb-blue/50"
                  />
                </div>

                {/* Student list — scrollable */}
                <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pb-2">
                  {alunosFiltrados.length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-4">
                      {filtroNome ? "Nenhum aluno encontrado" : "Nenhum aluno activo"}
                    </p>
                  ) : (
                    alunosFiltrados.map((aluno) => (
                      <button
                        key={aluno.id}
                        type="button"
                        onClick={() => setAlunoSelecionado(aluno)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                          alunoSelecionado?.id === aluno.id
                            ? "bg-gb-blue text-white"
                            : "bg-white/5 hover:bg-white/10 text-white/80"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
                          {aluno.foto_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={aluno.foto_url}
                              alt={aluno.nome_completo}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold">
                              {aluno.nome_completo
                                .split(" ")
                                .slice(0, 2)
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium truncate">{aluno.nome_completo}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Class selector */}
              <div className="px-6 py-4 border-t border-white/10 shrink-0">
                <p className="text-white/70 text-xs font-semibold mb-3 uppercase tracking-wider">
                  Aula
                </p>
                {aulasDisponiveis.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-2">
                    Nenhuma aula disponível agora
                  </p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {aulasDisponiveis.map((aula) => (
                      <button
                        key={aula.id}
                        type="button"
                        onClick={() => setAulaSelecionada(aula)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                          aulaSelecionada?.id === aula.id
                            ? "bg-gb-blue text-white"
                            : "bg-white/10 hover:bg-white/20 text-white/70"
                        }`}
                      >
                        {aula.horario} — {aula.turma?.nome ?? "Aula"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit button */}
              <div className="px-6 pb-8 shrink-0">
                <button
                  type="button"
                  onClick={submeterPresencaManual}
                  disabled={!alunoSelecionado || !aulaSelecionada || carregandoManual}
                  className="w-full h-14 rounded-2xl bg-gb-blue text-white font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
                >
                  {carregandoManual ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    "Registar Presença"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
