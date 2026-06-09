/**
 * Supabase/PostgREST limita cada pedido a 1000 linhas por defeito.
 * Esta função pagina automaticamente até obter todas as linhas.
 */
export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data } = await query(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}
