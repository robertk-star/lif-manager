# LIF Manager

Streamlined **leads manager** for Legal Intake Flow.

This is a new, focused rebuild that runs **alongside** the existing `legal-intake-flow` site.  
The original site is left completely untouched until this version is verified.

## Purpose

1. Receive qualified leads from Disability Benefits Screening (DBS)
2. Automatically route leads to the best eligible partner (buyer)
3. Admin: view/manage leads + create invoices
4. Partner: view assigned leads + invoices

## Relationship to existing LIF

| Item | Current site | This repo |
|------|--------------|-----------|
| Repo | `legal-intake-flow` | `lif-manager` |
| Live domain | legalintakeflow.com | (to be) v2.legalintakeflow.com |
| Supabase | Shared project | Shared project |
| Status | Production | New / testing |

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL)
- Vercel

## Core routes (planned)

**Admin**
- `/admin` – dashboard
- `/admin/leads` – lead queue + detail + assign
- `/admin/partners` – partner list + routing prefs
- `/admin/invoices` – create & manage invoices

**Partner**
- `/partner/login`
- `/partner/leads`
- `/partner/invoices`

**System**
- `POST /api/intake/ingest` – DBS lead ingestion (auto-route on by default)

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase + secrets
pnpm dev
```

## Environment

See `.env.example`. Uses the same Supabase project as the existing LIF site.

---

Built to be minimal, reliable, and easy to maintain.
