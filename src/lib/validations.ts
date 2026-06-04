import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  displayName: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(40, "El nombre es demasiado largo"),
});

export const createPoolSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe un nombre de al menos 2 caracteres")
    .max(60, "El nombre es demasiado largo (máximo 60 caracteres)"),
});

export const predictionSchema = z
  .object({
    matchId: z.string().uuid(),
    predictedHome: z.number().int().min(0).max(99),
    predictedAway: z.number().int().min(0).max(99),
    predictedWinner: z.enum(["home", "away"]).optional(),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreatePoolInput = z.infer<typeof createPoolSchema>;
export type PredictionInput = z.infer<typeof predictionSchema>;
