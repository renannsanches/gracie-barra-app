import type { createAdminClient } from "@/lib/supabase/admin";
import type { ItemMensalidade, Modalidade } from "@/lib/types";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Idade em anos; null se a data não for conhecida. */
export function idadeEmAnos(dataNascimento: string | null | undefined): number | null {
  if (!dataNascimento) return null;
  const nasc = new Date(`${dataNascimento}T00:00:00`);
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

/** Valor sugerido da modalidade para esta pessoa (menores de 16 usam o valor infantil, se existir). */
export function valorSugerido(
  modalidade: Pick<Modalidade, "valor" | "valor_infantil">,
  dataNascimento: string | null | undefined,
): number {
  const idade = idadeEmAnos(dataNascimento);
  if (idade !== null && idade < 16 && modalidade.valor_infantil !== null) {
    return Number(modalidade.valor_infantil);
  }
  return Number(modalidade.valor);
}

/** "62 €" para valores inteiros, "49,60 €" para os restantes. */
export function formatarEuro(valor: number): string {
  const v = Number(valor);
  return Number.isInteger(v) ? `${v} €` : `${v.toFixed(2).replace(".", ",")} €`;
}

/** Lê "49,60", "49.60" ou "49" → 49.6. Vazio ou inválido → null. */
export function lerValorEuro(texto: string): number | null {
  const t = texto.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
}

/** Valor como texto editável ("49,6" → "49,60"; inteiros sem casas). */
export function valorParaInput(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  const v = Number(valor);
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10-01" → "out/26" */
export function mesCurto(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  return `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`;
}

export function somaItens(itens: Pick<ItemMensalidade, "valor">[]): number {
  return Math.round(itens.reduce((s, i) => s + Number(i.valor), 0) * 100) / 100;
}

/**
 * Linhas a mostrar por baixo do valor de uma mensalidade.
 * `ajuste` ≠ 0 quando o admin editou o valor à mão (valor ≠ soma dos itens).
 */
export function descreverItens(valor: number, itens: ItemMensalidade[] | null | undefined) {
  const linhas = (itens ?? []).map((i) => ({ nome: i.nome, valor: Number(i.valor) }));
  const ajuste = linhas.length > 0 ? Math.round((Number(valor) - somaItens(linhas)) * 100) / 100 : 0;
  return { linhas, ajuste, temDetalhe: linhas.length > 1 || ajuste !== 0 };
}

// ─── Servidor ────────────────────────────────────────────────────────────────

/** Todas as modalidades: padrão primeiro, depois activas, depois por nome. */
export async function listarModalidades(admin: AdminClient): Promise<Modalidade[]> {
  const { data } = await admin
    .from("modalidades")
    .select("*")
    .order("padrao", { ascending: false })
    .order("ativo", { ascending: false })
    .order("nome", { ascending: true });
  return ((data ?? []) as Modalidade[]).map((m) => ({
    ...m,
    valor: Number(m.valor),
    valor_infantil: m.valor_infantil === null ? null : Number(m.valor_infantil),
  }));
}

export async function modalidadePadrao(admin: AdminClient): Promise<Modalidade | null> {
  const { data } = await admin
    .from("modalidades")
    .select("*")
    .eq("padrao", true)
    .eq("ativo", true)
    .maybeSingle();
  return (data as Modalidade | null) ?? null;
}

/** Plano actual do aluno (modalidades + valor de cada) e o total mensal. */
export async function planoDoAluno(
  admin: AdminClient,
  alunoId: string,
): Promise<{ itens: ItemMensalidade[]; total: number }> {
  const { data } = await admin
    .from("aluno_modalidades")
    .select("modalidade_id, valor, modalidade:modalidades(nome, padrao)")
    .eq("aluno_id", alunoId);

  type Row = { modalidade_id: string; valor: number; modalidade: { nome: string; padrao: boolean } | null };
  const rows = ((data ?? []) as unknown as Row[])
    // modalidade padrão primeiro, depois por nome — ordem estável na composição
    .sort((a, b) =>
      Number(b.modalidade?.padrao ?? false) - Number(a.modalidade?.padrao ?? false) ||
      (a.modalidade?.nome ?? "").localeCompare(b.modalidade?.nome ?? ""),
    );

  const itens = rows.map((r) => ({
    modalidade_id: r.modalidade_id,
    nome: r.modalidade?.nome ?? "Modalidade",
    valor: Number(r.valor),
  }));
  return { itens, total: somaItens(itens) };
}

/** Primeiro dia do mês actual (YYYY-MM-01) — a partir daqui uma mensalidade conta como "pendente futura". */
export function inicioMesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
