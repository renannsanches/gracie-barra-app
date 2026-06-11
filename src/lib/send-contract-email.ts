import { transporter } from './mailer'

const PDF_URL =
  'https://fjqiyilzxxyoyposqsfz.supabase.co/storage/v1/object/public/Contrato/CONTRATO%20DE%20PRESTACAO%20DE%20SERVICOS%20DESPORTIVOS%20GRACIE%20BARRA%20VILA%20NOVA%20DE%20FAMALICAO.pdf'

function buildEmailHtml(nome: string): string { return `<div style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#111827;padding:30px;text-align:center;">
              <img src="https://fjqiyilzxxyoyposqsfz.supabase.co/storage/v1/object/public/galeria/icon-512x512.png" alt="Gracie Barra Famalicão" width="140" style="display:block;margin:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:40px 35px;color:#111827;">
              <h1 style="margin:0 0 20px;font-size:26px;line-height:1.3;">O teu contrato está pronto ✅</h1>
              <p style="font-size:16px;line-height:1.7;margin:0 0 20px;">Olá, <strong>${nome}</strong>, bem-vindo(a) à <strong>Gracie Barra Famalicão</strong>!</p>
              <p style="font-size:16px;line-height:1.7;margin:0 0 25px;">O teu registo na nossa aplicação foi concluído com sucesso. Para formalizar a tua matrícula, precisamos que entregues o contrato assinado. Encontras o documento em anexo neste e-mail.</p>
              <p style="font-size:15px;font-weight:bold;margin:0 0 8px;color:#111827;">Passo 1 — Descarrega o contrato</p>
              <p style="font-size:15px;line-height:1.7;margin:0 0 25px;color:#374151;">Abre o ficheiro em anexo e guarda-o no teu dispositivo.</p>
              <div style="border-top:1px solid #e5e7eb;margin:0 0 25px;"></div>
              <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:20px;border-radius:8px;margin-bottom:20px;">
                <p style="margin:0 0 8px;font-size:15px;font-weight:bold;color:#15803d;">Opção A — Assinar digitalmente e enviar via WhatsApp</p>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#166534;">Preenche os teus dados e assina o contrato digitalmente (Adobe Acrobat, DocuSign ou qualquer app de assinatura). Depois, envia o ficheiro assinado para o nosso WhatsApp:</p>
                <div style="text-align:center;">
                  <a href="https://wa.me/14076941856?text=Olá,%20sou%20aluno%20da%20Gracie%20Barra%20Famalicão%20e%20quero%20enviar%20o%20meu%20contrato%20assinado." style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:bold;">📲 Enviar pelo WhatsApp</a>
                </div>
              </div>
              <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:20px;border-radius:8px;margin-bottom:30px;">
                <p style="margin:0 0 8px;font-size:15px;font-weight:bold;color:#1d4ed8;">Opção B — Imprimir, assinar e entregar presencialmente</p>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#1e40af;">Imprime o contrato, preenche os teus dados à mão e assina. Traz o documento assinado na tua próxima visita à academia.</p>
              </div>
              <div style="background:#fafafa;border:1px solid #e5e7eb;padding:16px;border-radius:8px;margin-bottom:30px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;"><strong>Já és aluno e já entregaste o teu contrato?</strong><br/>Podes ignorar este e-mail. Nenhuma ação é necessária.</p>
              </div>
              <p style="font-size:15px;line-height:1.7;margin:0;color:#374151;">Qualquer dúvida, estamos aqui para ajudar. Até ao tatami! 🥋</p>
            </td>
          </tr>
          <tr>
            <td style="padding:25px;background:#f9fafb;text-align:center;color:#6b7280;font-size:13px;line-height:1.6;">
              © 2026 Gracie Barra Famalicão<br/>Jiu-Jitsu para Todos.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>`; }

export async function sendContractEmail(email: string, nome: string): Promise<void> {
  try {
    const res = await fetch(PDF_URL)
    if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`)
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await transporter.sendMail({
      from: '"Gracie Barra Famalicão" <graciebarrafamalicao@gmail.com>',
      to: email,
      subject: 'Bem-vindo(a) à Gracie Barra Famalicão — Contrato de Prestação de Serviços',
      html: buildEmailHtml(nome),
      attachments: [
        {
          filename: 'Contrato-GracieBarra-Famalicao.pdf',
          content: buffer,
          contentType: 'application/pdf',
        },
      ],
    })

    console.log(`[mailer] Contract email sent to ${email} (${nome})`)
  } catch (err) {
    console.error('[mailer] Failed to send contract email:', err)
  }
}
