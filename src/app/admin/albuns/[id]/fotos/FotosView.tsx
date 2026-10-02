"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Pencil, Check, X, ImageIcon, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadFotos, apagarFoto, editarLegenda, definirCapa } from "./fotos-actions";
import type { Foto, Album } from "@/lib/types";

interface Props {
  album: Album;
  fotos: Foto[];
}

export function FotosView({ album, fotos: initialFotos }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [capaUrl, setCapaUrl] = useState(album.capa_url);
  const [settingCapaId, setSettingCapaId] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadErros, setUploadErros] = useState<string[]>([]);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [legendaValue, setLegendaValue] = useState("");
  const [savingLegenda, setSavingLegenda] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";

    setUploading(true);
    setUploadErros([]);
    setUploadProgress(`A enviar ${files.length} foto${files.length !== 1 ? "s" : ""}…`);

    const fd = new FormData();
    files.forEach((f) => fd.append("fotos", f));

    const result = await uploadFotos(album.id, fd);

    setUploading(false);
    setUploadProgress(null);

    if (result.erros.length > 0) setUploadErros(result.erros);
    if (result.uploaded > 0) startTransition(() => router.refresh());
  }

  async function handleDelete(foto: Foto) {
    if (!window.confirm("Apagar esta foto? Esta ação não pode ser desfeita.")) return;
    setDeletingId(foto.id);
    await apagarFoto(foto.id, foto.url, album.id);
    if (capaUrl === foto.url) setCapaUrl(null);
    setDeletingId(null);
    startTransition(() => router.refresh());
  }

  async function handleDefinirCapa(foto: Foto) {
    setSettingCapaId(foto.id);
    const result = await definirCapa(album.id, foto.url);
    if (result.ok) setCapaUrl(foto.url);
    setSettingCapaId(null);
    startTransition(() => router.refresh());
  }

  function startEditLegenda(foto: Foto) {
    setEditingId(foto.id);
    setLegendaValue(foto.legenda ?? "");
  }

  function cancelEditLegenda() {
    setEditingId(null);
    setLegendaValue("");
  }

  async function saveLegenda(fotoId: string) {
    setSavingLegenda(true);
    await editarLegenda(fotoId, legendaValue, album.id);
    setSavingLegenda(false);
    setEditingId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/admin/albuns"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Álbuns
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900 text-xl">{album.titulo}</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {initialFotos.length} foto{initialFotos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-gb-blue hover:bg-gb-blue-dark text-white"
        >
          {uploading ? (
            <Loader2 size={16} className="mr-1 animate-spin" />
          ) : (
            <Plus size={16} className="mr-1" />
          )}
          {uploading ? "A enviar…" : "Adicionar Fotos"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadProgress && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          <Loader2 size={14} className="animate-spin shrink-0" />
          {uploadProgress}
        </div>
      )}

      {uploadErros.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1">
          {uploadErros.map((e, i) => (
            <p key={i} className="text-sm text-red-600">{e}</p>
          ))}
          <button
            type="button"
            onClick={() => setUploadErros([])}
            className="text-xs text-red-400 hover:text-red-600 mt-1"
          >
            Fechar
          </button>
        </div>
      )}

      {initialFotos.length === 0 && !uploading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <ImageIcon size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma foto neste álbum</p>
          <p className="text-gray-400 text-sm mt-1">Clica em &quot;Adicionar Fotos&quot; para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {initialFotos.map((foto) => {
            const isCapa = capaUrl === foto.url;
            return (
              <div
                key={foto.id}
                className={`group relative bg-white rounded-2xl overflow-hidden border-2 transition-colors ${
                  isCapa ? "border-amber-400 shadow-md shadow-amber-100" : "border-gray-100"
                }`}
              >
                <div className="relative aspect-square bg-gray-50">
                  <Image
                    src={foto.url}
                    alt={foto.legenda ?? "Foto"}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover"
                  />

                  {isCapa && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                      <Star size={9} fill="white" />
                      Capa
                    </div>
                  )}

                  <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      aria-label="Apagar foto"
                      onClick={() => handleDelete(foto)}
                      disabled={deletingId === foto.id}
                      className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {deletingId === foto.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                    </button>
                  </div>

                  {!isCapa && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleDefinirCapa(foto)}
                        disabled={settingCapaId === foto.id}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-2 py-1 rounded-full transition-colors"
                      >
                        {settingCapaId === foto.id ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Star size={10} />
                        )}
                        Definir como capa
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-2">
                  {editingId === foto.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={legendaValue}
                        onChange={(e) => setLegendaValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveLegenda(foto.id);
                          if (e.key === "Escape") cancelEditLegenda();
                        }}
                        disabled={savingLegenda}
                        placeholder="Legenda…"
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gb-blue/30 focus:border-gb-blue min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => saveLegenda(foto.id)}
                        disabled={savingLegenda}
                        className="p-1 rounded text-green-600 hover:bg-green-50 disabled:opacity-50"
                      >
                        {savingLegenda ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditLegenda}
                        disabled={savingLegenda}
                        className="p-1 rounded text-gray-400 hover:bg-gray-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditLegenda(foto)}
                      className="flex items-center gap-1 w-full text-left group/leg"
                    >
                      <span className="text-xs text-gray-500 truncate flex-1 group-hover/leg:text-gray-800 transition-colors">
                        {foto.legenda || <span className="text-gray-300 italic">Sem legenda</span>}
                      </span>
                      <Pencil size={10} className="text-gray-300 group-hover/leg:text-gray-500 shrink-0 transition-colors" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
