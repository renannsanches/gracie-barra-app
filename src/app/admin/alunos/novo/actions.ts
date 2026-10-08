"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-guard";
import { senhaValida, REGRA_SENHA_TEXTO } from "@/lib/senha";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

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
  const valorMensalidade    = isResponsavel ? null : ((formData.get("valor_mensalidade") as string | null)?.trim() || null);
  const primeiroVencimento  = isResponsavel ? null : ((formData.get("primeiro_vencimento") as string | null)?.trim() || null);

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

      if (responsavelId) {
        await admin.from("dependentes").insert({
          dependente_id:  uuid,
          responsavel_id: responsavelId,
        });
      }

      if (valorMensalidade && primeiroVencimento && Number(valorMensalidade) > 0) {
        const [ano, mes] = primeiroVencimento.split("-");
        const mesRef = `${ano}-${mes}-01`;
        await admin.from("mensalidades").insert({
          aluno_id:        uuid,
          mes_referencia:  mesRef,
          data_vencimento: primeiroVencimento,
          valor:           Number(valorMensalidade),
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

    if (valorMensalidade && primeiroVencimento && Number(valorMensalidade) > 0) {
      const [ano, mes] = primeiroVencimento.split("-");
      const mesRef = `${ano}-${mes}-01`;
      await admin.from("mensalidades").insert({
        aluno_id:        userId,
        mes_referencia:  mesRef,
        data_vencimento: primeiroVencimento,
        valor:           Number(valorMensalidade),
        status:          "pendente",
      });
    }

    revalidatePath("/admin/alunos");
    return { ok: true, userId };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro inesperado." };
  }
}
