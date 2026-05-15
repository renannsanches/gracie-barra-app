"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CorFaixa, CategoriaFaixa } from "@/lib/types";

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
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1 + offsetMeses, 5);
  const dow = d.getDay(); // 0=Dom, 6=Sab
  if (dow === 6) d.setDate(7); // Sáb → seg
  if (dow === 0) d.setDate(6); // Dom → seg
  return d;
}

function gerarDatas6Meses(): Date[] {
  return Array.from({ length: 6 }, (_, i) => proximoDia5DoMes(i));
}

async function gerarMensalidades(alunoId: string, valor: number) {
  const admin = createAdminClient();
  const datas = gerarDatas6Meses();
  for (const data of datas) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const mesRef = `${ano}-${mes}-01`;
    const dataVenc = data.toISOString().split("T")[0];
    await admin.from("mensalidades").upsert(
      {
        aluno_id: alunoId,
        mes_referencia: mesRef,
        data_vencimento: dataVenc,
        valor,
        status: "pendente",
      },
      { onConflict: "aluno_id,mes_referencia", ignoreDuplicates: true }
    );
  }
}

export async function concluirCadastro(params: {
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
    }

    const { error: respErr } = await admin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);

    if (respErr) return { ok: false, erro: `Erro ao guardar dados: ${respErr.message}` };

    // 2. Generate mensalidades for adult (if not pure responsavel)
    if (params.tipo !== "responsavel") {
      const idadeAdulto = calcularIdade(params.dataNascimento);
      const valorAdulto = idadeAdulto < 16 ? 55 : 62;
      await gerarMensalidades(user.id, valorAdulto);
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
        });

        if (depProfileErr) return { ok: false, erro: `Erro ao criar perfil do dependente: ${depProfileErr.message}` };

        const { error: linkErr } = await admin.from("dependentes").insert({
          responsavel_id: user.id,
          dependente_id: depId,
        });

        if (linkErr) return { ok: false, erro: `Erro ao vincular dependente: ${linkErr.message}` };

        const idadeDep = calcularIdade(dep.dataNasc);
        const valorDep = idadeDep < 16 ? 55 : 62;
        await gerarMensalidades(depId, valorDep);
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro inesperado no servidor." };
  }
}
