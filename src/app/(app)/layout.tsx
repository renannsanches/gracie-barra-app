import { createClient } from "@/lib/supabase/server";
import { MensalidadeVencidaBanner } from "@/components/MensalidadeVencidaBanner";
import { getDiasAtraso, getMaiorAtraso } from "@/lib/mensalidade-status";
import type { Mensalidade } from "@/lib/types";

const THRESHOLD_DIAS = 5;

type MensalidadeRow = Pick<Mensalidade, "status" | "data_vencimento">;

type DependenteRow = {
  dependente: { id: string; nome_completo: string } | null;
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <>{children}</>;

  const [{ data: selfMensalidades }, { data: dependentesData }] =
    await Promise.all([
      supabase
        .from("mensalidades")
        .select("status, data_vencimento")
        .eq("aluno_id", user.id),
      supabase
        .from("dependentes")
        .select(
          "dependente:profiles!dependentes_dependente_id_fkey(id, nome_completo)",
        )
        .eq("responsavel_id", user.id),
    ]);

  const today = new Date();
  const selfMaior = getMaiorAtraso(
    (selfMensalidades ?? []) as MensalidadeRow[],
    today,
  );

  const depList = ((dependentesData ?? []) as unknown as DependenteRow[])
    .map((d) => d.dependente)
    .filter((d): d is { id: string; nome_completo: string } => d !== null);

  let depMaior = { dias: 0, nome: "" };
  if (depList.length > 0) {
    const depIds = depList.map((d) => d.id);
    const { data: depMensalidades } = await supabase
      .from("mensalidades")
      .select("aluno_id, status, data_vencimento")
      .in("aluno_id", depIds);

    const byAluno = new Map<string, MensalidadeRow[]>();
    for (const m of (depMensalidades ?? []) as (MensalidadeRow & {
      aluno_id: string;
    })[]) {
      const list = byAluno.get(m.aluno_id) ?? [];
      list.push({ status: m.status, data_vencimento: m.data_vencimento });
      byAluno.set(m.aluno_id, list);
    }
    for (const dep of depList) {
      const ms = byAluno.get(dep.id) ?? [];
      const maior = Math.max(0, ...ms.map((m) => getDiasAtraso(m, today)));
      if (maior > depMaior.dias) {
        depMaior = { dias: maior, nome: dep.nome_completo };
      }
    }
  }

  const usarSelf = selfMaior >= depMaior.dias;
  const dias = usarSelf ? selfMaior : depMaior.dias;

  let banner: React.ReactNode = null;
  if (dias >= THRESHOLD_DIAS) {
    const texto = usarSelf
      ? `Olá. Sua mensalidade está vencida há ${dias} dias. Entre em contato com a Simone.`
      : `Olá. A mensalidade de ${depMaior.nome} está vencida há ${dias} dias. Entre em contato com a Simone.`;
    banner = <MensalidadeVencidaBanner texto={texto} />;
  }

  return (
    <>
      {banner}
      {children}
    </>
  );
}
