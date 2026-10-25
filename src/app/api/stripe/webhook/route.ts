import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * POST /api/stripe/webhook — odbiór zdarzeń Stripe (checkout.session.completed).
 * Endpoint publiczny — sygnatura weryfikowana po stronie Stripe SDK.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Brak sygnatury." }, { status: 400 });

  const result = await handleStripeWebhook(body, sig);
  if (!result.ok) {
    console.error("[stripe:webhook]", result.error);
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ received: true });
}
