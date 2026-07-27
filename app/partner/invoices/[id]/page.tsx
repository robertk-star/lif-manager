import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAuthenticatedPartnerSession, type PartnerRole } from "@/lib/partnerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PartnerNav from "../../PartnerNav";
import InvoiceDetailClient from "./InvoiceDetailClient";

interface PartnerAccountHeader {
  id: string;
  firm_name: string;
  email: string | null;
}

interface PartnerUserHeader {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: PartnerRole;
}

const ROLE_LABELS: Record<PartnerRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<PartnerRole, string> = {
  owner: "bg-purple-100 text-purple-800",
  admin: "bg-indigo-100 text-indigo-800",
  staff: "bg-blue-100 text-blue-800",
  viewer: "bg-gray-100 text-gray-700",
};

const DEFAULT_PAYMENT_INSTRUCTIONS = `Pay by check to:

Ardykay LLC
5722 Goresseto Dr.
Frisco, TX 75034

Please include the invoice number in the check memo.`;

export default async function PartnerInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthenticatedPartnerSession();
  if (!session) redirect("/partner/login");

  const { id } = await params;

  const { data: account, error: accountError } = await supabaseAdmin
    .from("partner_accounts")
    .select("id, firm_name, email")
    .eq("id", session.partnerAccountId)
    .single();

  if (accountError || !account) redirect("/partner/login");

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("partner_billing_invoices")
    .select(
      "id, created_at, invoice_number, status, period_start, period_end, subtotal_cents, total_cents, " +
        "amount_paid_cents, balance_due_cents, notes, sent_at, paid_at, due_date, finalized_at, " +
        "payment_instructions, payment_method, payment_reference, payment_received_at, " +
        "stripe_receipt_url, stripe_payment_status, stripe_card_last4, stripe_payment_method_type, stripe_paid_at"
    )
    .eq("id", id)
    .eq("partner_account_id", session.partnerAccountId)
    .single();

  if (invoiceError || !invoice) notFound();
  if (invoice.status === "draft" || invoice.status === "void") notFound();

  const [{ data: items }, { data: user }] = await Promise.all([
    supabaseAdmin
      .from("partner_billing_invoice_items")
      .select("id, lead_id, description, amount_cents, billing_status_at_creation")
      .eq("invoice_id", id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("partner_users")
      .select("id, first_name, last_name, email, role")
      .eq("id", session.partnerUserId)
      .single(),
  ]);

  const partnerAccount = account as PartnerAccountHeader;
  const partnerUser = user as PartnerUserHeader | null;
  const displayName = partnerUser
    ? `${partnerUser.first_name} ${partnerUser.last_name}`
    : "Partner User";

  const paymentInstructions =
    (invoice.payment_instructions && String(invoice.payment_instructions).trim()) ||
    DEFAULT_PAYMENT_INSTRUCTIONS;

  return (
    <div className="min-h-screen bg-gray-50">
      <PartnerNav active="/partner/invoices" />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
          <div>
            <Link
              href="/partner/invoices"
              className="text-sm font-medium text-[#1a3a5c] hover:underline"
            >
              ← Back to Invoices
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-[#0d1b2e]">Invoice {invoice.invoice_number}</h1>
            <p className="mt-1 text-sm text-gray-500">{partnerAccount.firm_name}</p>
          </div>
          {partnerUser && (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Signed in as</p>
              <p className="mt-0.5 text-sm font-semibold text-[#0d1b2e]">{displayName}</p>
              <p className="text-xs text-gray-500">{partnerUser.email}</p>
              <div className="mt-1.5 flex sm:justify-end">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[session.role]}`}
                >
                  {ROLE_LABELS[session.role]}
                </span>
              </div>
            </div>
          )}
        </div>

        <InvoiceDetailClient
          invoice={{
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            status: invoice.status,
            period_start: invoice.period_start,
            period_end: invoice.period_end,
            due_date: invoice.due_date,
            created_at: invoice.created_at,
            finalized_at: invoice.finalized_at,
            total_cents: invoice.total_cents,
            amount_paid_cents: invoice.amount_paid_cents,
            balance_due_cents: invoice.balance_due_cents,
            notes: invoice.notes,
            payment_instructions: paymentInstructions,
            payment_reference: invoice.payment_reference,
            stripe_receipt_url: invoice.stripe_receipt_url,
            stripe_payment_status: invoice.stripe_payment_status,
            stripe_card_last4: invoice.stripe_card_last4,
            stripe_payment_method_type: invoice.stripe_payment_method_type,
          }}
          items={(items ?? []) as Array<{
            id: string;
            lead_id: string;
            description: string;
            amount_cents: number;
            billing_status_at_creation: string | null;
          }>}
          firmName={partnerAccount.firm_name}
        />
      </main>
    </div>
  );
}
