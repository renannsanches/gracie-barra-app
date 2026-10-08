"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { apagarGrupo, criarGrupo, definirGrupoAtivo, renomearGrupo } from "./actions";
import type { GrupoAluno } from "@/lib/types";

export interface ContagemGrupo {
  total: number;
  ativos: number;
}

interface Props {
  grupos: GrupoAluno[];
  contagens: Record<string, ContagemGrupo>;
}

const NOME_MAX = 40;

export function GruposView({ grupos: gruposServidor, contagens }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Cópia local para o switch responder de imediato (rollback se a action falhar)
  const [grupos, setGrupos] = useState(gruposServidor);
  useEffect(() => setGrupos(gruposServidor), [gruposServidor]);

  // Criar
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState<string | null>(null);
  const novoInputRef = useRef<HTMLInputElement>(null);

  // Editar nome inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Estado por linha
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [erroLinha, setErroLinha] = useState<{ id: string; msg: string } | null>(null);

  useEffect(() => {
    if (editId) editInputRef.current?.select();
  }, [editId]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    const nome = novoNome.trim();
    if (!nome) {
      setErroCriar("Escreve um nome para o grupo.");
      novoInputRef.current?.focus();
      return;
    }
    setCriando(true);
    setErroCriar(null);
    const r = await criarGrupo(nome);
    setCriando(false);
    if (!r.ok) {
      setErroCriar(r.erro ?? "Não foi possível criar o grupo.");
      return;
    }
    setNovoNome("");
    refresh();
  }

  function iniciarEdicao(g: GrupoAluno) {
    setErroLinha(null);
    setEditId(g.id);
    setEditNome(g.nome);
  }

  function cancelarEdicao() {
    setEditId(null);
    setEditNome("");
  }

  async function guardarEdicao(g: GrupoAluno) {
    const nome = editNome.trim();
    if (nome === g.nome) {
      cancelarEdicao();
      return;
    }
    setGuardandoId(g.id);
    setErroLinha(null);
    const r = await renomearGrupo(g.id, nome);
    setGuardandoId(null);
    if (!r.ok) {
      setErroLinha({ id: g.id, msg: r.erro ?? "Não foi possível renomear." });
      return;
    }
    setGrupos((prev) => prev.map((x) => (x.id === g.id ? { ...x, nome } : x)));
    cancelarEdicao();
    refresh();
  }

  async function alternarAtivo(g: GrupoAluno, ativo: boolean) {
    setErroLinha(null);
    setOcupadoId(g.id);
    setGrupos((prev) => prev.map((x) => (x.id === g.id ? { ...x, ativo } : x)));
    const r = await definirGrupoAtivo(g.id, ativo);
    setOcupadoId(null);
    if (!r.ok) {
      setGrupos((prev) => prev.map((x) => (x.id === g.id ? { ...x, ativo: !ativo } : x)));
      setErroLinha({ id: g.id, msg: r.erro ?? "Não foi possível alterar o estado." });
      return;
    }
    refresh();
  }

  async function handleApagar(g: GrupoAluno) {
    if (!window.confirm(`Apagar o grupo "${g.nome}"?`)) return;
    setErroLinha(null);
    setOcupadoId(g.id);
    const r = await apagarGrupo(g.id);
    setOcupadoId(null);
    if (!r.ok) {
      setErroLinha({ id: g.id, msg: r.erro ?? "Não foi possível apagar." });
      return;
    }
    setGrupos((prev) => prev.filter((x) => x.id !== g.id));
    refresh();
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Grupos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Separa os alunos por local de treino — ex.: Academia, Colégio.
        </p>
      </div>

      {/* Criar */}
      <form onSubmit={handleCriar} className="space-y-1.5" noValidate>
        <label htmlFor="novo-grupo" className="text-sm font-medium text-gray-700">
          Novo grupo
        </label>
        <div className="flex gap-2">
          <Input
            ref={novoInputRef}
            id="novo-grupo"
            value={novoNome}
            onChange={(e) => {
              setNovoNome(e.target.value);
              if (erroCriar) setErroCriar(null);
            }}
            placeholder="Ex.: Colégio"
            maxLength={NOME_MAX}
            disabled={criando}
            aria-invalid={!!erroCriar}
            aria-describedby={erroCriar ? "novo-grupo-erro" : undefined}
            className="h-10 rounded-xl border-gray-200 bg-white"
          />
          <Button
            type="submit"
            disabled={criando}
            className="h-10 shrink-0 rounded-xl bg-gb-blue hover:bg-gb-blue-dark text-white"
          >
            <Plus size={16} className="mr-1" />
            {criando ? "A criar…" : "Criar"}
          </Button>
        </div>
        {erroCriar && (
          <p id="novo-grupo-erro" role="alert" className="text-sm text-red-600">
            {erroCriar}
          </p>
        )}
      </form>

      {/* Lista */}
      {grupos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 px-6 py-12 text-center">
          <Layers size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">Ainda não há grupos</p>
          <p className="text-sm text-gray-500 mt-1">
            Cria o primeiro acima — por exemplo &ldquo;Academia&rdquo; ou &ldquo;Colégio&rdquo;.
          </p>
        </div>
      ) : (
        <ul className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
          {grupos.map((g) => {
            const c = contagens[g.id] ?? { total: 0, ativos: 0 };
            const inativos = c.total - c.ativos;
            const emEdicao = editId === g.id;
            const ocupado = ocupadoId === g.id || guardandoId === g.id;
            const podeApagar = !g.padrao && c.total === 0;

            return (
              <li key={g.id} className="px-4 py-3.5">
                {emEdicao ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      guardarEdicao(g);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      ref={editInputRef}
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") cancelarEdicao();
                      }}
                      maxLength={NOME_MAX}
                      disabled={guardandoId === g.id}
                      aria-label={`Novo nome para ${g.nome}`}
                      className="h-9 rounded-xl border-gray-200"
                    />
                    <button
                      type="submit"
                      disabled={guardandoId === g.id || !editNome.trim()}
                      aria-label="Guardar nome"
                      className="p-2 rounded-lg text-green-700 hover:bg-green-50 disabled:opacity-40 transition-colors"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelarEdicao}
                      disabled={guardandoId === g.id}
                      aria-label="Cancelar edição"
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className={cn("font-semibold truncate", g.ativo ? "text-gray-900" : "text-gray-500")}>
                          {g.nome}
                        </p>
                        {g.padrao && (
                          <span className="shrink-0 rounded-full bg-gb-blue/10 px-2 py-0.5 text-xs font-semibold text-gb-blue">
                            Padrão
                          </span>
                        )}
                        {!g.ativo && (
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {c.total === 0 ? (
                          "Sem alunos"
                        ) : (
                          <Link
                            href={`/admin/alunos?grupo=${g.id}`}
                            className="underline-offset-2 hover:text-gb-blue hover:underline"
                          >
                            {c.ativos} aluno{c.ativos === 1 ? "" : "s"} ativo{c.ativos === 1 ? "" : "s"}
                            {inativos > 0 && ` · ${inativos} inativo${inativos === 1 ? "" : "s"}`}
                          </Link>
                        )}
                        {g.padrao && <span className="block text-xs">Novos registos feitos na app entram aqui.</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={g.ativo}
                        onCheckedChange={(v) => alternarAtivo(g, v)}
                        disabled={g.padrao || ocupado}
                        aria-label={`${g.ativo ? "Desativar" : "Ativar"} grupo ${g.nome}`}
                        title={g.padrao ? "O grupo padrão está sempre ativo" : g.ativo ? "Ativo" : "Inativo"}
                        className="mr-1"
                      />
                      <button
                        type="button"
                        onClick={() => iniciarEdicao(g)}
                        disabled={ocupado}
                        aria-label={`Renomear ${g.nome}`}
                        title="Renomear"
                        className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      {podeApagar ? (
                        <button
                          type="button"
                          onClick={() => handleApagar(g)}
                          disabled={ocupado}
                          aria-label={`Apagar ${g.nome}`}
                          title="Apagar"
                          className="p-2 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        // Mantém os controlos alinhados entre linhas
                        <span aria-hidden className="w-[31px]" />
                      )}
                    </div>
                  </div>
                )}

                {erroLinha?.id === g.id && (
                  <p role="alert" className="mt-2 text-sm text-red-600">
                    {erroLinha.msg}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
