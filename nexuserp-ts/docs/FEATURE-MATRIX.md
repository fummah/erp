# Feature Matrix

Legend: **Working** = implemented in this local build; **Foundation** = schema/API/UI boundary is present but deeper statutory/enterprise workflow remains to be completed and verified before production.

| Area | Status | Included now |
|---|---|---|
| Multi-tenancy | Working | Tenant, company, branch hierarchy; company-scoped JWT context |
| Platform admin | Working | Tenant list, plans, tenant/company/admin onboarding |
| Authentication | Working | JWT login, company switch, platform admin |
| RBAC | Foundation | Membership roles and server-side company scoping; granular permission matrix is production roadmap |
| Finance / GL | Working core | Chart of accounts, double-entry sales posting, journals, P&L, balance sheet |
| Accounts Receivable | Working core | Customers, posted sales invoice control-account posting |
| Accounts Payable | Foundation | Supplier and PO domain; full supplier invoice/payment posting remains |
| Cash & Bank | Foundation | GL control account; reconciliation/payment workflows remain |
| Budgeting | Foundation | Architecture documented; detailed budget workflows remain |
| Sales | Working core | Customers, invoice entry, tax calculation, posting, fiscal-ready status |
| Credit/debit notes | Foundation | Fiscal receipt model supports types; complete sales UI/reversal rules remain |
| Procurement | Working foundation | Suppliers and purchase orders domain/API |
| Inventory | Working foundation | Items, warehouses, stock movement model and on-hand aggregation |
| HR | Working foundation | Employees/departments |
| Payroll | Foundation | Effective-dated statutory rule model; no invented PAYE/NSSA calculations |
| CRM | Working foundation | Lead pipeline model/API/UI |
| Assets | Working foundation | Asset register/depreciation fields |
| Maintenance | Foundation | Architecture reserved; full work-order scheduling remains |
| Compliance & risk | Working foundation | Risk register and compliance obligations |
| Reporting / BI | Working core | Dashboard, GL-derived P&L and balance sheet |
| Audit trail | Foundation | Audit model present; broaden event capture before production |
| Fiscal devices | Working mock | Device registration state and per-branch device identity |
| Fiscal days | Working mock | Open/close lifecycle |
| Fiscal counters | Working core | Server-side PostgreSQL atomic allocation of daily/global counters |
| Fiscal invoices | Working mock | Posted invoice -> fiscal payload -> mock FDMS result |
| ZIMRA live adapter | Not enabled | Intentionally blocked pending official UAT/certification and credentials |
| Integration registry | Working | ZIMRA, Paynow, SMTP, Bank, Webhook, SSO, Storage, WhatsApp placeholders/statuses |
| Background queues | Foundation | Retry statuses designed; Redis/BullMQ activation is production roadmap |
| Subscription billing | Foundation | Plans/subscriptions exist; live payment/usage billing remains |
