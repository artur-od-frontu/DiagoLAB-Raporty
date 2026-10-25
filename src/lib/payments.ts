/**
 * DiagoLAB Raporty+ — integracja płatności Stripe (serwer-only)
 * =============================================================
 * Sesja Checkout → webhook → aktywacja pakietu.
 * Bez STRIPE_SECRET_KEY działa w trybie symulacji DEV.
 */

import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, subscriptions, transactions } from "@/db/schema";
import { PLANS, type Plan } from "@/config/brand";
import { audit } from "@/lib/auth";
import { sendPackageActivated } from "@/lib/mailer";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function isPaymentsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  plan: Plan,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string | null; devMode: boolean; transactionId: string }> {
  // Rejestruj transakcję w bazie (niezależnie od trybu)
  const [tx] = await db
    .insert(transactions)
    .values({
      userId,
      planId: plan.id,
      amountGr: plan.pricePLN * 100,
      currency: "PLN",
      provider: isPaymentsConfigured() ? "stripe" : "dev-simulator",
      status: "NOWA",
    })
    .returning({ id: transactions.id });

  const stripe = getStripe();
  if (!stripe) {
    // Tryb DEV: natychmiastowa aktywacja bez płatności
    await activatePackage(userId, userEmail, plan, tx.id);
    return { url: null, devMode: true, transactionId: tx.id };
  }

  // Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    /* Stripe automatycznie pokaże metody płatności odpowiednie do kraju. */
    customer_email: userEmail,
    line_items: [
      {
        price_data: {
          currency: "pln",
          unit_amount: plan.pricePLN * 100,
          product_data: {
            name: `DiagoLAB Raporty+ — ${plan.name}`,
            description: `${plan.reportsIncluded} raportów · ważność ${plan.validityMonths} mies.`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      planId: plan.id,
      transactionId: tx.id,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  // Zaktualizuj transakcję o ID sesji Stripe
  await db
    .update(transactions)
    .set({ providerRef: session.id })
    .where(eq(transactions.id, tx.id));

  return { url: session.url, devMode: false, transactionId: tx.id };
}

export async function activatePackage(
  userId: string,
  userEmail: string,
  plan: Plan,
  transactionId: string
): Promise<void> {
  const validUntil = new Date();
  validUntil.setMonth(validUntil.getMonth() + plan.validityMonths);

  await db.insert(subscriptions).values({
    userId,
    planId: plan.id,
    status: "AKTYWNY",
    reportsLimit: plan.reportsIncluded,
    reportsUsed: 0,
    validUntil,
  });

  await db.update(users).set({ status: "AKTYWNE" }).where(eq(users.id, userId));
  await db.update(transactions).set({ status: "OPLACONA" }).where(eq(transactions.id, transactionId));

  await audit(userId, "package.activate", { planId: plan.id, reports: plan.reportsIncluded, transactionId });

  // Powiadomienie e-mail
  void sendPackageActivated(userEmail, plan.name, plan.reportsIncluded, validUntil.toLocaleDateString("pl-PL")).catch(() => {});
}

export async function handleStripeWebhook(body: string, signature: string): Promise<{ ok: boolean; error?: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe nie jest skonfigurowany." };

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return { ok: false, error: "Brak STRIPE_WEBHOOK_SECRET." };

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return { ok: false, error: `Weryfikacja sygnatury webhooków nie powiodła się: ${String(err)}` };
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, planId, transactionId } = session.metadata ?? {};
    if (!userId || !planId || !transactionId) return { ok: false, error: "Brak metadanych w sesji." };

    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) return { ok: false, error: `Nieznany pakiet: ${planId}.` };

    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u) return { ok: false, error: `Użytkownik ${userId} nie istnieje.` };

    await activatePackage(userId, u.email, plan, transactionId);
    return { ok: true };
  }

  return { ok: true }; // ignorujemy inne typy zdarzeń
}
