import { LoginForm } from "./LoginForm";

/**
 * O erro vem do servidor por prop (e não de `useSearchParams()` no cliente)
 * para que o formulário faça parte do HTML renderizado no servidor. Antes ficava
 * dentro de um <Suspense> e só existia depois do JavaScript correr — num browser
 * onde o bundle rebenta, a página mostrava o cabeçalho e uma área em branco.
 */
const MENSAGENS: Record<string, string> = {
  confirmacao: "Link inválido ou expirado. Tenta iniciar sessão ou solicita um novo link.",
  credenciais: "Email ou senha incorretos.",
  nao_confirmado:
    "Email ainda não confirmado. Verifica a tua caixa de entrada e confirma o registo.",
  generico: "Não foi possível entrar. Tenta novamente.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const erroInicial = erro ? MENSAGENS[erro] ?? MENSAGENS.generico : "";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gb-black py-10 px-6 flex flex-col items-center">
        <img src="/logo.webp" alt="Gracie Barra" className="h-20 w-auto mb-4 object-contain" />
        <h1 className="text-white font-black text-2xl tracking-wide flex flex-col items-center text-center">
          <span>GRACIE BARRA</span>
          <span>VILA NOVA DE FAMALICÃO</span>
        </h1>
        <p className="text-white/60 text-sm tracking-[0.25em] uppercase mt-1">Jiu-Jitsu</p>
      </div>

      {/* Form */}
      <div className="flex-1 bg-gb-gray flex items-start justify-center p-6 pt-8">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Entrar</h2>
          <p className="text-gray-500 text-sm mb-8">Aceda à sua conta na Gracie Barra Vila Nova de Famalicão</p>
          <LoginForm erroInicial={erroInicial} />
        </div>
      </div>
    </div>
  );
}
