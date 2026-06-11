"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, UserPlus, ChevronRight, User, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { labelCorFaixa } from "@/lib/utils";
import type { Profile, CorFaixa, StatusAluno, CategoriaFaixa } from "@/lib/types";

const FAIXA_BG: Record<CorFaixa, string> = {
  branca:         "bg-white border border-gray-300",
  cinza_branca:   "bg-gray-300",
  cinza:          "bg-gray-400",
  cinza_preta:    "bg-gray-500",
  amarela_branca: "bg-yellow-200",
  amarela:        "bg-yellow-400",
  amarela_preta:  "bg-yellow-500",
  laranja_branca: "bg-orange-300",
  laranja:        "bg-orange-500",
  laranja_preta:  "bg-orange-600",
  verde_branca:   "bg-green-400",
  verde:          "bg-green-600",
  verde_preta:    "bg-green-700",
  azul:           "bg-blue-600",
  roxa:           "bg-purple-700",
  marrom:         "bg-amber-800",
  preta:          "bg-gray-900",
  coral:          "bg-red-400",
  vermelha:       "bg-red-600",
};

const STATUS_VARIANT: Record<StatusAluno, "success" | "destructive" | "warning"> = {
  ativo: "success", inativo: "destructive", trancado: "warning",
};

const STATUS_LABEL: Record<StatusAluno, string> = {
  ativo: "Ativo", inativo: "Inativo", trancado: "Trancado",
};

const PERFIL_LABEL: Record<string, string> = {
  aluno: "Aluno", professor: "Professor", admin: "Admin",
};

const PAGE_SIZE = 20;

interface Props {
  alunos: Profile[];
  responsaveisMap: Record<string, string>;
}

export function AlunosView({ alunos, responsaveisMap }: Props) {
  const [lista, setLista] = useState<Profile[]>(alunos);
  const [busca, setBusca] = useState("");
  const [tabAtiva, setTabAtiva] = useState<"ativos" | "inativos">("ativos");
  const [filtroFaixa, setFiltroFaixa] = useState<CorFaixa | "">("");
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaFaixa | "">("");
  const [filtroPerfil, setFiltroPerfil] = useState<string>("");
  const [pagina, setPagina] = useState(1);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  async function handleExcluir(e: React.MouseEvent, aluno: Profile) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Excluir permanentemente "${aluno.nome_completo}"? Esta ação não pode ser desfeita.`)) return;
    setExcluindoId(aluno.id);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: aluno.id }),
      });
      const json = await res.json() as { ok: boolean; erro?: string };
      if (!json.ok) {
        alert(`Erro ao excluir: ${json.erro ?? "desconhecido"}`);
      } else {
        setLista((prev) => prev.filter((p) => p.id !== aluno.id));
      }
    } catch {
      alert("Erro de rede ao excluir.");
    } finally {
      setExcluindoId(null);
    }
  }

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return lista.filter((a) => {
      if (q && !a.nome_completo.toLowerCase().includes(q)) return false;
      if (tabAtiva === "ativos") {
        if (a.status !== "ativo") return false;
      } else {
        if (a.status !== "inativo" && a.status !== "trancado") return false;
      }
      if (filtroPerfil && a.perfil !== filtroPerfil) return false;
      if (filtroFaixa && a.faixa !== filtroFaixa) return false;
      if (filtroCategoria && a.categoria !== filtroCategoria) return false;
      return true;
    });
  }, [lista, busca, tabAtiva, filtroPerfil, filtroFaixa, filtroCategoria]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const slice = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  function resetPagina() { setPagina(1); }

  const selectClass = "h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue";

  // Collect unique belts present in the list for the filter dropdown
  const faixasPresentes = useMemo(() => {
    const seen = new Set<CorFaixa>();
    lista.forEach((a) => { if (a.faixa) seen.add(a.faixa); });
    return Array.from(seen);
  }, [lista]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cadastros</h1>
          <p className="text-sm text-gray-500">{lista.length} registados</p>
        </div>
        <Link
          href="/admin/alunos/novo"
          className="inline-flex items-center gap-2 bg-gb-blue hover:bg-gb-blue-dark text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <UserPlus size={16} />
          Novo cadastro
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["ativos", "inativos"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => { setTabAtiva(tab); resetPagina(); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors capitalize ${
              tabAtiva === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "ativos" ? "Ativos" : "Inativos"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Pesquisar..."
            value={busca}
            onChange={(e) => { setBusca(e.target.value); resetPagina(); }}
            className="pl-9 h-9 rounded-xl border-gray-200"
          />
        </div>

        <select
          title="Filtrar por perfil"
          value={filtroPerfil}
          onChange={(e) => { setFiltroPerfil(e.target.value); resetPagina(); }}
          className={selectClass}
        >
          <option value="">Todos os perfis</option>
          <option value="aluno">Aluno</option>
          <option value="professor">Professor</option>
          <option value="admin">Admin</option>
        </select>

        <select
          title="Filtrar por faixa"
          value={filtroFaixa}
          onChange={(e) => { setFiltroFaixa(e.target.value as CorFaixa | ""); resetPagina(); }}
          className={selectClass}
        >
          <option value="">Todas as faixas</option>
          {faixasPresentes.map((f) => (
            <option key={f} value={f}>{labelCorFaixa(f)}</option>
          ))}
        </select>

        <select
          title="Filtrar por categoria"
          value={filtroCategoria}
          onChange={(e) => { setFiltroCategoria(e.target.value as CategoriaFaixa | ""); resetPagina(); }}
          className={selectClass}
        >
          <option value="">Todas as categorias</option>
          <option value="adulto">Adulto</option>
          <option value="infantil">Infantil</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {slice.length === 0 ? (
          <div className="p-12 text-center">
            <User size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Nenhum cadastro encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {slice.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                {/* Avatar */}
                <Link href={`/admin/alunos/${a.id}`} className="w-10 h-10 rounded-full bg-gb-blue flex items-center justify-center shrink-0 overflow-hidden">
                  {a.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.foto_url} alt={a.nome_completo} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-sm">
                      {a.nome_completo.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                    </span>
                  )}
                </Link>

                {/* Info */}
                <Link href={`/admin/alunos/${a.id}`} className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{a.nome_completo}</p>
                    {responsaveisMap[a.id] && (
                      <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                        Dep. de {responsaveisMap[a.id]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap min-w-0">
                    <Badge variant={STATUS_VARIANT[a.status]} className="text-xs py-0">
                      {STATUS_LABEL[a.status]}
                    </Badge>
                    {a.perfil !== "aluno" && (
                      <Badge variant="default" className="bg-gb-blue text-white text-xs py-0">
                        {PERFIL_LABEL[a.perfil] ?? a.perfil}
                      </Badge>
                    )}
                    {a.faixa && (
                      <span className="flex items-center gap-1">
                        <div className={`w-3 h-3 rounded-sm ${FAIXA_BG[a.faixa]}`} />
                        <span className="text-xs text-gray-500">{labelCorFaixa(a.faixa)}</span>
                      </span>
                    )}
                    <span className="text-xs text-gray-400 capitalize">{a.categoria}</span>
                  </div>
                </Link>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleExcluir(e, a)}
                    disabled={excluindoId === a.id}
                    title="Excluir aluno"
                    className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                  </button>
                  <Link href={`/admin/alunos/${a.id}`}>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={paginaAtual === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500">
            {paginaAtual} / {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={paginaAtual === totalPaginas}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            Próximo
          </button>
        </div>
      )}
    </div>
  );
}
