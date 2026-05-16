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

## Tech stack
| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Turbopack) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) — project: `cybrenydxookzuexluni` |
| Auth | Email+password (merchants), bcryptjs passwords (customers), cookie session (admin) |
| Email | Resend — `resend` npm package |
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
│   ├── page.tsx                              # Home — "I'm a Merchant" (email+password) + "I'm a Customer" (email+password)
│   ├── admin/page.tsx                        # Admin dashboard — only at /admin directly (not linked)
│   ├── merchant/page.tsx                     # Merchant dashboard — loads from merchant_session cookie
│   ├── portal/[domain]/page.tsx             # Customer portal per merchant
│   ├── ref/[code]/page.tsx                  # Referral redirect → store with ?gp_ref=
│   ├── api/
│   │   ├── auth/
│   │   │   ├── install/route.ts              # Starts Shopify OAuth — accepts merchant_id param, embeds in state
│   │   │   └── callback/route.ts             # OAuth callback — links to existing merchant via state merchant_id
│   │   ├── webhooks/
│   │   │   └── orders/route.ts               # Shopify webhook → awards points on purchase (HMAC verified)
│   │   ├── widget/                           # CORS-enabled (called from any Shopify storefront)
│   │   │   ├── config/route.ts               # Widget settings + active offers for a shop
│   │   │   ├── register/route.ts             # Legacy customer registration with password
│   │   │   ├── points/route.ts               # Customer points/tier/referral_code lookup by email
│   │   │   ├── profile/route.ts              # Create/update customer profile; handles gp_ref referral
│   │   │   ├── follow/route.ts               # Award social follow points once per customer
│   │   │   └── redeem/route.ts               # Redeem offer → creates real Shopify discount code
│   │   ├── portal/
│   │   │   ├── global-login/route.ts         # Customer login across all stores (email+password)
│   │   │   ├── login/route.ts                # Customer login for specific store
│   │   │   └── history/route.ts              # Customer transaction history
│   │   ├── admin/
│   │   │   ├── login/route.ts                # Sets admin_session cookie
│   │   │   ├── overview/route.ts             # Platform stats + all merchants
│   │   │   └── merchants/
│   │   │       ├── route.ts                  # PATCH (toggle active) + DELETE merchant
│   │   │       └── add/route.ts              # Creates merchant with bcrypt password + sends welcome email via Resend
│   │   └── merchant/
│   │       ├── login/route.ts                # Merchant email+password login → sets merchant_session cookie
│   │       ├── me/route.ts                   # GET: merchant data from session | DELETE: logout (clears cookie)
│   │       ├── change-password/route.ts      # Verifies current password, sets new bcrypt hash
│   │       ├── customers/route.ts            # Lists customers (uses merchant_session)
│   │       ├── offers/route.ts               # CRUD offers (uses merchant_session)
│   │       └── settings/route.ts             # Saves widget/points settings (uses merchant_session)
├── lib/
│   ├── supabase.ts                           # supabase (anon) + supabaseAdmin (service role)
│   └── shopify.ts                            # OAuth helpers, Shopify API fetch, discount code creator, getTier()
public/
├── widget.js                                 # Embeddable IIFE widget — no dependencies
└── logo.png                                  # GoldPoints logo (gold star coin + purple orbit)
src/app/
└── icon.png                                  # Same logo — used as browser tab favicon
supabase/
└── schema.sql                                # DB schema reference — already applied
```

## Database (Supabase) — all tables are live
| Table | Key columns |
|---|---|
| `merchants` | id, shopify_domain (nullable), store_name, email, password_hash, active, points_per_dollar, signup_bonus, birthday_bonus, widget_primary_color, widget_title, widget_position, social_follow_url, follow_points, referral_points, shopify_access_token |
| `customers` | id, merchant_id, email, name, phone, birthday, marketing_consent, password_hash, points, tier, referral_code, referred_by |
| `offers` | id, merchant_id, name, description, points_required, offer_type, offer_value, active |
| `point_transactions` | id, merchant_id, customer_id, type, points, description, created_at |
| `redemptions` | id, merchant_id, customer_id, offer_id, discount_code, created_at |

**Columns added via ALTER TABLE (already applied):**
- `customers.password_hash TEXT`
- `customers.marketing_consent BOOLEAN`
- `customers.referral_code TEXT`
- `customers.referred_by UUID`
- `merchants.password_hash TEXT`
- `merchants.social_follow_url TEXT`
- `merchants.follow_points INT`
- `merchants.referral_points INT`
- `merchants.birthday_bonus INT`
- `merchants.shopify_domain` — NOT NULL constraint dropped (nullable now)

**point_transactions.type values:** `earn_order`, `earn_signup`, `earn_referral`, `earn_follow`, `earn_birthday`, `redeem`

## How the product works end-to-end
1. **Tony creates merchant** → `/admin` → Add Merchant (store name + email + password) → welcome email sent to Tony's Gmail (TEST_EMAIL) during dev
2. **Merchant logs in** → `goldpoints-shopify.vercel.app` → "I'm a Merchant" → email + password → `merchant_session` cookie set → dashboard opens
3. **Merchant connects Shopify** → yellow banner in dashboard → enters `.myshopify.com` domain → OAuth → access token stored, `shopify_domain` updated on merchant record
4. **Merchant installs widget** → Install tab → copies Liquid snippet → pastes in theme.liquid before `</body>`
5. **Customer visits store** → sees 🎁 pill button in merchant's brand color
6. **Not logged in:** welcome carousel + Register/Login buttons → Shopify native auth
7. **Logged in (Shopify):** Liquid passes email+name → widget auto-detects → profile completion or home tabs
8. **Home tabs:** Home (referral + tier) | Rewards (redeem) | Offers (earning methods) | 👤 (profile/password)
9. **Order points:** webhook fires → points_per_dollar × total awarded
10. **Referral:** unique link → `/ref/[code]` → store with `?gp_ref=` → credited on new customer join

## Merchant auth flow
- Tony creates accounts manually via `/admin` — this is intentional (paid service, controlled onboarding)
- Login: email + password → POST `/api/merchant/login` → `merchant_session` cookie (merchant UUID, 7 days)
- Session check: all `/api/merchant/*` routes read `merchant_session` cookie → look up merchant by ID
- Logout: DELETE `/api/merchant/me` → clears cookie
- Change password: Account tab in dashboard → POST `/api/merchant/change-password`
- Shopify connection: inside dashboard → enter domain → `/api/auth/install?shop=domain&merchant_id=ID` → OAuth → callback updates merchant record

## Widget install snippet (Liquid — goes in Shopify theme before </body>)
```liquid
{% if customer %}
<script src="https://goldpoints-shopify.vercel.app/widget.js"
  data-shop="{{ shop.permanent_domain }}"
  data-customer-email="{{ customer.email }}"
  data-customer-name="{{ customer.first_name }} {{ customer.last_name }}">
</script>
{% else %}
<script src="https://goldpoints-shopify.vercel.app/widget.js"
  data-shop="{{ shop.permanent_domain }}">
</script>
{% endif %}
```

## Customer auth flow
- Widget (Shopify-logged-in): email+name passed via Liquid attributes → checked against DB → home or profile completion
- Birthday and consent are optional in profile completion
- Referral code (`gp_ref`) saved to localStorage immediately on page load — survives Shopify auth redirect
- Portal login: email + password → bcrypt verified

## Tiers
| Tier | Min points | Icon |
|---|---|---|
| Bronze | 0 | 🥉 |
| Silver | 500 | 🥈 |
| Gold | 1000 | 🥇 |

## Merchant settings
`points_per_dollar`, `signup_bonus`, `birthday_bonus`, `referral_points`, `follow_points`, `social_follow_url`, `widget_primary_color`, `widget_title`, `widget_position`

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

## What's working (as of 2026-05-16)
- Merchant email+password login (Tony-controlled onboarding)
- Welcome email via Resend on merchant creation (routed to TEST_EMAIL during dev)
- Change password in merchant Account tab
- Merchant connects Shopify from inside dashboard (OAuth with merchant_id in state)
- Full widget: pill launcher, welcome carousel, profile completion, Home/Rewards/Offers/Profile tabs
- Referral system: unique codes, /ref/[code] redirect, localStorage persistence through auth
- Social follow: honor-system one-time points
- Order points via webhook (HMAC verified)
- Customer portal: email+password login, points, history, redeem
- Admin: create merchants, stats, manage
- GoldPoints logo as favicon and in welcome emails
- Tab title: "GoldPoints — Loyalty Rewards for Shopify"
- Widget snippet installed in Scarpe Dev unpublished theme for testing

## What is NOT yet built
1. **Email domain** — need to verify a domain on Resend to send to real merchant emails (remove TEST_EMAIL after)
2. **Birthday bonus logic** — column exists, no cron/trigger yet
3. **Customer tags in Shopify** — tag customers by tier (gp-gold etc.) + products bought — needs `write_customers` scope (already in app)
4. **Email/WhatsApp campaigns** — merchants send campaigns to customer segments
5. **Subscription/billing** — Stripe for merchant payments
6. **Analytics charts** — visual graphs in merchant dashboard
7. **Forgot password** — customer + merchant password reset via email

## Owner context
Tony is a non-developer building this as a SaaS product. Keep explanations clear, implement directly without long preambles. Use `py -m pip` (not `pip`) if Python is ever needed. Never push to GitHub without Tony's explicit instruction.
