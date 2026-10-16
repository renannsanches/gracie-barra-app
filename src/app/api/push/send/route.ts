import {
  sendPushMensalidade,
  sendPushAviso,
  sendPushResponsavelAula,
  sendPushGraduacao,
  sendPushConquistas,
} from "@/lib/push-sender";
import { sincronizarConquistas } from "@/lib/conquistas-sync";
import { createAdminClient } from "@/lib/supabase/admin";

// A sincronização de conquistas percorre todos os alunos
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  try {
    if (type === "mensalidade") {
      await sendPushMensalidade();
    } else if (type === "aviso") {
      await sendPushAviso();
    } else if (type === "responsavel_aula") {
      await sendPushResponsavelAula();
    } else if (type === "graduacao") {
      await sendPushGraduacao();
    } else if (type === "conquistas") {
      // ?dry=1 só conta o que seria gravado (a BD de dev e produção é a mesma)
      const dry = searchParams.get("dry") === "1";
      const r = await sincronizarConquistas(createAdminClient(), { dry });
      if (!dry) await sendPushConquistas();
      return Response.json({ dry, alunos: r.alunos, novas: r.novas.length, porCodigo: r.porCodigo });
    } else {
      return new Response(`Tipo desconhecido: ${type}`, { status: 400 });
    }
    return new Response("ok");
  } catch (err) {
    console.error(`[push/send] type=${type}`, err);
    return new Response("Erro interno", { status: 500 });
  }
}
