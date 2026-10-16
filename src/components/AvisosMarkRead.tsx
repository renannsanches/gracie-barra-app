"use client";

import { useEffect } from "react";

export const AVISOS_LAST_SEEN_KEY = "avisos_last_seen";
/** Avisa a BottomNav (mesmo separador — o evento "storage" só chega a outros) */
export const AVISOS_LIDOS_EVENT = "avisos-lidos";

export function AvisosMarkRead() {
  useEffect(() => {
    try {
      localStorage.setItem(AVISOS_LAST_SEEN_KEY, new Date().toISOString());
    } catch {
      return;
    }
    window.dispatchEvent(new Event(AVISOS_LIDOS_EVENT));
  }, []);
  return null;
}
