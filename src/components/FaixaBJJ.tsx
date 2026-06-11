"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { CorFaixa, CategoriaFaixa } from "@/lib/types";

const ADULTO_MAP: Partial<Record<CorFaixa, string>> = {
  branca: "branca",
  azul:   "azul",
  roxa:   "roxo",
  marrom: "marrom",
  preta:  "preta",
};

const INFANTIL_MAP: Partial<Record<CorFaixa, string>> = {
  branca:         "branca",
  cinza_branca:   "cinzabr",
  cinza:          "cinza",
  cinza_preta:    "cinzapr",
  amarela_branca: "amarelabr",
  amarela:        "amarela",
  amarela_preta:  "amarelapr",
  laranja_branca: "laranjabr",
  laranja:        "laranja",
  laranja_preta:  "laranjapr",
  verde_branca:   "verdebr",
  verde:          "verde",
  verde_preta:    "verdepr",
};

const SIZE_H: Record<string, number> = {
  xs: 24,
  sm: 48,
  md: 60,
  lg: 72,
};

function beltLabel(cor: string): string {
  return cor.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("-");
}

interface FaixaBJJProps {
  faixa: CorFaixa;
  graus?: number;
  categoria: CategoriaFaixa;
  tamanho?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function FaixaBJJ({
  faixa,
  graus = 0,
  categoria,
  tamanho = "md",
  showLabel = false,
  className,
}: FaixaBJJProps) {
  const isInfantil = categoria === "infantil";
  const map = isInfantil ? INFANTIL_MAP : ADULTO_MAP;
  const nome = map[faixa];

  const grausLabel = graus === 0
    ? "Sem graus"
    : `${graus} ${graus === 1 ? "grau" : "graus"}`;

  if (!nome) return null;

  const basePath = isInfantil ? "/img/infantil/" : "/img/adulto/";
  const filename = graus > 0 ? `${nome}-${graus}g.webp` : `${nome}.webp`;
  const src = `${basePath}${filename}`;
  const h = SIZE_H[tamanho] ?? 40;

  return (
    <div className={cn("inline-flex flex-col items-center", className)}>
      <Image
        src={src}
        alt={`Faixa ${beltLabel(faixa)}, ${grausLabel}`}
        width={420}
        height={84}
        unoptimized
        style={{ height: h, width: "auto" }}
        className="object-contain"
      />
      {showLabel && (
        <div className="mt-1.5 text-center">
          <p className="text-sm font-semibold text-gray-900">{beltLabel(faixa)}</p>
          <p className="text-xs text-gray-500">{grausLabel}</p>
        </div>
      )}
    </div>
  );
}

// Infers categoria from faixa value — for use when categoria is not available
// (e.g. graduation history entries). "branca" defaults to adulto.
export function inferCategoria(faixa: CorFaixa): CategoriaFaixa {
  if (faixa.includes("_")) return "infantil";
  if (["cinza", "amarela", "laranja", "verde"].includes(faixa)) return "infantil";
  return "adulto";
}
