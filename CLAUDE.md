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
| Auth | Shopify OAuth (merchants), bcryptjs passwords (customers), cookie session (admin) |
| Hosting | Vercel — repo: `tonyabichahine/goldpoints-shopify` |
| Shopify | Partner app — Client ID: `2236f7c85e070634127c0bbe6fdadbaa` |

## Environment variables (.env.local)
All secrets live in `Desktop\goldpoints-app\.env.local` — **never commit this file**.
```
NEXT_PUBLIC_SUPABASE_URL=https://cybrenydxookzuexluni.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...          ← server-side DB access
SHOPIFY_API_KEY=2236f7c85e070634127c0bbe6fdadbaa
SHOPIFY_API_SECRET=shpss_b86bc8d8...
SHOPIFY_SCOPES=read_orders,read_customers,write_discounts
NEXT_PUBLIC_APP_URL=https://goldpoints-shopify.vercel.app
ADMIN_PASSWORD=admin123
```
On Vercel these are set as Environment Variables in the project dashboard. NEXT_PUBLIC_APP_URL must be `https://goldpoints-shopify.vercel.app`.

## Shopify Partner app
- Dashboard: partners.shopify.com
- App URL: `https://goldpoints-shopify.vercel.app`
- Allowed redirect URL: `https://goldpoints-shopify.vercel.app/api/auth/callback`
- These must match exactly or OAuth will fail with "invalid redirect URI"

## File map
```
src/
├── app/
│   ├── page.tsx                              # Home — "I'm a Merchant" tab (Shopify OAuth) + "I'm a Customer" tab (email+password login)
│   ├── admin/page.tsx                        # Admin dashboard — only accessible at /admin directly (not linked from home)
│   ├── merchant/page.tsx                     # Merchant dashboard (customers, offers, widget settings, install instructions)
│   ├── portal/[domain]/page.tsx             # Customer portal per merchant — points, history, redeem offers
│   ├── ref/[code]/page.tsx                  # Referral redirect — looks up customer by referral_code, redirects to their store with ?gp_ref=
│   ├── api/
│   │   ├── auth/
│   │   │   ├── install/route.ts              # Starts Shopify OAuth
│   │   │   └── callback/route.ts             # OAuth callback → upserts merchant in DB
│   │   ├── webhooks/
│   │   │   └── orders/route.ts               # Shopify webhook → awards points on purchase (HMAC verified)
│   │   ├── widget/                           # CORS-enabled (called from any Shopify storefront)
│   │   │   ├── config/route.ts               # Widget settings + active offers for a shop
│   │   │   ├── register/route.ts             # Registers customer with bcrypt password (legacy — widget now uses profile route)
│   │   │   ├── points/route.ts               # Looks up customer points/tier/referral_code by email
│   │   │   ├── profile/route.ts              # Creates or updates customer profile; handles gp_ref referral crediting
│   │   │   ├── follow/route.ts               # Awards social follow points once per customer (earn_follow transaction)
│   │   │   └── redeem/route.ts               # Redeems offer → creates real Shopify discount code
│   │   ├── portal/
│   │   │   ├── global-login/route.ts         # Home page customer login — finds customer across all stores by email+password
│   │   │   ├── login/route.ts                # Portal login for a specific store (email + password, bcrypt verified)
│   │   │   └── history/route.ts              # Transaction history for portal
│   │   ├── admin/
│   │   │   ├── login/route.ts                # Sets admin_session cookie
│   │   │   ├── overview/route.ts             # All merchants + platform stats
│   │   │   └── merchants/
│   │   │       ├── route.ts                  # PATCH (toggle active) + DELETE merchant
│   │   │       └── add/route.ts              # Admin manually adds a merchant
│   │   └── merchant/
│   │       ├── customers/route.ts            # Lists customers for logged-in merchant
│   │       ├── offers/route.ts               # CRUD for merchant offers
│   │       └── settings/route.ts             # Saves widget/points settings
├── lib/
│   ├── supabase.ts                           # supabase (anon) + supabaseAdmin (service role)
│   └── shopify.ts                            # OAuth helpers, Shopify API fetch, discount code creator, getTier()
public/
└── widget.js                                 # Embeddable IIFE widget — no dependencies, merchants paste 1 script tag
supabase/
└── schema.sql                                # DB schema reference — already applied, do NOT re-run blindly
```

## Database (Supabase) — all tables are live
| Table | Key columns |
|---|---|
| `merchants` | id, shopify_domain, store_name, email, active, points_per_dollar, signup_bonus, birthday_bonus, widget_primary_color, widget_title, widget_position, social_follow_url, follow_points, referral_points |
| `customers` | id, merchant_id, email, name, phone, birthday, marketing_consent, password_hash, points, tier, referral_code, referred_by |
| `offers` | id, merchant_id, name, description, points_required, offer_type, offer_value, active |
| `point_transactions` | id, merchant_id, customer_id, type, points, description, created_at |
| `redemptions` | id, merchant_id, customer_id, offer_id, discount_code, created_at |

**Trigger:** `on_merchant_created` — auto-creates 3 default offers when a merchant is inserted.

**Columns added via ALTER TABLE (already applied, do not re-run):**
- `customers.password_hash TEXT`
- `customers.marketing_consent BOOLEAN`
- `customers.referral_code TEXT`
- `customers.referred_by UUID` (references customers.id)
- `merchants.social_follow_url TEXT`
- `merchants.follow_points INT`
- `merchants.referral_points INT`
- `merchants.birthday_bonus INT`

**point_transactions.type values:** `earn_order`, `earn_signup`, `earn_referral`, `earn_follow`, `earn_birthday`, `redeem`

## How the product works end-to-end
1. **Merchant connects** → visits `goldpoints-shopify.vercel.app`, enters `.myshopify.com` domain → Shopify OAuth → stored in `merchants` table
2. **Merchant installs widget** → copies script tag from Install tab → pastes into Shopify theme `<body>` with Liquid conditional
3. **Customer visits store** → sees floating 🎁 pill button in merchant's brand color with their chosen title
4. **Not logged in (Shopify):** widget shows welcome carousel (Place order / Refer a Friend / Follow us cards) + Register/Login buttons → go to Shopify native `/account/register` or `/account/login`
5. **Logged in (Shopify):** Liquid passes `data-customer-email` + `data-customer-name` to script tag → widget auto-detects → if customer exists in DB goes to home tabs, if new shows profile completion screen
6. **Profile completion:** name + email (locked from Shopify), birthday (optional), marketing consent (optional) → saved to `customers` table → signup bonus awarded
7. **Home tabs (logged in):**
   - **Home:** Refer a Friend section (unique URL + copy + Facebook share) + Tier progress bar + Ways to Earn card
   - **Rewards:** Redeem active offers → generates real Shopify discount codes
   - **Offers:** Full list of earning methods with points values
   - **👤 Profile:** Edit birthday/consent, sign out
8. **Referral system:** customer's unique referral link → `goldpoints-shopify.vercel.app/ref/[code]` → server redirects to `https://[store]?gp_ref=[code]` → widget reads `gp_ref` from URL, saves to localStorage → when new customer completes profile, referrer is credited
9. **Social follow:** customer clicks "Follow & Claim" → social page opens in new tab + points awarded once (tracked via `earn_follow` transaction — honor system, cannot verify)
10. **Order points:** Shopify webhook → `points_per_dollar × order total` added to customer
11. **Customer portal:** `goldpoints-shopify.vercel.app` → "I'm a Customer" → email+password → auto-redirected to their dashboard

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

## Widget state variables
```javascript
let homeTab       = 'home'    // 'home' | 'rewards' | 'offers' | 'profile'
let welcomeSlide  = 0         // 0 = Place order + Refer a Friend, 1 = Follow us
let welcomeDetail = null      // null | 'order' | 'refer' | 'follow'
```

## Customer auth flow
- **Widget (Shopify-logged-in):** Shopify passes email+name via Liquid attributes. Widget calls `/api/widget/points` to check if they exist in DB. If yes → home tabs. If no → profile completion form.
- **Profile completion:** birthday and consent are optional. Saves via `/api/widget/profile`.
- **Portal login:** email + password → bcrypt verified → dashboard
- **Multi-store:** if same email+password is at multiple stores, store picker is shown
- **Referral code survival:** `gp_ref` param is saved to localStorage immediately on page load so it survives the Shopify register/login redirect. Cleared after first profile save.

## Tiers
| Tier | Min points | Icon |
|---|---|---|
| Bronze | 0 | 🥉 |
| Silver | 500 | 🥈 |
| Gold | 1000 | 🥇 |

## Merchant settings (configurable per merchant)
- `points_per_dollar` — points earned per $1 spent on orders
- `signup_bonus` — one-time points when customer completes profile
- `birthday_bonus` — points on birthday (column exists, logic not yet wired)
- `referral_points` — points awarded to referrer when a new customer joins via their link
- `follow_points` — one-time points for social media follow
- `social_follow_url` — URL to open when customer clicks Follow (Instagram, Facebook, etc.)
- `widget_primary_color` — hex color for the widget button and accents
- `widget_title` — text shown on the pill launcher button
- `widget_position` — `bottom-right` or `bottom-left`

## Merchant auth
Cookie `merchant_shop` set after Shopify OAuth. All `/api/merchant/*` routes verify this cookie.

## Admin
- URL: `goldpoints-shopify.vercel.app/admin` (not linked anywhere — Tony accesses it directly)
- Password: `admin123` (env var `ADMIN_PASSWORD`)
- Can: view all merchants, pause/activate merchants, delete merchants, add merchants manually, view portal for any merchant

## Test file
`Desktop\widget-test.html` — open in browser to preview widget locally without a real Shopify store. Uses `teststore.myshopify.com` — make sure that domain exists in the DB (add it via /admin).

## Webhook setup (merchant must do once in Shopify Admin)
Settings → Notifications → Webhooks → Add webhook:
- Event: Order creation
- URL: `https://goldpoints-shopify.vercel.app/api/webhooks/orders`
- Format: JSON

## What's working (as of 2026-05-16)
- Shopify OAuth for merchants
- Merchant dashboard: customers list, offers CRUD, widget customization, install snippet with Liquid
- Widget: pill launcher, welcome carousel (Place order / Refer a Friend / Follow us), profile completion, tab-based home (Home / Rewards / Offers / 👤 Profile)
- Home tab: Refer a Friend (unique URL + clipboard copy + Facebook share), tier progress bar, ways to earn card
- Rewards tab: redeem offers → real Shopify discount codes
- Offers tab: earning methods breakdown with points values
- Profile tab: edit birthday/consent, sign out
- Referral system: unique codes, /ref/[code] server redirect, localStorage persistence through auth redirect, referrer gets credited on new join
- Social follow: honor-system one-time points, tracks via earn_follow transaction
- Order points via Shopify webhook (HMAC verified)
- Customer portal: email+password login, points/tier/history, redeem offers
- Admin panel: platform stats, manage all merchants, add manually
- Home page: Merchant tab + Customer tab (global email+password login → store picker or auto-redirect)
- Password auth: bcryptjs hashing on register, bcrypt verification on portal login
- Multi-store customer support

## What is NOT yet built (next priorities)
1. **Birthday bonus logic** — `birthday_bonus` column and `birthday` on customer exist, but no cron/webhook awards points on the customer's birthday
2. **Email notifications** — welcome email, tier upgrade, birthday reward
3. **Subscription/billing** — Stripe integration for merchants paying for GoldPoints
4. **Analytics charts** — visual graphs in merchant dashboard
5. **Forgot password** — customer password reset via email

## Owner context
Tony is a non-developer building this as a SaaS product. Keep explanations clear, implement directly without long preambles. Use `py -m pip` (not `pip`) if Python is ever needed. Never push to GitHub without Tony's explicit instruction.
