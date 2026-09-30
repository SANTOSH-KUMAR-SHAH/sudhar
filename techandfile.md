# Sudhar Lab — Technology Stack and Project Structure

## 1. Architecture decision

Sudhar Lab will use a small, clear monorepo: one repository containing the public website, internal portals, API, shared business rules, and database migrations.

This is intentionally **not** a collection of unrelated projects. The public customer website, `/admin` portal, and `/tech` portal belong to one service-operation system and should share types, status definitions, validation rules, and design foundations.

```text
Customer website (/)
Admin portal (/admin)
Technician portal (/tech)
        ↓
Hono API on Cloudflare Workers
        ↓
Supabase Auth + PostgreSQL + private Storage
```

The frontend presents information and collects input. The API owns business rules. PostgreSQL stores the operational record. No sensitive decision should rely only on browser code.

## 2. Chosen technology stack

### Frontend

- **Astro** — fast public website and route structure.
- **TypeScript** — safer refactoring, clearer data shapes, fewer accidental mistakes.
- **Tailwind CSS** — consistent design tokens and responsive styling.
- **Motion One** — default animation library for small, efficient interactions.
- **GSAP** — only for a specifically approved advanced animation that Motion One cannot express well.

Astro will serve all three frontend areas initially:

```text
/        customer website
/admin   company administration portal
/tech    technician portal
```

This preserves a unified brand and avoids maintaining three frontend projects too early. If the technician experience later needs a native mobile application, it can become a separate app without changing the backend service rules.

### Backend

- **TypeScript**
- **Hono**
- **Cloudflare Workers**
- **Zod** for validating every API request

The Hono API is the only place that performs sensitive operations such as assigning a technician, changing service status, recording a diagnosis, approving a price, generating a billing record, or creating signed file URLs.

### Database, authentication, and files

- **Supabase PostgreSQL** — operational database.
- **Supabase Auth** — authentication for admins and technicians.
- **Supabase Storage** — appliance photos and videos in private buckets.
- **Supabase Row Level Security** — database-level protection in addition to API authorization.

The public customer request form does not require a customer account in version one. It submits a tightly validated request to the API. Admins and technicians do require authenticated accounts.

### Hosting and delivery

- **Cloudflare Pages** — deploy the Astro frontend.
- **Cloudflare Workers** — deploy the Hono API.
- **Supabase** — hosted database, Auth, and Storage.
- **GitHub** — source control and deployment connection.

### Engineering support tools

- **pnpm** — one fast package manager for the monorepo.
- **ESLint + Prettier** — consistent code quality and formatting.
- **Vitest** — unit and API tests.
- **Playwright** — later, for key customer/admin/technician flow tests.
- **GitHub Actions** — later, to run type-check, lint, test, and build before merging or deploying.

## 3. Security foundation

The technology stack is safe only when it is used with these rules:

1. Never place Supabase service-role keys, Cloudflare secrets, payment keys, or messaging keys in frontend code.
2. Validate input in the frontend for usability and again in the Hono API for security.
3. Use explicit role checks in the API: admin, technician, and future customer roles.
4. Enable Row Level Security and least-privilege policies for every exposed database table and storage bucket.
5. A technician can only read or update jobs assigned to that technician.
6. Keep uploaded files private; deliver them through short-lived signed URLs after permission checks.
7. Log important operational actions: confirmation, assignment, diagnosis, price approval, status changes, and billing changes.
8. Add rate limits to public request submission and login endpoints before launch.

SQL is not replaced by avoiding PostgreSQL. PostgreSQL is the correct database for this kind of connected operational system. SQL injection is prevented by parameterized database access, strict validation, least privilege, and never building database queries from raw user text.

## 4. Folder structure

```text
sudhar-lab/
│
├── apps/
│   ├── web/                         # Astro frontend: /, /admin, /tech
│   │   ├── public/
│   │   │   ├── images/
│   │   │   ├── icons/
│   │   │   └── fonts/
│   │   │
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── common/          # Button, Input, Modal, StatusBadge
│   │   │   │   ├── customer/        # Homepage and request-form components
│   │   │   │   ├── admin/           # Admin-only interface components
│   │   │   │   └── technician/      # Technician-only interface components
│   │   │   │
│   │   │   ├── layouts/             # Public, Admin, Technician layouts
│   │   │   ├── pages/
│   │   │   │   ├── index.astro
│   │   │   │   ├── admin/
│   │   │   │   │   ├── login.astro
│   │   │   │   │   ├── index.astro
│   │   │   │   │   └── requests/[id].astro
│   │   │   │   └── tech/
│   │   │   │       ├── login.astro
│   │   │   │       ├── index.astro
│   │   │   │       └── jobs/[id].astro
│   │   │   │
│   │   │   ├── features/            # Frontend behaviour grouped by business feature
│   │   │   │   ├── service-request/
│   │   │   │   ├── assignment/
│   │   │   │   ├── diagnosis/
│   │   │   │   └── authentication/
│   │   │   │
│   │   │   ├── lib/                 # API client, auth helpers, formatting
│   │   │   ├── styles/              # Global CSS and Tailwind entry point
│   │   │   └── env.d.ts
│   │   │
│   │   ├── astro.config.mjs
│   │   └── package.json
│   │
│   └── api/                         # Hono application on Cloudflare Workers
│       ├── src/
│       │   ├── index.ts              # Application entry point; assembles routes
│       │   ├── routes/               # Thin HTTP route definitions
│       │   ├── modules/              # Business features, each self-contained
│       │   │   ├── service-requests/
│       │   │   │   ├── request.routes.ts
│       │   │   │   ├── request.service.ts
│       │   │   │   ├── request.repository.ts
│       │   │   │   └── request.schema.ts
│       │   │   ├── technicians/
│       │   │   ├── assignments/
│       │   │   ├── diagnoses/
│       │   │   ├── billing/
│       │   │   ├── attachments/
│       │   │   └── notifications/
│       │   │
│       │   ├── middleware/           # Auth, roles, errors, rate limits, request ID
│       │   ├── domain/               # Status machine and cross-feature rules
│       │   ├── lib/                  # Supabase clients and small infrastructure helpers
│       │   └── types/                # Worker bindings and internal API types
│       │
│       ├── wrangler.jsonc
│       └── package.json
│
├── packages/
│   └── shared/
│       └── src/
│           ├── service-status.ts     # One source of truth for status names
│           ├── roles.ts              # One source of truth for roles
│           ├── api-contracts.ts      # Shared request/response shapes
│           └── constants.ts
│
├── supabase/
│   ├── migrations/                   # Versioned database and RLS changes
│   ├── seed.sql                      # Safe local/sample data only
│   └── config.toml
│
├── tests/
│   ├── api/                          # API and workflow tests
│   ├── e2e/                          # Later: request, assignment, diagnosis flows
│   └── security/                     # Permission and access-control tests
│
├── docs/
│   ├── prd.md
│   ├── architecture.md
│   ├── decisions/                    # Important decisions with reasons
│   └── runbooks/                     # Operational guides for later
│
├── .env.example                      # Variable names only; no real secrets
├── package.json
├── pnpm-workspace.yaml
├── README.md
└── .gitignore
```

## 5. Why this is organized but not overbuilt

The initial implementation does **not** need every module shown above. Start with only:

```text
service-requests
technicians
assignments
authentication
attachments
```

Add diagnosis, billing, notifications, warranty, inventory, and payment modules only when the real workflow reaches them.

The structure is designed around real business capabilities, not around random technical file types. When a future feature changes, such as price approval, most work stays inside the relevant module instead of forcing a risky search across the entire repository.

## 6. Rules for future growth

- Do not create a new app, service, database, or package merely because it might be useful one day.
- Do create a module when a business capability has its own rules, permissions, data, and tests.
- Keep routes thin. Put decisions in services and workflow rules.
- Keep components small and named after their responsibility.
- Keep service statuses and permissions in one shared source of truth.
- Prefer explicit code over clever abstractions.
- Add a test whenever a rule protects money, customer data, technician access, or status transitions.
- Record architectural decisions when they are difficult to reverse.

## 7. Final decision

This is the approved initial direction:

```text
Astro + TypeScript + Tailwind + Motion One
Cloudflare Pages

Hono + TypeScript
Cloudflare Workers

Supabase PostgreSQL + Auth + private Storage + RLS
```

It is simple enough for the first Kathmandu launch and structured enough to grow into a broader service-operation platform without rewriting the foundation.
