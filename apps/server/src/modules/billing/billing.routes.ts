import { Router, Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { db } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { sendSuccess, sendCreated } from "../../utils/response";
import { authorize } from "../../middleware/auth";
import { Role } from "@prisma/client";
import { logger } from "../../utils/logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2023-10-16",
});

export const PLANS_CONFIG: Record<
  string,
  {
    id: string;
    name: string;
    price: number;
    currency: string;
    maxStudents: number;
    features: string[];
    priceEnvVar?: string;
  }
> = {
  FREE: {
    id: "FREE",
    name: "Free",
    price: 0,
    currency: "USD",
    maxStudents: 50,
    features: ["Basic attendance", "Grade tracking", "2 admin users"],
  },
  BASIC: {
    id: "BASIC",
    name: "Basic",
    price: 29,
    currency: "USD",
    maxStudents: 200,
    features: [
      "All Free features",
      "Parent portal",
      "Chat system",
      "File uploads",
      "5 admin users",
    ],
    priceEnvVar: process.env.STRIPE_PRICE_BASIC,
  },
  STANDARD: {
    id: "STANDARD",
    name: "Standard",
    price: 79,
    currency: "USD",
    maxStudents: 1000,
    features: [
      "All Basic features",
      "AI insights",
      "Exam management",
      "Fee management",
      "Library system",
      "Unlimited admins",
    ],
    priceEnvVar: process.env.STRIPE_PRICE_STANDARD,
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 199,
    currency: "USD",
    maxStudents: -1,
    features: [
      "All Standard features",
      "Custom domain",
      "API access",
      "Priority support",
      "Custom integrations",
      "Dedicated account manager",
    ],
    priceEnvVar: process.env.STRIPE_PRICE_ENTERPRISE,
  },
};

const getClientBaseUrl = (req: Request): string => {
  const origin =
    req.headers.origin ||
    (req.headers.referer ? new URL(req.headers.referer).origin : undefined);
  if (origin) return origin.replace(/\/$/, "");
  const configured = (process.env.CLIENT_URL ?? "http://localhost:3000")
    .split(",")[0]
    .trim();
  return configured.replace(/\/$/, "");
};

const getCheckoutLineItem = (
  planKey: string,
): Stripe.Checkout.SessionCreateParams.LineItem | null => {
  const plan = PLANS_CONFIG[planKey];
  if (!plan || plan.price <= 0) return null;

  const envPrice = plan.priceEnvVar?.trim();
  if (envPrice && envPrice.startsWith("price_") && !envPrice.includes("...")) {
    return { price: envPrice, quantity: 1 };
  }

  return {
    price_data: {
      currency: plan.currency.toLowerCase(),
      product_data: {
        name: `TimhirtHub ${plan.name} Plan`,
        description: `TimhirtHub School Management Platform — ${plan.name} Plan Subscription`,
      },
      unit_amount: Math.round(plan.price * 100),
      recurring: {
        interval: "month",
      },
    },
    quantity: 1,
  };
};

const router = Router();
const isFinance = [Role.FINANCE, Role.ADMIN, Role.SUPER_ADMIN];

// ── Get current subscription ──────────────────────────────────────────────────
router.get(
  "/subscription",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let sub = await db.subscription.findUnique({
        where: { schoolId: req.user.schoolId },
        include: { payments: { orderBy: { createdAt: "desc" }, take: 5 } },
      });

      if (!sub) {
        sub = await db.subscription.create({
          data: {
            schoolId: req.user.schoolId,
            plan: "FREE",
            status: "ACTIVE",
          },
          include: { payments: { orderBy: { createdAt: "desc" }, take: 5 } },
        });
      }

      sendSuccess(res, sub);
    } catch (e) {
      next(e);
    }
  },
);

// ── Get available plans ───────────────────────────────────────────────────────
router.get("/plans", (_req: Request, res: Response) => {
  sendSuccess(res, Object.values(PLANS_CONFIG));
});

// ── Create checkout session ───────────────────────────────────────────────────
router.post(
  "/checkout",
  authorize(...isFinance),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { plan } = req.body;
      if (!plan || !PLANS_CONFIG[plan] || plan === "FREE") {
        throw new AppError("Please select a valid paid plan to subscribe", 400);
      }

      if (
        !process.env.STRIPE_SECRET_KEY ||
        process.env.STRIPE_SECRET_KEY.includes("...")
      ) {
        throw new AppError("Stripe API key is not configured on the server", 500);
      }

      const school = await db.school.findUnique({
        where: { id: req.user.schoolId },
        include: { subscription: true },
      });
      if (!school) throw new AppError("School not found", 404);

      let customerId = school.subscription?.stripeCustomerId;

      // Create Stripe customer if doesn't exist
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: school.email ?? req.user.email,
          name: school.name,
          metadata: { schoolId: school.id },
        });
        customerId = customer.id;

        await db.subscription.upsert({
          where: { schoolId: school.id },
          create: {
            schoolId: school.id,
            stripeCustomerId: customerId,
            plan: "FREE",
            status: "INACTIVE",
          },
          update: {
            stripeCustomerId: customerId,
          },
        });
      }

      const lineItem = getCheckoutLineItem(plan);
      if (!lineItem) {
        throw new AppError("Unable to create checkout item for selected plan", 400);
      }

      const clientUrl = getClientBaseUrl(req);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [lineItem],
        success_url: `${clientUrl}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}/settings/billing?cancelled=true`,
        metadata: { schoolId: school.id, plan },
      });

      sendCreated(res, { url: session.url, sessionId: session.id });
    } catch (e: any) {
      logger.error("Stripe checkout error:", e);
      if (e?.type?.startsWith("Stripe") || e?.raw?.message) {
        next(new AppError(`Stripe Error: ${e.raw?.message || e.message}`, 400));
      } else {
        next(e);
      }
    }
  },
);

// ── Verify session & sync subscription ─────────────────────────────────────────
router.post(
  "/verify-session",
  authorize(...isFinance),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId || typeof sessionId !== "string") {
        throw new AppError("Session ID is required", 400);
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });

      if (!session) {
        throw new AppError("Checkout session not found", 404);
      }

      const { schoolId, plan } = session.metadata ?? {};
      if (schoolId && schoolId !== req.user.schoolId) {
        throw new AppError("Unauthorized session verification", 403);
      }

      const stripeSub = session.subscription as Stripe.Subscription | undefined;
      const stripeSubscriptionId =
        stripeSub?.id ??
        (typeof session.subscription === "string"
          ? session.subscription
          : null);
      const stripePriceId = stripeSub?.items?.data?.[0]?.price?.id ?? null;
      const currentPeriodStart = stripeSub?.current_period_start
        ? new Date(stripeSub.current_period_start * 1000)
        : new Date();
      const currentPeriodEnd = stripeSub?.current_period_end
        ? new Date(stripeSub.current_period_end * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const targetPlan = plan && PLANS_CONFIG[plan] ? plan : "BASIC";

      const updatedSub = await db.subscription.upsert({
        where: { schoolId: req.user.schoolId },
        create: {
          schoolId: req.user.schoolId,
          plan: targetPlan as any,
          status: "ACTIVE",
          stripeCustomerId: (session.customer as string) ?? null,
          stripeSubscriptionId,
          stripePriceId,
          currentPeriodStart,
          currentPeriodEnd,
        },
        update: {
          plan: targetPlan as any,
          status: "ACTIVE",
          stripeCustomerId: (session.customer as string) ?? undefined,
          stripeSubscriptionId: stripeSubscriptionId ?? undefined,
          stripePriceId: stripePriceId ?? undefined,
          currentPeriodStart,
          currentPeriodEnd,
        },
        include: { payments: { orderBy: { createdAt: "desc" }, take: 5 } },
      });

      sendSuccess(res, updatedSub, "Subscription verified successfully");
    } catch (e: any) {
      logger.error("Session verification error:", e);
      if (e?.type?.startsWith("Stripe") || e?.raw?.message) {
        next(new AppError(`Stripe Error: ${e.raw?.message || e.message}`, 400));
      } else {
        next(e);
      }
    }
  },
);

// ── Customer portal (manage subscription) ────────────────────────────────────
router.post(
  "/portal",
  authorize(...isFinance),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await db.subscription.findUnique({
        where: { schoolId: req.user.schoolId },
      });
      if (!sub?.stripeCustomerId)
        throw new AppError("No billing account found. Please subscribe to a plan first.", 400);

      const clientUrl = getClientBaseUrl(req);
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${clientUrl}/settings/billing`,
      });

      sendSuccess(res, { url: session.url });
    } catch (e: any) {
      logger.error("Billing portal error:", e);
      if (e?.type?.startsWith("Stripe") || e?.raw?.message) {
        next(new AppError(`Stripe Error: ${e.raw?.message || e.message}`, 400));
      } else {
        next(e);
      }
    }
  },
);

// ── Stripe webhook handler ────────────────────────────────────────────────────
export const handleStripeWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    );
  } catch (err: any) {
    logger.error("Webhook signature verification failed:", err.message);
    res.status(400).send(`Webhook error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { schoolId, plan } = session.metadata ?? {};
        if (!schoolId || !plan) break;

        let stripeSubId: string | null = null;
        let stripePriceId: string | null = null;
        let periodStart = new Date();
        let periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        if (session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          stripeSubId = subId;
          try {
            const subscription = await stripe.subscriptions.retrieve(subId);
            stripePriceId = subscription.items.data[0]?.price?.id ?? null;
            if (subscription.current_period_start) {
              periodStart = new Date(subscription.current_period_start * 1000);
            }
            if (subscription.current_period_end) {
              periodEnd = new Date(subscription.current_period_end * 1000);
            }
          } catch (e) {
            logger.warn("Could not retrieve subscription in webhook:", e);
          }
        }

        await db.subscription.upsert({
          where: { schoolId },
          create: {
            schoolId,
            plan: plan as any,
            status: "ACTIVE",
            stripeCustomerId: (session.customer as string) ?? null,
            stripeSubscriptionId: stripeSubId,
            stripePriceId,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          },
          update: {
            plan: plan as any,
            status: "ACTIVE",
            stripeCustomerId: (session.customer as string) ?? undefined,
            stripeSubscriptionId: stripeSubId ?? undefined,
            stripePriceId: stripePriceId ?? undefined,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          },
        });
        logger.info(`School ${schoolId} upgraded to ${plan}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription.id;
          const sub = await db.subscription.findFirst({
            where: { stripeSubscriptionId: subId },
          });
          if (sub) {
            const paymentId =
              typeof invoice.payment_intent === "string"
                ? invoice.payment_intent
                : invoice.payment_intent?.id;
            const existingPayment = paymentId
              ? await db.payment.findFirst({
                  where: { stripePaymentId: paymentId },
                })
              : null;
            if (!existingPayment) {
              await db.payment.create({
                data: {
                  subscriptionId: sub.id,
                  amount: invoice.amount_paid / 100,
                  currency: (invoice.currency || "USD").toUpperCase(),
                  status: "succeeded",
                  stripePaymentId: paymentId ?? null,
                  invoiceUrl: invoice.hosted_invoice_url ?? null,
                  paidAt: new Date(),
                },
              });
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await db.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status:
              sub.status === "active"
                ? "ACTIVE"
                : sub.status === "past_due"
                  ? "PAST_DUE"
                  : "INACTIVE",
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await db.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: "CANCELLED", plan: "FREE" },
        });
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error("Webhook handler error:", err);
    res.status(500).json({ error: "Webhook handler failed" });
  }
};

router.post("/webhook", handleStripeWebhook);

export default router;
