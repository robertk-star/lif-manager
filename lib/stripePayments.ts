import crypto from "crypto";

export type StripeCheckoutSessionResult = {
  id: string;
  url: string;
  paymentStatus?: string | null;
};

export type StripePaymentIntentDetails = {
  paymentIntentId: string;
  chargeId: string | null;
  receiptUrl: string | null;
  paymentMethodType: string | null;
  cardLast4: string | null;
};

export function stripeCheckoutAllowLink() {
  return process.env.STRIPE_CHECKOUT_ALLOW_LINK?.trim().toLowerCase() !== "false";
}

export function stripeCheckoutPrefillEmail() {
  return process.env.STRIPE_CHECKOUT_PREFILL_EMAIL?.trim().toLowerCase() !== "false";
}

function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

export function stripeConfigured() {
  return Boolean(getStripeSecretKey());
}

export function appUrlFromRequest(requestUrl?: string) {
  const configured = process.env.LIF_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (requestUrl) {
    const url = new URL(requestUrl);
    return `${url.protocol}//${url.host}`;
  }
  return "https://v2.legalintakeflow.com";
}

export function stripeCurrency() {
  return (process.env.STRIPE_CURRENCY?.trim() || "usd").toLowerCase();
}

function appendParam(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | null | undefined
) {
  if (value === null || value === undefined) return;
  params.append(key, String(value));
}

export async function createStripeCheckoutSession(input: {
  invoiceId: string;
  invoiceNumber: string;
  partnerAccountId: string;
  partnerFirmName: string;
  amountCents: number;
  customerEmail?: string | null;
  appUrl: string;
}): Promise<{ data: StripeCheckoutSessionResult | null; error: string | null; raw?: unknown }> {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    return {
      data: null,
      error: "Stripe is not configured. Add STRIPE_SECRET_KEY in Vercel and redeploy.",
    };
  }

  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return {
      data: null,
      error: "Invoice balance must be greater than zero before creating a payment link.",
    };
  }

  const appUrl = input.appUrl.replace(/\/$/, "");
  const params = new URLSearchParams();
  appendParam(params, "mode", "payment");
  if (!stripeCheckoutAllowLink()) {
    appendParam(params, "payment_method_types[0]", "card");
  }
  appendParam(
    params,
    "success_url",
    `${appUrl}/partner/invoices?payment=success&invoice=${encodeURIComponent(input.invoiceId)}`
  );
  appendParam(
    params,
    "cancel_url",
    `${appUrl}/partner/invoices?payment=cancelled&invoice=${encodeURIComponent(input.invoiceId)}`
  );
  appendParam(params, "client_reference_id", input.invoiceId);
  appendParam(params, "line_items[0][quantity]", 1);
  appendParam(params, "line_items[0][price_data][currency]", stripeCurrency());
  appendParam(params, "line_items[0][price_data][unit_amount]", input.amountCents);
  appendParam(
    params,
    "line_items[0][price_data][product_data][name]",
    `Legal Intake Flow Invoice ${input.invoiceNumber}`
  );
  appendParam(
    params,
    "line_items[0][price_data][product_data][description]",
    `Invoice for ${input.partnerFirmName}`
  );
  appendParam(params, "metadata[invoice_id]", input.invoiceId);
  appendParam(params, "metadata[invoice_number]", input.invoiceNumber);
  appendParam(params, "metadata[partner_account_id]", input.partnerAccountId);
  appendParam(params, "payment_intent_data[metadata][invoice_id]", input.invoiceId);
  appendParam(params, "payment_intent_data[metadata][invoice_number]", input.invoiceNumber);
  appendParam(params, "payment_intent_data[metadata][partner_account_id]", input.partnerAccountId);

  if (
    stripeCheckoutPrefillEmail() &&
    input.customerEmail &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail)
  ) {
    appendParam(params, "customer_email", input.customerEmail);
  }

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        typeof data?.error?.message === "string"
          ? data.error.message
          : `Stripe returned HTTP ${res.status}.`;
      return { data: null, error: message, raw: data };
    }

    if (typeof data?.id !== "string" || typeof data?.url !== "string") {
      return { data: null, error: "Stripe did not return a checkout URL.", raw: data };
    }

    return {
      data: {
        id: data.id,
        url: data.url,
        paymentStatus: typeof data.payment_status === "string" ? data.payment_status : null,
      },
      error: null,
      raw: data,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to contact Stripe.",
    };
  }
}

export function verifyStripeWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  webhookSecret: string | undefined;
}) {
  const secret = input.webhookSecret?.trim();
  if (!secret) {
    return { ok: false, error: "Stripe webhook secret is not configured." };
  }
  if (!input.signatureHeader) {
    return { ok: false, error: "Missing Stripe signature header." };
  }

  const pieces = input.signatureHeader.split(",").reduce<Record<string, string[]>>((acc, piece) => {
    const [key, value] = piece.split("=", 2);
    if (!key || !value) return acc;
    acc[key] = acc[key] ?? [];
    acc[key].push(value);
    return acc;
  }, {});

  const timestamp = pieces.t?.[0];
  const signatures = pieces.v1 ?? [];
  if (!timestamp || signatures.length === 0) {
    return { ok: false, error: "Invalid Stripe signature header." };
  }

  const signedPayload = `${timestamp}.${input.rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  const matched = signatures.some((candidate) => {
    try {
      const candidateBuffer = Buffer.from(candidate, "hex");
      return (
        candidateBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(candidateBuffer, expectedBuffer)
      );
    } catch {
      return false;
    }
  });

  if (!matched) {
    return { ok: false, error: "Invalid Stripe signature." };
  }

  return { ok: true, error: null };
}

export async function retrieveStripePaymentIntentDetails(
  paymentIntentId: string
): Promise<{ data: StripePaymentIntentDetails | null; error: string | null; raw?: unknown }> {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    return {
      data: null,
      error: "Stripe is not configured. Add STRIPE_SECRET_KEY in Vercel and redeploy.",
    };
  }

  const encodedId = encodeURIComponent(paymentIntentId);
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodedId}?expand[]=latest_charge`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${secretKey}` },
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        typeof data?.error?.message === "string"
          ? data.error.message
          : `Stripe returned HTTP ${res.status}.`;
      return { data: null, error: message, raw: data };
    }

    const latestCharge =
      data?.latest_charge && typeof data.latest_charge === "object"
        ? (data.latest_charge as Record<string, unknown>)
        : null;
    const paymentMethodDetails =
      latestCharge?.payment_method_details &&
      typeof latestCharge.payment_method_details === "object"
        ? (latestCharge.payment_method_details as Record<string, unknown>)
        : null;
    const card =
      paymentMethodDetails?.card && typeof paymentMethodDetails.card === "object"
        ? (paymentMethodDetails.card as Record<string, unknown>)
        : null;

    return {
      data: {
        paymentIntentId,
        chargeId: typeof latestCharge?.id === "string" ? latestCharge.id : null,
        receiptUrl: typeof latestCharge?.receipt_url === "string" ? latestCharge.receipt_url : null,
        paymentMethodType:
          typeof paymentMethodDetails?.type === "string" ? paymentMethodDetails.type : null,
        cardLast4: typeof card?.last4 === "string" ? card.last4 : null,
      },
      error: null,
      raw: data,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to retrieve Stripe payment details.",
    };
  }
}
