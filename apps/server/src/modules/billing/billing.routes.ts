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

const PLAN_PRICES: Record<string, string> = {
  BASIC: process.env.STRIPE_PRICE_BASIC ?? "",
  STANDARD: process.env.STRIPE_PRICE_STANDARD ?? "",
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
};

const router = Router();
const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN];
const isFinance = [Role.FINANCE, Role.ADMIN, Role.SUPER_ADMIN];

// ── Get current subscription ──────────────────────────────────────────────────
router.get(
  "/subscription",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await db.subscription.findUnique({
        where: { schoolId: req.user.schoolId },
        include: { payments: { orderBy: { createdAt: "desc" }, take: 5 } },
      });
      sendSuccess(res, sub);
    } catch (e) {
      next(e);
    }
  },
);

// ── Get available plans ───────────────────────────────────────────────────────
router.get("/plans", (req: Request, res: Response) => {
  sendSuccess(res, [
    {
      id: "FREE",
      name: "Free",
      price: 0,
      currency: "USD",
      maxStudents: 50,
      features: ["Basic attendance", "Grade tracking", "2 admin users"],
    },
    {
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
    },
    {
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
    },
    {
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
    },
  ]);
});

// ── Create checkout session ───────────────────────────────────────────────────
router.post(
  "/checkout",
  authorize(...isFinance),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { plan } = req.body;
      if (!PLAN_PRICES[plan]) throw new AppError("Invalid plan", 400);

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
        await db.subscription.update({
          where: { schoolId: school.id },
          data: { stripeCustomerId: customerId },
        });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: PLAN_PRICES[plan], quantity: 1 }],
        success_url: `${process.env.CLIENT_URL}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/settings/billing?cancelled=true`,
        metadata: { schoolId: school.id, plan },
      });

      sendCreated(res, { url: session.url, sessionId: session.id });
    } catch (e) {
      next(e);
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
        throw new AppError("No billing account found", 400);

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${process.env.CLIENT_URL}/settings/billing`,
      });

      sendSuccess(res, { url: session.url });
    } catch (e) {
      next(e);
    }
  },
);

// ── Stripe webhook (raw body required — registered before json middleware) ────
router.post("/webhook", async (req: Request, res: Response): Promise<void> => {
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

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        await db.subscription.update({
          where: { schoolId },
          data: {
            plan: plan as any,
            status: "ACTIVE",
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0].price.id,
            currentPeriodStart: new Date(
              subscription.current_period_start * 1000,
            ),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
        logger.info(`School ${schoolId} upgraded to ${plan}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const sub = await db.subscription.findFirst({
            where: { stripeSubscriptionId: invoice.subscription as string },
          });
          if (sub) {
            await db.payment.create({
              data: {
                subscriptionId: sub.id,
                amount: invoice.amount_paid / 100,
                currency: invoice.currency.toUpperCase(),
                status: "succeeded",
                stripePaymentId: invoice.payment_intent as string,
                invoiceUrl: invoice.hosted_invoice_url ?? null,
                paidAt: new Date(),
              },
            });
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
});

export default router;
