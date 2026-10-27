"use client";

// NextImage: o nome "Image" é o construtor global usado na compressão WebP
import NextImage from "next/image";
import Link, { useLinkStatus } from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Bell, Camera, Images, LayoutList, Loader2, Medal, Settings, Trophy, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FaixaBJJ } from "@/components/FaixaBJJ";
import { cn, labelCorFaixa } from "@/lib/utils";
import { comprimirParaWebP } from "@/lib/comprimir-imagem";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import type { Separador } from "@/lib/inicio";
import type { CategoriaFaixa, CorFaixa, Mensalidade, PerfilUsuario } from "@/lib/types";
import { NotificacoesModal } from "./NotificacoesModal";

export interface PessoaInicio {
  id: string;
  nome: string;
  foto: string | null;
  faixa: CorFaixa | null;
  graus: number;
  categoria: CategoriaFaixa;
  perfil: PerfilUsuario;
}

interface InicioViewProps {
  pessoa: PessoaInicio;
  separador: Separador;
  mensalidades: Mensalidade[];
  avisosNotif: { id: string; titulo: string; created_at: string }[];
  children: React.ReactNode;
}

const PILULAS: { id: Separador; label: string; icon: LucideIcon }[] = [
  { id: "feed", label: "Feed", icon: LayoutList },
  { id: "ranking", label: "Ranking", icon: Trophy },
  { id: "conquistas", label: "Conquistas", icon: Medal },
  { id: "galeria", label: "Galeria", icon: Images },
];

const SAFE_TOP = "env(safe-area-inset-top, 0px)";

const NO_SERVIDOR = "ssr";
const semSubscricao = () => () => {};
function lerUltimaVista(): string | null {
  try {
    return localStorage.getItem("notificacoes_last_seen");
  } catch {
    return null;
  }
}

// Dentro do <Link>: a pílula tocada fica logo activa enquanto o servidor responde
// (e a activa de antes apaga-se), sem esperar pela casca toda
function PilulaConteudo({ activa, label, icon: Icon }: { activa: boolean; label: string; icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  const destacada = activa || pending;
  return (
    <span
      data-pendente={pending && !activa ? "" : undefined}
      className={cn(
        "flex items-center gap-1.5 h-11 px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors duration-fast",
        destacada
          ? "bg-brand text-white"
          : "bg-surface border border-line text-fg hover:bg-canvas active:scale-[0.97]",
        activa &&
          "group-has-[[data-pendente]]/pilulas:bg-surface group-has-[[data-pendente]]/pilulas:text-fg group-has-[[data-pendente]]/pilulas:border group-has-[[data-pendente]]/pilulas:border-line",
      )}
    >
      <Icon size={16} aria-hidden="true" className={pending ? "animate-pulse" : undefined} />
      {label}
    </span>
  );
}

export function InicioView({ pessoa, separador, mensalidades, avisosNotif, children }: InicioViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pilulasRef = useRef<HTMLUListElement>(null);
  const [lidas, setLidas] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [fotoUrl, setFotoUrl] = useState(pessoa.foto);
  const [uploading, setUploading] = useState(false);

  usePushSubscription();

  // O ponto do sino depende do localStorage: lido só no cliente (no servidor fica escondido)
  const lastSeen = useSyncExternalStore(semSubscricao, lerUltimaVista, () => NO_SERVIDOR);
  const hasUnread = useMemo(() => {
    if (lidas || lastSeen === NO_SERVIDOR) return false;
    if (!lastSeen) {
      const hasMensalidadeAtrasada = mensalidades.some((m) => m.status !== "pago");
      const hasAvisos = avisosNotif.length > 0;
      return hasMensalidadeAtrasada || hasAvisos;
    }
    const lastSeenDate = new Date(lastSeen);
    const novoAviso = avisosNotif.some((a) => new Date(a.created_at) > lastSeenDate);
    const novasMensalidades = mensalidades.some(
      (m) => m.status !== "pago" && new Date(m.data_vencimento + "T09:00:00") > lastSeenDate
    );
    return novoAviso || novasMensalidades;
  }, [lidas, lastSeen, avisosNotif, mensalidades]);

  // Pílula activa sempre à vista quando as quatro não cabem (só desliza na horizontal)
  useEffect(() => {
    const lista = pilulasRef.current;
    const activa = lista?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!lista || !activa) return;
    const inicio = activa.offsetLeft - 16;
    const fim = activa.offsetLeft + activa.offsetWidth + 16 - lista.clientWidth;
    if (lista.scrollLeft > inicio) lista.scrollLeft = inicio;
    else if (lista.scrollLeft < fim) lista.scrollLeft = fim;
  }, [separador]);

  const handleAvatarClick = useCallback(() => {
    if (!uploading) fileInputRef.current?.click();
  }, [uploading]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];
    if (!tiposPermitidos.includes(file.type)) {
      toast.error("Apenas JPG, PNG e WebP são aceites.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }

    setUploading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const blob = await comprimirParaWebP(file, 500);
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
      toast.error(err instanceof Error ? err.message : "Erro ao fazer upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const iniciais = pessoa.nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {/* Faixa escura fixa sob o notch: com as pílulas presas no topo, o texto branco da barra
          de estado continua legível. Parado, fica por cima do cabeçalho (escuro como ela). */}
      <div
        aria-hidden="true"
        data-faixa-notch
        className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-ink"
        style={{ height: SAFE_TOP }}
      />
      <header className="bg-ink px-5 pt-header pb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 min-w-0">
            <NextImage src="/logo.webp" alt="Gracie Barra" width={32} height={32} priority className="w-8 h-8 object-contain" />
            <span className="text-white font-medium text-[13px] tracking-[0.5px] truncate">GRACIE BARRA FAMALICÃO</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { setNotifOpen(true); setLidas(true); }}
              className="relative w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-fast hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label="Notificações"
            >
              <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <Bell size={18} className="text-white" aria-hidden="true" />
              </span>
              {hasUnread && (
                <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-brand border-2 border-ink" aria-hidden="true" />
              )}
            </button>
            <Link
              href="/conta"
              aria-label="Minha conta"
              className="w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-fast hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <Settings size={18} className="text-white" aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploading}
              className="relative w-[72px] h-[72px] rounded-full bg-white/15 border-[2.5px] border-brand flex items-center justify-center shadow-lg overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label="Alterar foto de perfil"
            >
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-black text-xl">{iniciais}</span>
              )}
              {uploading ? (
                <span className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 size={24} className="text-white animate-spin" aria-hidden="true" />
                </span>
              ) : (
                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={20} className="text-white" aria-hidden="true" />
                </span>
              )}
            </button>
            <span
              className="pointer-events-none absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] rounded-full bg-brand border-2 border-ink flex items-center justify-center shadow"
              aria-hidden="true"
            >
              <Camera size={10} className="text-white" />
            </span>
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
            <h1 className="text-white font-medium text-xl leading-tight break-words">{pessoa.nome}</h1>
            {pessoa.faixa && (
              <div className="flex items-center gap-2.5 mt-2">
                <FaixaBJJ faixa={pessoa.faixa} graus={pessoa.graus} categoria={pessoa.categoria} tamanho="sm" />
                <span className="text-[13px] text-white/70">
                  {labelCorFaixa(pessoa.faixa)}
                  {pessoa.graus > 0 && ` · ${pessoa.graus} ${pessoa.graus === 1 ? "grau" : "graus"}`}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Presa por baixo do aviso de mensalidade (--banner-h, quando existe) ou da faixa do notch */}
      <nav
        aria-label="Secções do início"
        className="sticky z-30 bg-canvas pt-3"
        style={{ top: `var(--banner-h, ${SAFE_TOP})` }}
      >
        <ul ref={pilulasRef} className="group/pilulas relative flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PILULAS.map(({ id, label, icon }) => {
            const activa = separador === id;
            return (
              <li key={id} className="shrink-0">
                <Link
                  href={id === "feed" ? "/perfil" : `/perfil?tab=${id}`}
                  scroll={false}
                  aria-current={activa ? "page" : undefined}
                  className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <PilulaConteudo activa={activa} label={label} icon={icon} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex-1 px-4 pt-1 pb-bottom-nav">{children}</div>

      {notifOpen && (
        <NotificacoesModal
          mensalidades={mensalidades}
          avisos={avisosNotif}
          onClose={() => setNotifOpen(false)}
        />
      )}
    </div>
  );
}
