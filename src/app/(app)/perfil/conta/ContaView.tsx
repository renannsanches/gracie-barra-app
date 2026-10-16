"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  User, Phone, Calendar, Mail, LogOut, ShieldCheck, Camera, Loader2, Check, X, CreditCard, UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/PhoneInput";
import { DetalheMensalidade } from "@/components/ValorMensalidade";
import { telefoneParaExibir, telefoneParaE164 } from "@/lib/phone";
import { formatarMoeda, formatarMes, formatarData, labelCorFaixa } from "@/lib/utils";
import { getEffectiveStatus } from "@/lib/mensalidade-status";
import { comprimirParaWebP, TIPOS_IMAGEM, MAX_IMAGEM_BYTES } from "@/lib/comprimir-webp";
import type { Profile, Mensalidade } from "@/lib/types";
import { PERFIL_LABELS, STATUS_LABELS, iniciaisDe } from "../perfil-labels";

function calcularIdade(dataNascimento: string | null): string {
  if (!dataNascimento) return "";
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return ` (${idade} anos)`;
}

const semSubscricao = () => () => {};

interface ContaViewProps {
  profile: Profile | null;
  email: string;
  mensalidades: Mensalidade[];
}

export function ContaView({ profile: profileProp, email, mensalidades }: ContaViewProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState(profileProp);
  const [saindo, setSaindo] = useState(false);

  const [fotoUrl, setFotoUrl] = useState(profileProp?.foto_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadErro, setUploadErro] = useState("");

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvoErro, setSalvoErro] = useState("");
  const [form, setForm] = useState({
    nome:      profileProp?.nome_completo ?? "",
    telefone:  telefoneParaE164(profileProp?.telefone) ?? "",
    dataNasc:  profileProp?.data_nascimento ?? "",
    novoEmail: "",
  });
  const [emailMsgOk, setEmailMsgOk] = useState("");

  // Só no cliente (a data de hoje do servidor pode ser outra → hidratação diferente)
  const idadeStr = useSyncExternalStore(
    semSubscricao,
    () => calcularIdade(profile?.data_nascimento ?? null),
    () => "",
  );

  async function handleLogout() {
    setSaindo(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!TIPOS_IMAGEM.includes(file.type)) {
      setUploadErro("Apenas JPG, PNG e WebP são aceitos.");
      return;
    }
    if (file.size > MAX_IMAGEM_BYTES) {
      setUploadErro("A imagem deve ter no máximo 2MB.");
      return;
    }

    setUploading(true);
    setUploadErro("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const blob = await comprimirParaWebP(file);
      const fileName = `${user.id}.webp`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, blob, { contentType: "image/webp", upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      await supabase
        .from("profiles")
        .update({ foto_url: publicUrl })
        .eq("id", user.id);

      setFotoUrl(`${publicUrl}?t=${Date.now()}`);
      toast.success("Foto atualizada");
      router.refresh();
    } catch (err) {
      setUploadErro(err instanceof Error ? err.message : "Erro ao fazer upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function iniciarEdicao() {
    setForm({
      nome:      profile?.nome_completo ?? "",
      telefone:  telefoneParaE164(profile?.telefone) ?? "",
      dataNasc:  profile?.data_nascimento ?? "",
      novoEmail: "",
    });
    setSalvoErro("");
    setEmailMsgOk("");
    setEditando(true);
  }

  async function handleSalvar() {
    if (!form.nome.trim()) {
      setSalvoErro("Nome não pode estar vazio.");
      return;
    }

    setSalvando(true);
    setSalvoErro("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("profiles")
        .update({
          nome_completo:    form.nome.trim(),
          telefone:         form.telefone.trim() || null,
          data_nascimento:  form.dataNasc || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              nome_completo:   form.nome.trim(),
              telefone:        form.telefone.trim() || null,
              data_nascimento: form.dataNasc || null,
            }
          : prev
      );

      const emailNovo = form.novoEmail.trim().toLowerCase();
      if (emailNovo && emailNovo !== email.toLowerCase()) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: emailNovo });
        if (emailErr) throw emailErr;
        setEmailMsgOk(`Email de confirmação enviado para ${emailNovo}. Confirma para concluir a alteração.`);
      }

      setEditando(false);
      toast.success("Dados guardados");
      router.refresh();
    } catch (err) {
      setSalvoErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const header = (
    <PageHeader title="A minha conta" icon={<UserRound size={20} />} back={{ href: "/perfil", label: "Início" }} />
  );

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col bg-canvas">
        {header}
        <div className="flex-1 px-4 py-8 text-center space-y-3 pb-bottom-nav">
          <p className="text-gray-500">Perfil não encontrado.</p>
          <Button variant="outline" onClick={handleLogout}>Sair</Button>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[profile.status] ?? STATUS_LABELS.ativo;

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {header}

      <div className="flex-1 px-4 pt-4 space-y-3 pb-bottom-nav animar-lista">
        {/* Identidade + foto */}
        <section className="bg-surface border border-gray-100 rounded-2xl p-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => !uploading && fileInputRef.current?.click()}
            disabled={uploading}
            className="relative w-16 h-16 shrink-0 rounded-full bg-ink border-2 border-brand flex items-center justify-center overflow-hidden focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            aria-label="Alterar foto de perfil"
          >
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-lg">{iniciaisDe(profile.nome_completo)}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 h-5 bg-black/55 flex items-center justify-center">
              {uploading ? <Loader2 size={12} className="text-white animate-spin" /> : <Camera size={12} className="text-white" />}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Selecionar foto de perfil"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-semibold text-gray-900 leading-tight break-words">{profile.nome_completo}</p>
            <p className="text-[13px] text-gray-500 truncate mt-0.5">{email}</p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {PERFIL_LABELS[profile.perfil] ?? profile.perfil}
              </span>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusInfo.classe}`}>
                {statusInfo.label}
              </span>
            </div>
            {uploadErro && <p className="text-red-600 text-xs mt-1.5">{uploadErro}</p>}
          </div>
        </section>

        {/* Dados pessoais */}
        <section className="bg-surface border border-gray-100 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-gray-900">
              <ShieldCheck size={16} className="text-gray-400" />
              Dados pessoais
            </h2>
            {!editando && (
              <button
                type="button"
                onClick={iniciarEdicao}
                className="-mr-2 h-11 px-3 rounded-lg text-[13px] font-medium text-brand active:bg-brand/10"
              >
                Editar
              </button>
            )}
          </div>

          <div className="px-4 py-2">
            {editando ? (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="telefone">Telefone</Label>
                  <PhoneInput
                    id="telefone"
                    value={form.telefone || undefined}
                    onChange={(v) => setForm((f) => ({ ...f, telefone: v ?? "" }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dataNasc">Data de nascimento</Label>
                  <Input
                    id="dataNasc"
                    type="date"
                    title="Data de nascimento"
                    value={form.dataNasc}
                    onChange={(e) => setForm((f) => ({ ...f, dataNasc: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={email}
                    value={form.novoEmail}
                    onChange={(e) => setForm((f) => ({ ...f, novoEmail: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500 px-1">
                    Deixa em branco para manter {email}. Ao alterar, receberás um email de confirmação.
                  </p>
                </div>

                {profile.faixa && (
                  <div className="rounded-xl bg-canvas px-4 py-3">
                    <p className="text-xs text-gray-500 font-medium mb-1">Faixa / Graus / Categoria</p>
                    <p className="text-sm text-gray-700 capitalize">
                      {labelCorFaixa(profile.faixa)} · {profile.graus} grau{profile.graus !== 1 ? "s" : ""} · {profile.categoria}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Apenas o professor pode alterar</p>
                  </div>
                )}

                {salvoErro && <p className="text-red-600 text-sm">{salvoErro}</p>}

                <div className="flex gap-3 pt-1">
                  <Button
                    onClick={handleSalvar}
                    disabled={salvando}
                    className="flex-1 bg-brand hover:bg-brand-dark text-white"
                  >
                    {salvando ? (
                      <><Loader2 size={16} className="animate-spin mr-2" />Salvando...</>
                    ) : (
                      <><Check size={16} className="mr-2" />Salvar</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setEditando(false); setSalvoErro(""); }}
                    disabled={salvando}
                    className="flex-1"
                  >
                    <X size={16} className="mr-2" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <InfoRow icon={<User size={16} />} label="Nome completo" value={profile.nome_completo} />
                <InfoRow icon={<Mail size={16} />} label="E-mail" value={email || "—"} />
                {profile.telefone && (
                  <InfoRow icon={<Phone size={16} />} label="Telefone" value={telefoneParaExibir(profile.telefone)} />
                )}
                {profile.data_nascimento && (
                  <InfoRow
                    icon={<Calendar size={16} />}
                    label="Data de nascimento"
                    value={formatarData(profile.data_nascimento) + idadeStr}
                  />
                )}
              </>
            )}
            {emailMsgOk && <p className="text-xs text-green-700 px-1 pb-2">{emailMsgOk}</p>}
          </div>
        </section>

        {/* Mensalidades */}
        {mensalidades.length > 0 && (
          <section id="mensalidades" className="bg-surface border border-gray-100 rounded-2xl overflow-hidden scroll-mt-4">
            <div className="flex items-center px-4 h-12 border-b border-gray-100">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-gray-900">
                <CreditCard size={16} className="text-gray-400" />
                Mensalidades
              </h2>
            </div>
            <div className="px-4 py-1">
              {mensalidades.map((m) => {
                const ef = getEffectiveStatus(m);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-gray-900">{formatarMes(Number(m.mes_referencia.slice(0, 4)), Number(m.mes_referencia.slice(5, 7)))}</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">Vence em {formatarData(m.data_vencimento)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[14px] font-medium text-gray-900">{m.valor != null ? formatarMoeda(m.valor) : "—"}</p>
                      {m.valor != null && <DetalheMensalidade valor={m.valor} itens={m.itens} className="text-xs" />}
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${
                        ef === "pago"
                          ? "bg-emerald-500/15 text-emerald-700"
                          : ef === "atrasado"
                          ? "bg-red-500/15 text-red-700"
                          : "bg-amber-500/15 text-amber-700"
                      }`}>
                        {ef === "pago"
                          ? `Pago${m.data_pagamento ? ` em ${formatarData(m.data_pagamento)}` : ""}`
                          : ef === "atrasado"
                          ? "Vencida"
                          : "Pendente"
                        }
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {mensalidades.some((m) => getEffectiveStatus(m) === "atrasado") && (
              <div className="px-4 pb-4">
                <a
                  href="https://wa.me/14076941856"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-whatsapp hover:bg-whatsapp-dark transition-colors duration-fast text-white text-[14px] font-medium"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Falar com a Simone
                </a>
              </div>
            )}
          </section>
        )}

        <button
          type="button"
          onClick={handleLogout}
          disabled={saindo}
          className="w-full h-12 rounded-2xl bg-surface border border-gray-100 flex items-center justify-center gap-2 text-[14px] font-medium text-red-700 active:bg-red-50 transition-colors duration-fast disabled:opacity-60"
        >
          {saindo ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
          Sair da conta
        </button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="text-gray-400 shrink-0 w-5 text-center">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-[14px] text-gray-900 break-words">{value}</p>
      </div>
    </div>
  );
}
