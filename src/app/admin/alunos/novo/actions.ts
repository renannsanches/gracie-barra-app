"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { senhaValida, REGRA_SENHA_TEXTO } from "@/lib/senha";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { somaItens } from "@/lib/modalidades";
import type { ItemMensalidade } from "@/lib/types";

export interface CriarAlunoResult {
  ok: boolean;
  userId?: string;
  erro?: string;
}

export async function criarAluno(formData: FormData): Promise<CriarAlunoResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const semLogin            = formData.get("sem_login") === "true";
  const email               = (formData.get("email") as string | null)?.trim() ?? "";
  const senha               = (formData.get("senha") as string | null) ?? "";
  const nomeCompleto        = (formData.get("nome_completo") as string).trim();
  const telefone            = (formData.get("telefone") as string | null)?.trim() || null;
  const dataNasc            = (formData.get("data_nascimento") as string | null) || null;
  const perfil              = (formData.get("perfil") as string) || "aluno";
  const isResponsavel       = perfil === "responsavel";
  const faixa               = isResponsavel ? null : ((formData.get("faixa") as string) || "branca");
  const graus               = isResponsavel ? 0 : Number(formData.get("graus") ?? 0);
  const categoria           = (formData.get("categoria") as string) || "adulto";
  const iban                = (formData.get("iban") as string | null)?.trim() || null;
  const nif                 = (formData.get("nif") as string | null)?.trim() || null;
  const primeiroVencimento  = isResponsavel ? null : ((formData.get("primeiro_vencimento") as string | null)?.trim() || null);

  let planoForm: { modalidade_id: string; valor: number }[] = [];
  try {
    planoForm = isResponsavel ? [] : JSON.parse((formData.get("modalidades") as string | null) || "[]");
  } catch {
    return { ok: false, erro: "Modalidades inválidas." };
  }
  const grupoIdForm         = (formData.get("grupo_id") as string | null)?.trim() || null;

  if (!nomeCompleto) return { ok: false, erro: "Nome é obrigatório." };

  const admin = createAdminClient();

  // Grupo aplica-se a quem treina (todos menos responsável); tem de existir e estar activo
  let grupoId: string | null = null;
  if (!isResponsavel && grupoIdForm) {
    const { data: grupo } = await admin
      .from("grupos_alunos").select("id, ativo").eq("id", grupoIdForm).maybeSingle();
    if (!grupo || !grupo.ativo) return { ok: false, erro: "Grupo inválido ou inativo. Escolhe outro grupo." };
    grupoId = grupo.id;
  }

  // Modalidades: confirmar que existem e montar a composição da mensalidade
  let itens: ItemMensalidade[] = [];
  if (planoForm.length > 0) {
    const { data: mods } = await admin
      .from("modalidades").select("id, nome").in("id", planoForm.map((p) => p.modalidade_id));
    const nomes = new Map((mods ?? []).map((m) => [m.id as string, m.nome as string]));
    if (nomes.size !== planoForm.length || planoForm.some((p) => !Number.isFinite(p.valor) || p.valor < 0)) {
      return { ok: false, erro: "Modalidade ou valor inválido." };
    }
    itens = planoForm.map((p) => ({ modalidade_id: p.modalidade_id, nome: nomes.get(p.modalidade_id)!, valor: p.valor }));
  }
  const valorMensalidade = itens.length > 0 ? somaItens(itens) : 0;

  async function gravarPlano(alunoId: string) {
    if (itens.length === 0) return null;
    const { error } = await admin.from("aluno_modalidades").insert(
      itens.map((i) => ({ aluno_id: alunoId, modalidade_id: i.modalidade_id, valor: i.valor })),
    );
    return error;
  }

  try {
    if (semLogin) {
      const uuid = randomUUID();
      const responsavelId = (formData.get("responsavel_id") as string | null)?.trim() || null;

      const { error: insertErr } = await admin.from("profiles").insert({
        id:              uuid,
        nome_completo:   nomeCompleto,
        telefone,
        data_nascimento: dataNasc,
        iban,
        nif,
        faixa,
        graus,
        categoria,
        perfil,
        grupo_id:        grupoId,
        status:          "ativo",
        sem_login:       true,
      });

      if (insertErr) return { ok: false, erro: insertErr.message };

      const planoErr = await gravarPlano(uuid);
      if (planoErr) return { ok: false, erro: `Aluno criado, mas erro nas modalidades: ${planoErr.message}` };

      if (responsavelId) {
        await admin.from("dependentes").insert({
          dependente_id:  uuid,
          responsavel_id: responsavelId,
        });
      }

      if (valorMensalidade > 0 && primeiroVencimento) {
        const [ano, mes] = primeiroVencimento.split("-");
        const mesRef = `${ano}-${mes}-01`;
        await admin.from("mensalidades").insert({
          aluno_id:        uuid,
          mes_referencia:  mesRef,
          data_vencimento: primeiroVencimento,
          valor:           valorMensalidade,
          itens,
          status:          "pendente",
        });
      }

      revalidatePath("/admin/alunos");
      return { ok: true, userId: uuid };
    }

    if (!email || !senha) return { ok: false, erro: "Email e senha são obrigatórios." };
    if (!senhaValida(senha)) return { ok: false, erro: `Senha fraca. ${REGRA_SENHA_TEXTO}` };

    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome_completo: nomeCompleto },
    });

    if (authErr) {
      if (authErr.message.includes("already registered") || authErr.message.includes("already been registered")) {
        return { ok: false, erro: "Este email já está cadastrado." };
      }
      return { ok: false, erro: authErr.message };
    }

    const userId = authData.user.id;

    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        nome_completo:   nomeCompleto,
        telefone,
        data_nascimento: dataNasc,
        iban,
        nif,
        faixa,
        graus,
        categoria,
        perfil,
        grupo_id: grupoId,
        status: "ativo",
      })
      .eq("id", userId);

    if (profileErr) return { ok: false, erro: `Usuário criado, mas erro no perfil: ${profileErr.message}` };

    const planoErr = await gravarPlano(userId);
    if (planoErr) return { ok: false, erro: `Usuário criado, mas erro nas modalidades: ${planoErr.message}` };

    if (valorMensalidade > 0 && primeiroVencimento) {
      const [ano, mes] = primeiroVencimento.split("-");
      const mesRef = `${ano}-${mes}-01`;
      await admin.from("mensalidades").insert({
        aluno_id:        userId,
        mes_referencia:  mesRef,
        data_vencimento: primeiroVencimento,
        valor:           valorMensalidade,
        itens,
        status:          "pendente",
      });
    }

    revalidatePath("/admin/alunos");
    return { ok: true, userId };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro inesperado." };
  }
}
