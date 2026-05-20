import {
  sendPushMensalidade,
  sendPushAviso,
  sendPushResponsavelAula,
  sendPushGraduacao,
} from "@/lib/push-sender";

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
    } else {
      return new Response(`Tipo desconhecido: ${type}`, { status: 400 });
    }
    return new Response("ok");
  } catch (err) {
    console.error(`[push/send] type=${type}`, err);
    return new Response("Erro interno", { status: 500 });
  }
}
