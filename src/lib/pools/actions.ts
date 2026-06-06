"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { nanoid } from "nanoid";

import { createClient } from "@/lib/supabase/server";
import { createPoolSchema } from "@/lib/validations";

export type PoolActionState = { error: string } | null;

/** Longitud del código de invitación (nanoid criptográficamente seguro). */
const INVITE_CODE_LENGTH = 10;

export async function createPool(
  _prev: PoolActionState,
  formData: FormData,
): Promise<PoolActionState> {
  const parsed = createPoolSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Nombre inválido" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const inviteCode = nanoid(INVITE_CODE_LENGTH);

  const { data: pool, error: poolError } = await supabase
    .from("pools")
    .insert({
      name: parsed.data.name,
      created_by: user.id,
      invite_code: inviteCode,
    })
    .select("id")
    .single();

  if (poolError || !pool) {
    return { error: "No se pudo crear la polla" };
  }

  // El creador se une automáticamente.
  const { error: memberError } = await supabase
    .from("pool_members")
    .insert({ pool_id: pool.id, user_id: user.id });

  if (memberError) {
    return { error: "Polla creada pero no se pudo unir al creador" };
  }

  revalidatePath("/dashboard");
  redirect(`/pool/${pool.id}`);
}

export async function joinPool(inviteCode: string): Promise<PoolActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // join_pool_by_code es SECURITY DEFINER: puede ver pollas ajenas para
  // resolver el invite_code sin exponer todos los códigos (RLS queda activo
  // para cualquier otra consulta).
  const { data: poolId, error } = await supabase.rpc("join_pool_by_code", {
    p_invite_code: inviteCode,
  });

  if (error || !poolId) {
    return { error: "Código de invitación inválido" };
  }

  revalidatePath("/dashboard");
  redirect(`/pool/${poolId}`);
}

/**
 * Elimina una polla. Solo el creador puede hacerlo, y puede hacerlo siempre
 * (con o sin otros participantes). El borrado cascada limpia membresías y
 * puntajes; las predicciones son globales y sobreviven. Validación y delete
 * son atómicos dentro de la RPC delete_pool (SECURITY DEFINER).
 */
export async function deletePool(poolId: string): Promise<PoolActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.rpc("delete_pool", { p_pool_id: poolId });

  if (error) {
    if (error.message.includes("not authorized")) return { error: "No tienes permiso" };
    if (error.message.includes("pool not found")) return { error: "Polla no encontrada" };
    if (error.message.includes("has scores")) {
      return { error: "No se puede eliminar: ya hay participantes con puntos" };
    }
    return { error: "No se pudo eliminar la polla" };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** Variante para usar desde un <form action> con FormData. */
export async function joinPoolFromForm(
  _prev: PoolActionState,
  formData: FormData,
): Promise<PoolActionState> {
  const code = String(formData.get("inviteCode") ?? "").trim();
  if (!code) return { error: "Ingresa un código" };
  return joinPool(code);
}
