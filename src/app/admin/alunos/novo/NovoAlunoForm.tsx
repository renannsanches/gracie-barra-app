"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { labelCorFaixa } from "@/lib/utils";
import { PhoneInput } from "@/components/PhoneInput";
import { GrupoPicker } from "@/components/GrupoPicker";
import { ModalidadesEditor, lerPlano, type PlanoRascunho } from "@/components/ModalidadesEditor";
import { valorParaInput, valorSugerido } from "@/lib/modalidades";
import { senhaValida, REGRA_SENHA_TEXTO } from "@/lib/senha";
import { criarAluno } from "./actions";
import type { CorFaixa, CategoriaFaixa, GrupoAluno, Modalidade } from "@/lib/types";

const COR_FAIXA_OPTIONS: CorFaixa[] = [
  "branca",
  "cinza_branca", "cinza", "cinza_preta",
  "amarela_branca", "amarela", "amarela_preta",
  "laranja_branca", "laranja", "laranja_preta",
  "verde_branca", "verde", "verde_preta",
  "azul", "roxa", "marrom", "preta", "coral", "vermelha",
];

const selectClass = "w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue";

interface Props {
  alunosComLogin: { id: string; nome_completo: string }[];
  grupos: GrupoAluno[];
  modalidades: Modalidade[];
}

/** Plano inicial: modalidade padrão com o valor sugerido para a idade. */
function planoInicial(modalidades: Modalidade[], dataNascimento: string): PlanoRascunho[] {
  const padrao = modalidades.find((m) => m.padrao && m.ativo) ?? modalidades.find((m) => m.ativo);
  return padrao ? [{ modalidade_id: padrao.id, valor: valorParaInput(valorSugerido(padrao, dataNascimento)) }] : [];
}

export function NovoAlunoForm({ alunosComLogin, grupos, modalidades }: Props) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [semLogin, setSemLogin] = useState(false);

  const [form, setForm] = useState({
    email: "", senha: "", nome_completo: "",
    telefone: "", data_nascimento: "", iban: "", nif: "",
    faixa: "branca" as CorFaixa,
    graus: "0",
    categoria: "adulto" as CategoriaFaixa,
    perfil: "aluno",
    primeiro_vencimento: "",
    dia_vencimento: "10",
    responsavel_id: "",
    grupo_id: (grupos.find((g) => g.padrao && g.ativo) ?? grupos.find((g) => g.ativo))?.id ?? "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Modalidades: enquanto o admin não mexer, o valor acompanha a data de nascimento (<16 → infantil)
  const [plano, setPlano] = useState<PlanoRascunho[]>(() => planoInicial(modalidades, ""));
  const [planoMexido, setPlanoMexido] = useState(false);
  useEffect(() => {
    if (!planoMexido) setPlano(planoInicial(modalidades, form.data_nascimento));
  }, [form.data_nascimento, planoMexido, modalidades]);

  const senhaFraca = form.senha.length > 0 && !senhaValida(form.senha);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!semLogin && !senhaValida(form.senha)) {
      setErro(`Senha fraca. ${REGRA_SENHA_TEXTO}`);
      return;
    }

    const precisaPlano = form.perfil !== "responsavel";
    const { itens, erro: erroPlano } = lerPlano(precisaPlano ? plano : [], modalidades);
    if (!itens) { setErro(erroPlano ?? "Valor inválido numa modalidade."); return; }

    setCarregando(true);

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("modalidades", JSON.stringify(itens));
    fd.append("sem_login", String(semLogin));

    try {
      const result = await criarAluno(fd);
      if (!result.ok) { setErro(result.erro ?? "Erro ao criar aluno."); return; }
      setSucesso(true);
      setTimeout(() => router.push(`/admin/alunos/${result.userId}`), 1500);
    } finally {
      setCarregando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <Check size={28} className="text-green-600" />
        </div>
        <p className="font-bold text-gray-900 text-lg">Aluno criado com sucesso!</p>
        <p className="text-gray-400 text-sm">Redirecionando para o perfil...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Sem login toggle */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={semLogin}
            onChange={(e) => {
              setSemLogin(e.target.checked);
              if (e.target.checked) set("perfil", "aluno");
              else set("responsavel_id", "");
            }}
            disabled={carregando}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gb-blue focus:ring-gb-blue/30"
          />
          <div>
            <p className="font-semibold text-gray-900 text-sm">Sem login (dependente / criança)</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Cria o cadastro sem conta de acesso ao app — útil para crianças geridas por um responsável.
            </p>
          </div>
        </label>

        {semLogin && (
          <div className="space-y-1.5">
            <Label htmlFor="responsavel_id">Responsável</Label>
            <select
              id="responsavel_id"
              title="Responsável pelo aluno"
              value={form.responsavel_id}
              onChange={(e) => set("responsavel_id", e.target.value)}
              className={selectClass}
              disabled={carregando}
            >
              <option value="">Sem responsável</option>
              {alunosComLogin.map((a) => (
                <option key={a.id} value={a.id}>{a.nome_completo}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Perfil — segunda decisão do form; oculto quando dependente sem login (fica sempre aluno) */}
      {!semLogin && (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wide text-gb-blue">Perfil</h2>
        <div className="space-y-1.5">
          <Label htmlFor="perfil">Tipo de cadastro</Label>
          <select
            id="perfil" title="Tipo de cadastro" value={form.perfil}
            onChange={(e) => set("perfil", e.target.value)}
            className={selectClass} disabled={carregando}
          >
            <option value="aluno">Aluno</option>
            <option value="responsavel">Responsável</option>
            <option value="professor">Professor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      )}

      {/* Grupo — onde treina (academia, colégio…); não se aplica a responsáveis */}
      {form.perfil !== "responsavel" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <div>
            <h2 id="grupo-label" className="font-bold text-gray-900 text-sm uppercase tracking-wide text-gb-blue">Grupo</h2>
            <p className="text-xs text-gray-500 mt-0.5">Onde treina. Usado para filtrar cadastros e mensalidades.</p>
          </div>
          <GrupoPicker
            id="grupo_id"
            labelledBy="grupo-label"
            grupos={grupos}
            value={form.grupo_id}
            onChange={(v) => set("grupo_id", v)}
            disabled={carregando}
          />
        </div>
      )}

      {/* Dados de Acesso — oculto quando sem_login */}
      {!semLogin && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wide text-gb-blue">Dados de Acesso</h2>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email" type="email" required={!semLogin}
              placeholder="aluno@email.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={carregando}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha *</Label>
            <div className="relative">
              <Input
                id="senha"
                type={mostrarSenha ? "text" : "password"}
                required={!semLogin} minLength={8}
                placeholder="Mínimo 8 caracteres"
                value={form.senha}
                onChange={(e) => set("senha", e.target.value)}
                disabled={carregando}
                className="pr-11"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className={`text-xs mt-1 ${senhaFraca ? "text-red-600" : "text-gray-400"}`}>
              {REGRA_SENHA_TEXTO}
            </p>
          </div>
        </div>
      )}

      {/* Dados pessoais */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wide text-gb-blue">Dados pessoais</h2>

        <div className="space-y-1.5">
          <Label htmlFor="nome_completo">Nome completo *</Label>
          <Input
            id="nome_completo" required
            placeholder="Nome e sobrenome"
            value={form.nome_completo}
            onChange={(e) => set("nome_completo", e.target.value)}
            disabled={carregando}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!(semLogin && form.responsavel_id) && (
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone</Label>
              <PhoneInput
                id="telefone"
                value={form.telefone || undefined}
                onChange={(v) => set("telefone", v ?? "")}
                disabled={carregando}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="data_nascimento">Data de nascimento</Label>
            <Input
              id="data_nascimento" type="date"
              title="Data de nascimento"
              value={form.data_nascimento}
              onChange={(e) => set("data_nascimento", e.target.value)}
              disabled={carregando}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nif">NIF</Label>
            <Input
              id="nif"
              placeholder="123 456 789"
              value={form.nif}
              onChange={(e) => set("nif", e.target.value)}
              disabled={carregando}
            />
          </div>

          {!(semLogin && form.responsavel_id) && (
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                placeholder="PT50 XXXX XXXX XXXX XXXX XXXX X"
                value={form.iban}
                onChange={(e) => set("iban", e.target.value)}
                disabled={carregando}
              />
            </div>
          )}
        </div>
      </div>

      {/* Graduação */}
      {form.perfil !== "responsavel" && (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h2 className="font-bold text-gray-900 text-sm uppercase tracking-wide text-gb-blue">Graduação</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="faixa">Faixa</Label>
            <select
              id="faixa" title="Faixa" value={form.faixa}
              onChange={(e) => set("faixa", e.target.value)}
              className={selectClass} disabled={carregando}
            >
              {COR_FAIXA_OPTIONS.map((c) => (
                <option key={c} value={c}>{labelCorFaixa(c)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="graus">Graus</Label>
            <select
              id="graus" title="Graus" value={form.graus}
              onChange={(e) => set("graus", e.target.value)}
              className={selectClass} disabled={carregando}
            >
              {[0, 1, 2, 3, 4].map((g) => (
                <option key={g} value={g}>{g === 0 ? "Sem" : g}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoria</Label>
            <select
              id="categoria" title="Categoria" value={form.categoria}
              onChange={(e) => set("categoria", e.target.value)}
              className={selectClass} disabled={carregando}
            >
              <option value="adulto">Adulto</option>
              <option value="infantil">Infantil</option>
              <option value="adulto_infantil">Adulto &amp; Infantil</option>
            </select>
          </div>
        </div>
      </div>
      )}

      {/* Mensalidade */}
      {form.perfil !== "responsavel" && (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <h2 className="font-bold text-sm uppercase tracking-wide text-gb-blue">Modalidades e mensalidade</h2>
          <p className="text-xs text-gray-500 mt-0.5">O que treina e quanto paga por cada uma. A mensalidade é a soma.</p>
        </div>

        <ModalidadesEditor
          idPrefix="novo-plano"
          modalidades={modalidades}
          value={plano}
          onChange={(p) => { setPlano(p); setPlanoMexido(true); }}
          dataNascimento={form.data_nascimento}
          disabled={carregando}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">

          <div className="space-y-1.5">
            <Label htmlFor="primeiro_vencimento">Primeiro vencimento</Label>
            <Input
              id="primeiro_vencimento" type="date"
              title="Primeiro vencimento"
              value={form.primeiro_vencimento}
              onChange={(e) => set("primeiro_vencimento", e.target.value)}
              disabled={carregando}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dia_vencimento">Dia de vencimento</Label>
            <select
              id="dia_vencimento"
              title="Dia de vencimento recorrente"
              value={form.dia_vencimento}
              onChange={(e) => set("dia_vencimento", e.target.value)}
              className={selectClass}
              disabled={carregando}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      )}

      {erro && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={carregando} className="bg-gb-blue hover:bg-gb-blue-dark text-white flex-1">
          {carregando
            ? <><Loader2 size={15} className="animate-spin mr-2" />Criando...</>
            : "Criar aluno"
          }
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={carregando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
