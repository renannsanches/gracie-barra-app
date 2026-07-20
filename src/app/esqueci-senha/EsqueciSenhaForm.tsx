"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-error-messages";

export function EsqueciSenhaForm() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/nova-senha`;
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo },
      );
      if (!error) {
        setEnviado(true);
      } else {
        setErro(getAuthErrorMessage(error, "reset-password-request"));
      }
    } finally {
      setCarregando(false);
    }
  }

  if (enviado) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle className="text-green-500" size={48} />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Email enviado!</h2>
        <p className="text-gray-500 text-sm">
          Se o endereço <span className="font-semibold text-gray-700">{email}</span> estiver registado,
          receberás um link para redefinir a tua senha.
        </p>
        <p className="text-gray-400 text-xs">Verifica também a pasta de spam.</p>
        <Link
          href="/login"
          className="inline-block mt-4 text-sm text-gb-blue font-semibold hover:underline"
        >
          Voltar ao login
        </Link>
      </div>
    );
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

      {erro && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={carregando || !email}>
        {carregando ? (
          <>
            <Loader2 size={16} className="animate-spin mr-2" />
            A enviar...
          </>
        ) : (
          "Enviar link de recuperação"
        )}
      </Button>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        Voltar ao login
      </Link>
    </form>
  );
}
