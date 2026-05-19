@AGENTS.md

# GoldPoints — Full Project Guide for Claude

## What this is
GoldPoints is a Shopify loyalty program SaaS. Merchants connect their Shopify store via OAuth, install a floating widget on their storefront, and their customers earn/redeem points automatically. Built by Tony Abi Chahine (tonyabichahine@gmail.com), non-developer.

## Live URL
**https://goldpoints-shopify.vercel.app** — this is the ONLY real production URL. Do NOT use `goldpoints.vercel.app` (wrong, returns 404).

## How to run locally
```
cd Desktop\goldpoints-app
npm run dev
```
Opens at http://localhost:3000

## CRITICAL — before every git push
Always run `npm run build` first. Vercel runs the same TypeScript check and will fail if you don't catch errors locally first.
```
npm run build   # must show ✓ before pushing
git add ...
git commit -m "..."
git push
```
Vercel auto-deploys in ~60 seconds after push.

## Running Supabase SQL migrations
No psql or Supabase CLI installed. Use the Management API with Tony's PAT:
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/cybrenydxookzuexluni/database/query" \
  -H "Authorization: Bearer <SUPABASE_PAT>" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR SQL HERE"}'
```
Tony's Supabase PAT is stored in memory — never put it in any committed file.
Empty array `[]` response = success.

## Tech stack
| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Turbopack) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) — project: `cybrenydxookzuexluni` |
| Auth | Email+password (merchants), bcryptjs passwords (customers), cookie session (admin) |
| Email | Resend — `resend` npm package |
| AI | Groq API — LLaMA 3.3 70B (`llama-3.3-70b-versatile`) |
| Hosting | Vercel — repo: `tonyabichahine/goldpoints-shopify` |
| Shopify | Partner app — Client ID: `78c3102f2df130e39ee82789e038e7ae` |

## Environment variables (.env.local)
All secrets live in `Desktop\goldpoints-app\.env.local` — **never commit this file**.
```
NEXT_PUBLIC_SUPABASE_URL=https://cybrenydxookzuexluni.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
SHOPIFY_API_KEY=<from Shopify Partners dashboard>
SHOPIFY_API_SECRET=<from Shopify Partners dashboard>
SHOPIFY_SCOPES=read_orders,read_customers,write_customers,write_discounts
NEXT_PUBLIC_APP_URL=https://goldpoints-shopify.vercel.app
ADMIN_PASSWORD=admin123
GROQ_API_KEY=<from console.groq.com — also set on Vercel>
RESEND_API_KEY=<from resend.com dashboard — rotate if exposed>
TEST_EMAIL=tonyabichahine@gmail.com   ← dev only: routes all emails to Tony until domain verified
```
On Vercel all of these are set as Environment Variables. `TEST_EMAIL` is temporary — remove it once a real domain is verified on Resend.

## Email setup (Resend)
- Package: `resend` (installed)
- Currently using `from: onboarding@resend.dev` (Resend's shared test domain)
- `TEST_EMAIL` env var routes all outbound emails to Tony's Gmail during development
- **To go live:** verify a custom domain at resend.com/domains, update `from` address to `noreply@yourdomain.com`, remove `TEST_EMAIL` env var
- Emails sent: welcome email when Tony creates a merchant account in admin

## Shopify Partner app
- Dashboard: partners.shopify.com
- Client ID: `78c3102f2df130e39ee82789e038e7ae`
- App URL: `https://goldpoints-shopify.vercel.app`
- Allowed redirect URL: `https://goldpoints-shopify.vercel.app/api/auth/callback`
- Scopes: `read_orders,read_customers,write_customers,write_discounts`

## File map
```
src/
├── app/
│   ├── page.tsx                              # Home — "I'm a Merchant" + "I'm a Customer"
│   ├── admin/page.tsx                        # Admin dashboard — only at /admin directly (not linked)
│   ├── merchant/page.tsx                     # Merchant dashboard — 4 tabs: Overview, Customers, Offers, Settings
│   ├── portal/[domain]/page.tsx             # Customer portal per merchant
│   ├── ref/[code]/page.tsx                  # Referral redirect → store with ?gp_ref=
│   ├── api/
│   │   ├── auth/
│   │   │   ├── install/route.ts              # Starts Shopify OAuth
│   │   │   └── callback/route.ts             # OAuth callback — links to existing merchant
│   │   ├── webhooks/
│   │   │   └── orders/
│   │   │       ├── route.ts                  # Order created → award points (HMAC verified)
│   │   │       └── cancelled/route.ts        # Order cancelled → deduct points (HMAC verified)
│   │   ├── widget/                           # CORS-enabled (called from any Shopify storefront)
│   │   │   ├── config/route.ts               # Widget settings + active offers for a shop
│   │   │   ├── register/route.ts             # Legacy customer registration
│   │   │   ├── points/route.ts               # Customer points/tier/referral_code lookup
│   │   │   ├── profile/route.ts              # Create/update customer profile; handles gp_ref referral
│   │   │   ├── follow/route.ts               # Award social follow points once per customer
│   │   │   └── redeem/route.ts               # Redeem offer → creates real Shopify discount code
│   │   ├── portal/
│   │   │   ├── global-login/route.ts         # Customer login across all stores
│   │   │   ├── login/route.ts                # Customer login for specific store
│   │   │   └── history/route.ts              # Customer transaction history
│   │   ├── admin/
│   │   │   ├── login/route.ts                # Sets admin_session cookie
│   │   │   ├── overview/route.ts             # Platform stats + all merchants
│   │   │   └── merchants/
│   │   │       ├── route.ts                  # PATCH (toggle active) + DELETE merchant
│   │   │       └── add/route.ts              # Creates merchant + sends welcome email
│   │   └── merchant/
│   │       ├── login/route.ts                # Merchant login → sets merchant_session cookie
│   │       ├── me/route.ts                   # GET: merchant data | DELETE: logout
│   │       ├── change-password/route.ts      # Verifies current password, sets new bcrypt hash
│   │       ├── customers/route.ts            # Lists customers
│   │       ├── offers/route.ts               # CRUD offers
│   │       ├── settings/route.ts             # Saves all widget/points/tier settings
│   │       ├── analytics/
│   │       │   ├── route.ts                  # Main analytics: KPIs, 14d charts, top customers, recent activity
│   │       │   ├── detail/route.ts           # Drill-down: points/redemptions/signups/activity/segment
│   │       │   └── segments/route.ts         # Customer lifecycle segment counts for donut chart
│   │       └── ai-insights/route.ts          # AI chat — Groq LLaMA 3.3 70B, context-aware
├── lib/
│   ├── supabase.ts                           # supabase (anon) + supabaseAdmin (service role)
│   └── shopify.ts                            # OAuth helpers, getTier(points, silverThreshold, goldThreshold)
public/
├── widget.js                                 # Embeddable IIFE widget — no dependencies
└── logo.png                                  # GoldPoints logo
```

## Database (Supabase) — all tables are live
| Table | Key columns |
|---|---|
| `merchants` | id, shopify_domain (nullable), store_name, email, password_hash, active, points_per_dollar, signup_bonus, birthday_bonus, widget_primary_color, widget_btn_text_color, widget_title, widget_position, widget_offset_bottom, widget_offset_side, social_follow_url, follow_points, referral_points, **tier_silver**, **tier_gold**, shopify_access_token |
| `customers` | id, merchant_id, email, name, phone, birthday, marketing_consent, password_hash, points, tier, referral_code, referred_by |
| `offers` | id, merchant_id, name, description, points_required, offer_type, offer_value, active |
| `point_transactions` | id, merchant_id, customer_id, type, points, description, shopify_order_id, created_at |
| `redemptions` | id, merchant_id, customer_id, offer_id, discount_code, created_at |

**point_transactions.type values:**
`earn_order`, `earn_signup`, `earn_referral`, `earn_follow`, `earn_birthday`, `redeem`, `deduct_cancel`

`deduct_cancel` is inserted when a Shopify order is cancelled — it stores the same `shopify_order_id` as the original `earn_order`. The segmentation logic excludes earn transactions whose `shopify_order_id` appears in any `deduct_cancel` row when computing "last purchase date".

## Tiers
| Tier | Default min points | Icon |
|---|---|---|
| Bronze | 0 | 🥉 |
| Silver | 500 (configurable) | 🥈 |
| Gold | 1000 (configurable) | 🥇 |

Thresholds are set per merchant via `tier_silver` and `tier_gold` columns. `getTier(points, silverThreshold, goldThreshold)` in `src/lib/shopify.ts` defaults to 500/1000 if not set. All three call sites (earn webhook, cancel webhook, redeem) pass merchant thresholds.

## Merchant dashboard tabs
1. **Overview** — KPI cards (members, points issued 30d, points redeemed 30d, redemptions 30d), Points Liability card, 14-day bar charts (points issued + signups), Top Customers, Recent Activity, Tier Breakdown, Offer Performance bars, Customer Health donut chart
2. **Customers** — full customer table with tier filter (All / Bronze / Silver / Gold)
3. **Offers** — CRUD for loyalty offers
4. **Settings** — three sections in one tab:
   - *Widget* — all program settings (color, position, points/dollar, bonuses, tier thresholds, referral, social follow) + Save button
   - *Install* — Liquid snippet + webhook setup instructions
   - *Account* — logged-in email + Change Password

## Analytics drill-down drawers
Clicking KPI cards or "See all" opens a slide-in drawer. `type` param options:
- `points` — points issued transactions (period filter: 7d/30d/90d/all)
- `redemptions` — redemption log with discount codes (period filter)
- `signups` — new customer list (period filter)
- `activity` — all transactions (period filter)
- `segment` — customers in a lifecycle segment (Active/At Risk/Dormant/Lapsing/Lost/Never Purchased)

API: `GET /api/merchant/analytics/detail?type=X&period=Y` or `?type=segment&segment=active`

## Customer lifecycle segments
Computed from last non-cancelled `earn_order` per customer:
| Segment | Days since last purchase | Color |
|---|---|---|
| Active | ≤ 30 | green |
| At Risk | 31–60 | yellow |
| Dormant | 61–90 | orange |
| Lapsing | 91–180 | red |
| Lost | 180+ | gray |
| Never Purchased | no earn_order ever | purple |

API: `GET /api/merchant/analytics/segments` — returns counts + percentages for the donut chart.

## AI Assistant
- Button in nav bar (top right), opens as a fixed right-side drawer (420px wide)
- No overlay — main content shifts right (`mr-[420px]`) so the page stays interactive
- Calls `POST /api/merchant/ai-insights` with `{ message, history, pageContext }`
- `pageContext` is built from whichever tab is active + what data is loaded (analytics numbers, customers, offers, settings)
- Backend fetches live store data (30d stats, top customers, offers) and builds a system prompt
- Model: `llama-3.3-70b-versatile` via Groq API, `max_tokens: 400`, `temperature: 0.6`
- Suggested starter questions shown when chat is empty

## Merchant settings (saveable fields)
`widget_primary_color`, `widget_btn_text_color`, `widget_position`, `widget_offset_bottom`, `widget_offset_side`, `widget_title`, `points_per_dollar`, `signup_bonus`, `birthday_bonus`, `social_follow_url`, `follow_points`, `referral_points`, `tier_silver`, `tier_gold`

## Admin
- URL: `goldpoints-shopify.vercel.app/admin` (not linked — Tony accesses directly)
- Password: `admin123` (env var `ADMIN_PASSWORD`)
- Creates merchant accounts with email + password + optional Shopify domain
- Can pause/activate/delete merchants, view all stats

## Test store
- **Scarpe** — `pc0w3w-y4.myshopify.com` (Tony's test Shopify store)
- Widget snippet installed in **Scarpe - Dev** unpublished theme (safe — does not affect live "Rebel" theme)
- Shopify Partner app connected to this store via OAuth; access token stored on merchant record
- To test: Shopify Admin → Online Store → Themes → Scarpe - Dev → Preview

## How the product works end-to-end
1. **Tony creates merchant** → `/admin` → Add Merchant (store name + email + password) → welcome email sent
2. **Merchant logs in** → home page → "I'm a Merchant" → email + password → `merchant_session` cookie → dashboard
3. **Merchant connects Shopify** → yellow banner → enters `.myshopify.com` domain → OAuth → access token stored
4. **Merchant installs widget** → Settings → Install section → copies Liquid snippet → pastes in theme.liquid
5. **Customer visits store** → sees 🎁 pill button in merchant's brand color
6. **Order points:** webhook fires → `points_per_dollar × total` awarded, tier recalculated with merchant thresholds
7. **Order cancelled:** cancelled webhook fires → points deducted, `deduct_cancel` transaction recorded
8. **Referral:** unique link → `/ref/[code]` → store with `?gp_ref=` → credited on new customer join

## What's working (as of 2026-05-19)
- Merchant email+password login (Tony-controlled onboarding)
- Welcome email via Resend on merchant creation (routed to TEST_EMAIL during dev)
- Merchant connects Shopify via OAuth from inside dashboard
- Full widget: pill launcher, welcome carousel, profile completion, Home/Rewards/Offers/Profile tabs
- Referral system: unique codes, /ref/[code] redirect, localStorage persistence through auth
- Social follow: honor-system one-time points
- Order points via webhook (HMAC verified) + cancellation deduction webhook
- Customer portal: email+password login, points, history, redeem
- Admin: create merchants, stats, manage
- **Analytics dashboard:** KPI cards, 14-day bar charts, top customers, recent activity, drill-down drawers with period filters
- **Points Liability card**, **Offer Performance** mini-bars, **Tier Breakdown** stacked visual
- **Customer Health** donut chart with 6 lifecycle segments (cancelled orders excluded from last purchase)
- **AI assistant** in nav bar — context-aware chat powered by Groq LLaMA 3.3 70B
- **Merchant-configurable tier thresholds** — Silver/Gold point minimums set per store in Settings
- Customers tab tier filter (All / Bronze / Silver / Gold)
- Settings tab consolidates Widget, Install, and Account in one place
- GoldPoints logo as favicon and in welcome emails

## What is NOT yet built
1. **Email domain** — verify a domain on Resend to send to real merchant emails (remove TEST_EMAIL after)
2. **Birthday bonus logic** — column exists, no cron/trigger yet
3. **Customer tags in Shopify** — tag customers by tier (gp-gold etc.) — needs `write_customers` scope (already in app)
4. **Email/WhatsApp campaigns** — merchants send campaigns to customer segments
5. **Subscription/billing** — Stripe for merchant payments
6. **Forgot password** — customer + merchant password reset via email

## Owner context
Tony is a non-developer building this as a SaaS product. Keep explanations clear, implement directly without long preambles. Use `py -m pip` (not `pip`) if Python is ever needed. Never push to GitHub without Tony's explicit instruction.
