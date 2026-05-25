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
  const nums = valor.replace(/\D/g, '').slice(0, 9)
  if (nums.length <= 4) return nums
  if (nums.length <= 7) return `${nums.slice(0, 4)} ${nums.slice(4)}`
  return `${nums.slice(0, 4)} ${nums.slice(4, 7)} ${nums.slice(7)}`
}

export function formatarTelefonePT(valor: string): string {
  return mascararTelefonePT(valor)
}

const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

export function formatarData(data: string | Date | null | undefined): string {
  if (!data) return '—'
  const d = new Date(data)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `${day}/${month}/${year}`
}

export function formatarMes(ano: number, mes: number): string {
  return `${MESES_PT[mes - 1]} de ${ano}`
}

export function formatarMoeda(valor: number): string {
  return `${valor.toFixed(2).replace('.', ',')} €`
}
