// Posts automáticos do feed (graduação e pódio mensal): regras puras, sem Supabase nem React.
// Testado em feed-automatico.test.ts.
import type { CorFaixa } from "./types";
import type { DadosGraduacao, DadosPodio, EntradaPodio } from "./feed";
import { ordemFaixa } from "./graduacao-rules";
import { MIN_AULAS_TOP3, addDias, grupoRanking, nomeRanking, ordenarRanking } from "./gamificacao";
import { labelCorFaixa } from "./utils";

// Primeiro mês cujo pódio gera post (o do mês anterior ao primeiro dia de funcionamento do ranking)
export const PRIMEIRO_MES_PODIO = "2026-10";

// Dias (de calendário) para trás em que uma graduação ainda gera post
const JANELA_GRADUACAO_DIAS = 7;

// Meses escritos à mão: o Intl varia entre motores
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// Só faixa nova que SOBE conta (graus não; o primeiro registo também não; correcções/descidas não),
// nunca para quem está oculto do ranking, e só se a graduação for de hoje ou dos 7 dias anteriores.
// Datas "YYYY-MM-DD" (Lisboa).
export function deveCriarPostGraduacao(e: {
  faixaAnterior: CorFaixa | null;
  faixaNova: CorFaixa;
  dataGraduacao: string;
  ocultarRanking: boolean;
  hoje: string;
}): boolean {
  if (e.ocultarRanking) return false;
  if (e.faixaAnterior === null || e.faixaAnterior === e.faixaNova) return false;
  // ordem da graduação-rules; as faixas de adulto ficam acima de todas as infantis
  if (ordemFaixa(e.faixaNova) <= ordemFaixa(e.faixaAnterior)) return false;
  return e.dataGraduacao >= addDias(e.hoje, -JANELA_GRADUACAO_DIAS) && e.dataGraduacao <= e.hoje;
}

export function textoGraduacao(nome: string, faixa: CorFaixa): string {
  return `${nome} recebeu a faixa ${labelCorFaixa(faixa).toLowerCase()}.`;
}

// "2026-10" → "outubro"
export function nomeMes(mes: string): string {
  return MESES[Number(mes.slice(5, 7)) - 1] ?? "";
}

// Mês do pódio a publicar hoje: o mês anterior, desde que não seja anterior ao primeiro com pódio
export function mesDoPodio(hoje: string): string | null {
  const anterior = addDias(`${hoje.slice(0, 7)}-01`, -1).slice(0, 7);
  return anterior >= PRIMEIRO_MES_PODIO ? anterior : null;
}

// O pódio só é publicado nos dias 1 a 3 do mês (Lisboa): se o post for apagado, o cron dos dias
// seguintes não o ressuscita (nem volta a mandar push). Data "YYYY-MM-DD".
export function dentroJanelaPodio(hoje: string): boolean {
  return Number(hoje.slice(8, 10)) <= 3;
}

type LinhaPodio = Omit<EntradaPodio, "posicao" | "nome"> & { nomeCompleto: string };

// Top 3 de cada grupo (Adultos/Kids) com as regras do /ranking: mínimo de aulas, empates 1, 1, 3.
// null se não houver ninguém em nenhum dos grupos.
export function montarPodio(linhas: LinhaPodio[], mes: string): DadosPodio | null {
  const grupos: Record<"adulto" | "infantil", EntradaPodio[]> = { adulto: [], infantil: [] };

  for (const grupo of ["adulto", "infantil"] as const) {
    const doGrupo = linhas
      .filter((l) => l.aulas >= MIN_AULAS_TOP3 && grupoRanking(l.faixa, l.categoria) === grupo)
      .map(({ nomeCompleto, ...resto }) => ({ ...resto, nome: nomeRanking(nomeCompleto, grupo) }));
    grupos[grupo] = ordenarRanking(doGrupo).filter((l) => l.posicao <= 3);
  }

  if (grupos.adulto.length === 0 && grupos.infantil.length === 0) return null;
  return { kind: "podio", mes, adultos: grupos.adulto, kids: grupos.infantil };
}

export function textoPodio(d: DadosPodio): string {
  const linha = (rotulo: string, entradas: EntradaPodio[]) =>
    `${rotulo}: ${entradas.map((e) => `${e.posicao}.º ${e.nome}`).join(", ")}`;

  const linhas = [`Pódio de ${nomeMes(d.mes)} 🏆`];
  if (d.adultos.length > 0) linhas.push(linha("Adultos", d.adultos));
  if (d.kids.length > 0) linhas.push(linha("Kids", d.kids));
  return linhas.join("\n");
}

// `dados` vem da BD sem validação: só se desenha o bloco especial quando a forma está certa
// (senão o post aparece como um manual, em vez de rebentar o feed).
export function ehDadosGraduacao(d: unknown): d is DadosGraduacao {
  if (typeof d !== "object" || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.kind === "graduacao" && typeof o.faixa === "string";
}

export function ehDadosPodio(d: unknown): d is DadosPodio {
  if (typeof d !== "object" || d === null) return false;
  const o = d as Record<string, unknown>;
  return o.kind === "podio" && typeof o.mes === "string" && Array.isArray(o.adultos) && Array.isArray(o.kids);
}
