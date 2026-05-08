"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User, Phone, Calendar, Mail, LogOut, ShieldCheck,
  Award, QrCode, Camera, Loader2, Check, X, Pencil, CalendarDays, CreditCard, BookOpen, Megaphone, Images, Users, ChevronRight, ChevronDown, Bell,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FaixaBJJ, inferCategoria } from "@/components/FaixaBJJ";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mascararTelefonePT, formatarTelefonePT, formatarMoeda, formatarMes, formatarData, labelCorFaixa } from "@/lib/utils";
import type { Profile, Mensalidade, StatusMensalidade, HistoricoGraduacao, DependentePerfil } from "@/lib/types";
import { DependenteModal } from "./DependenteModal";

const STATUS_LABELS: Record<string, { label: string; variant: "success" | "destructive" | "warning" }> = {
  ativo:    { label: "Ativo",    variant: "success" },
  inativo:  { label: "Inativo",  variant: "destructive" },
  trancado: { label: "Trancado", variant: "warning" },
};

const PERFIL_LABELS: Record<string, string> = {
  aluno:     "Aluno",
  professor: "Professor",
  admin:     "Administrador",
  tablet:    "Tablet",
};

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

function calcularIdade(dataNascimento: string | null): string {
  if (!dataNascimento) return "";
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return ` (${idade} anos)`;
}

async function comprimirParaWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const MAX = 500;
      let { width, height } = img;

      if (width > MAX || height > MAX) {
        if (width >= height) {
          height = Math.round((height / width) * MAX);
          width = MAX;
        } else {
          width = Math.round((width / height) * MAX);
          height = MAX;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas não suportado"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) resolve(blob);
          else reject(new Error("Falha ao converter imagem"));
        },
        "image/webp",
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao carregar imagem"));
    };

    img.src = objectUrl;
  });
}

interface PerfilViewProps {
  profile: Profile | null;
  email: string;
  mensalidades: Mensalidade[];
  historicoGraduacoes: HistoricoGraduacao[];
  totalAulas: number;
  aulasMes: number;
  ultimoTreino: string | null;
  avisosTimestamps: string[];
  dependentes: DependentePerfil[];
}

export function PerfilView({ profile: profileProp, email, mensalidades, historicoGraduacoes, totalAulas, aulasMes, ultimoTreino, avisosTimestamps, dependentes }: PerfilViewProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [unreadAvisos, setUnreadAvisos] = useState(0);
  const [saindo, setSaindo] = useState(false);
  const [dependenteSelecionado, setDependenteSelecionado] = useState<DependentePerfil | null>(null);

  const [faixaOpen, setFaixaOpen] = useState(true);
  const [dadosOpen, setDadosOpen] = useState(false);
  const [mensalidadesOpen, setMensalidadesOpen] = useState(true);
  const [dependentesOpen, setDependentesOpen] = useState(true);

  useEffect(() => {
    const lastSeen = localStorage.getItem("avisos_last_seen");
    const count = lastSeen
      ? avisosTimestamps.filter((t) => new Date(t) > new Date(lastSeen)).length
      : avisosTimestamps.length;
    setUnreadAvisos(count);
  }, [avisosTimestamps]);

  const [profile, setProfile] = useState(profileProp);
  const [fotoUrl, setFotoUrl] = useState(profileProp?.foto_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadErro, setUploadErro] = useState("");

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);
  const [salvoErro, setSalvoErro] = useState("");
  const [form, setForm] = useState({
    nome:     profileProp?.nome_completo ?? "",
    telefone: profileProp?.telefone ?? "",
    dataNasc: profileProp?.data_nascimento ?? "",
  });

  async function handleLogout() {
    setSaindo(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const handleAvatarClick = useCallback(() => {
    if (!uploading) fileInputRef.current?.click();
  }, [uploading]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];
    if (!tiposPermitidos.includes(file.type)) {
      setUploadErro("Apenas JPG, PNG e WebP são aceitos.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
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
    } catch (err) {
      setUploadErro(err instanceof Error ? err.message : "Erro ao fazer upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function iniciarEdicao() {
    setForm({
      nome:     profile?.nome_completo ?? "",
      telefone: profile?.telefone ?? "",
      dataNasc: profile?.data_nascimento ?? "",
    });
    setSalvoErro("");
    setEditando(true);
  }

  function cancelarEdicao() {
    setEditando(false);
    setSalvoErro("");
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

      setEditando(false);
      setSalvoOk(true);
      setTimeout(() => setSalvoOk(false), 3000);
    } catch (err) {
      setSalvoErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-gray-500">Perfil não encontrado.</p>
          <Button variant="outline" onClick={handleLogout}>Sair</Button>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[profile.status] ?? STATUS_LABELS.ativo;
  const primeiroNome = profile.nome_completo.split(" ")[0];
  const iniciais = profile.nome_completo
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-gb-gray">
      <div className="bg-[#1a1a1a] px-5 pt-10 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <img src="/logo.webp" alt="Gracie Barra" className="w-8 h-8 object-contain" />
            <span className="text-white font-medium text-[13px] tracking-[0.5px]">GRACIE BARRA FAMALICÃO</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/avisos")}
              className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
              aria-label="Notificações"
            >
              <Bell size={18} className="text-white" />
              {unreadAvisos > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {unreadAvisos > 9 ? "9+" : unreadAvisos}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={saindo}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
              aria-label="Sair"
            >
              {saindo ? <Loader2 size={18} className="text-white animate-spin" /> : <LogOut size={18} className="text-white" />}
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploading}
              className="relative w-[72px] h-[72px] rounded-full bg-[#333] border-[2.5px] border-[#c8102e] flex items-center justify-center shadow-lg overflow-hidden group focus:outline-none"
              aria-label="Alterar foto de perfil"
            >
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fotoUrl}
                  alt={profile.nome_completo}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-black text-xl">{iniciais}</span>
              )}
              {uploading ? (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 size={24} className="text-white animate-spin" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={20} className="text-white" />
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploading}
              className="absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] rounded-full bg-[#c8102e] border-2 border-[#1a1a1a] flex items-center justify-center shadow"
              aria-label="Alterar foto"
            >
              <Camera size={10} className="text-white" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Selecionar foto de perfil"
            className="hidden"
            onChange={handleAvatarChange}
          />

          <div className="flex-1 min-w-0">
            {uploadErro && (
              <p className="text-red-400 text-xs mb-1">{uploadErro}</p>
            )}
            <p className="text-[13px] text-white/50 mb-0.5">Bem-vindo de volta</p>
            <h1 className="text-white font-medium text-xl leading-tight">{profile.nome_completo}</h1>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[11px] font-medium px-2.5 py-[3px] rounded-full bg-white/15 text-white/85">
                {PERFIL_LABELS[profile.perfil] ?? profile.perfil}
              </span>
              <span className={`text-[11px] font-medium px-2.5 py-[3px] rounded-full ${
                statusInfo.variant === "success" ? "bg-emerald-500/20 text-emerald-400" :
                statusInfo.variant === "destructive" ? "bg-red-500/20 text-red-400" :
                "bg-amber-500/20 text-amber-400"
              }`}>
                {statusInfo.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 space-y-3 pb-8">
        <div className="grid grid-cols-2 gap-2.5">
          <ActionCard
            onClick={() => router.push("/presenca")}
            primary
            icon={<QrCode size={20} className="text-white" />}
            label="Registrar Presença"
          />
          <ActionCard
            onClick={() => router.push("/presencas")}
            icon={<CalendarDays size={20} className="text-gray-500" />}
            label="Histórico"
          />
          <ActionCard
            onClick={() => router.push("/aulas")}
            icon={<BookOpen size={20} className="text-gray-500" />}
            label="Aulas"
          />
          <ActionCard
            onClick={() => router.push("/avisos")}
            icon={
              <div className="relative">
                <Megaphone size={20} className="text-gray-500" />
                {unreadAvisos > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadAvisos > 9 ? "9+" : unreadAvisos}
                  </span>
                )}
              </div>
            }
            label="Avisos"
          />
          <ActionCard
            onClick={() => router.push("/galeria")}
            icon={<Images size={20} className="text-gray-500" />}
            label="Galeria"
          />
        </div>

        {/* Faixa + Stats */}
        <AccordionCard
          open={faixaOpen}
          onToggle={() => setFaixaOpen((o) => !o)}
          icon={<Award size={16} className="text-gray-400" />}
          title="Faixa &amp; Graduação"
        >
            <div className="space-y-3">
              {profile.faixa ? (
                <>
                  <div className="flex items-center gap-3">
                    <FaixaBJJ faixa={profile.faixa} graus={profile.graus} categoria={profile.categoria} tamanho="sm" className="flex-1" />
                    <div className="text-right shrink-0">
                      <p className="text-[14px] font-medium text-gray-900">{labelCorFaixa(profile.faixa)}</p>
                      <p className="text-[12px] text-gray-400">{profile.graus} {profile.graus === 1 ? "grau" : "graus"} · <span className="capitalize">{profile.categoria}</span></p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gb-gray rounded-xl p-3 text-center">
                      <p className="text-[22px] font-medium text-gray-900 leading-none">{totalAulas}</p>
                      <p className="text-[11px] text-gray-400 mt-1">Total de aulas</p>
                    </div>
                    <div className="bg-gb-gray rounded-xl p-3 text-center">
                      <p className="text-[22px] font-medium text-gray-900 leading-none">{aulasMes}</p>
                      <p className="text-[11px] text-gray-400 mt-1">Esse mês</p>
                    </div>
                    <div className="bg-gb-gray rounded-xl p-3 text-center">
                      <p className="text-[22px] font-medium text-gray-900 leading-none">
                        {ultimoTreino ? formatarData(ultimoTreino).split("/").slice(0, 2).join("/") : "—"}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">Último treino</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <Award size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Graduação a ser definida pelo professor</p>
                </div>
              )}

              {historicoGraduacoes.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Minha Evolução</p>
                  <div className="relative pl-9">
                    {historicoGraduacoes.length > 1 && (
                      <div className="absolute left-3 top-5 bottom-5 w-0.5 bg-gray-200 rounded-full" />
                    )}
                    {historicoGraduacoes.map((g) => (
                      <div key={g.id} className="relative mb-5 last:mb-0">
                        <div className="absolute -left-9 top-1 w-7 h-7 rounded-full bg-gb-blue border-2 border-white flex items-center justify-center shadow-sm z-10">
                          <Award size={12} className="text-white" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            {formatarData(g.data_graduacao)}
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            {g.faixa_anterior && (
                              <>
                                <FaixaBJJ
                                  faixa={g.faixa_anterior}
                                  graus={g.graus_anterior ?? 0}
                                  categoria={inferCategoria(g.faixa_anterior)}
                                  tamanho="sm"
                                  showLabel
                                />
                                <span className="text-gray-400 text-xl font-light shrink-0">→</span>
                              </>
                            )}
                            <FaixaBJJ faixa={g.faixa_nova} graus={g.graus_nova} categoria={inferCategoria(g.faixa_nova)} tamanho="sm" showLabel />
                          </div>
                          {(g.professor || g.observacoes) && (
                            <div className="space-y-0.5 pt-1">
                              {g.professor && (
                                <p className="text-xs text-gray-400">{g.professor.nome_completo}</p>
                              )}
                              {g.observacoes && (
                                <p className="text-xs text-gray-500 italic">&ldquo;{g.observacoes}&rdquo;</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
        </AccordionCard>

        {/* Dados pessoais */}
        <AccordionCard
          open={dadosOpen}
          onToggle={() => setDadosOpen((o) => !o)}
          icon={<ShieldCheck size={16} className="text-gray-400" />}
          title="Dados pessoais"
          action={
            !editando ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDadosOpen(true);
                  iniciarEdicao();
                }}
                className="text-[12px] text-[#c8102e] font-medium"
              >
                Editar
              </button>
            ) : undefined
          }
        >
          <div className="space-y-1">
            {salvoOk && (
              <div className="mb-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <Check size={16} className="text-green-600 shrink-0" />
                <p className="text-green-700 text-sm font-medium">Dados salvos com sucesso!</p>
              </div>
            )}

            {editando ? (
              <div className="space-y-4 pt-1">
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
                  <Input
                    id="telefone"
                    type="tel"
                    placeholder="+351 XXX XXX XXX"
                    value={form.telefone}
                    onChange={(e) => setForm((f) => ({ ...f, telefone: mascararTelefonePT(e.target.value) }))}
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
                  <Label className="text-gray-400">Email</Label>
                  <p className="text-sm text-gray-400 px-1">{email}</p>
                  <p className="text-xs text-gray-300 px-1">O email não pode ser alterado</p>
                </div>

                {profile.faixa && (
                  <div className="rounded-xl bg-gb-gray px-4 py-3">
                    <p className="text-xs text-gray-400 font-medium mb-1">Faixa / Graus / Categoria</p>
                    <p className="text-sm text-gray-500 capitalize">
                      {labelCorFaixa(profile.faixa)} · {profile.graus} grau{profile.graus !== 1 ? "s" : ""} · {profile.categoria}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Apenas o professor pode alterar</p>
                  </div>
                )}

                {salvoErro && (
                  <p className="text-red-600 text-sm">{salvoErro}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <Button
                    onClick={handleSalvar}
                    disabled={salvando}
                    className="flex-1 bg-[#c8102e] hover:bg-[#a50d25] text-white"
                  >
                    {salvando ? (
                      <><Loader2 size={16} className="animate-spin mr-2" />Salvando...</>
                    ) : (
                      <><Check size={16} className="mr-2" />Salvar</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelarEdicao}
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
                  <InfoRow icon={<Phone size={16} />} label="Telefone" value={formatarTelefonePT(profile.telefone)} />
                )}
                {profile.data_nascimento && (
                  <InfoRow
                    icon={<Calendar size={16} />}
                    label="Data de nascimento"
                    value={formatarData(profile.data_nascimento) + calcularIdade(profile.data_nascimento)}
                  />
                )}
              </>
            )}
          </div>
        </AccordionCard>

        {/* Mensalidades */}
        {mensalidades.length > 0 && (
          <AccordionCard
            open={mensalidadesOpen}
            onToggle={() => setMensalidadesOpen((o) => !o)}
            icon={<CreditCard size={16} className="text-gray-400" />}
            title="Mensalidades"
          >
            <div className="space-y-2">
              {mensalidades.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-gray-900">{formatarMes(Number(m.mes_referencia.slice(0, 4)), Number(m.mes_referencia.slice(5, 7)))}</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">Vence em {formatarData(m.data_vencimento)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-medium text-gray-900">{m.valor != null ? formatarMoeda(m.valor) : "—"}</p>
                    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mt-1 ${
                      m.status === "pago"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : m.status === "atrasado"
                        ? "bg-red-500/15 text-red-600"
                        : "bg-amber-500/15 text-amber-600"
                    }`}>
                      {m.status === "pago"
                        ? `Pago${m.data_pagamento ? ` em ${formatarData(m.data_pagamento)}` : ""}`
                        : m.status === "atrasado"
                        ? "Atrasado"
                        : "Pendente"
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </AccordionCard>
        )}

        {/* Dependentes */}
        {dependentes.length > 0 && (
          <AccordionCard
            open={dependentesOpen}
            onToggle={() => setDependentesOpen((o) => !o)}
            icon={<Users size={16} className="text-gray-400" />}
            title="Dependentes"
          >
            <div className="space-y-1">
              {dependentes.map((dep) => {
                const depIniciais = dep.nome_completo
                  .split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase();
                return (
                  <button
                    key={dep.id}
                    type="button"
                    onClick={() => setDependenteSelecionado(dep)}
                    className="w-full flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#1a3a6b] flex items-center justify-center overflow-hidden shrink-0">
                      {dep.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={dep.foto_url} alt={dep.nome_completo} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-[13px]">{depIniciais}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-gray-900 truncate">{dep.nome_completo}</p>
                      {dep.faixa && (
                        <p className="text-[12px] text-gray-400 mt-0.5">
                          {labelCorFaixa(dep.faixa)} · {dep.graus} grau{dep.graus !== 1 ? "s" : ""} · <span className="capitalize">{dep.categoria}</span>
                        </p>
                      )}
                    </div>
                    {dep.faixa && (
                      <FaixaBJJ faixa={dep.faixa} graus={dep.graus} categoria={dep.categoria} tamanho="sm" />
                    )}
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          </AccordionCard>
        )}
      </div>

      {dependenteSelecionado && (
        <DependenteModal
          dependente={dependenteSelecionado}
          onClose={() => setDependenteSelecionado(null)}
        />
      )}
    </div>
  );
}

function AccordionCard({
  open,
  onToggle,
  icon,
  title,
  action,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[13px] font-medium text-gray-900" dangerouslySetInnerHTML={{ __html: title }} />
        </div>
        <div className="flex items-center gap-2.5">
          {action}
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform duration-200 ease-in-out${open ? "" : " rotate-180"}`}
          />
        </div>
      </button>
      <div className={`overflow-hidden transition-[max-height] duration-[250ms] ease-in-out ${open ? "max-h-[2000px]" : "max-h-0"}`}>
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {children}
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  onClick,
  icon,
  label,
  primary,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl p-4 flex flex-col gap-2.5 active:scale-[0.97] transition-all text-left ${
        primary
          ? "bg-[#c8102e] border-0"
          : "bg-white border border-gray-100"
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        primary ? "bg-white/20" : "bg-gray-100"
      }`}>
        {icon}
      </div>
      <p className={`text-[13px] font-medium leading-tight ${primary ? "text-white" : "text-gray-800"}`}>
        {label}
      </p>
    </button>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="text-gray-400 shrink-0 w-5 text-center">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
        <p className="text-[14px] text-gray-900 break-words">{value}</p>
      </div>
    </div>
  );
}
