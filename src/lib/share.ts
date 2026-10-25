/**
 * Tokeny udostępniania raportów (serwer-only).
 * Stateless: HMAC-SHA256(reportId, sekret) — brak dodatkowej tabeli.
 * Link publiczny /r/[id]?t=… daje WYŁĄCZNIE podgląd do odczytu.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  return process.env.SHARE_TOKEN_SECRET ?? process.env.AUTH_SECRET ?? process.env.DATABASE_URL ?? "diagolab-dev-share-secret";
}

export function computeShareToken(reportId: string): string {
  return createHmac("sha256", secret()).update(`report:${reportId}`).digest("hex").slice(0, 32);
}

export function verifyShareToken(reportId: string, token: string | null | undefined): boolean {
  if (!token || !/^[0-9a-f]{32}$/.test(token)) return false;
  const expected = Buffer.from(computeShareToken(reportId), "utf8");
  const given = Buffer.from(token, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function shareUrl(baseUrl: string, reportId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/r/${reportId}?t=${computeShareToken(reportId)}`;
}
