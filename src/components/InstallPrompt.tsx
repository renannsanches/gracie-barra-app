"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem("pwa-install-dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem("pwa-install-dismissed", "1");
    setVisible(false);
  }

  if (!visible) return null;

  // Cartão flutuante acima da barra inferior (quando existe) e do home indicator
  return (
    <div className="install-prompt fixed left-3 right-3 z-50 flex items-center gap-3 rounded-2xl border border-gray-200 bg-surface py-2 pl-3 pr-1 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-base">
      <Image
        src="/logo.webp"
        alt="Gracie Barra"
        width={40}
        height={40}
        className="shrink-0 rounded-lg"
      />
      <span className="flex-1 text-sm font-medium text-ink">
        Instalar Gracie Barra Famalicão
      </span>
      <button
        type="button"
        onClick={handleInstall}
        className="shrink-0 h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white active:scale-[0.98] transition-transform"
      >
        Instalar
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 w-11 h-11 flex items-center justify-center text-gray-400"
        aria-label="Fechar"
      >
        <X size={18} />
      </button>
    </div>
  );
}
