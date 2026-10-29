import Image from "next/image";
import { NovaSenhaForm } from "./NovaSenhaForm";

/**
 * O link do email traz `?token_hash=…&type=recovery`. Lê-se aqui, no servidor, e
 * segue por prop para o formulário: o token só é gasto quando o aluno carrega em
 * "Continuar" (ver `validarLinkRecuperacao`), nunca ao abrir a página.
 */
export default async function NovaSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;
  const tokenHash = type === "recovery" && token_hash ? token_hash : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-gb-black py-10 px-6 flex flex-col items-center">
        <Image src="/logo.webp" alt="Gracie Barra" width={93} height={80} priority className="h-20 w-auto mb-4 object-contain" />
        <h1 className="text-white font-black text-2xl tracking-wide flex flex-col items-center text-center">
          <span>GRACIE BARRA</span>
          <span>VILA NOVA DE FAMALICÃO</span>
        </h1>
        <p className="text-white/60 text-sm tracking-[0.25em] uppercase mt-1">Jiu-Jitsu</p>
      </div>

      <div className="flex-1 bg-gb-gray flex items-start justify-center p-6 pt-8">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Nova senha</h2>
          <p className="text-gray-500 text-sm mb-8">Define uma nova senha para a tua conta.</p>
          <NovaSenhaForm tokenHash={tokenHash} />
        </div>
      </div>
    </div>
  );
}
