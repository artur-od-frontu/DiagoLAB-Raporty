import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { PLANS, BRAND } from "@/config/brand";
import { parseBody, checkoutSchema } from "@/lib/validation";
import { createCheckoutSession, isPaymentsConfigured } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * POST /api/checkout { planId }
 * Tworzy sesję Stripe Checkout lub aktywuje pakiet w trybie DEV.
 * Ceny i limity pochodzą z konfiguracji serwerowej, nie z klienta.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  const parsed = parseBody(checkoutSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const plan = PLANS.find((p) => p.id === parsed.data.planId);
  if (!plan) return NextResponse.json({ error: "Nieznany pakiet." }, { status: 400 });
  if (plan.pricePLN === 0) return NextResponse.json({ error: "Pakiet START jest darmowy." }, { status: 400 });

  const baseUrl = BRAND.appUrl;
  const result = await createCheckoutSession(
    user.id,
    user.email,
    plan,
    `${baseUrl}/panel/abonament?status=ok`,
    `${baseUrl}/panel/abonament?status=cancelled`
  );

  if (result.devMode) {
    return NextResponse.json({
      ok: true,
      mode: "dev",
      transactionId: result.transactionId,
      message: `Pakiet ${plan.name} aktywowany w trybie DEV (brak STRIPE_SECRET_KEY).`,
    });
  }

  return NextResponse.json({
    ok: true,
    mode: "stripe",
    checkoutUrl: result.url,
    transactionId: result.transactionId,
  });
}
