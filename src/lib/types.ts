export type PerfilUsuario = "aluno" | "professor" | "admin" | "tablet" | "responsavel";
export interface ActionResult { ok: boolean; erro?: string; }
export type StatusMensalidade = "pendente" | "pago" | "atrasado";

export interface Mensalidade {
  id: string;
  aluno_id: string;
  mes_referencia: string;
  data_vencimento: string;
  valor: number;
  status: StatusMensalidade;
  data_pagamento: string | null;
  criado_em: string;
  atualizado_em: string;
}
export type CategoriaFaixa = "adulto" | "infantil" | "adulto_infantil";
export type CorFaixa =
  | "branca"
  | "cinza_branca"
  | "cinza"
  | "cinza_preta"
  | "amarela_branca"
  | "amarela"
  | "amarela_preta"
  | "laranja_branca"
  | "laranja"
  | "laranja_preta"
  | "verde_branca"
  | "verde"
  | "verde_preta"
  | "azul"
  | "roxa"
  | "marrom"
  | "preta"
  | "coral"
  | "vermelha";
export type StatusAluno      = "ativo" | "inativo" | "trancado";
export type RecorrenciaTurma = "semanal" | "quinzenal" | "mensal" | "diario" | "personalizado";
export type StatusAula       = "agendada" | "cancelada" | "concluida";
export type StatusReserva    = "confirmada" | "cancelada" | "presente";

export interface Turma {
  id: string;
  nome: string;
  dia_semana: number;
  horario: string;
  recorrencia: RecorrenciaTurma;
  lotacao_maxima: number;
  categoria: CategoriaFaixa;
  professor_id: string | null;
  ativa: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Aula {
  id: string;
  turma_id: string;
  data: string;
  horario: string;
  lotacao_maxima: number;
  status: StatusAula;
  criado_em: string;
}

export interface Reserva {
  id: string;
  aula_id: string;
  aluno_id: string;
  status: StatusReserva;
  criado_em: string;
}

export interface Profile {
  id: string;
  nome_completo: string;
  telefone: string | null;
  data_nascimento: string | null;
  perfil: PerfilUsuario;
  faixa: CorFaixa | null;
  graus: number;
  categoria: CategoriaFaixa;
  status: StatusAluno;
  foto_url: string | null;
  contacto_emergencia: string | null;
  iban: string | null;
  nif: string | null;
  aulas_manual: number;
  sem_login: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface DependentePerfil {
  id: string;
  nome_completo: string;
  foto_url: string | null;
  faixa: CorFaixa | null;
  graus: number;
  categoria: CategoriaFaixa;
  mensalidades: Mensalidade[];
}

export interface Dependente {
  id: string;
  responsavel_id: string;
  dependente_id: string;
  created_at: string;
}

export interface Aviso {
  id: string;
  titulo: string;
  conteudo: string;
  fixado: boolean;
  publicado: boolean;
  created_at: string;
}

export interface Album {
  id: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  autor_id: string;
  created_at: string;
  fotos_count?: number;
}

export interface Foto {
  id: string;
  album_id: string | null;
  url: string;
  legenda: string | null;
  autor_id: string;
  created_at: string;
}

// ─── Financeiro: lançamentos avulsos ─────────────────────────────────
export interface AlunoCombo {
  id: string;
  nome_completo: string;
  foto_url: string | null;
}
export type TipoCategoriaFinanceira = "despesa" | "receita";
export type TipoFornecedor          = "fornecedor" | "cliente" | "funcionario" | "outro";
export type TipoLancamento          = "pagar" | "receber";
export type StatusLancamento        = "pendente" | "pago" | "atrasado" | "cancelado";

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: TipoCategoriaFinanceira;
  parent_id: string | null;
  ativa: boolean;
  criado_em: string;
}

export interface FormaPagamento {
  id: string;
  nome: string;
  ativa: boolean;
  ordem: number;
  criado_em: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  tipo: TipoFornecedor;
  nif: string | null;
  email: string | null;
  telefone: string | null;
  notas: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface LancamentoFinanceiro {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  fornecedor_id: string | null;
  categoria_id: string | null;
  data_vencimento: string;
  valor: number;
  status: StatusLancamento;
  data_pagamento: string | null;
  forma_pagamento_id: string | null;
  comprovativo_url: string | null;
  notas: string | null;
  grupo_id: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  aluno_id: string | null;
  criado_em: string;
  atualizado_em: string;
  criado_por: string | null;
}

export interface HistoricoGraduacao {
  id: string;
  aluno_id: string;
  faixa_anterior: CorFaixa | null;
  graus_anterior: number | null;
  faixa_nova: CorFaixa;
  graus_nova: number;
  graduado_por: string | null;
  professor?: { nome_completo: string } | null;
  observacoes: string | null;
  data_graduacao: string;
  created_at: string;
}
