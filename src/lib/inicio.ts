// Separadores do Início (/perfil). O activo vem de ?tab= — o "voltar" do browser funciona.
export const SEPARADORES = ["feed", "ranking", "conquistas", "galeria"] as const;

export type Separador = (typeof SEPARADORES)[number];

export function separadorValido(v: string | undefined): Separador {
  return (SEPARADORES as readonly string[]).includes(v ?? "") ? (v as Separador) : "feed";
}
