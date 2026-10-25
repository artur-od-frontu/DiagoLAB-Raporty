/**
 * Schematy walidacji Zod — DiagoLAB Raporty+
 * ==========================================
 * Jedno źródło prawdy: każdy endpoint importuje schemat stąd.
 * Zod waliduje ZANIM dane trafią do bazy, silnika lub odpowiedzi.
 */

import { z } from "zod";

/* ---------- Auth ---------- */

export const registerSchema = z.object({
  email: z.string().email("Podaj poprawny adres e-mail.").max(255).transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, "Hasło musi mieć min. 8 znaków.").max(128),
  phone: z.string().regex(/^\+?[0-9\s-]{9,15}$/, "Podaj poprawny numer telefonu (9–15 cyfr).").transform((v) => v.replace(/[\s-]/g, "")),
});

export const loginSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Podaj hasło.").max(128),
});

export const verifyCodeSchema = z.object({
  userId: z.string().uuid("Nieprawidłowy identyfikator użytkownika."),
  channel: z.enum(["email", "sms"]),
  code: z.string().regex(/^\d{6}$/, "Kod musi składać się z 6 cyfr."),
});

export const resetRequestSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.trim().toLowerCase()),
});

export const resetConfirmSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.trim().toLowerCase()),
  code: z.string().regex(/^\d{6}$/, "Nieprawidłowy kod."),
  newPassword: z.string().min(8, "Nowe hasło musi mieć min. 8 znaków.").max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8, "Nowe hasło musi mieć min. 8 znaków.").max(128),
});

/* ---------- Profil ---------- */

export const profileSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  companyName: z.string().max(200).optional(),
  nip: z.string().regex(/^\d{10}$/, "NIP musi zawierać 10 cyfr.").optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional(),
  certificateNo: z.string().max(100).optional(),
  qualificationScope: z.string().max(200).optional(),
  certificateValidUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format daty: RRRR-MM-DD.").optional().or(z.literal("")),
}).transform((data) => {
  const clean: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(data)) {
    clean[k] = typeof v === "string" && v.trim() ? v.trim() : null;
  }
  if (clean.nip) clean.nip = clean.nip.replace(/[-\s]/g, "");
  return clean;
});

/* ---------- Raporty ---------- */

const protectionSchema = z.object({
  curve: z.enum(["B", "C", "D"]),
  inA: z.number().min(1).max(1000),
  rcdmA: z.number().min(1).max(10000).nullable().optional(),
});

const rawPointSchema = z.object({
  code: z.string().min(1).max(50),
  location: z.string().max(500),
  circuit: z.string().max(500),
  protection: protectionSchema,
  zsOhm: z.number().nullable().optional(),
  risoMOhm: z.number().nullable().optional(),
  continuityOhm: z.number().nullable().optional(),
  rcdTripMs: z.number().nullable().optional(),
  rcdTripmA: z.number().nullable().optional(),
});

export const createReportSchema = z.object({
  points: z.array(rawPointSchema).min(1, "Raport wymaga co najmniej 1 punktu pomiarowego.").max(2000, "Maksymalnie 2000 punktów."),
  sourceFileName: z.string().max(200).optional(),
  objectName: z.string().max(300).optional(),
  objectAddress: z.string().max(500).optional(),
  clientName: z.string().max(300).optional(),
  instrument: z.string().max(500).optional(),
});

export const approveReportSchema = z.object({
  assessment: z.enum(["POZYTYWNA", "WARUNKOWA", "NEGATYWNA"], {
    message: "Wybierz ocenę: POZYTYWNA, WARUNKOWA lub NEGATYWNA.",
  }),
  confirmDataVerification: z.literal(true, {
    message: "Zatwierdzenie wymaga potwierdzenia weryfikacji danych.",
  }),
});

export const decisionsSchema = z.object({
  decisions: z.record(
    z.string(),
    z.object({
      decision: z.enum(["ACCEPTED", "REJECTED", "EDITED"]),
      note: z.string().max(1000).optional(),
      edited: z.string().max(2000).optional(),
    })
  ),
});

/* ---------- Klienci ---------- */

export const createClientSchema = z.object({
  name: z.string().min(2, "Podaj nazwę klienta.").max(300),
  nip: z.string().regex(/^\d{10}$/, "NIP musi zawierać 10 cyfr.").optional().or(z.literal("")),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
});

/* ---------- Pakiety ---------- */

export const checkoutSchema = z.object({
  planId: z.string().min(1, "Wybierz pakiet."),
});

/* ---------- Konto ---------- */

export const deleteAccountSchema = z.object({
  confirmEmail: z.string().email(),
});

/* ---------- Helper ---------- */

export function parseBody<T>(schema: z.ZodType<T>, data: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  const msg = result.error.issues.map((i) => i.message).join(" ");
  return { ok: false, error: msg };
}
