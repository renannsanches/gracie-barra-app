"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Home, BookOpen, QrCode, CalendarDays, Megaphone, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AVISOS_LAST_SEEN_KEY, AVISOS_LIDOS_EVENT } from "@/components/AvisosMarkRead";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Outras rotas que contam como esta tab (ex.: galeria abre a partir do Início) */
  extra?: string[];
};

const TABS: Tab[] = [
  { href: "/perfil", label: "Início", icon: Home, extra: ["/galeria", "/conquistas", "/ranking", "/turmas", "/conta"] },
  { href: "/aulas", label: "Aulas", icon: BookOpen },
  { href: "/presenca", label: "Presença", icon: QrCode },
  { href: "/presencas", label: "Histórico", icon: CalendarDays },
  { href: "/avisos", label: "Avisos", icon: Megaphone },
];

const CENTRO = "/presenca";

function corresponde(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(base + "/");
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(AVISOS_LIDOS_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(AVISOS_LIDOS_EVENT, cb);
  };
}

function lerUltimaVisita(): string | null {
  try {
    return localStorage.getItem(AVISOS_LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Barra de navegação inferior do aluno (≤ 5 destinos, Presença ao centro).
 * Substitui o vaivém pelo /perfil: cada destino principal fica a um toque.
 */
export function BottomNav({ ultimoAvisoEm }: { ultimoAvisoEm: string | null }) {
  const pathname = usePathname();
  // undefined no servidor → sem badge até o cliente ler o localStorage
  const ultimaVisita = useSyncExternalStore(subscribe, lerUltimaVisita, () => undefined);

  const avisosPorLer =
    ultimoAvisoEm !== null &&
    ultimaVisita !== undefined &&
    !corresponde(pathname, "/avisos") &&
    (ultimaVisita === null || new Date(ultimoAvisoEm) > new Date(ultimaVisita));

  return (
    <nav
      data-bottom-nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-safe"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, extra }) => {
          const ativo = corresponde(pathname, href) || (extra ?? []).some((e) => corresponde(pathname, e));
          const centro = href === CENTRO;

          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "group relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-fast",
                  ativo ? "text-brand" : "text-fg-muted hover:text-fg",
                )}
              >
                {centro ? (
                  <span
                    className={cn(
                      "-mt-6 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg shadow-brand/30 ring-4 ring-surface transition-transform duration-fast ease-out-expo group-active:scale-90",
                      ativo ? "bg-brand-dark" : "bg-brand",
                    )}
                  >
                    <Icon size={22} strokeWidth={2.25} />
                  </span>
                ) : (
                  <span className="relative flex transition-transform duration-fast ease-out-expo group-active:scale-90">
                    <Icon size={22} strokeWidth={ativo ? 2.25 : 1.75} />
                    {href === "/avisos" && avisosPorLer && (
                      <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-surface">
                        <span className="sr-only">Avisos por ler</span>
                      </span>
                    )}
                  </span>
                )}
                <span className="leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
