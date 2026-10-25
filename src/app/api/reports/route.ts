import { NextResponse } from "next/server";
import { eq, desc, and, ilike } from "drizzle-orm";
import { db } from "@/db";
import { reports, users, subscriptions, objects, clients, installerProfiles } from "@/db/schema";
import { getSessionUser, sha256, audit } from "@/lib/auth";
import { analyzePoints, type RawPoint, ALGORITHM_VERSION, CRITERIA_SET } from "@/lib/engine";

export const runtime = "nodejs";
const MAX_POINTS = 2000;

/** GET /api/reports — lista raportów zalogowanego użytkownika. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  const rows = await db
    .select({
      id: reports.id,
      number: reports.number,
      status: reports.status,
      createdAt: reports.createdAt,
      approvedAt: reports.approvedAt,
      sourceFileName: reports.sourceFileName,
      sourceRows: reports.sourceRows,
      objectId: reports.objectId,
    })
    .from(reports)
    .where(eq(reports.userId, user.id))
    .orderBy(desc(reports.createdAt))
    .limit(100);

  return NextResponse.json({ reports: rows, status: user.status });
}

/**
 * POST /api/reports — utworzenie raportu z zaimportowanych punktów.
 * Kontrola limitów WYŁĄCZNIE po stronie serwera. Automatycznie:
 *  - buduje pełne meta raportu (dane z profilu instalatora),
 *  - znajduje lub tworzy KLIENTA i OBIEKT (historia + Smart Compare+).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Wymagane zalogowanie." }, { status: 401 });

  let body: {
    points?: RawPoint[];
    sourceFileName?: string;
    objectName?: string;
    objectAddress?: string;
    clientName?: string;
    instrument?: string;
    instruments?: string[];
    inspectionChecklist?: Record<string, boolean | string>;
    weather?: string;
    globalZone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  const points = body.points;
  if (!Array.isArray(points) || points.length === 0 || points.length > MAX_POINTS) {
    return NextResponse.json({ error: `Raport wymaga od 1 do ${MAX_POINTS} punktów pomiarowych.` }, { status: 400 });
  }

  // --- Kontrola uprawnień i limitów (serwer) ---
  const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!u) return NextResponse.json({ error: "Konto nie istnieje." }, { status: 401 });
  if (u.status === "ZABLOKOWANE") return NextResponse.json({ error: "Konto zablokowane." }, { status: 403 });
  if (u.status === "NIEZWERYFIKOWANE") {
    return NextResponse.json({ error: "Potwierdź najpierw e-mail i numer telefonu.", code: "VERIFY_REQUIRED" }, { status: 403 });
  }
  if (u.status === "WYGASLE") {
    return NextResponse.json({ error: "Abonament wygasł — wykup pakiet, aby tworzyć raporty.", code: "PLAN_REQUIRED" }, { status: 402 });
  }

  if (u.status === "DEMO") {
    if (u.freeReportUsedAt) {
      return NextResponse.json({ error: "Darmowy raport został już wykorzystany. Wybierz pakiet, aby kontynuować.", code: "FREE_USED" }, { status: 402 });
    }
  } else if (u.status === "AKTYWNE") {
    // Model ilościowy: sprawdzamy pulę we wszystkich nieprzeterminowanych pakietach
    const packs = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id));
    const nowTs = new Date();
    const usable = packs.filter(
      (pk) => pk.status === "AKTYWNY" && (!pk.validUntil || pk.validUntil > nowTs) && (pk.reportsLimit ?? 0) > pk.reportsUsed
    );
    if (usable.length === 0) {
      const expired = packs.some((pk) => pk.validUntil && pk.validUntil <= nowTs && (pk.reportsLimit ?? 0) > pk.reportsUsed);
      return NextResponse.json(
        {
          error: expired
            ? "Ważność pakietu wygasła — niewykorzystane raporty przepadły. Kup nowy pakiet, aby kontynuować."
            : "Pula raportów została wyczerpana. Kup kolejny pakiet, aby kontynuować.",
          code: expired ? "PACKAGE_EXPIRED" : "LIMIT",
        },
        { status: 402 }
      );
    }
  }

  // --- Analiza (Moduł A) ---
  const analysis = analyzePoints(points);
  const sourceSha = sha256(JSON.stringify(points));

  const now = new Date();
  const number = `DLR/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // --- Klient (find-or-create po nazwie) ---
  let clientId: string | null = null;
  const clientName = body.clientName?.trim();
  if (clientName) {
    const [existing] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.userId, user.id), ilike(clients.name, clientName)))
      .limit(1);
    if (existing) {
      clientId = existing.id;
    } else {
      const [created] = await db.insert(clients).values({ userId: user.id, name: clientName }).returning({ id: clients.id });
      clientId = created.id;
    }
  }

  // --- Obiekt (find-or-create po nazwie) ---
  let objectId: string | null = null;
  const objectName = body.objectName?.trim();
  if (objectName) {
    const [existing] = await db
      .select()
      .from(objects)
      .where(and(eq(objects.userId, user.id), ilike(objects.name, objectName)))
      .limit(1);
    if (existing) {
      objectId = existing.id;
      if (body.objectAddress?.trim() && !existing.address) {
        await db.update(objects).set({ address: body.objectAddress.trim() }).where(eq(objects.id, existing.id));
      }
      if (clientId && !existing.clientId) {
        await db.update(objects).set({ clientId }).where(eq(objects.id, existing.id));
      }
    } else {
      const [created] = await db
        .insert(objects)
        .values({ userId: user.id, clientId, name: objectName, address: body.objectAddress?.trim() || null })
        .returning({ id: objects.id });
      objectId = created.id;
    }
  }

  // --- Meta raportu z profilu instalatora ---
  const [profile] = await db.select().from(installerProfiles).where(eq(installerProfiles.userId, user.id)).limit(1);
  const installerName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || user.email;
  
  // Zbieramy mierniki z profilu wg dostarczonych ID
  const allInst = (profile?.instruments ?? []) as import("@/components/instruments-manager").InstrumentItem[];
  const selectedInstIds = body.instruments ?? [];
  const instrumentsDetails = allInst.filter(i => selectedInstIds.includes(i.id));

  const meta = {
    reportNumber: number,
    date: now.toISOString().slice(0, 10),
    object: objectName || "Obiekt nieprzypisany",
    objectAddress: body.objectAddress?.trim() || "—",
    client: clientName || "—",
    contractor: profile?.companyName || installerName,
    installer: {
      name: installerName,
      company: profile?.companyName ?? "—",
      certificateNo: profile?.certificateNo ?? "—",
      scope: profile?.qualificationScope ?? "—",
    },
    instrument: instrumentsDetails.length ? instrumentsDetails.map(i => i.name).join(", ") : "—",
    instrumentsDetails,
    inspectionChecklist: body.inspectionChecklist,
    source: { fileName: body.sourceFileName?.slice(0, 200) ?? "—", importedAt: now.toISOString() },
    weather: body.weather ?? "—",
  };

  const [created] = await db
    .insert(reports)
    .values({
      userId: user.id,
      objectId,
      number,
      status: "SZKIC",
      sourceFileName: body.sourceFileName?.slice(0, 200) ?? null,
      sourceSha256: sourceSha,
      sourceRows: points.length,
      algorithmVersion: ALGORITHM_VERSION,
      criteriaSet: CRITERIA_SET,
      data: { meta, points, analysis },
    })
    .returning({ id: reports.id, number: reports.number });

  // --- Zużycie limitu ---
  if (u.status === "DEMO") {
    await db.update(users).set({ freeReportUsedAt: now }).where(eq(users.id, user.id));
  } else if (u.status === "AKTYWNE") {
    // Zużywamy raport z pakietu wygasającego NAJWCZEŚNIEJ (FIFO po ważności)
    const packs = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id));
    const usable = packs
      .filter((pk) => pk.status === "AKTYWNY" && (!pk.validUntil || pk.validUntil > now) && (pk.reportsLimit ?? 0) > pk.reportsUsed)
      .sort((a, b) => (a.validUntil?.getTime() ?? Infinity) - (b.validUntil?.getTime() ?? Infinity));
    const target = usable[0];
    if (target) {
      await db.update(subscriptions).set({ reportsUsed: target.reportsUsed + 1 }).where(eq(subscriptions.id, target.id));
    }
  }

  await audit(user.id, "report.create", { reportId: created.id, number: created.number, rows: points.length, objectId });
  return NextResponse.json({ ok: true, report: created, summary: analysis.summary, objectId });
}
