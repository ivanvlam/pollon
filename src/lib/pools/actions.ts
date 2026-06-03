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

  const { data: pool, error: poolError } = await supabase
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

/** Variante para usar desde un <form action> con FormData. */
export async function joinPoolFromForm(
  _prev: PoolActionState,
  formData: FormData,
): Promise<PoolActionState> {
  const code = String(formData.get("inviteCode") ?? "").trim();
  if (!code) return { error: "Ingresa un código" };
  return joinPool(code);
}
