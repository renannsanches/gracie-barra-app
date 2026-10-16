import type { CorFaixa, CategoriaFaixa } from "@/lib/types";

export interface AptoGraduar {
  id: string;
  nome_completo: string;
  faixa: CorFaixa;
  graus: number;
  categoria: CategoriaFaixa;
  proximaPromocao: { faixa: CorFaixa; graus: number };
  semanasQualificadas: number;
  semanasNecessarias: number;
}

export interface ResumoGamificacao {
  id: string;
  nome: string;
  sequencia: number;
  semanaAulas: number;
  medalhas: number;
}

/** Próxima aula reservada já formatada no servidor (evita diferenças de fuso na hidratação). */
export type ProximaAulaHome =
  | {
      estado: "ok";
      modalidade: string | null;
      turma: string;
      /** "Hoje · 19:00", "Amanhã · 19:00", "Qui, 17 out · 19:00" */
      quando: string;
      /** Primeiros nomes de quem tem reserva, quando não é só o próprio */
      para: string[];
      outras: number;
    }
  | { estado: "vazio" }
  | { estado: "erro" };

/** Os mesmos indicadores do /admin. `emAtraso` = null para professor (sem acesso ao financeiro). */
export interface KpisAdmin {
  ativos: number;
  presencasMes: number;
  mes: string;
  emAtraso: number | null;
}
