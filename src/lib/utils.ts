import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { CorFaixa } from "@/lib/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const LABEL_COR_FAIXA: Record<CorFaixa, string> = {
  branca:        "Branca",
  cinza_branca:  "Cinza/Branca",
  cinza:         "Cinza",
  cinza_preta:   "Cinza/Preta",
  amarela_branca:"Amarela/Branca",
  amarela:       "Amarela",
  amarela_preta: "Amarela/Preta",
  laranja_branca:"Laranja/Branca",
  laranja:       "Laranja",
  laranja_preta: "Laranja/Preta",
  verde_branca:  "Verde/Branca",
  verde:         "Verde",
  verde_preta:   "Verde/Preta",
  azul:          "Azul",
  roxa:          "Roxa",
  marrom:        "Marrom",
  preta:         "Preta",
  coral:         "Coral",
  vermelha:      "Vermelha",
}

export function labelCorFaixa(faixa: CorFaixa): string {
  return LABEL_COR_FAIXA[faixa] ?? faixa
}

export function mascararTelefonePT(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 9);
  if (nums.length <= 4) return nums;
  if (nums.length <= 7) return `${nums.slice(0,4)} ${nums.slice(4)}`;
  return `${nums.slice(0,4)} ${nums.slice(4,7)} ${nums.slice(7)}`;
}

export function formatarTelefonePT(valor: string): string {
  return mascararTelefonePT(valor);
}

export function formatarData(data: string | Date | null | undefined): string {
  if (!data) return '—';
  return new Date(data).toLocaleDateString('pt-PT');
}

export function formatarMes(ano: number, mes: number): string {
  return new Date(ano, mes - 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}
