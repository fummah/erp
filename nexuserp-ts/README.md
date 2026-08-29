# NexusERP Cloud — Multi-Tenant SaaS ERP

A TypeScript monorepo foundation for a commercial, multi-company ERP SaaS with a dedicated ZIMRA FDMS fiscalisation subsystem.

## Stack

- Next.js 16 + React + TypeScript
- Ant Design + Tailwind CSS + TanStack Query + Recharts
- NestJS 11 + Node.js
- PostgreSQL + Prisma ORM
- JWT authentication + tenant/company context + RBAC foundation
- ZIMRA FDMS provider abstraction with **mock mode enabled by default**
- Swagger / OpenAPI

## Included modules

Platform Admin, Multi-Tenancy, Subscriptions, Finance, Procurement, Sales, Inventory, HR & Payroll foundation, CRM, Assets & Maintenance, Compliance & Risk, Reporting / BI, Administration / Security, Integrations, Audit, and Fiscalisation.

## Quick start (Windows, no Docker)

Read `docs/INSTALLATION-WINDOWS.md`.

Typical flow after PostgreSQL is installed:

```powershell
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.local.example apps\web\.env.local
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Open:
- ERP: http://localhost:3000
- API: http://localhost:4000/api
- Swagger: http://localhost:4000/docs

Demo users:
- Company admin: `admin@demo.local` / `Password123!`
- Platform admin: `platform@demo.local` / `Password123!`

See `docs/FEATURE-MATRIX.md` for the exact implemented-vs-foundation status of each ERP area.

## Important

`ZIMRA_MODE=mock` is the default. It intentionally does not submit to live ZIMRA. Production FDMS work must be completed against the official current ZIMRA test environment and certification process before live use.

This repository is a strong installable ERP foundation with working core flows, not a claim of production certification for payroll, tax, banking, or ZIMRA.
