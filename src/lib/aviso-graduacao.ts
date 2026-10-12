// Aviso "alunos aptos a graduar" (admin/professor): aparece 2x por semana, no 1º acesso
// a partir de segunda e no 1º acesso a partir de quinta (hora de Lisboa). A janela vista
// fica em user_metadata, por conta — não depende do browser/dispositivo.
export const CHAVE_AVISO_GRADUACAO = "aviso_graduacao_janela";

// Início da janela actual (YYYY-MM-DD): seg–qua → segunda; qui–dom → quinta
export function janelaAvisoGraduacao(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const d = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00Z`);

  const diasDesdeSegunda = (d.getUTCDay() + 6) % 7;
  const recuo = diasDesdeSegunda >= 3 ? diasDesdeSegunda - 3 : diasDesdeSegunda;
  d.setUTCDate(d.getUTCDate() - recuo);
  return d.toISOString().slice(0, 10);
}
