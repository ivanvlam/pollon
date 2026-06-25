/**
 * Trae TODAS las filas de una query de Supabase paginando de a 1000.
 *
 * PostgREST corta los resultados en 1000 filas por defecto (`Content-Range:
 * 0-999/*`), truncando en orden físico. Las páginas que leen predicciones o
 * scores de muchos partidos/usuarios superan ese tope y perdían filas
 * silenciosamente —típicamente las creadas más recientemente—. Síntomas: una
 * predicción guardada que aparece como "sin predicción", o un contador (p. ej.
 * el total de predicciones del panel admin) clavado en 1000.
 *
 * `makePage` recibe el rango [from, to] y debe devolver la query con
 * `.range(from, to)` aplicado y un `.order(...)` de orden TOTAL y estable
 * (una columna única, o varias que en conjunto lo sean) para que la paginación
 * no salte ni duplique filas entre páginas.
 *
 * @example
 * const rows = await fetchAllRows<{ user_id: string }>((from, to) =>
 *   supabase.from("predictions").select("user_id").order("id").range(from, to),
 * );
 */
export async function fetchAllRows<T>(
  makePage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makePage(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}
