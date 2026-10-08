"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { grupoPadraoId } from "@/lib/grupos";
import { modalidadePadrao, valorSugerido } from "@/lib/modalidades";
import { createClient } from "@/lib/supabase/server";
import type { CorFaixa, CategoriaFaixa, ItemMensalidade, Modalidade } from "@/lib/types";
import { sendContractEmail } from "@/lib/send-contract-email";

export async function verificarEmailExistente(email: string): Promise<boolean> {
  const supabase = createAdminClient();
  const emailNorm = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data) return false;
  return data.users.some((u) => u.email?.toLowerCase() === emailNorm);
}

function calcularIdade(dataNasc: string | null): number {
  if (!dataNasc) return 99;
  const hoje = new Date();
  const nasc = new Date(dataNasc);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

function proximoDia5DoMes(offsetMeses: number): Date {
  const hoje = new Date();
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + offsetMeses, 5);
  const dow = d.getDay(); // 0=Dom, 6=Sab
  if (dow === 6) d.setDate(7); // Sáb → seg
  if (dow === 0) d.setDate(6); // Dom → seg
  return d;
}

function gerarDatas6Meses(): Date[] {
  // Dias 1-10: começa no mês atual. Dias 11+: começa no mês seguinte (admin regista o atual manualmente).
  const offsetBase = new Date().getDate() <= 10 ? 0 : 1;
  return Array.from({ length: 6 }, (_, i) => proximoDia5DoMes(offsetBase + i));
}

async function gerarMensalidades(alunoId: string, valor: number, itens: ItemMensalidade[] | null) {
  const admin = createAdminClient();
  const datas = gerarDatas6Meses();
  for (const data of datas) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const mesRef = `${ano}-${mes}-01`;
    const dataVenc = data.toISOString().split("T")[0];
    const { error } = await admin.from("mensalidades").upsert(
      {
        aluno_id: alunoId,
        mes_referencia: mesRef,
        data_vencimento: dataVenc,
        valor,
        itens,
        status: "pendente",
      },
      { onConflict: "aluno_id,mes_referencia", ignoreDuplicates: true }
    );
    if (error) throw new Error(`Erro ao gerar mensalidade ${mesRef}: ${error.message}`);
  }
}

/**
 * Inscreve na modalidade padrão (ex.: Jiu-Jitsu) com o valor sugerido para a idade
 * e gera as mensalidades. Sem modalidade padrão, usa 62/55 € como antes.
 */
async function inscreverEGerarMensalidades(
  alunoId: string,
  dataNasc: string | null,
  padrao: Modalidade | null,
) {
  if (!padrao) {
    await gerarMensalidades(alunoId, calcularIdade(dataNasc) < 16 ? 55 : 62, null);
    return;
  }
  const valor = valorSugerido(padrao, dataNasc);
  const admin = createAdminClient();
  const { error } = await admin.from("aluno_modalidades").upsert(
    { aluno_id: alunoId, modalidade_id: padrao.id, valor },
    { onConflict: "aluno_id,modalidade_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Erro ao inscrever na modalidade: ${error.message}`);
  await gerarMensalidades(alunoId, valor, [{ modalidade_id: padrao.id, nome: padrao.nome, valor }]);
}

export async function concluirCadastro(params: {
  email: string;
  tipo: "aluno" | "responsavel" | "aluno_responsavel";
  nomeResponsavel: string;
  telefone: string | null;
  contactoEmergencia: string | null;
  nif: string | null;
  dataNascimento: string | null;
  faixaAdulto: CorFaixa | null;
  grausAdulto: number;
  categoriaAdulto: CategoriaFaixa;
  dependentes: Array<{
    nome: string;
    dataNasc: string | null;
    nif: string | null;
    faixa: CorFaixa | null;
    graus: number;
    categoria: CategoriaFaixa;
  }>;
}): Promise<{ ok: boolean; erro?: string }> {
  try {
    const supabase = await createClient();
    const { data, error: authErr } = await supabase.auth.getUser();
    if (authErr || !data?.user) return { ok: false, erro: "Sessão expirada. Começa o registo novamente." };
    const user = data.user;

    const admin = createAdminClient();
    // Registos feitos pela app entram no grupo padrão (ex.: Academia)
    const grupoId = await grupoPadraoId(admin);
    const modalidade = await modalidadePadrao(admin);

    // 1. Update responsável/adulto profile
    const profileUpdate: Record<string, unknown> = {
      nome_completo: params.nomeResponsavel,
      telefone: params.telefone,
      contacto_emergencia: params.contactoEmergencia,
      data_nascimento: params.dataNascimento,
      nif: params.nif,
    };

    if (params.tipo === "responsavel") {
      profileUpdate.perfil = "responsavel";
    } else {
      profileUpdate.faixa = params.faixaAdulto;
      profileUpdate.graus = params.grausAdulto;
      profileUpdate.categoria = params.categoriaAdulto;
      profileUpdate.grupo_id = grupoId;
    }

    const { error: respErr } = await admin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);

    if (respErr) return { ok: false, erro: `Erro ao guardar dados: ${respErr.message}` };

    // 2. Generate mensalidades for adult (if not pure responsavel)
    if (params.tipo !== "responsavel") {
      await inscreverEGerarMensalidades(user.id, params.dataNascimento, modalidade);
    }

    // 3. Create dependentes (if not pure aluno)
    if (params.tipo !== "aluno") {
      for (const dep of params.dependentes) {
        const depId = crypto.randomUUID();

        const { error: depProfileErr } = await admin.from("profiles").insert({
          id: depId,
          nome_completo: dep.nome,
          data_nascimento: dep.dataNasc,
          nif: dep.nif,
          faixa: dep.faixa,
          graus: dep.graus,
          categoria: dep.categoria,
          telefone: params.telefone,
          perfil: "aluno",
          status: "ativo",
          sem_login: true,
          grupo_id: grupoId,
        });

        if (depProfileErr) return { ok: false, erro: `Erro ao criar perfil do dependente: ${depProfileErr.message}` };

        const { error: linkErr } = await admin.from("dependentes").insert({
          responsavel_id: user.id,
          dependente_id: depId,
        });

        if (linkErr) return { ok: false, erro: `Erro ao vincular dependente: ${linkErr.message}` };

        await inscreverEGerarMensalidades(depId, dep.dataNasc, modalidade);
      }
    }

    await sendContractEmail(params.email, params.nomeResponsavel);

    return { ok: true };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro inesperado no servidor." };
  }
}
