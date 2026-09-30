"use client";

import { useState, useEffect } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import {
  autenticar,
  mensagemErroLogin,
  guardarErroLogin,
  consumirErroLogin,
} from "@/lib/login-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TabletLoginForm({ erroInicial = "" }: { erroInicial?: string }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(erroInicial);

  useEffect(() => {
    if (erroInicial) return;
    const anterior = consumirErroLogin();
    if (anterior) setErro(anterior);
  }, [erroInicial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      const res = await autenticar(email.trim(), senha, "tablet");

      if (!res.ok) {
        setErro(mensagemErroLogin(res.tipoErro));
        return;
      }

      // Navegação dura: garante que o browser reenvia os cookies recém-criados
      // antes do middleware decidir. router.push() não servia em Safari antigo.
      window.location.assign("/tablet");
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro inesperado ao entrar.";
      setErro(mensagem);
      guardarErroLogin(mensagem);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form
      action="/api/auth/login"
      method="post"
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      {/* Fallback sem JavaScript: o Route Handler responde com redirect */}
      <input type="hidden" name="perfilEsperado" value="tablet" />
      <input type="hidden" name="destino" value="/tablet" />

      <div className="space-y-2">
        <Label htmlFor="email" className="text-white/80">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tablet@academia.com"
          autoComplete="email"
          required
          disabled={carregando}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-gb-blue focus-visible:border-gb-blue"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha" className="text-white/80">
          Senha
        </Label>
        <div className="relative">
          <Input
            id="senha"
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            disabled={carregando}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-gb-blue focus-visible:border-gb-blue pr-11"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
            onClick={() => setMostrarSenha((v) => !v)}
            tabIndex={-1}
          >
            {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {erro && (
        <div className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-300">
          {erro}
        </div>
      )}

      <Button
        type="submit"
        disabled={carregando}
        className="w-full bg-gb-blue hover:bg-gb-blue-dark text-white h-12 font-bold"
      >
        {carregando ? (
          <>
            <Loader2 size={16} className="animate-spin mr-2" />
            Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}
