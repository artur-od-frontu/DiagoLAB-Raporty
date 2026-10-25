/**
 * DiagoLAB Raporty+ — schemat bazy danych (PostgreSQL / Drizzle ORM)
 * ==================================================================
 * Model danych obejmuje: konta i weryfikacje, profil instalatora,
 * klientów i obiekty, raporty z integralnością źródeł, historię
 * pomiarów (Smart Compare+), pakiety/płatności oraz logi audytowe.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  doublePrecision,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AccountStatus } from "@/config/brand";

/* ---------------- Konta i bezpieczeństwo ---------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    phone: text("phone"),
    status: text("status").$type<AccountStatus>().notNull().default("NIEZWERYFIKOWANE"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    /** Model "jeden pełny raport gratis" — wykorzystanie zapisywane serwerowo */
    freeReportUsedAt: timestamp("free_report_used_at", { withTimezone: true }),
    failedLogins: integer("failed_logins").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    /** Sygnatura ostatniej aktywności — sesja wygasa wyłącznie po bezczynności */
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    /** Twardy limit absolutny sesji (30 dni) — niezależny od licznika bezczynności */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)]
);

/* ---------------- Wersje robocze dokumentów ---------------- */

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"IMPORT" | "RAPORT">().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    sourceFileName: text("source_file_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("drafts_user_idx").on(t.userId), index("drafts_kind_idx").on(t.userId, t.kind)]
);

export const verificationCodes = pgTable(
  "verification_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").$type<"email" | "sms">().notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("vcodes_user_idx").on(t.userId)]
);

/* ---------------- Profil instalatora ---------------- */

export const installerProfiles = pgTable("installer_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  nip: text("nip"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  /** Nr świadectwa — nigdy nie generowany przez AI; wpisuje instalator */
  certificateNo: text("certificate_no"),
  qualificationScope: text("qualification_scope"),
  certificateValidUntil: date("certificate_valid_until"),
  logoPath: text("logo_path"),
  /** Logo firmy osadzone jako data URL (PNG/JPEG/SVG, ≤ 512 KB) — trafia do raportu i PDF. */
  logoData: text("logo_data"),
  logoMime: text("logo_mime"),
  signaturePath: text("signature_path"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------- Klienci i obiekty ---------------- */

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nip: text("nip"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clients_user_idx").on(t.userId)]
);

export const objects = pgTable(
  "objects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    address: text("address"),
    type: text("type"),
    nextInspectionAt: date("next_inspection_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("objects_user_idx").on(t.userId)]
);

/* ---------------- Raporty ---------------- */

export type ReportStatus = "SZKIC" | "DO_ZATWIERDZENIA" | "ZATWIERDZONY";

export interface StoredReportData {
  meta: Record<string, unknown>;
  points: unknown[];
  analysis: unknown;
}

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    objectId: uuid("object_id").references(() => objects.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    status: text("status").$type<ReportStatus>().notNull().default("SZKIC"),
    /** Źródło danych — integralność */
    sourceFileName: text("source_file_name"),
    sourceSha256: text("source_sha256"),
    sourceRows: integer("source_rows"),
    algorithmVersion: text("algorithm_version"),
    criteriaSet: text("criteria_set"),
    /** Ten sam model danych zasila HTML i PDF */
    data: jsonb("data").$type<StoredReportData>(),
    assessment: text("assessment").$type<"POZYTYWNA" | "WARUNKOWA" | "NEGATYWNA" | null>(),
    dataVerifiedConfirmed: text("data_verified_confirmed"), // ISO timestamp potwierdzenia weryfikacji
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reports_number_uq").on(t.number), index("reports_user_idx").on(t.userId)]
);

/** Historia decyzji o ostrzeżeniach (akceptacja / odrzucenie / edycja + uzasadnienie) */
export const findingDecisions = pgTable(
  "finding_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
    findingKey: text("finding_key").notNull(),
    decision: text("decision").$type<"ACCEPTED" | "REJECTED" | "EDITED">().notNull(),
    note: text("note"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fdecisions_report_idx").on(t.reportId)]
);

/* ---------------- Historia pomiarów (Smart Compare+) ---------------- */

export const measurementHistory = pgTable(
  "measurement_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    objectId: uuid("object_id").notNull().references(() => objects.id, { onDelete: "cascade" }),
    reportId: uuid("report_id").references(() => reports.id, { onDelete: "set null" }),
    pointKey: text("point_key").notNull(),
    metric: text("metric").notNull(), // ZS | RISO | CONTINUITY | RCD_TIME | RCD_CURRENT
    value: doublePrecision("value"),
    measuredAt: date("measured_at").notNull(),
  },
  (t) => [index("mhist_object_idx").on(t.objectId), index("mhist_point_idx").on(t.pointKey)]
);

/* ---------------- Pakiety, płatności, limity ---------------- */

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull(),
    status: text("status").$type<"AKTYWNY" | "WYGASLY" | "ANULOWANY">().notNull().default("AKTYWNY"),
    reportsLimit: integer("reports_limit"),
    reportsUsed: integer("reports_used").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
  },
  (t) => [index("subs_user_idx").on(t.userId)]
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull(),
    amountGr: integer("amount_gr").notNull(),
    currency: text("currency").notNull().default("PLN"),
    provider: text("provider"), // np. stripe / payu — integracja serwerowa
    providerRef: text("provider_ref"),
    status: text("status").$type<"NOWA" | "OPLACONA" | "ODRZUCONA" | "ZWROT">().notNull().default("NOWA"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tx_user_idx").on(t.userId)]
);

/* ---------------- Logi audytowe ---------------- */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    meta: jsonb("meta"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_user_idx").on(t.userId)]
);
