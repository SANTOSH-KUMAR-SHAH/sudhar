# Sudhar Lab — Frontend (`@sudhar-lab/web`)

Astro + TypeScript + Tailwind CSS static frontend for the Sudhar Lab
service-operation system. Three portals, one codebase:

- `/` — public customer website (Kathmandu home-appliance repair)
- `/admin` — internal operations portal (login, dashboard, requests, technicians, customers)
- `/tech` — technician field portal (login, dashboard, jobs, profile)

## Scripts

```bash
npm run dev     # local dev server
npm run check   # Astro type-check (must be 0 errors before any commit)
npm run build   # static production build -> dist/
npm run preview # preview the production build
```

## Structure

```text
src/
  pages/        routes per portal (index, admin/*, tech/*, 404)
  layouts/      5 thin shells (no business logic, no giant style blocks)
  components/
    common/     StatusBadge, EmptyState, FormNotice (shared by portals)
    customer/   homepage sections (Hero, Services, RequestService, ...)
  features/     behaviour by business capability (one folder = one job)
    service-request/  3-step request wizard state + submit
    authentication/   login validation + loading guard + toggles
    diagnosis/        technician diagnosis form
    faq/ how-it-works/ navigation/ motion/ technician/ shared/
  lib/          single source of truth (no duplicates anywhere else)
    service-status.ts  17 canonical statuses + transitions + badge map
    roles.ts           customer | admin | technician | system
    types.ts           ServiceRequest / Technician / Customer shapes
    api-client.ts      typed backend client (throws BackendNotConfigured)
    format.ts          phone/date/request-ref helpers
    site.ts            hotline + WhatsApp + email (replace before launch!)
  styles/
    tailwind.css       brand tokens (@theme)
    customer/01-14     homepage sections, import order = cascade order
```

## Demo mode (frontend-only phase)

No backend is wired yet. Mock data lives in pages, logins validate then
redirect, and unavailable actions are visibly `disabled` with a `title`
explaining what API unlocks them — never a silent `alert()` or fake success.
Replace `SITE_*` values in `src/lib/site.ts` with the real hotline before
launch. `npm run check` and `npm run build` must both pass clean.
