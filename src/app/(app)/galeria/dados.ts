import type { SupabaseServer } from "../ranking/dados";

export interface AlbumResumo {
  id: string;
  titulo: string;
  capa: string | null;
  total: number;
  created_at: string;
}

export async function carregarAlbuns(supabase: SupabaseServer): Promise<AlbumResumo[]> {
  const { data: albuns } = await supabase
    .from("albuns")
    .select("id, titulo, descricao, capa_url, created_at")
    .order("created_at", { ascending: false });

  const albumIds = (albuns ?? []).map((a) => a.id);
  const semCapa = (albuns ?? []).filter((a) => !a.capa_url).map((a) => a.id);

  const countMap = new Map<string, number>();
  const fallbackCoverMap = new Map<string, string>();

  if (albumIds.length > 0) {
    const { data: todasFotos } = await supabase
      .from("fotos")
      .select("album_id, url")
      .in("album_id", albumIds)
      .order("created_at", { ascending: true });

    for (const f of todasFotos ?? []) {
      countMap.set(f.album_id, (countMap.get(f.album_id) ?? 0) + 1);
      if (semCapa.includes(f.album_id) && !fallbackCoverMap.has(f.album_id)) {
        fallbackCoverMap.set(f.album_id, f.url);
      }
    }
  }

  return (albuns ?? []).map((a) => ({
    id: a.id,
    titulo: a.titulo,
    created_at: a.created_at,
    capa: a.capa_url ?? fallbackCoverMap.get(a.id) ?? null,
    total: countMap.get(a.id) ?? 0,
  }));
}
