# Sudhar Lab — Typography System (`font.md`)

Single source of truth for every type decision on the frontend.
Rule: no family, size, or weight ships unless it serves the section's job
as defined in `prd.md`, `customer-admin-technician.md`, `technician.md`,
`sudhar.md`. Beauty never outranks psychology here.

## 0. First principles (from the docs)

1. The customer is **buying confidence** before spending money and letting a
   stranger into their home (`customer-admin-technician.md:20`).
   Type must feel effortless: processing fluency *is* trust.
2. Users may be uncomfortable with forms and short on reading patience
   (`customer-admin-technician.md:233`). Nothing content-bearing under 12px.
   Inputs stay 16px on mobile (iOS zoom guard, already true).
3. Phones first, often slow networks (`systemprompt.md:244`,
   `customer-admin-technician.md:782`). System stack first, webfonts with
   `display: swap` (already true). No new font files.
4. Staff portals are scanning tools, not reading tools: admin triages queues,
   tech works one-thumbed in the field (`technician.md:20-28`). Figures
   (IDs, times, invoices) must be tabular; actions must be unmissable.
5. English-only for now (owner decision). No Devanagari work in this pass.
6. Research grounding: fluency→trust (Adobe/PMC); sans +8.7% screen speed
   (MIT); 16px body / 1.5–1.7 leading / 45–75ch measure (Bringhurst, web.dev,
   Material/Apple HIG); italics slow reading (dyslexia research) — never carry
   meaning in italics; hierarchy cuts bounce (NNGroup).

## 1. Global decisions (all portals)

| Decision | Value | Why |
|---|---|---|
| Display family | Nunito 700–900, tight tracking (−0.01…−0.03em) | Rounded, warm, approachable Black for homeowner-facing headlines; owner-rejected Jakarta as too cold. Hero uses full 900. Nav wordmark set in Nunito 800 to match the reference lockup. |
| Text family | Nunito Sans 200–1000 variable (optical sizing), never light body text | Same superfamily as the display = one cohesive warm system; full weight range covers the 400–700 label steps; variable file keeps slow-network loads light. Replaced Public Sans (near-twin of Inter — change was invisible, defeating the purpose). |
| Human touch | Kalam, exactly ONE place (`.qr-handwriting`) | Sturdier handwriting than Caveat at small sizes; signals "real people". A second use would signal unprofessional. |
| Content floor | 12px minimum for anything content-bearing | Lighthouse flags <12px; low-literacy + small phones punish tiny text. |
| Chrome floor | 10px minimum, only tracked-uppercase (`≥0.08em`) 700 labels | Badges/tabs are chrome, not content; tracking + weight compensate size. |
| Body rhythm | 1.6 leading for prose/descriptions | CHI + web.dev sweet spot for comprehension. |
| Figures | `.tnum` (tabular-nums) on IDs, invoices, times, phones | Wobbling digits feel untrustworthy in billing/queue contexts. |
| Italics | Banned for meaning; remove the one existing case | Slows fixation; use color/border for distinction instead. |

---

## 2. CUSTOMER (`/`)

Job of the whole portal: turn anxiety into a submitted request or a phone
call. Two intents only: **Get My Appliance Checked / Call Us** (`:85-88`).

### 2.1 Navigation (`Navigation.astro` + drawer + `ContextPill`)
Purpose: wayfinding + always-visible call escape. Type job: invisible —
links must be tappable labels, never decoration.
Prescription: keep 13.5px/600 links, 13.5px/700 call, `drawer-title` 17px/800.
Change: none (already serves the job).

### 2.2 Hero (`Hero.astro`, `04-hero.css`)
Purpose: answer "what/where/trust" in seconds (`:94-100`). Type job:
one confident promise + two unmissable actions.
Prescription: H1 Outfit 900 `clamp(48,7vw,88)` / 1.03 / −0.03em — keep.
Eyebrow is unstyled `span.eyebrow` → set 12px/700/0.2em uppercase
(current `10.5px` in `02-base.css:96` violates the content floor).
Ribbon micro-labels `10px` (`04-hero.css:237,272`) → `11px` (chrome floor).
Change: eyebrow 10.5→12px; ribbon labels 10→11px. Nothing else.

### 2.3 Services (`Services.astro`, `06-services.css`)
Purpose: "which appliances" + tap-to-start (`:109`). Type job: card titles
are buttons in disguise — big, confident, tappable.
Prescription: keep 26px/800 titles, 14px/1.5 hints.
Section `h2` uses inline `font-size:42px` — replace with shared
`.sec-head h2` (single source; identical render).
Change: delete inline h2 style (use class); rest keep.

### 2.4 RequestService (`RequestService.astro`, `07-request-form.css`)
Purpose: THE money step — simplest possible path to a submitted request
(`:170-174`; "most important customer feature"). Type job: labels must
instruct, inputs must never zoom, progress must orient, receipt must reassure.
Prescription:
- Step `h3` 32px/800 — keep (orientation landmarks).
- Labels 13.5px/700, `(optional)` 500 — keep (instruction > decoration).
- Inputs 14px desktop / 16px mobile — keep (iOS guard already in
  `13-responsive.css:330`).
- Progress numbers `11px` (`:215`) + step labels `11.5px` (`:231`) →
  `12px` (orientation is content; floor applies).
- App option labels `11px` (`:305`, mobile `12px` already) → `12px` base.
- `summary-title`/`success-ref-label` `11px`/`10px` uppercase → `12px`
  (receipt context is high-anxiety; micro-labels must not whisper).
- `success-ref-num` 26px/800/0.06em + ADD `tnum` (phone-quoted number).
- `qr-form-bottom-sub` 11.5px → 12px; `field-hint` 12px keep.
- `.qr-handwriting` Caveat 24px — keep, sole exception by design.

### 2.5 HowItWorks (`HowItWorks.astro`, `08-how-it-works.css`)
Purpose: "what happens after I request" (`:100`) — de-risk the unknown.
Type job: steps must read as a calm sequence, not a wall.
Prescription: keep 16px/800 titles, 13.5px/1.6 descs (sequence rhythm).
Section `h2` inline (`:14`) → shared `.sec-head h2`.
Pills/tags `10–11px` uppercase (`:109,183,421`) → `11px` floor
(`hiw-mob-pill` 10→11px; `hiw-caption-tag` 10.5→11px).
`hiw-mob-pill` 9.5px @480px (`14-motion.css:120`) → `10.5px` (chrome floor).
Change: class-ify h2; 4 micro-label bumps. Nothing else.

### 2.6 TrustSection (`TrustSection.astro`, `09-trust.css`)
Purpose: "why should I trust it" with ONLY deliverable promises (`:136-147`,
no fake ratings). Type job: quiet authority — smaller than hero, warmer.
Prescription: keep 22px/700 titles, 14.5px/1.6 descs, dark section contrast.
Section `h2` inline (`:11`) → shared `.sec-head h2`.
`trust-footer-note` 11px → 12px.
Change: class-ify h2; one bump.

### 2.7 FaqSection (`FaqSection.astro`, `10-faq.css`)
Purpose: dissolve remaining objections before the request (`:119`).
Type job: questions scannable, answers comfortable long-reads.
Prescription: questions 13.5px/600 keep; answers 13px/1.6 → **14px/1.65**
(the only true paragraph reading on the page; CHI: larger reads better).
Section `h2` inline (`:12`) → shared `.sec-head h2`.
Change: answers 13→14px + 1.65; class-ify h2.

### 2.8 FinalCta (`FinalCta.astro`, in `10-faq.css`)
Purpose: last conversion moment (`:121`). Type job: closing certainty.
Prescription: keep 40–56px/800 H2, 17px/1.6 desc, 15px trust strip.
`cta-logo-text p` tagline 8px → 10px tracked (chrome floor; brand legibility).
Change: one bump.

### 2.9 Footer (`Footer.astro`, `11-footer.css`)
Purpose: contact + service/company map + legal. Type job: findable, not loud —
except `.ft-desc` ("Kathmandu's trusted partner…"), whose job is a warm
personal assurance: set in Kalam 17px/1.5, the second and last handwriting use.
Prescription: keep 11px tracked col headers, 13.5px links.
`ft-tagline` 9px → 10px; `ft-bottom-text` 11px → 12px.
Change: two bumps + Kalam trust line.

### 2.10 Overlays (drawer, pill, dock, badges)
Purpose: one-thumb escape hatches. Keep all current sizes except chrome
floors already covered; `ContextPill` 14px/700 keep.

### 2.11 Receipt + 404
`success-ref-num` gets `tnum` (phone dictation). 404 uses Nunito headings +
Nunito Sans body (matches the system).

---

## 3. ADMIN (`/admin`) — Archivo + Source Sans 3 + Plex Mono (never customer/tech voices)

Job of the whole portal: triage queues fast, never misread an ID, status, or
amount (`customer-admin-technician.md:404-426`). Dense is correct here
(density 4–5); the floor still holds for content. Three voices because the
admin has three reading risks: titles = **Archivo 700/800** (formal command);
descriptions = **Source Sans 3 400–700** (fatigue-free shifts); figures =
**IBM Plex Mono 500/600** via one shared layout rule covering
`.req-id/.qc-id/.lj-id/.tc-cj-id/.billing-inv-val` + ID breadcrumbs
(mono kills 0/O + 1/l confusion where a wrong digit misroutes a visit).
Isolated to the two admin layouts; customer/tech untouched.

### 3.1 Shell (`AdminDashboardLayout.astro`)
`.logo-badge` 9px → 10px; `.nav-section-label` 10px → 11px;
`.nav-badge`/`.user-role`/`.badge` 11px → 12px; `.bn-item` + mobile
`.topbar-avatar` 10px → 11px. Nav stays 15px/500-600 (scanning hierarchy).

### 3.2 Login (`admin/login.astro`)
Purpose: staff gate, not marketing. Keep 32px sidebar promise / 32px
"Welcome back" / 16px submit. `.footer-note` 11px → 12px. Nothing else.

### 3.3 Dashboard (`admin/dashboard.astro`)
Purpose: "which requests require action NOW" (`:404`). Type job: queue IDs
+ names + statuses scannable in seconds.
- REMOVE `.qc-problem` italic (`:418`) → normal, keep color distinction.
- `.tech-av`/`.tech-status`/`.sum-label`/`.rd-label` 11px → 12px.
- `.qc-id`/`.lj-id` already `tnum` — extend `tnum` to `.qc-time`? No:
  times pair with names; IDs carry the record identity. Keep as is.

### 3.4 Requests list (`admin/requests/index.astro`)
Purpose: the full queue with filters (`:428-450`). Keep table 14px/600
names, 12px meta. `.tab-pill`/thead/`.req-time` 11px → 12px;
`.req-tech-av` 10px → 11px (avatar initials = chrome).
`req-id` already `tnum` via `StatusBadge` normalization — keep.

### 3.5 Request detail (`admin/requests/[id].astro`)
Purpose: one service case answering "what happened + what next"
(`sudhar.md:1080-1116`). Type job: values > labels; timeline must read as
accountability record (`:511`).
Keep 28px title, 15px/1.65 problem desc, 14px/1.5 notes.
`.step-label`/`.next-action-badge` 11px → 12px. Rest ≥12px — keep.

### 3.6 Technicians (`technicians/index.astro`, `[id].astro`)
Purpose: availability + workload → correct manual assignment (`prd.md:183`).
Keep 28px titles, KPI numerals (already stable shapes).
`.tc-tab-count`/`.skill-chip` 11px → 12px. Detail page already ≥12px — keep.

### 3.7 Customers (`customers/index.astro`, `[id].astro`)
Purpose: directory + 360° history/billing (`:381` trust foundation).
`.cs-stat-label`/`.cs-last-date` 11px → 12px.
`.banner-key`/`.appl-key`/thead/`.status-badge` 11px → 12px.
`.billing-inv-val` already `tnum` — keep.

---

## 4. TECH (`/tech`) — Barlow system (deliberately NOT customer fonts)

Job of the whole portal: "What job? Where? Next action? What to record?"
in sunlight, one-thumbed (`technician.md:9-28`). Biggest type on the site
belongs to the next-action button, not headlines. The reader is staff doing
physical work — not an anxious homeowner — so warmth yields to sturdiness:
titles = **Barlow Condensed 600–800** (narrow signage voice fits small
screens, shouts state at a glance), descriptions = **Barlow 400–700**
(full label range, open grotesque legibility), profile identity = Condensed
(name/stats as confident headlines). Isolated to the two tech layouts'
`--font-h/--font-b`; customer/admin untouched.

### 4.1 Shells + login
`TechDashboardLayout` bottom tabs 11px → 12px (mobile 10px → 11px).
Login: keep 56px brand voice / 32px header / 16px submit; `.footer-note`
11px → 12px.

### 4.2 Dashboard (`tech/dashboard.astro`)
Keep 40px visit time hero (glanceable across the room), 20px appliance,
18px massive CTA. Already clean — no changes.

### 4.3 Jobs (`tech/jobs.astro`)
Purpose: filter + open today's work. `.badge` 11px uppercase → 12px.
Rest keep (17px titles, 15px actions = thumb-first).

### 4.4 Job detail (`tech/jobs/[id].astro`)
Purpose: the central field workspace (`technician.md:172`) — 14 documented
sections. Type job: customer words vs technician words must never visually
merge (`:246-254`).
Keep label/value 12px-up/17px-600 split, 15px/1.4 problem alert,
16px diagnosis inputs. Already ≥12px — no changes.

### 4.5 Profile (`tech/profile.astro`)
Keep 28px stats (earned numbers, glanceable), 16px menu rows.
Already clean — no changes.

---

## 5. Change ledger (implementation checklist)

Customer: eyebrow→12px; ribbon 10→11px ×2; sec-h2 inline→class ×4
(Services, HowItWorks, Trust, Faq); progress 11/11.5→12px; app labels→12px;
summary/success labels→12px; ref-num +`tnum`; bottom-sub→12px; answers
13→14px/1.65; logo tagline 8→10px; ft-tagline 9→10px; ft-bottom 11→12px;
trust-note 11→12px; mob-pill 10→11px (+9.5→10.5 @480px); caption-tag→11px.
Admin: shell 7 bumps; login note→12px; dashboard italic removal + 4 bumps;
list 4 bumps; detail 2 bumps; tech-list 2 bumps; customers 5 bumps.
Tech: tabs 11→12px (+10→11px mobile); jobs badge→12px; logins note→12px.
Everything else: KEEP. Total ≈ 35 micro-edits, zero family changes, zero
layout changes.
