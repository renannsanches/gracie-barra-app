"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./auth-actions";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const erroParam = searchParams.get("erro");
    if (erroParam === "confirmacao") {
      setErro("Link inválido ou expirado. Tenta iniciar sessão ou solicita um novo link.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    const res = await login(email, senha);

    if (res.ok) {
      router.push("/perfil");
    } else {
      if (res.tipoErro === "nao_confirmado") {
        setErro("Email ainda não confirmado. Verifica a tua caixa de entrada e confirma o registo.");
      } else if (res.tipoErro === "rate_limit") {
        setErro("Demasiadas tentativas. Aguarda alguns minutos e tenta novamente.");
      } else {
        setErro("Email ou senha incorretos.");
      }
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Input
            id="email"
            type="email"
            placeholder="teu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={carregando}
            className="pl-10"
          />
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="senha">Senha</Label>
          <Link
            href="/esqueci-senha"
            className="text-xs text-gb-blue hover:underline"
          >
            Esqueci a senha
          </Link>
        </div>
        <div className="relative">
          <Input
            id="senha"
            type="password"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            disabled={carregando}
            className="pl-10"
          />
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        </div>
      </div>

      {erro && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={carregando}>
        {carregando ? (
          <>
            <Loader2 size={16} className="animate-spin mr-2" />
            A entrar…
          </>
        ) : (
          "Entrar"
        )}
      </Button>

      <p className="text-center text-sm text-gray-500">
        Não tem conta?{" "}
        <Link href="/cadastro" className="text-gb-blue font-semibold hover:underline">
          Registe-se
        </Link>
      </p>

      <p className="text-center text-sm text-gray-500">
        <Link href="/aula-experimental" className="text-gb-blue font-semibold hover:underline">
          Agende sua aula experimental grátis
        </Link>
      </p>
    </form>
  );
}
