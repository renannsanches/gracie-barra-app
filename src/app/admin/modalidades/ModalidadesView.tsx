"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Shapes, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EuroInput } from "@/components/ui/euro-input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatarEuro, lerValorEuro, valorParaInput, type GrupoRef } from "@/lib/modalidades";
import { GrupoPicker } from "@/components/GrupoPicker";
import {
  apagarModalidade, criarModalidade, definirModalidadeAtiva, editarModalidade,
  type DadosModalidade,
} from "./actions";
import type { Modalidade } from "@/lib/types";

export interface ContagemModalidade {
  alunos: number;
  ativos: number;
  turmas: number;
}

interface Props {
  modalidades: Modalidade[];
  contagens: Record<string, ContagemModalidade>;
  /** Locais (grupos): Academia, Colégio… */
  grupos: GrupoRef[];
}

const NOME_MAX = 40;

interface Rascunho {
  nome: string;
  valor: string;
  valorInfantil: string;
  grupoId: string;
  desconta: boolean;
}

/** Converte o rascunho do formulário; devolve erro legível se algo estiver mal. */
function lerRascunho(r: Rascunho): { dados?: DadosModalidade; erro?: string; campo?: keyof Rascunho } {
  if (!r.nome.trim()) return { erro: "Escreve um nome para a modalidade.", campo: "nome" };
  const valor = lerValorEuro(r.valor);
  if (valor === null) return { erro: "Indica o valor mensal (ex.: 20).", campo: "valor" };
  const valorInfantil = r.valorInfantil.trim() ? lerValorEuro(r.valorInfantil) : null;
  if (r.valorInfantil.trim() && valorInfantil === null) {
    return { erro: "Valor para menores de 16 inválido.", campo: "valorInfantil" };
  }
  return {
    dados: { nome: r.nome.trim(), valor, valorInfantil, grupoId: r.grupoId, descontaNoutroLocal: r.desconta },
  };
}

function descreverPreco(m: Modalidade): string {
  const base = `${formatarEuro(m.valor)}/mês`;
  if (m.valor_infantil === null || m.valor_infantil === m.valor) return base;
  return `${base} · ${formatarEuro(m.valor_infantil)} menores de 16`;
}

export function ModalidadesView({ modalidades: doServidor, contagens, grupos }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const grupoPadraoId = grupos.find((g) => g.padrao)?.id ?? grupos[0]?.id ?? "";
  const VAZIO: Rascunho = { nome: "", valor: "", valorInfantil: "", grupoId: grupoPadraoId, desconta: false };
  const variosLocais = grupos.length > 1;
  const opcoesLocal = grupos.map((g) => ({ id: g.id, nome: g.nome, ativo: true }));
  const nomeLocal = (id: string) => grupos.find((g) => g.id === id)?.nome ?? "";

  const [modalidades, setModalidades] = useState(doServidor);
  useEffect(() => setModalidades(doServidor), [doServidor]);

  // Criar
  const [novo, setNovo] = useState<Rascunho>(() => VAZIO);
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState<{ msg: string; campo?: keyof Rascunho } | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const valorRef = useRef<HTMLInputElement>(null);
  const infantilRef = useRef<HTMLInputElement>(null);

  // Editar inline
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Rascunho>(VAZIO);
  const editNomeRef = useRef<HTMLInputElement>(null);

  // Estado por linha
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [erroLinha, setErroLinha] = useState<{ id: string; msg: string } | null>(null);

  useEffect(() => {
    if (editId) editNomeRef.current?.select();
  }, [editId]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  function mudarNovo<K extends keyof Rascunho>(campo: K, v: Rascunho[K]) {
    setNovo((r) => ({ ...r, [campo]: v }));
    if (erroCriar) setErroCriar(null);
  }

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    const { dados, erro, campo } = lerRascunho(novo);
    if (!dados) {
      setErroCriar({ msg: erro!, campo });
      const refs = { nome: nomeRef, valor: valorRef, valorInfantil: infantilRef } as const;
      if (campo && campo in refs) refs[campo as keyof typeof refs].current?.focus();
      return;
    }
    setCriando(true);
    setErroCriar(null);
    const r = await criarModalidade(dados);
    setCriando(false);
    if (!r.ok) {
      setErroCriar({ msg: r.erro ?? "Não foi possível criar a modalidade." });
      return;
    }
    setNovo(VAZIO);
    refresh();
  }

  function iniciarEdicao(m: Modalidade) {
    setErroLinha(null);
    setEditId(m.id);
    setEdit({
      nome: m.nome, valor: valorParaInput(m.valor), valorInfantil: valorParaInput(m.valor_infantil),
      grupoId: m.grupo_id, desconta: m.desconta_noutro_local,
    });
  }

  async function guardarEdicao(m: Modalidade) {
    const { dados, erro } = lerRascunho(edit);
    if (!dados) {
      setErroLinha({ id: m.id, msg: erro! });
      return;
    }
    setOcupadoId(m.id);
    setErroLinha(null);
    const r = await editarModalidade(m.id, dados);
    setOcupadoId(null);
    if (!r.ok) {
      setErroLinha({ id: m.id, msg: r.erro ?? "Não foi possível guardar." });
      return;
    }
    setModalidades((prev) =>
      prev.map((x) => (x.id === m.id
        ? {
          ...x, nome: dados.nome, valor: dados.valor, valor_infantil: dados.valorInfantil,
          grupo_id: dados.grupoId, desconta_noutro_local: dados.descontaNoutroLocal,
        }
        : x)),
    );
    setEditId(null);
    refresh();
  }

  async function alternarAtivo(m: Modalidade, ativo: boolean) {
    setErroLinha(null);
    setOcupadoId(m.id);
    setModalidades((prev) => prev.map((x) => (x.id === m.id ? { ...x, ativo } : x)));
    const r = await definirModalidadeAtiva(m.id, ativo);
    setOcupadoId(null);
    if (!r.ok) {
      setModalidades((prev) => prev.map((x) => (x.id === m.id ? { ...x, ativo: !ativo } : x)));
      setErroLinha({ id: m.id, msg: r.erro ?? "Não foi possível alterar o estado." });
      return;
    }
    refresh();
  }

  async function handleApagar(m: Modalidade) {
    if (!window.confirm(`Apagar a modalidade "${m.nome}"?`)) return;
    setErroLinha(null);
    setOcupadoId(m.id);
    const r = await apagarModalidade(m.id);
    setOcupadoId(null);
    if (!r.ok) {
      setErroLinha({ id: m.id, msg: r.erro ?? "Não foi possível apagar." });
      return;
    }
    setModalidades((prev) => prev.filter((x) => x.id !== m.id));
    refresh();
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Modalidades</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          O valor é sugerido ao inscrever um aluno. Cada aluno pode ter um valor próprio na ficha — mudar aqui não altera quem já está inscrito.
        </p>
      </div>

      {/* Criar */}
      <form onSubmit={handleCriar} noValidate className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-900">Nova modalidade</p>
        <div className="space-y-1.5">
          <label htmlFor="mod-nome" className="text-sm font-medium text-gray-700">Nome</label>
          <Input
            ref={nomeRef}
            id="mod-nome"
            value={novo.nome}
            onChange={(e) => mudarNovo("nome", e.target.value)}
            placeholder="Ex.: Capoeira"
            maxLength={NOME_MAX}
            disabled={criando}
            aria-invalid={erroCriar?.campo === "nome"}
            className="h-10 rounded-xl border-gray-200"
          />
        </div>
        {variosLocais && (
          <div className="space-y-1.5">
            <p id="mod-local-label" className="text-sm font-medium text-gray-700">Local</p>
            <GrupoPicker
              id="mod-local"
              labelledBy="mod-local-label"
              grupos={opcoesLocal}
              value={novo.grupoId}
              onChange={(v) => mudarNovo("grupoId", v)}
              disabled={criando}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="mod-valor" className="text-sm font-medium text-gray-700">Valor mensal</label>
            <EuroInput
              ref={valorRef}
              id="mod-valor"
              value={novo.valor}
              onChange={(e) => mudarNovo("valor", e.target.value)}
              placeholder="Ex.: 20"
              disabled={criando}
              aria-invalid={erroCriar?.campo === "valor"}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="mod-infantil" className="text-sm font-medium text-gray-700">Menores de 16</label>
            <EuroInput
              ref={infantilRef}
              id="mod-infantil"
              value={novo.valorInfantil}
              onChange={(e) => mudarNovo("valorInfantil", e.target.value)}
              placeholder="Igual"
              disabled={criando}
              aria-invalid={erroCriar?.campo === "valorInfantil"}
              aria-describedby="mod-infantil-ajuda"
            />
          </div>
        </div>
        <p id="mod-infantil-ajuda" className="text-xs text-gray-500">
          Deixa &ldquo;Menores de 16&rdquo; vazio se o valor for o mesmo para todos.
        </p>
        {variosLocais && (
          <CheckboxDesconto
            id="mod-desconta"
            checked={novo.desconta}
            onChange={(v) => mudarNovo("desconta", v)}
            disabled={criando}
          />
        )}
        {erroCriar && (
          <p role="alert" className="text-sm text-red-600">{erroCriar.msg}</p>
        )}
        <Button
          type="submit"
          disabled={criando}
          className="h-10 w-full sm:w-auto rounded-xl bg-gb-blue hover:bg-gb-blue-dark text-white"
        >
          <Plus size={16} className="mr-1" />
          {criando ? "A criar…" : "Criar modalidade"}
        </Button>
      </form>

      {/* Lista */}
      {modalidades.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-6 py-12 text-center">
          <Shapes size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">Ainda não há modalidades</p>
          <p className="text-sm text-gray-500 mt-1">Cria a primeira acima — por exemplo &ldquo;Jiu-Jitsu&rdquo;.</p>
        </div>
      ) : (
        <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {modalidades.map((m) => {
            const c = contagens[m.id] ?? { alunos: 0, ativos: 0, turmas: 0 };
            const inativos = c.alunos - c.ativos;
            const ocupado = ocupadoId === m.id;
            const podeApagar = !m.padrao && c.alunos === 0 && c.turmas === 0;

            return (
              <li key={m.id} className="px-4 py-3.5">
                {editId === m.id ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); guardarEdicao(m); }}
                    onKeyDown={(e) => { if (e.key === "Escape") setEditId(null); }}
                    className="space-y-3"
                    noValidate
                  >
                    <Input
                      ref={editNomeRef}
                      value={edit.nome}
                      onChange={(e) => setEdit((r) => ({ ...r, nome: e.target.value }))}
                      maxLength={NOME_MAX}
                      disabled={ocupado}
                      aria-label="Nome da modalidade"
                      className="h-10 rounded-xl border-gray-200"
                    />
                    {variosLocais && (
                      <GrupoPicker
                        id={`el-${m.id}`}
                        grupos={opcoesLocal}
                        value={edit.grupoId}
                        onChange={(v) => setEdit((r) => ({ ...r, grupoId: v }))}
                        disabled={ocupado}
                      />
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label htmlFor={`ev-${m.id}`} className="text-xs font-medium text-gray-600">Valor mensal</label>
                        <EuroInput
                          id={`ev-${m.id}`}
                          value={edit.valor}
                          onChange={(e) => setEdit((r) => ({ ...r, valor: e.target.value }))}
                          disabled={ocupado}
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`ei-${m.id}`} className="text-xs font-medium text-gray-600">Menores de 16</label>
                        <EuroInput
                          id={`ei-${m.id}`}
                          value={edit.valorInfantil}
                          onChange={(e) => setEdit((r) => ({ ...r, valorInfantil: e.target.value }))}
                          placeholder="Igual"
                          disabled={ocupado}
                        />
                      </div>
                    </div>
                    {variosLocais && (
                      <CheckboxDesconto
                        id={`ed-${m.id}`}
                        checked={edit.desconta}
                        onChange={(v) => setEdit((r) => ({ ...r, desconta: v }))}
                        disabled={ocupado}
                      />
                    )}
                    <div className="flex gap-2">
                      <Button type="submit" disabled={ocupado} className="h-9 rounded-xl bg-gb-blue hover:bg-gb-blue-dark text-white">
                        <Check size={15} className="mr-1" />
                        {ocupado ? "A guardar…" : "Guardar"}
                      </Button>
                      <Button type="button" variant="outline" disabled={ocupado} onClick={() => setEditId(null)} className="h-9 rounded-xl">
                        <X size={15} className="mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className={cn("font-semibold truncate", m.ativo ? "text-gray-900" : "text-gray-500")}>{m.nome}</p>
                        {m.padrao && (
                          <span className="shrink-0 rounded-full bg-gb-blue/10 px-2 py-0.5 text-xs font-semibold text-gb-blue">Padrão</span>
                        )}
                        {!m.ativo && (
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">Inativa</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5 tabular-nums">
                        {variosLocais && <span className="font-medium">{nomeLocal(m.grupo_id)} · </span>}
                        {descreverPreco(m)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {c.alunos === 0 ? (
                          "Sem alunos"
                        ) : (
                          <Link
                            href={`/admin/alunos?modalidade=${m.id}`}
                            className="underline-offset-2 hover:text-gb-blue hover:underline"
                          >
                            {c.ativos} aluno{c.ativos === 1 ? "" : "s"} ativo{c.ativos === 1 ? "" : "s"}
                            {inativos > 0 && ` · ${inativos} inativo${inativos === 1 ? "" : "s"}`}
                          </Link>
                        )}
                        {" · "}
                        {c.turmas === 0 ? "sem turmas" : `${c.turmas} turma${c.turmas === 1 ? "" : "s"}`}
                      </p>
                      {m.padrao && <p className="text-xs text-gray-500">Novos registos feitos na app entram aqui.</p>}
                      {m.desconta_noutro_local && (
                        <p className="text-xs text-green-700">
                          Quem também treina noutro local paga isto no {nomeLocal(m.grupo_id)} e recebe-o como desconto.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={m.ativo}
                        onCheckedChange={(v) => alternarAtivo(m, v)}
                        disabled={m.padrao || ocupado}
                        aria-label={`${m.ativo ? "Desativar" : "Ativar"} modalidade ${m.nome}`}
                        title={m.padrao ? "A modalidade padrão está sempre ativa" : m.ativo ? "Ativa" : "Inativa"}
                        className="mr-1"
                      />
                      <button
                        type="button"
                        onClick={() => iniciarEdicao(m)}
                        disabled={ocupado}
                        aria-label={`Editar ${m.nome}`}
                        title="Editar"
                        className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      {podeApagar ? (
                        <button
                          type="button"
                          onClick={() => handleApagar(m)}
                          disabled={ocupado}
                          aria-label={`Apagar ${m.nome}`}
                          title="Apagar"
                          className="p-2 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        <span aria-hidden className="w-[31px]" />
                      )}
                    </div>
                  </div>
                )}

                {erroLinha?.id === m.id && (
                  <p role="alert" className="mt-2 text-sm text-red-600">{erroLinha.msg}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** "Quem também treina noutro local recebe este valor como desconto" */
function CheckboxDesconto({
  id, checked, onChange, disabled,
}: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gb-blue focus:ring-gb-blue/30"
      />
      <span className="text-sm text-gray-700">
        Desconto noutro local
        <span className="block text-xs text-gray-500">
          Se o aluno também treinar noutro local, este valor passa a ser pago aqui diretamente e entra como desconto na mensalidade.
        </span>
      </span>
    </label>
  );
}
