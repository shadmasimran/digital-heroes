# Ripple Rounds — Digital Heroes PRD (Level 1)

A subscription web app that combines golf score tracking (Stableford), a monthly prize draw and charity giving.
Built with **Next.js 14 (App Router) · Supabase (Auth, Postgres, Storage, RLS) · Stripe · Tailwind · Framer Motion**, deployed on **Vercel**.

The product name is a placeholder; change it in `lib/brand.ts`.

---

## 1. Run it locally

```bash
npm install
cp .env.example .env.local      # then fill in the values (see below)
```

1. **Create a NEW Supabase project.** Open *SQL Editor*, paste all of `supabase/schema.sql` and run it. This creates tables, RLS policies, triggers, the private `proofs` storage bucket and seed charities.
2. In Supabase go to *Authentication → Providers → Email* and **turn off "Confirm email"** so reviewers can sign up and continue immediately.
3. Copy *Project URL*, *anon key* and *service_role key* (Settings → API) into `.env.local`.
4. Payments — pick one:
   * **Test checkout (no Stripe account):** set `DEMO_PAYMENTS=true`. Subscribing opens a built-in checkout page where you enter a test card (see §8).
   * **Stripe test mode:** set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (see §3) and leave `DEMO_PAYMENTS` unset.
5. Create the reviewer accounts and demo data, then start the app:

```bash
npm run seed     # creates admin + subscribers with scores
npm run dev      # http://localhost:3000
npm test         # 12 unit tests for the draw / prize / score / subscription logic
```

### Test credentials (created by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@ripplerounds.test` | `Admin@12345` |
| Subscriber (active yearly plan, 5 scores) | `demo@ripplerounds.test` | `Demo@12345` |
| 8 more active subscribers | `player1…8@ripplerounds.test` | `Demo@12345` |

> Update the credentials table in this README with your own deployed values before submitting.

## 2. Deploy (new accounts required by the brief)

1. Push this folder to a new Git repo and import it into a **new Vercel account**.
2. Add the environment variables from `.env.example` in Vercel (*Settings → Environment Variables*). Set `NEXT_PUBLIC_SITE_URL` to your production URL.
3. Deploy, then run `npm run seed` locally once (it talks to your Supabase project, not Vercel).

## 3. Stripe webhook (only if not using demo mode)

* Endpoint: `https://YOUR-SITE/api/stripe/webhook`
* Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
* Put the signing secret in `STRIPE_WEBHOOK_SECRET`. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

---

## 4. Requirements interpretation (PRD ambiguities and how they were resolved)

The PRD says ambiguity is part of the test, so these decisions are explicit. Most are constants in `lib/draw.ts` or rows in the `settings` table.

| Topic | Decision |
|---|---|
| **What the draw picks** | Five distinct numbers in 1–45 (the Stableford range). A subscriber's entry is their 5 stored scores; match count = how many *distinct* score values appear in the drawn numbers. |
| **Prize pool size** | The PRD says "a fixed portion" without a figure. Configurable via `settings.prize_pool_percent` (default **50%**) of each active subscriber's *monthly-equivalent* fee; a yearly plan counts as 1/12 per month. |
| **Tiers** | 5 matches 40% (jackpot), 4 matches 35%, 3 matches 25%. The 3-match tier absorbs rounding so tiers always sum to the pool. |
| **Splitting** | Equal split among winners in a tier; leftover paise go 1-each to the first winners so no money disappears. |
| **Rollover** | Only the 5-match jackpot rolls over (added to next draw's jackpot). Unclaimed 4/3-match pools do **not** roll over, per the PRD table; they are reported as "unclaimed". |
| **Algorithmic draw** | "Weighted by score frequency": weight = 1 + how often a score appears across eligible entries. Admin can flip it to favour *rare* scores instead. Random mode is a uniform lottery draw. |
| **Who is eligible** | Active subscribers holding all 5 scores. The pool itself is based on *all* active subscribers ("based on active subscriber count"). |
| **Rolling 5 scores** | Enforced in the database (trigger) and validated in the app. "Oldest" means oldest by *date played*. A round older than all five stored scores is rejected with an explanation rather than silently dropped. One score per date (unique constraint). |
| **Draw lifecycle** | Simulate (unlimited, invisible to users) → Publish (final). Publishing locks in the simulated numbers, recomputes winners against live data, and claims the draw atomically so a double-click cannot pay out twice. Admin can also type the five numbers manually to test the tiers. |
| **Subscription states** | `active`, `lapsed` (period ended, not renewed), `cancelled`, `inactive`. Status is derived from the period end on every authenticated request (`getViewer`), so access never depends on a stale flag. Cancelling keeps access until the paid period ends. |
| **Charity share** | Chosen at signup; minimum 10% (enforced by a DB check, the UI and server actions); changeable any time. Each payment writes the charity's share to a `contributions` ledger, which powers the reports. |
| **Independent donation** | A separate one-off payment from a charity's page, recorded as `source = donation`. Not linked to the draw. |
| **Winner verification** | Winner uploads a screenshot to a **private** bucket → admin sees a short-lived signed URL → Approve / Reject (with reason; the winner can re-upload) → payment Pending → Paid. Marking paid requires approval first. |
| **Sections missing from the PDF** | The supplied PDF has no page 11 (§13 Technical, §14 Scalability). Assumed: responsive, secure by default, extensible data model — see §5. |

## 5. Architecture and scalability notes

```
app/                 routes (server components) — public, dashboard, admin
app/actions/         server actions: every mutation, each starting with an auth check
app/api/stripe/      webhook (signature verified, idempotent)
lib/draw.ts          pure draw + prize engine  → unit tested
lib/subscription.ts  subscription state rules  → unit tested
lib/payments.ts      records payments + charity shares (idempotent via external_ref)
supabase/schema.sql  tables, RLS, triggers, storage bucket, seeds
```

* **Security:** RLS on every table. Users can only read/write their own rows. Money-touching tables (subscriptions, contributions, winners, entries) are written only by the server with the service-role key, after `requireUser` / `requireAdmin`. A DB trigger blocks role escalation. Proof screenshots are private. Open redirects are blocked. Service-role code is marked `server-only`.
* **Extensibility:** draw logic is pure and isolated (add a new mode by adding a function); prices and pool % live in `settings`; new tiers only need `TIER_SHARES`; money is stored in minor units so adding currencies means adding a column, not a migration of meaning.
* **Multi-country / campaigns:** `charities` and `contributions` are already decoupled from users, so per-region charities or campaign pages are additive.
* **Scale path:** draw evaluation is O(entries) and runs on the server; for very large subscriber bases move `loadDrawInputs` + publish into a Postgres function or background job (noted in `lib/draw-service.ts`).

## 6. PRD coverage / testing checklist

| Checklist item | Where |
|---|---|
| Signup & login | `/signup`, `/login` |
| Subscription flow (monthly & yearly) | `/subscribe` → Stripe or demo |
| Score entry, 5-score rolling logic | dashboard; DB trigger + `lib/scores.ts` |
| Draw system + simulation | `/admin/draws` |
| Charity selection & contribution calc | signup, dashboard, `lib/payments.ts` |
| Winner verification & payout tracking | dashboard upload → `/admin/winners` |
| User dashboard (all 5 modules) | `/dashboard` |
| Admin panel (users, draws, charities, winners, reports) | `/admin/*` |
| Data accuracy | `npm test` |
| Responsive design | Tailwind, mobile-first; native `<details>` mobile menu |
| Error handling & edge cases | validation on every action, empty states, friendly errors |

**Suggested reviewer walkthrough:** log in as admin → *Draws* → simulate (try the manual numbers `28 30 32 35 38`) → publish → log in as `demo@…` → see the win on the dashboard → upload any image as proof → back as admin, *Winners* → approve → mark as paid.

## 7. Known limitations

* Publishing a draw performs several writes without a single DB transaction (the "claim" step guarantees it can only run once, but a mid-way crash would need a manual retry). A Postgres function would make it fully atomic.
* Email notifications (winner alerts, renewal reminders) are not included; in-app status is used instead.
* Charity images are URL-based; there is no image upload for charities.

## 8. Test payment flow

**Monthly (or Yearly) plan → Payment page → Payment successful → Subscription active**

1. `/subscribe`: choose a plan and click **Continue to payment**.
2. `/checkout`: an order summary (plan, price, charity share) and a card form. Use a test card:

| Card number | Result |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds |
| `5555 5555 5555 4444` | Payment succeeds (Mastercard) |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |

   Any future expiry (e.g. `12/30`) and any 3-digit CVC. The **Fill in the test card for me** link completes the form in one click. Real card numbers are refused, and card data is validated then discarded — it is never stored or logged.
3. `/subscribe/success`: **Payment successful** with plan, amount, renewal date, charity share and a reference. It only ever shows success when the database says the subscription is active.
4. `/dashboard`: the subscription appears as **Active**, and score entry and draw entry unlock.

**With Stripe keys instead** (`STRIPE_SECRET_KEY` set, `DEMO_PAYMENTS` unset), the same flow uses Stripe's hosted Checkout in test mode (card `4242 4242 4242 4242`). Prices are sent inline (`price_data`), so no Stripe Price IDs exist to be misconfigured. The success page verifies the Checkout Session with Stripe itself, so activation does not depend on the webhook arriving first (the webhook still handles renewals and cancellations, idempotently).
