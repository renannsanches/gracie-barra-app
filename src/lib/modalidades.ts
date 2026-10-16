import type { createAdminClient } from "@/lib/supabase/admin";
import type { AlunoDesconto, ItemMensalidade, Modalidade } from "@/lib/types";

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

/** "62 €" para valores inteiros, "49,60 €" para os restantes, "−13 €" para negativos. */
export function formatarEuro(valor: number): string {
  const v = Number(valor);
  const abs = Math.abs(v);
  const txt = Number.isInteger(abs) ? `${abs} €` : `${abs.toFixed(2).replace(".", ",")} €`;
  return v < 0 ? `−${txt}` : txt;
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
  const linhas = (itens ?? []).map((i) => ({ nome: i.nome, valor: Number(i.valor), tipo: i.tipo ?? "modalidade" }));
  const ajuste = linhas.length > 0 ? Math.round((Number(valor) - somaItens(linhas)) * 100) / 100 : 0;
  return { linhas, ajuste, temDetalhe: linhas.length > 1 || ajuste !== 0 };
}

// ─── Locais, plano e descontos (puro — usado no cliente e no servidor) ──────

export interface GrupoRef {
  id: string;
  nome: string;
  padrao: boolean;
}

/** "Jiu-Jitsu · Colégio" quando a modalidade não é do local padrão; senão só "Jiu-Jitsu". */
export function rotuloModalidade(m: Pick<Modalidade, "nome" | "grupo_id">, grupos: GrupoRef[]): string {
  const g = grupos.find((x) => x.id === m.grupo_id);
  return g && !g.padrao ? `${m.nome} · ${g.nome}` : m.nome;
}

export interface LinhaPlano {
  modalidade_id: string;
  valor: number;
  /** false = pago fora da app (no próprio local) */
  cobrar: boolean;
}

export interface DescontoPlano {
  descricao: string;
  /** Positivo; é subtraído */
  valor: number;
  origem_modalidade_id: string | null;
}

/**
 * Composição e total da mensalidade a partir do plano.
 * Total = linhas cobradas − descontos (nunca abaixo de 0).
 */
export function calcularPlano(
  linhas: LinhaPlano[],
  descontos: DescontoPlano[],
  rotulos: Map<string, string>,
): { itens: ItemMensalidade[]; total: number; foraDaApp: number } {
  const itens: ItemMensalidade[] = [
    ...linhas
      .filter((l) => l.cobrar)
      .map((l) => ({
        modalidade_id: l.modalidade_id,
        nome: rotulos.get(l.modalidade_id) ?? "Modalidade",
        valor: Number(l.valor),
        tipo: "modalidade" as const,
      })),
    ...descontos.map((d) => ({
      modalidade_id: d.origem_modalidade_id,
      nome: d.descricao,
      valor: -Number(d.valor),
      tipo: "desconto" as const,
    })),
  ];
  const total = Math.max(0, somaItens(itens));
  const foraDaApp = somaItens(linhas.filter((l) => !l.cobrar));
  return { itens, total, foraDaApp };
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

export async function listarGruposRef(admin: AdminClient): Promise<GrupoRef[]> {
  const { data } = await admin.from("grupos_alunos").select("id, nome, padrao");
  return (data ?? []) as GrupoRef[];
}

/** Modalidades com o nome já rotulado pelo local ("Jiu-Jitsu · Colégio") — para listas e pickers. */
export async function listarModalidadesRotuladas(admin: AdminClient): Promise<Modalidade[]> {
  const [modalidades, grupos] = await Promise.all([listarModalidades(admin), listarGruposRef(admin)]);
  return modalidades.map((m) => ({ ...m, nome: rotuloModalidade(m, grupos) }));
}

/** Rótulo de cada modalidade ("Jiu-Jitsu · Colégio"), por id. */
export async function rotulosModalidades(admin: AdminClient): Promise<Map<string, string>> {
  const [modalidades, grupos] = await Promise.all([listarModalidades(admin), listarGruposRef(admin)]);
  return new Map(modalidades.map((m) => [m.id, rotuloModalidade(m, grupos)]));
}

/** Plano actual do aluno: linhas, descontos, composição e total da mensalidade. */
export async function planoDoAluno(admin: AdminClient, alunoId: string) {
  const [{ data: linhasRows }, { data: descontosRows }, modalidades, grupos] = await Promise.all([
    admin.from("aluno_modalidades").select("modalidade_id, valor, cobrar").eq("aluno_id", alunoId),
    admin.from("aluno_descontos").select("*").eq("aluno_id", alunoId).order("criado_em"),
    listarModalidades(admin),
    listarGruposRef(admin),
  ]);

  const rotulos = new Map(modalidades.map((m) => [m.id, rotuloModalidade(m, grupos)]));
  const ordem = ordemModalidades(modalidades, grupos);
  const linhas: LinhaPlano[] = ((linhasRows ?? []) as LinhaPlano[])
    .map((l) => ({ modalidade_id: l.modalidade_id, valor: Number(l.valor), cobrar: l.cobrar }))
    .sort((a, b) => (ordem.get(a.modalidade_id) ?? 99) - (ordem.get(b.modalidade_id) ?? 99));
  const descontos: DescontoPlano[] = ((descontosRows ?? []) as AlunoDesconto[]).map((d) => ({
    descricao: d.descricao,
    valor: Number(d.valor),
    origem_modalidade_id: d.origem_modalidade_id,
  }));

  return { linhas, descontos, ...calcularPlano(linhas, descontos, rotulos) };
}

/** Ordem estável: local padrão primeiro, depois outros locais; dentro de cada, modalidade padrão e nome. */
export function ordemModalidades(modalidades: Modalidade[], grupos: GrupoRef[]): Map<string, number> {
  const g = new Map(grupos.map((x) => [x.id, x]));
  const ordenadas = [...modalidades].sort((a, b) =>
    Number(g.get(b.grupo_id)?.padrao ?? false) - Number(g.get(a.grupo_id)?.padrao ?? false) ||
    (g.get(a.grupo_id)?.nome ?? "").localeCompare(g.get(b.grupo_id)?.nome ?? "") ||
    Number(b.padrao) - Number(a.padrao) ||
    a.nome.localeCompare(b.nome),
  );
  return new Map(ordenadas.map((m, i) => [m.id, i]));
}

/** Valida o plano vindo do cliente; devolve mensagem de erro ou null. */
export function validarPlano(linhas: LinhaPlano[], descontos: DescontoPlano[]): string | null {
  if (new Set(linhas.map((l) => l.modalidade_id)).size !== linhas.length) return "Modalidade repetida.";
  if (linhas.some((l) => !Number.isFinite(l.valor) || l.valor < 0)) return "Valor inválido numa das modalidades.";
  for (const d of descontos) {
    if (!d.descricao.trim()) return "Escreve a descrição do desconto.";
    if (d.descricao.trim().length > 60) return "Descrição do desconto demasiado longa (máx. 60).";
    if (!Number.isFinite(d.valor) || d.valor <= 0) return `Valor inválido no desconto "${d.descricao}".`;
  }
  return null;
}

/** Substitui modalidades e descontos do aluno (servidor, com cliente admin). */
export async function gravarPlanoAluno(
  admin: AdminClient,
  alunoId: string,
  linhas: LinhaPlano[],
  descontos: DescontoPlano[],
): Promise<string | null> {
  const ids = linhas.map((l) => l.modalidade_id);
  const del = admin.from("aluno_modalidades").delete().eq("aluno_id", alunoId);
  const { error: delErr } = ids.length > 0 ? await del.not("modalidade_id", "in", `(${ids.join(",")})`) : await del;
  if (delErr) return delErr.message;

  if (linhas.length > 0) {
    const { error } = await admin.from("aluno_modalidades").upsert(
      linhas.map((l) => ({ aluno_id: alunoId, modalidade_id: l.modalidade_id, valor: l.valor, cobrar: l.cobrar })),
      { onConflict: "aluno_id,modalidade_id" },
    );
    if (error) return error.message;
  }

  const { error: delDescErr } = await admin.from("aluno_descontos").delete().eq("aluno_id", alunoId);
  if (delDescErr) return delDescErr.message;
  if (descontos.length > 0) {
    const { error } = await admin.from("aluno_descontos").insert(
      descontos.map((d) => ({
        aluno_id: alunoId,
        descricao: d.descricao.trim(),
        valor: d.valor,
        origem_modalidade_id: d.origem_modalidade_id,
      })),
    );
    if (error) return error.message;
  }
  return null;
}

/** aluno_id → ids dos grupos (locais) onde treina, derivados das modalidades. */
export async function gruposPorAluno(admin: AdminClient): Promise<Record<string, string[]>> {
  const { data } = await admin
    .from("aluno_modalidades")
    .select("aluno_id, modalidade:modalidades(grupo_id)");
  const mapa: Record<string, string[]> = {};
  type Row = { aluno_id: string; modalidade: { grupo_id: string } | null };
  for (const r of (data ?? []) as unknown as Row[]) {
    const g = r.modalidade?.grupo_id;
    if (!g) continue;
    const lista = (mapa[r.aluno_id] ??= []);
    if (!lista.includes(g)) lista.push(g);
  }
  return mapa;
}

/** Primeiro dia do mês actual (YYYY-MM-01) — a partir daqui uma mensalidade conta como "pendente futura". */
export function inicioMesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
