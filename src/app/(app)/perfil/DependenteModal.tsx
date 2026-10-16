"use client";

import { DetalheMensalidade } from "@/components/ValorMensalidade";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Award, CalendarDays, CreditCard, Camera, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FaixaBJJ, inferCategoria } from "@/components/FaixaBJJ";
import { formatarData, formatarMoeda, formatarMes, labelCorFaixa } from "@/lib/utils";
import { getEffectiveStatus } from "@/lib/mensalidade-status";
import type { DependentePerfil, HistoricoGraduacao, Mensalidade, StatusMensalidade } from "@/lib/types";
import { historicoGraduacoesDependente } from "./dependente-historico-actions";
import { atualizarFotoDependente } from "./dependente-foto-actions";
import { comprimirParaWebP, TIPOS_IMAGEM, MAX_IMAGEM_BYTES } from "@/lib/comprimir-webp";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const MENS_BG: Record<StatusMensalidade, string> = {
  pago:     "bg-green-50 border-green-100",
  pendente: "bg-amber-50 border-amber-100",
  atrasado: "bg-red-50 border-red-100",
};

const MENS_TEXT: Record<StatusMensalidade, string> = {
  pago:     "text-green-600",
  pendente: "text-amber-600",
  atrasado: "text-red-600",
};

const MENS_STATUS_LABEL: Record<StatusMensalidade, string> = {
  pago:     "Pago",
  pendente: "Pendente",
  atrasado: "Vencida",
};

interface Props {
  dependente: DependentePerfil;
  onClose: () => void;
  /** Depois de trocar a foto (URL já com ?t= para furar a cache) */
  onFotoAlterada?: (dependenteId: string, url: string) => void;
}


export function DependenteModal({ dependente, onClose, onFotoAlterada }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fotoUrl, setFotoUrl] = useState(dependente.foto_url);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [presencasCount, setPresencasCount] = useState<number | null>(null);
  const [presencasRecentes, setPresencasRecentes] = useState<{ registrado_em: string }[]>([]);
  const [graduacoes, setGraduacoes] = useState<HistoricoGraduacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const mensalidades: Mensalidade[] = dependente.mensalidades;

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const [
        { count },
        { data: recentes },
        grads,
      ] = await Promise.all([
        supabase
          .from("presencas")
          .select("id", { count: "exact", head: true })
          .eq("aluno_id", dependente.id),
        supabase
          .from("presencas")
          .select("registrado_em")
          .eq("aluno_id", dependente.id)
          .order("registrado_em", { ascending: false })
          .limit(5),
        // No servidor: o nome do professor está num perfil que o RLS não deixa ler aqui
        historicoGraduacoesDependente(dependente.id),
      ]);

      setPresencasCount(count ?? 0);
      setPresencasRecentes(recentes ?? []);
      setGraduacoes(grads.historico ?? []);
      setCarregando(false);
    }

    carregar();
  }, [dependente.id]);

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (!TIPOS_IMAGEM.includes(file.type)) {
      toast.error("Apenas JPG, PNG e WebP são aceites.");
      return;
    }
    if (file.size > MAX_IMAGEM_BYTES) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }

    setEnviandoFoto(true);
    try {
      const blob = await comprimirParaWebP(file);
      const timestamp = Date.now();
      const path = `dependentes/${dependente.id}/${timestamp}.webp`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/webp", upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const result = await atualizarFotoDependente(dependente.id, publicUrl);
      if (!result.ok) throw new Error(result.erro);

      const urlComTs = `${publicUrl}?t=${timestamp}`;
      setFotoUrl(urlComTs);
      onFotoAlterada?.(dependente.id, urlComTs);
      toast.success("Foto atualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar a foto.");
    } finally {
      setEnviandoFoto(false);
    }
  }

  const iniciais = dependente.nome_completo
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
      <DialogContent
        variant="sheet"
        showClose={false}
        showHandle={false}
        aria-describedby={undefined}
        className="p-0 pb-safe sm:p-0 sm:rounded-3xl max-h-[85vh]"
      >
        <div className="sticky top-0 bg-white z-10 px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => !enviandoFoto && fileInputRef.current?.click()}
              disabled={enviandoFoto}
              aria-label={`Alterar foto de ${dependente.nome_completo}`}
              className="relative w-12 h-12 rounded-full bg-brand flex items-center justify-center overflow-hidden shrink-0 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-black text-base">{iniciais}</span>
              )}
              <span className="absolute inset-x-0 bottom-0 h-4 bg-black/55 flex items-center justify-center">
                {enviandoFoto ? <Loader2 size={10} className="text-white animate-spin" /> : <Camera size={10} className="text-white" />}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={`Selecionar foto de ${dependente.nome_completo}`}
              className="hidden"
              onChange={handleFotoChange}
            />
            <div className="min-w-0">
              <DialogTitle className="text-base">{dependente.nome_completo}</DialogTitle>
              {dependente.faixa && (
                <p className="text-xs text-gray-400">
                  {labelCorFaixa(dependente.faixa)} · {dependente.graus} grau{dependente.graus !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="-mr-2 w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors duration-fast">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {carregando ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-gb-blue border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {dependente.faixa && (
                <div className="bg-gb-gray rounded-2xl p-4">
                  <FaixaBJJ
                    faixa={dependente.faixa}
                    graus={dependente.graus}
                    categoria={dependente.categoria}
                    tamanho="md"
                    showLabel
                  />
                </div>
              )}

              <div className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays size={16} className="text-gb-blue" />
                  <h3 className="font-bold text-gray-900 text-sm">Presenças</h3>
                </div>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-4xl font-black text-gb-blue">{presencasCount}</span>
                  <span className="text-sm text-gray-400">aulas</span>
                </div>
                {presencasRecentes.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Últimas</p>
                    {presencasRecentes.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 py-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-gb-blue shrink-0" />
                        <p className="text-sm text-gray-700">
                          {new Date(p.registrado_em).toLocaleDateString("pt-PT", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {mensalidades.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard size={16} className="text-gb-blue" />
                    <h3 className="font-bold text-gray-900 text-sm">Mensalidades</h3>
                  </div>
                  <div className="space-y-2">
                    {mensalidades.map((m) => {
                      const ef = getEffectiveStatus(m);
                      return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${MENS_BG[ef]}`}
                      >
                        <div>
                          <p className="text-[13px] font-semibold text-gray-800">{formatarMes(Number(m.mes_referencia.slice(0, 4)), Number(m.mes_referencia.slice(5, 7)))}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Venc. {formatarData(m.data_vencimento)}
                            {m.data_pagamento ? ` · Pago ${formatarData(m.data_pagamento)}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[13px] font-bold text-gray-800">{formatarMoeda(m.valor)}</p>
                          <DetalheMensalidade valor={m.valor} itens={m.itens} className="text-xs" />
                          <p className={`text-xs font-medium mt-0.5 ${MENS_TEXT[ef]}`}>
                            {MENS_STATUS_LABEL[ef]}
                          </p>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {graduacoes.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Award size={16} className="text-gb-blue" />
                    <h3 className="font-bold text-gray-900 text-sm">Evolução</h3>
                  </div>
                  <div className="relative pl-8">
                    {graduacoes.length > 1 && (
                      <div className="absolute left-3 top-4 bottom-4 w-0.5 bg-gray-200 rounded-full" />
                    )}
                    {graduacoes.map((g) => (
                      <div key={g.id} className="relative mb-4 last:mb-0">
                        <div className="absolute -left-8 top-0.5 w-6 h-6 rounded-full bg-gb-blue border-2 border-white flex items-center justify-center shadow-sm z-10">
                          <Award size={10} className="text-white" />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-gray-400">{formatarData(g.data_graduacao)}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {g.faixa_anterior && (
                              <>
                                <FaixaBJJ
                                  faixa={g.faixa_anterior}
                                  graus={g.graus_anterior ?? 0}
                                  categoria={inferCategoria(g.faixa_anterior)}
                                  tamanho="sm"
                                  showLabel
                                />
                                <span className="text-gray-400 text-lg font-light">→</span>
                              </>
                            )}
                            <FaixaBJJ
                              faixa={g.faixa_nova}
                              graus={g.graus_nova}
                              categoria={inferCategoria(g.faixa_nova)}
                              tamanho="sm"
                              showLabel
                            />
                          </div>
                          {g.professor && (
                            <p className="text-xs text-gray-400">{g.professor.nome_completo}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
