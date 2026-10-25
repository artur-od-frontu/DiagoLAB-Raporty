/**
 * DiagoLAB Raporty+ — Next.js Middleware
 * ======================================
 * 1. Security headers na każdej odpowiedzi.
 * 2. Rate limiting na endpointach auth (brute-force protection).
 * 3. CSRF: weryfikacja Origin na mutacjach POST/PUT/DELETE.
 */

import { NextResponse, type NextRequest } from "next/server";

/* ---------- Security Headers ---------- */

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/* ---------- Rate Limiting (in-memory, per IP) ---------- */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000; // 1 minuta
const RATE_LIMIT = 20; // max 20 żądań auth / minutę / IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT) return false;
  return true;
}

// Okresowe czyszczenie mapy (zapobiega wyciekom pamięci)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

/* ---------- Middleware ---------- */

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* 1. Rate limiting na endpointach auth */
  if (pathname.startsWith("/api/auth/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Zbyt wiele żądań. Spróbuj ponownie za minutę." },
        { status: 429, headers: { "Retry-After": "60", ...SECURITY_HEADERS } }
      );
    }
  }

  /* 2. CSRF: mutacje API muszą pochodzić z tej samej domeny */
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/stripe/webhook") && ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host) {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json(
          { error: "Niedozwolone żądanie z obcego źródła (CSRF)." },
          { status: 403, headers: SECURITY_HEADERS }
        );
      }
    }
  }

  /* 3. Security headers na każdej odpowiedzi */
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Wszystkie ścieżki oprócz plików statycznych Next.js i faviconów.
     * API, strony, panel — wszystko chronione headerami.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|samples/).*)",
  ],
};
