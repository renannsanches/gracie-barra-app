"use client";

import { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { labelCorFaixa } from "@/lib/utils";
import { verificarEmailExistente, concluirCadastroResponsavel } from "./cadastro-actions";
import type { CorFaixa, CategoriaFaixa } from "@/lib/types";

// ─── Palette ────────────────────────────────────────────────
const C = {
  red: "#FF0100",
  redDark: "#cc0100",
  blue: "#030A8C",
  navy: "#253659",
  navyDark: "#1a2740",
  bg: "#F2F2F2",
  ink: "#212121",
  ink2: "#52525a",
  ink3: "#9a9aa3",
  line: "#e4e4e8",
};

// ─── Belt constants ──────────────────────────────────────────
const ADULT_BELTS: CorFaixa[] = ["branca", "azul", "roxa", "marrom", "preta"];
const INFANTIL_BELTS: CorFaixa[] = [
  "branca", "cinza_branca", "cinza", "cinza_preta",
  "amarela_branca", "amarela", "amarela_preta",
  "laranja_branca", "laranja", "laranja_preta",
  "verde_branca", "verde", "verde_preta",
];

const BELT_BG: Partial<Record<CorFaixa, string>> = {
  branca: "#ffffff",
  cinza_branca: "#e5e7eb",
  cinza: "#9ca3af",
  cinza_preta: "#6b7280",
  amarela_branca: "#fef9c3",
  amarela: "#eab308",
  amarela_preta: "#a16207",
  laranja_branca: "#ffedd5",
  laranja: "#f97316",
  laranja_preta: "#c2410c",
  verde_branca: "#dcfce7",
  verde: "#22c55e",
  verde_preta: "#15803d",
  azul: "#2563eb",
  roxa: "#7c3aed",
  marrom: "#92400e",
  preta: "#1f2937",
};

const BELT_TEXT: Partial<Record<CorFaixa, string>> = {
  branca: "#374151",
  cinza_branca: "#374151",
  cinza: "#ffffff",
  cinza_preta: "#ffffff",
  amarela_branca: "#374151",
  amarela: "#1f2937",
  amarela_preta: "#ffffff",
  laranja_branca: "#374151",
  laranja: "#ffffff",
  laranja_preta: "#ffffff",
  verde_branca: "#374151",
  verde: "#ffffff",
  verde_preta: "#ffffff",
  azul: "#ffffff",
  roxa: "#ffffff",
  marrom: "#ffffff",
  preta: "#ffffff",
};

// ─── Helpers ─────────────────────────────────────────────────

function formatarTelefone(valor: string): string {
  let digits: string;
  if (valor.startsWith("+351")) {
    digits = valor.slice(4).replace(/\D/g, "");
  } else if (valor.startsWith("351")) {
    digits = valor.slice(3).replace(/\D/g, "");
  } else {
    digits = valor.replace(/\D/g, "");
  }
  digits = digits.slice(0, 9);
  if (!digits) return "+351 ";
  if (digits.length <= 3) return `+351 ${digits}`;
  if (digits.length <= 6) return `+351 ${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `+351 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function mascaraData(valor: string): string {
  const nums = valor.replace(/\D/g, "").slice(0, 8);
  if (nums.length <= 2) return nums;
  if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`;
  return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4)}`;
}

function dataParaISO(ddmmaaaa: string): string | null {
  const nums = ddmmaaaa.replace(/\D/g, "");
  if (nums.length !== 8) return null;
  const dia = nums.slice(0, 2);
  const mes = nums.slice(2, 4);
  const ano = nums.slice(4, 8);
  const d = new Date(`${ano}-${mes}-${dia}`);
  if (isNaN(d.getTime())) return null;
  return `${ano}-${mes}-${dia}`;
}

function telefoneLimpo(telefone: string): string | null {
  return telefone.replace(/\D/g, "").length > 3 ? telefone.trim() : null;
}

function calcularIdade(dataDDMMAAAA: string): number | null {
  const nums = dataDDMMAAAA.replace(/\D/g, "");
  if (nums.length !== 8) return null;
  const dia = parseInt(nums.slice(0, 2), 10);
  const mes = parseInt(nums.slice(2, 4), 10) - 1;
  const ano = parseInt(nums.slice(4, 8), 10);
  const nasc = new Date(ano, mes, dia);
  if (isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const aindaNaoFezAnos =
    hoje.getMonth() < nasc.getMonth() ||
    (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate());
  if (aindaNaoFezAnos) idade--;
  return idade;
}

// ─── Shared primitives ───────────────────────────────────────

function PrimaryBtn({
  children,
  disabled,
  loading,
  onClick,
  type = "button",
  dark = false,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  dark?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <button
      type={type}
      disabled={!!inactive}
      onClick={onClick}
      style={{
        height: 56,
        borderRadius: 28,
        background: inactive ? (dark ? "rgba(255,255,255,0.15)" : C.line) : C.red,
        color: inactive ? (dark ? "rgba(255,255,255,0.45)" : C.ink3) : "#fff",
        border: "none",
        cursor: inactive ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontFamily: "inherit",
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: -0.2,
        width: "100%",
        boxShadow: inactive ? "none" : "0 8px 22px rgba(255,1,0,0.32)",
        transition: "opacity 0.15s",
      }}
    >
      {loading ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : children}
    </button>
  );
}

function BackBar({ progress, onBack }: { progress: number; onBack: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 22px 0" }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          background: "#fff",
          border: `1px solid ${C.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        <svg width="11" height="18" viewBox="0 0 11 18" fill="none">
          <path d="M9 2L2 9l7 7" stroke={C.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: C.line, overflow: "hidden" }}>
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: C.red,
            borderRadius: 2,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 1.6,
        textTransform: "uppercase",
        color: color ?? C.red,
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  focused,
  children,
}: {
  label: string;
  focused?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: focused ? C.red : C.ink2,
          letterSpacing: 0.3,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function TextInput({
  id,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
  required,
  disabled,
  suffix,
  inputMode,
}: {
  id?: string;
  type: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  suffix?: React.ReactNode;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        inputMode={inputMode}
        style={{
          height: 50,
          borderRadius: 12,
          background: "#fff",
          border: `${focused ? 2 : 1.5}px solid ${focused ? C.ink : C.line}`,
          padding: "0 14px",
          paddingRight: suffix ? 44 : 14,
          display: "flex",
          alignItems: "center",
          fontSize: 16,
          fontWeight: 500,
          width: "100%",
          boxSizing: "border-box",
          outline: "none",
          fontFamily: "inherit",
          color: C.ink,
        }}
      />
      {suffix && (
        <div
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          {suffix}
        </div>
      )}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(255,1,0,0.07)",
        border: `1px solid rgba(255,1,0,0.2)`,
        fontSize: 14,
        color: C.redDark,
        lineHeight: 1.45,
      }}
    >
      {msg}
    </div>
  );
}

// ─── Screen shell ────────────────────────────────────────────

function Shell({
  children,
  dark = false,
  bg,
}: {
  children: React.ReactNode;
  dark?: boolean;
  bg?: string;
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: bg ?? (dark ? C.ink : C.bg),
        display: "flex",
        flexDirection: "column",
        paddingBottom: 34,
        position: "relative",
        overflow: "hidden",
        fontFamily: "-apple-system, system-ui, sans-serif",
        color: dark ? "#fff" : C.ink,
      }}
    >
      {children}
    </div>
  );
}

// ─── Step 0 — Welcome ────────────────────────────────────────

function StepWelcome({ onCriar, onLogin }: { onCriar: () => void; onLogin: () => void }) {
  return (
    <Shell dark bg={C.ink}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/fachada.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.35,
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(rgba(33,33,33,0.55) 0%, rgba(33,33,33,0.7) 50%, rgba(33,33,33,0.95) 100%)",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -140,
          right: -160,
          width: 460,
          height: 460,
          borderRadius: "50%",
          background: C.red,
          opacity: 0.18,
          filter: "blur(60px)",
          zIndex: 1,
        }}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "0 32px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ paddingTop: 64, display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src="/logo.webp"
            alt="Gracie Barra"
            width={44}
            height={44}
            style={{ borderRadius: 22, background: "#fff", objectFit: "contain" }}
          />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: 0.4,
                color: "#fff",
                textTransform: "uppercase",
              }}
            >
              Gracie Barra
            </span>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: 1.2,
                color: "rgba(255,255,255,0.7)",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              Famalicão · Portugal
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <Eyebrow>Brazilian Jiu-Jitsu</Eyebrow>
        <h1
          style={{
            fontSize: "clamp(44px, 13vw, 54px)",
            fontWeight: 800,
            lineHeight: 0.96,
            letterSpacing: -2,
            margin: "14px 0 0",
            color: "#fff",
            textShadow: "0 2px 20px rgba(0,0,0,0.4)",
          }}
        >
          Bem-vindo
          <br />à <span style={{ color: C.red }}>família.</span>
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.75)",
            margin: "20px 0 0",
            maxWidth: 320,
          }}
        >
          Marca aulas, segue a tua progressão e mantém-te ligado à academia.
        </p>

        <div style={{ height: 36 }} />

        <button
          type="button"
          onClick={onCriar}
          style={{
            height: 56,
            borderRadius: 28,
            background: C.red,
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 17,
            fontWeight: 600,
            boxShadow: "0 8px 22px rgba(255,1,0,0.4)",
            fontFamily: "inherit",
            width: "100%",
          }}
        >
          Criar conta
        </button>
        <div style={{ height: 12 }} />
        <button
          type="button"
          onClick={onLogin}
          style={{
            height: 56,
            borderRadius: 28,
            border: "1.5px solid rgba(255,255,255,0.4)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 17,
            fontWeight: 600,
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            fontFamily: "inherit",
            width: "100%",
          }}
        >
          Já tenho conta
        </button>

        <p
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
            margin: "20px 0 8px",
            lineHeight: 1.5,
          }}
        >
          Ao continuar aceita os Termos
          <br />e Política de Privacidade.
        </p>
      </div>
    </Shell>
  );
}

// ─── Step 1 — Email + senha ───────────────────────────────────

function StepEmail({
  email,
  senha,
  confirmarSenha,
  erro,
  loading,
  onEmail,
  onSenha,
  onConfirmarSenha,
  onBack,
  onSubmit,
}: {
  email: string;
  senha: string;
  confirmarSenha: string;
  erro: string;
  loading: boolean;
  onEmail: (v: string) => void;
  onSenha: (v: string) => void;
  onConfirmarSenha: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const senhasNaoCoincidem = confirmarSenha.length > 0 && senha !== confirmarSenha;

  return (
    <Shell>
      <BackBar progress={33} onBack={onBack} />
      <div
        style={{
          padding: "32px 28px 0",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Eyebrow>Passo 1 de 3</Eyebrow>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -1.2,
            margin: "12px 0 12px",
          }}
        >
          Qual é o teu
          <br />
          email?
        </h1>
        <p style={{ fontSize: 15, color: C.ink2, lineHeight: 1.5, margin: 0 }}>
          Vamos enviar-te um código para confirmar.
        </p>

        <div style={{ height: 36 }} />

        <Field label="Email" focused={email.length > 0}>
          <TextInput
            type="email"
            placeholder="joao.silva@gmail.com"
            value={email}
            onChange={onEmail}
            autoComplete="email"
            required
            disabled={loading}
          />
        </Field>

        <Field label="Criar senha" focused={senha.length > 0}>
          <TextInput
            type={showPwd ? "text" : "password"}
            placeholder="Mínimo 6 caracteres"
            value={senha}
            onChange={onSenha}
            autoComplete="new-password"
            required
            disabled={loading}
            suffix={
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.ink3 }}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
        </Field>

        <Field label="Confirmar senha" focused={confirmarSenha.length > 0}>
          <TextInput
            type={showConfirmar ? "text" : "password"}
            placeholder="Repete a senha"
            value={confirmarSenha}
            onChange={onConfirmarSenha}
            autoComplete="new-password"
            required
            disabled={loading}
            suffix={
              <button
                type="button"
                onClick={() => setShowConfirmar((v) => !v)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.ink3 }}
                tabIndex={-1}
              >
                {showConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          {senhasNaoCoincidem && (
            <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>
              As senhas não coincidem.
            </div>
          )}
        </Field>

        {erro && <ErrorBanner msg={erro} />}

        <div style={{ flex: 1 }} />

        <PrimaryBtn
          loading={loading}
          disabled={!email || senha.length < 6 || senha !== confirmarSenha}
          onClick={onSubmit}
        >
          Enviar código
        </PrimaryBtn>

        <div style={{ marginTop: 16, fontSize: 13, color: C.ink3, textAlign: "center", lineHeight: 1.5 }}>
          Usamos o teu email apenas para confirmar
          <br />a inscrição e avisos da academia.
        </div>
      </div>
    </Shell>
  );
}

// ─── Step 2 — OTP verification ───────────────────────────────

function StepOtp({
  email,
  erro,
  loading,
  onBack,
  onVerify,
  onReenviar,
  countdown,
}: {
  email: string;
  erro: string;
  loading: boolean;
  onBack: () => void;
  onVerify: (code: string) => void;
  onReenviar: () => void;
  countdown: number;
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");

  function handleChange(i: number, val: string) {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    if (char && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d) && char) {
      onVerify(next.join(""));
    }
  }

  function handleKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    refs.current[focusIdx]?.focus();
    if (pasted.length === 6) onVerify(pasted);
  }

  return (
    <Shell>
      <BackBar progress={66} onBack={onBack} />
      <div style={{ padding: "32px 28px 0", flex: 1, display: "flex", flexDirection: "column" }}>
        <Eyebrow>Passo 2 de 3</Eyebrow>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -1.2,
            margin: "12px 0 12px",
          }}
        >
          Vê o teu email
        </h1>
        <p style={{ fontSize: 15, color: C.ink2, lineHeight: 1.5, margin: 0 }}>
          Enviámos um código de 6 dígitos para
          <br />
          <span style={{ color: C.ink, fontWeight: 600 }}>{email}</span>
        </p>

        <div style={{ height: 28 }} />

        <div
          style={{
            alignSelf: "center",
            width: 76,
            height: 76,
            borderRadius: 18,
            background: "#fff",
            border: `1.5px solid ${C.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            position: "relative",
          }}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect x="4" y="9" width="28" height="20" rx="3" stroke={C.navy} strokeWidth="2" />
            <path d="M5 11l13 9 13-9" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              width: 20,
              height: 20,
              borderRadius: 10,
              background: C.red,
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fff",
            }}
          >
            1
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              disabled={loading}
              style={{
                width: 45,
                height: 52,
                borderRadius: 12,
                background: "#fff",
                border: `2px solid ${i === digits.findIndex((x) => !x) && d === "" ? C.ink : d ? C.navy : C.line}`,
                textAlign: "center",
                fontSize: 24,
                fontWeight: 700,
                color: C.ink,
                outline: "none",
                fontFamily: "inherit",
                padding: 0,
              }}
            />
          ))}
        </div>

        <div style={{ height: 22 }} />

        <div
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: "#fff",
            border: `1px solid ${C.line}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              background: "rgba(255,1,0,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke={C.red} strokeWidth="1.5" />
              <path d="M7 4v3l2 1.5" stroke={C.red} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ flex: 1, fontSize: 14, color: C.ink2 }}>
            Não recebeste?{" "}
            {countdown > 0 ? (
              <span style={{ color: C.red, fontWeight: 600 }}>
                Reenviar em 0:{countdown.toString().padStart(2, "0")}
              </span>
            ) : (
              <button
                type="button"
                onClick={onReenviar}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: C.red,
                  fontWeight: 600,
                  fontSize: 14,
                  fontFamily: "inherit",
                }}
              >
                Reenviar código
              </button>
            )}
          </div>
        </div>

        {erro && (
          <div style={{ marginTop: 12 }}>
            <ErrorBanner msg={erro} />
          </div>
        )}

        <div style={{ flex: 1 }} />

        <PrimaryBtn loading={loading} disabled={code.length < 6} onClick={() => onVerify(code)}>
          Verificar
        </PrimaryBtn>
      </div>
    </Shell>
  );
}

// ─── Belt + Grau pickers ─────────────────────────────────────

function BeltPicker({
  categoria,
  faixa,
  onFaixa,
  disabled,
}: {
  categoria: CategoriaFaixa;
  faixa: CorFaixa | "";
  onFaixa: (v: CorFaixa | "") => void;
  disabled?: boolean;
}) {
  const belts = categoria === "adulto" ? ADULT_BELTS : INFANTIL_BELTS;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {belts.map((b) => {
        const selected = faixa === b;
        return (
          <button
            key={b}
            type="button"
            disabled={disabled}
            onClick={() => onFaixa(selected ? "" : b)}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 17,
              background: selected ? (BELT_BG[b] ?? "#ddd") : "#fff",
              color: selected ? (BELT_TEXT[b] ?? C.ink) : C.ink2,
              border: selected
                ? `2px solid ${BELT_BG[b] ?? "#aaa"}`
                : `1.5px solid ${C.line}`,
              cursor: disabled ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: selected ? 700 : 500,
              fontFamily: "inherit",
              boxShadow: selected ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
              transition: "all 0.12s",
              whiteSpace: "nowrap",
            }}
          >
            {labelCorFaixa(b)}
          </button>
        );
      })}
    </div>
  );
}

function GrauPicker({
  graus,
  onGraus,
  disabled,
}: {
  graus: number;
  onGraus: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {[0, 1, 2, 3, 4].map((g) => {
        const selected = graus === g;
        return (
          <button
            key={g}
            type="button"
            disabled={disabled}
            onClick={() => onGraus(g)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: selected ? C.ink : "#fff",
              color: selected ? "#fff" : C.ink2,
              border: selected ? `2px solid ${C.ink}` : `1.5px solid ${C.line}`,
              cursor: disabled ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "inherit",
              transition: "all 0.12s",
            }}
          >
            {g}
          </button>
        );
      })}
    </div>
  );
}

function CategoriaPicker({
  categoria,
  onCategoria,
  disabled,
  soInfantil,
}: {
  categoria: CategoriaFaixa;
  onCategoria: (v: CategoriaFaixa) => void;
  disabled?: boolean;
  soInfantil?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        background: "#fff",
        border: `1.5px solid ${C.line}`,
        borderRadius: 12,
        padding: 4,
        gap: 4,
      }}
    >
      {(["adulto", "infantil"] as CategoriaFaixa[]).map((c) => {
        const selected = categoria === c;
        const bloqueado = !!(soInfantil && c === "adulto");
        return (
          <button
            key={c}
            type="button"
            disabled={disabled || bloqueado}
            onClick={() => onCategoria(c)}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 8,
              background: selected ? C.ink : "transparent",
              color: selected ? "#fff" : bloqueado ? C.ink3 : C.ink2,
              border: "none",
              cursor: disabled || bloqueado ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: selected ? 700 : 500,
              fontFamily: "inherit",
              transition: "all 0.15s",
              opacity: bloqueado ? 0.45 : 1,
            }}
          >
            {c === "adulto" ? "Adulto" : "Infantil"}
          </button>
        );
      })}
    </div>
  );
}

// ─── Step 3 — Personal data ──────────────────────────────────

function StepDados({
  tipoUsuario,
  onTipoUsuario,
  nome,
  telefone,
  dataNasc,
  contactoEmergencia,
  categoria,
  faixa,
  graus,
  nomeAluno,
  nif,
  nifAluno,
  erro,
  loading,
  onNome,
  onTelefone,
  onDataNasc,
  onContacto,
  onCategoria,
  onFaixa,
  onGraus,
  onNomeAluno,
  onNif,
  onNifAluno,
  onBack,
  onSubmit,
}: {
  tipoUsuario: "aluno" | "responsavel";
  onTipoUsuario: (t: "aluno" | "responsavel") => void;
  nome: string;
  telefone: string;
  dataNasc: string;
  contactoEmergencia: string;
  categoria: CategoriaFaixa;
  faixa: CorFaixa | "";
  graus: number;
  nomeAluno: string;
  nif: string;
  nifAluno: string;
  erro: string;
  loading: boolean;
  onNome: (v: string) => void;
  onTelefone: (v: string) => void;
  onDataNasc: (v: string) => void;
  onContacto: (v: string) => void;
  onCategoria: (v: CategoriaFaixa) => void;
  onFaixa: (v: CorFaixa | "") => void;
  onGraus: (v: number) => void;
  onNomeAluno: (v: string) => void;
  onNif: (v: string) => void;
  onNifAluno: (v: string) => void;
  termoAceito: boolean;
  onTermoAceito: (v: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const nomeValido = nome.trim().split(" ").filter(Boolean).length >= 2;
  const nomeAlunoValido = nomeAluno.trim().split(" ").filter(Boolean).length >= 2;
  const idadeAluno = calcularIdade(dataNasc);
  const menorDe13 = idadeAluno !== null && idadeAluno <= 12;
  const menorDe17 = idadeAluno !== null && idadeAluno <= 16;
  const dataNascValida = dataParaISO(dataNasc) !== null;
  const telefoneValido = telefoneLimpo(telefone) !== null;
  const dadosValidos =
    tipoUsuario === "aluno"
      ? nomeValido && dataNascValida && telefoneValido && !menorDe17
      : nomeValido && nomeAlunoValido && dataNascValida && telefoneValido;
  const podeSubmeter = dadosValidos && termoAceito;
  const isResponsavel = tipoUsuario === "responsavel";

  return (
    <Shell>
      <BackBar progress={100} onBack={onBack} />
      <div style={{ padding: "24px 28px 0", flex: 1, display: "flex", flexDirection: "column" }}>
        <Eyebrow>Passo 3 de 3</Eyebrow>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -1.2,
            margin: "10px 0 16px",
          }}
        >
          Os teus dados
        </h1>

        {/* Tipo toggle */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.ink2, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 8 }}>
            Sou
          </div>
          <div
            style={{
              display: "flex",
              background: "#fff",
              border: `1.5px solid ${C.line}`,
              borderRadius: 12,
              padding: 4,
              gap: 4,
            }}
          >
            {(["aluno", "responsavel"] as const).map((t) => {
              const selected = tipoUsuario === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={loading}
                  onClick={() => onTipoUsuario(t)}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 8,
                    background: selected ? C.red : "transparent",
                    color: selected ? "#fff" : C.ink2,
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: 14,
                    fontWeight: selected ? 700 : 500,
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                    padding: "0 8px",
                  }}
                >
                  {t === "aluno" ? "Aluno" : "Responsável de Aluno"}
                </button>
              );
            })}
          </div>
        </div>

        {tipoUsuario === "aluno" && menorDe17 && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(204,0,0,0.06)",
              border: `1px solid rgba(204,0,0,0.3)`,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke={C.red} strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M8 6v3.5M8 11.5h.01" stroke={C.red} strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.red, lineHeight: 1.5, marginBottom: 8, fontWeight: 600 }}>
                Menores de 17 anos devem registar-se como Responsável de Aluno.
              </div>
              <button
                type="button"
                onClick={() => onTipoUsuario("responsavel")}
                style={{
                  background: C.red,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Mudar para Responsável →
              </button>
            </div>
          </div>
        )}

        <Field label={isResponsavel ? "Nome Completo do Responsável" : "Nome completo"} focused>
          <TextInput
            type="text"
            placeholder={isResponsavel ? "Maria Silva" : "João Silva"}
            value={nome}
            onChange={onNome}
            autoComplete="name"
            required
            disabled={loading}
          />
          {nome.length > 0 && !nomeValido && (
            <div style={{ fontSize: 12, color: C.ink3, marginTop: 4 }}>Insere nome e apelido.</div>
          )}
        </Field>

        <Field label="Telemóvel">
          <TextInput
            type="tel"
            placeholder="+351 939 992 840"
            value={telefone}
            onChange={(v) => onTelefone(formatarTelefone(v))}
            autoComplete="tel"
            disabled={loading}
            inputMode="tel"
          />
        </Field>

        {isResponsavel && (
          <Field label="NIF do responsável">
            <TextInput
              type="text"
              placeholder="123 456 789"
              value={nif}
              onChange={onNif}
              disabled={loading}
              inputMode="numeric"
            />
          </Field>
        )}

        {isResponsavel && (
          <Field label="Nome do Aluno">
            <TextInput
              type="text"
              placeholder="Pedro Silva"
              value={nomeAluno}
              onChange={onNomeAluno}
              disabled={loading}
            />
            {nomeAluno.length > 0 && !nomeAlunoValido && (
              <div style={{ fontSize: 12, color: C.ink3, marginTop: 4 }}>Insere nome e apelido do aluno.</div>
            )}
          </Field>
        )}

        <Field label={isResponsavel ? "Data de nascimento do aluno" : "Data de nascimento"}>
          <TextInput
            type="text"
            inputMode="numeric"
            placeholder="DD/MM/AAAA"
            value={dataNasc}
            onChange={(v) => onDataNasc(mascaraData(v))}
            disabled={loading}
          />
        </Field>

        {isResponsavel ? (
          <Field label="NIF da criança">
            <TextInput
              type="text"
              placeholder="123 456 789"
              value={nifAluno}
              onChange={onNifAluno}
              disabled={loading}
              inputMode="numeric"
            />
          </Field>
        ) : (
          <Field label="NIF">
            <TextInput
              type="text"
              placeholder="123 456 789"
              value={nif}
              onChange={onNif}
              disabled={loading}
              inputMode="numeric"
            />
          </Field>
        )}

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.ink2, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>
            {isResponsavel ? "Categoria do aluno" : "Categoria"}
          </div>
          <CategoriaPicker categoria={categoria} onCategoria={onCategoria} disabled={loading} soInfantil={menorDe13} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.ink2, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>
            {isResponsavel ? "Faixa do aluno" : "Faixa"}
          </div>
          <BeltPicker categoria={categoria} faixa={faixa} onFaixa={onFaixa} disabled={loading} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.ink2, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>
            Graus
          </div>
          <GrauPicker graus={graus} onGraus={onGraus} disabled={loading} />
        </div>

        <Field label="Contacto de emergência">
          <TextInput
            type="text"
            placeholder="Nome · +351 919 876 543"
            value={contactoEmergencia}
            onChange={onContacto}
            disabled={loading}
          />
        </Field>

        <div
          style={{
            marginTop: 4,
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(3,10,140,0.06)",
            border: `1px solid rgba(3,10,140,0.15)`,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="8" cy="8" r="6.5" stroke={C.blue} strokeWidth="1.4" />
            <path d="M8 5v3.5M8 11h.01" stroke={C.blue} strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 12, color: C.navy, lineHeight: 1.45 }}>
            Os teus dados ficam visíveis apenas para a equipa da Gracie Barra Famalicão.
          </span>
        </div>

        {/* Terms checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginTop: 4,
            padding: "12px 14px",
            borderRadius: 12,
            background: termoAceito ? "rgba(255,1,0,0.05)" : "#fff",
            border: `1.5px solid ${termoAceito ? C.red : C.line}`,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "border-color 0.15s, background 0.15s",
          }}
        >
          <input
            type="checkbox"
            checked={termoAceito}
            disabled={loading}
            onChange={(e) => onTermoAceito(e.target.checked)}
            style={{
              marginTop: 2,
              width: 18,
              height: 18,
              accentColor: C.red,
              flexShrink: 0,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          />
          <span style={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>
            Declaro que estou de acordo com todos os termos do{" "}
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                color: C.red,
                textDecoration: "underline",
                fontWeight: 600,
              }}
            >
              contrato da Gracie Barra Famalicão
            </a>
            .
          </span>
        </label>

        {erro && (
          <div style={{ marginTop: 12 }}>
            <ErrorBanner msg={erro} />
          </div>
        )}

        <div style={{ flex: 1, minHeight: 12 }} />

        <PrimaryBtn loading={loading} disabled={!podeSubmeter} onClick={onSubmit}>
          Concluir inscrição
        </PrimaryBtn>
      </div>
    </Shell>
  );
}

// ─── Step 4 — Success ────────────────────────────────────────

function StepPronto({ nome, onLogin }: { nome: string; onLogin: () => void }) {
  const firstName = nome.trim().split(" ")[0] || "Atleta";
  return (
    <Shell dark bg={C.navy}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0 }}>
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: C.blue,
            opacity: 0.5,
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -150,
            right: -150,
            width: 460,
            height: 460,
            borderRadius: "50%",
            background: C.red,
            opacity: 0.35,
            filter: "blur(70px)",
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "0 32px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ paddingTop: 64 }} />

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: 70,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                overflow: "hidden",
              }}
            >
              <img src="/logo.webp" alt="Gracie Barra" width={120} height={120} style={{ objectFit: "contain" }} />
            </div>
            <div
              style={{
                position: "absolute",
                bottom: -4,
                right: -4,
                width: 44,
                height: 44,
                borderRadius: 22,
                background: C.red,
                border: `4px solid ${C.navy}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 10l3 3 7-8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        <Eyebrow color="#ff5a59">Conta criada</Eyebrow>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 800,
            lineHeight: 0.98,
            letterSpacing: -1.6,
            margin: "14px 0 0",
            color: "#fff",
          }}
        >
          Tudo pronto,
          <br />
          {firstName}.
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.78)",
            margin: "14px 0 0",
          }}
        >
          A tua conta foi criada com sucesso. Inicia sessão para começar a usar a aplicação.
        </p>

        <div style={{ height: 28 }} />

        <button
          type="button"
          onClick={onLogin}
          style={{
            height: 56,
            borderRadius: 28,
            background: C.red,
            color: "#fff",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 17,
            fontWeight: 600,
            boxShadow: "0 8px 22px rgba(255,1,0,0.4)",
            fontFamily: "inherit",
            width: "100%",
          }}
        >
          Iniciar sessão
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </Shell>
  );
}

// ─── Orchestrator ────────────────────────────────────────────

export function CadastroForm() {
  const router = useRouter();
  const [passo, setPasso] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  // Auth state
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [otpEnviado, setOtpEnviado] = useState(false);

  // Profile state
  const [tipoUsuario, setTipoUsuario] = useState<"aluno" | "responsavel">("aluno");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("+351 ");
  const [dataNasc, setDataNasc] = useState("");
  const [contactoEmergencia, setContactoEmergencia] = useState("");
  const [categoria, setCategoria] = useState<CategoriaFaixa>("adulto");
  const [faixa, setFaixa] = useState<CorFaixa | "">("");
  const [graus, setGraus] = useState(0);
  const [nomeAluno, setNomeAluno] = useState("");
  const [nif, setNif] = useState("");
  const [nifAluno, setNifAluno] = useState("");
  const [termoAceito, setTermoAceito] = useState(false);

  // On mount: if the user is already authenticated with an incomplete profile (e.g. after
  // OTP confirmation followed by a page refresh), skip straight to Step 3.
  useEffect(() => {
    async function checkIncompleteProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome_completo")
        .eq("id", user.id)
        .single();
      if (!profile?.nome_completo) {
        setEmail(user.email ?? "");
        setPasso(3);
      }
    }
    checkIncompleteProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCategoria(cat: CategoriaFaixa) {
    setCategoria(cat);
    setFaixa("");
  }

  useEffect(() => {
    const idade = calcularIdade(dataNasc);
    if (idade !== null && idade <= 12) {
      setCategoria("infantil");
      setFaixa("");
    }
  }, [dataNasc]);

  function startCountdown() {
    setCountdown(30);
    const iv = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) { clearInterval(iv); return 0; }
        return n - 1;
      });
    }, 1000);
  }

  async function handleEnviarCodigo() {
    setErro("");
    if (!email || senha.length < 6 || senha !== confirmarSenha) return;
    setLoading(true);
    try {
      const emailNorm = email.trim().toLowerCase();

      if (!otpEnviado) {
        try {
          const jaExiste = await verificarEmailExistente(emailNorm);
          if (jaExiste) {
            setErro("E-mail já cadastrado. Use um e-mail diferente.");
            return;
          }
        } catch {
          // fall through — signUp will catch real duplicates
        }
      }

      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: emailNorm,
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setErro("Erro ao enviar código. Tenta novamente.");
        return;
      }
      if (!data.user || data.user.identities?.length === 0) {
        setErro("E-mail já cadastrado. Use um e-mail diferente.");
        return;
      }
      setOtpEnviado(true);
      setPasso(2);
      startCountdown();
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(code: string) {
    setErro("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      });
      if (error) {
        setErro("Código incorreto ou expirado. Tenta novamente.");
        return;
      }
      setPasso(3);
    } finally {
      setLoading(false);
    }
  }

  async function handleReenviar() {
    setErro("");
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase() });
      startCountdown();
    } finally {
      setLoading(false);
    }
  }

  async function handleConcluir() {
    setErro("");
    const nomeValido = nome.trim().split(" ").filter(Boolean).length >= 2;
    if (!nomeValido) return;
    if (tipoUsuario === "responsavel") {
      const nomeAlunoValido = nomeAluno.trim().split(" ").filter(Boolean).length >= 2;
      if (!nomeAlunoValido) return;
    }

    setLoading(true);
    try {
      const tel = telefoneLimpo(telefone);
      const dataNascISO = dataParaISO(dataNasc);

      if (tipoUsuario === "aluno") {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setErro("Sessão expirada. Começa o registo novamente.");
          return;
        }
        const { error } = await supabase
          .from("profiles")
          .update({
            nome_completo: nome.trim(),
            telefone: tel,
            data_nascimento: dataNascISO,
            contacto_emergencia: contactoEmergencia || null,
            nif: nif.trim() || null,
            faixa: faixa || null,
            graus,
            categoria,
          })
          .eq("id", user.id);
        if (error) {
          setErro("Erro ao guardar dados. Tenta novamente.");
          return;
        }
      } else {
        const result = await concluirCadastroResponsavel({
          nomeResponsavel: nome.trim(),
          telefone: tel,
          contactoEmergencia: contactoEmergencia || null,
          nif: nif.trim() || null,
          nomeAluno: nomeAluno.trim(),
          dataNascAluno: dataNascISO,
          nifAluno: nifAluno.trim() || null,
          faixaAluno: faixa || null,
          grausAluno: graus,
          categoriaAluno: categoria,
        });
        if (!result.ok) {
          setErro(result.erro ?? "Erro ao concluir registo.");
          return;
        }
      }

      setPasso(4);
    } finally {
      setLoading(false);
    }
  }

  switch (passo) {
    case 0:
      return (
        <StepWelcome
          onCriar={() => setPasso(1)}
          onLogin={() => router.push("/login")}
        />
      );
    case 1:
      return (
        <StepEmail
          email={email}
          senha={senha}
          confirmarSenha={confirmarSenha}
          erro={erro}
          loading={loading}
          onEmail={setEmail}
          onSenha={setSenha}
          onConfirmarSenha={setConfirmarSenha}
          onBack={() => { setErro(""); setPasso(0); }}
          onSubmit={handleEnviarCodigo}
        />
      );
    case 2:
      return (
        <StepOtp
          email={email}
          erro={erro}
          loading={loading}
          onBack={() => { setErro(""); setPasso(1); }}
          onVerify={handleVerify}
          onReenviar={handleReenviar}
          countdown={countdown}
        />
      );
    case 3:
      return (
        <StepDados
          tipoUsuario={tipoUsuario}
          onTipoUsuario={setTipoUsuario}
          nome={nome}
          telefone={telefone}
          dataNasc={dataNasc}
          contactoEmergencia={contactoEmergencia}
          categoria={categoria}
          faixa={faixa}
          graus={graus}
          nomeAluno={nomeAluno}
          nif={nif}
          nifAluno={nifAluno}
          erro={erro}
          loading={loading}
          onNome={setNome}
          onTelefone={setTelefone}
          onDataNasc={setDataNasc}
          onContacto={setContactoEmergencia}
          onCategoria={handleCategoria}
          onFaixa={setFaixa}
          onGraus={setGraus}
          onNomeAluno={setNomeAluno}
          onNif={setNif}
          onNifAluno={setNifAluno}
          termoAceito={termoAceito}
          onTermoAceito={setTermoAceito}
          onBack={() => { setErro(""); setPasso(2); }}
          onSubmit={handleConcluir}
        />
      );
    case 4:
      return <StepPronto nome={nome} onLogin={() => router.push("/login")} />;
  }
}
