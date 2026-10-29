"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { atualizarSenha, validarLinkRecuperacao } from "./nova-senha-actions";
import { senhaValida, REGRA_SENHA_TEXTO } from "@/lib/senha";

const MSG_LINK_EXPIRADO = "O link expirou ou já foi usado. Pede um novo em \"Esqueci a senha\".";

/**
 * `tokenHash` vem do link do email. Quando existe, o aluno tem de carregar em
 * "Continuar" para gastar o token — assim um scanner de email que só abre o link
 * não o invalida. Sem `tokenHash` (sessão já criada, ex. por /auth/callback com
 * `?code=`) vai direto para o formulário.
 */
export function NovaSenhaForm({ tokenHash }: { tokenHash?: string }) {
  const router = useRouter();
  const [linkValidado, setLinkValidado] = useState(!tokenHash);
  const [validando, setValidando] = useState(false);
  const [erroLink, setErroLink] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  const senhaOk = senhaValida(senha);
  const confirmacaoOk = senha === confirmar;

  async function continuar() {
    if (!tokenHash) return;
    setErroLink("");
    setValidando(true);
    try {
      const res = await validarLinkRecuperacao(tokenHash);
      if (res.ok) {
        setLinkValidado(true);
      } else if (res.codigo === "otp_expired" || res.codigo === "invalid_token") {
        setErroLink(MSG_LINK_EXPIRADO);
      } else {
        setErroLink(`${MSG_LINK_EXPIRADO} Se o problema continuar, fala com a academia.`);
      }
    } finally {
      setValidando(false);
    }
  }

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
      } else if (res.codigo === "weak_password") {
        setErro(`Senha fraca. Usa ${REGRA_SENHA_TEXTO}`);
      } else if (res.codigo === "same_password") {
        setErro("A nova senha tem de ser diferente da senha atual.");
      } else if (res.codigo === "session_not_found" || res.codigo === "user_not_found") {
        setErro(MSG_LINK_EXPIRADO);
      } else {
        setErro("Não foi possível atualizar a senha agora. Tenta novamente em instantes.");
      }
    } finally {
      setCarregando(false);
    }
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

  if (!linkValidado) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-gray-600">
          Carrega em <span className="font-semibold">Continuar</span> para definires a tua nova senha.
        </p>

        {erroLink && (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 space-y-2">
            <p>{erroLink}</p>
            <Link href="/esqueci-senha" className="inline-block font-semibold underline">
              Pedir novo link
            </Link>
          </div>
        )}

        <Button type="button" className="w-full" onClick={continuar} disabled={validando}>
          {validando ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" />
              A verificar…
            </>
          ) : (
            "Continuar"
          )}
        </Button>
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
            placeholder="Mín. 8 caracteres"
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
        {senha && !senhaOk && (
          <p className="text-xs text-red-600">{REGRA_SENHA_TEXTO}</p>
        )}
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
