import { createAdminClient } from "@/lib/supabase/admin";
import { listarModalidades } from "@/lib/modalidades";
import { ModalidadesView, type ContagemModalidade } from "./ModalidadesView";

export const dynamic = "force-dynamic";

export default async function ModalidadesPage() {
  const admin = createAdminClient();
  const [modalidades, { data: inscricoes }, { data: turmas }] = await Promise.all([
    listarModalidades(admin),
    admin.from("aluno_modalidades").select("modalidade_id, aluno:profiles(status)"),
    admin.from("turmas").select("modalidade_id"),
  ]);

  const contagens: Record<string, ContagemModalidade> = {};
  const conta = (id: string) => (contagens[id] ??= { alunos: 0, ativos: 0, turmas: 0 });

  type Inscricao = { modalidade_id: string; aluno: { status: string } | null };
  for (const i of (inscricoes ?? []) as unknown as Inscricao[]) {
    const c = conta(i.modalidade_id);
    c.alunos += 1;
    if (i.aluno?.status === "ativo") c.ativos += 1;
  }
  for (const t of turmas ?? []) conta(t.modalidade_id as string).turmas += 1;

  return <ModalidadesView modalidades={modalidades} contagens={contagens} />;
}
