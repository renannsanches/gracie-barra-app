"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { atualizarSenha } from "./nova-senha-actions";

export function NovaSenhaForm({ code }: { code?: string }) {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [trocando, setTrocando] = useState(!!code);
  const [linkExpirado, setLinkExpirado] = useState(false);

  useEffect(() => {
    if (!code) return;
    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setLinkExpirado(true);
      setTrocando(false);
    });
  }, [code]);

  const senhaOk = senha.length >= 6;
  const confirmacaoOk = senha === confirmar;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!senhaOk || !confirmacaoOk) return;
    setErro("");
    setCarregando(true);
    try {
      const res = await atualizarSenha(senha);
      if (res.ok) {
        setSucesso(true);
        setTimeout(() => router.push("/perfil"), 2500);
      } else {
        setErro("Erro ao atualizar senha. O link pode ter expirado — solicita um novo.");
      }
    } finally {
      setCarregando(false);
    }
  }

  if (trocando) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  if (linkExpirado) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <AlertCircle className="text-red-500" size={48} />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Link expirado</h2>
        <p className="text-gray-500 text-sm">
          Este link de recuperação já não é válido. Solicita um novo.
        </p>
        <Link
          href="/esqueci-senha"
          className="inline-block mt-2 text-sm text-gb-blue font-semibold hover:underline"
        >
          Pedir novo link
        </Link>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle className="text-green-500" size={48} />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Senha atualizada!</h2>
        <p className="text-gray-500 text-sm">A redirecionar para o teu perfil…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="senha">Nova senha</Label>
        <div className="relative">
          <Input
            id="senha"
            type={showSenha ? "text" : "password"}
            placeholder="Mínimo 6 caracteres"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            disabled={carregando}
            className="pl-10 pr-10"
          />
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <button
            type="button"
            onClick={() => setShowSenha((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            tabIndex={-1}
          >
            {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmar">Confirmar senha</Label>
        <div className="relative">
          <Input
            id="confirmar"
            type={showConfirmar ? "text" : "password"}
            placeholder="Repete a nova senha"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
            disabled={carregando}
            className="pl-10 pr-10"
          />
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <button
            type="button"
            onClick={() => setShowConfirmar((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            tabIndex={-1}
          >
            {showConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {confirmar && !confirmacaoOk && (
          <p className="text-xs text-red-600">As senhas não coincidem.</p>
        )}
      </div>

      {erro && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={carregando || !senhaOk || !confirmacaoOk}
      >
        {carregando ? (
          <>
            <Loader2 size={16} className="animate-spin mr-2" />
            A guardar…
          </>
        ) : (
          "Definir nova senha"
        )}
      </Button>
    </form>
  );
}
