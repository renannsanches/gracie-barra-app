import {
  sendPushMensalidade,
  sendPushAviso,
  sendPushResponsavelAula,
  sendPushGraduacao,
  sendPushConquistas,
  sendPushPodio,
} from "@/lib/push-sender";
import { pushAtivo } from "@/lib/push-ativo";
import { gerarPostPodio } from "@/lib/feed-servidor";
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
    } else if (type === "feed_podio") {
      // ?dry=1 só calcula (a BD de dev e produção é a mesma); fora de produção é sempre dry (senão
      // inseria o post real sem push e o cron de produção via "já existia"). Só com ?dry=1
      // explícito se aceita ?hoje=YYYY-MM-DD
      const dryPedido = searchParams.get("dry") === "1";
      const dry = dryPedido || !pushAtivo(process.env.VERCEL_ENV);
      let hoje: string | undefined;
      if (dryPedido && searchParams.has("hoje")) {
        hoje = searchParams.get("hoje") ?? "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(hoje)) return new Response("Parâmetro hoje inválido", { status: 400 });
      }
      const r = await gerarPostPodio(createAdminClient(), { dry, hoje });
      // só quem inseriu o post manda push
      if (r.publicado) await sendPushPodio(r.mes!);
      return Response.json({
        dry,
        mes: r.mes,
        publicado: r.publicado,
        jaExistia: r.jaExistia,
        adultos: r.podio?.adultos.length ?? 0,
        kids: r.podio?.kids.length ?? 0,
      });
    } else {
      return new Response(`Tipo desconhecido: ${type}`, { status: 400 });
    }
    return new Response("ok");
  } catch (err) {
    console.error(`[push/send] type=${type}`, err);
    return new Response("Erro interno", { status: 500 });
  }
}
