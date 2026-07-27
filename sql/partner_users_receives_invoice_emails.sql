-- Run once in Supabase SQL editor (shared LIF project).
-- Controls which partner users receive invoice-sent emails.

ALTER TABLE public.partner_users
  ADD COLUMN IF NOT EXISTS receives_invoice_emails boolean NOT NULL DEFAULT false;

-- Existing owner/admin users start opted in (matches previous default behavior).
UPDATE public.partner_users
SET receives_invoice_emails = true
WHERE role IN ('owner', 'admin')
  AND status = 'active'
  AND receives_invoice_emails = false;

CREATE INDEX IF NOT EXISTS partner_users_receives_invoice_emails_idx
  ON public.partner_users (partner_account_id, receives_invoice_emails)
  WHERE receives_invoice_emails = true;
