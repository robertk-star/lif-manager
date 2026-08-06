-- Retell / DBS Caller ID on leads
-- Run in Supabase SQL editor before deploying code that selects caller_id.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS caller_id text;

COMMENT ON COLUMN public.leads.caller_id IS
  'Caller ID from Retell (or similar), forwarded by DBS on ingest. Distinct from claimant phone when both are present.';

CREATE INDEX IF NOT EXISTS leads_caller_id_idx
  ON public.leads (caller_id)
  WHERE caller_id IS NOT NULL;
