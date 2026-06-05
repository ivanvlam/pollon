"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { nanoid } from "nanoid";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
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

  // Resolver el código con el service role: el cliente del usuario NO tiene
  // permiso de SELECT sobre pollas ajenas, así el invite_code no es
  // enumerable. Solo se expone el id de la polla cuyo código exacto se provee.
  const admin = createServiceRoleClient();
  const { data: pool, error: poolError } = await admin
    .from("pools")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (poolError || !pool) {
    return { error: "Código de invitación inválido" };
  }

  // upsert idempotente: si ya es miembro, no falla (unique pool_id+user_id).
  const { error: memberError } = await supabase
    .from("pool_members")
    .upsert(
      { pool_id: pool.id, user_id: user.id },
      { onConflict: "pool_id,user_id", ignoreDuplicates: true },
    );

  if (memberError) {
    return { error: "No se pudo unir a la polla" };
  }

  revalidatePath("/dashboard");
  redirect(`/pool/${pool.id}`);
}

/** Sale de una polla (borra la membresía propia; RLS lo permite). */
export async function leavePool(poolId: string): Promise<PoolActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("pool_members")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", user.id);

  if (error) return { error: "No se pudo salir de la polla" };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** Elimina una polla. Solo el creador puede hacerlo y únicamente si está solo. */
export async function deletePool(poolId: string): Promise<PoolActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: pool } = await supabase
    .from("pools")
    .select("created_by")
    .eq("id", poolId)
    .maybeSingle();

  if (!pool) return { error: "Polla no encontrada" };
  if (pool.created_by !== user.id) return { error: "No tienes permiso" };

  const { count } = await supabase
    .from("pool_members")
    .select("id", { count: "exact", head: true })
    .eq("pool_id", poolId);

  if ((count ?? 0) > 1) return { error: "No puedes eliminar una polla con más de un participante" };

  const { error } = await supabase.from("pools").delete().eq("id", poolId);
  if (error) return { error: "No se pudo eliminar la polla" };

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
