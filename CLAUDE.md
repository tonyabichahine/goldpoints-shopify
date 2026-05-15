@AGENTS.md

# GoldPoints — Full Project Guide for Claude

## What this is
GoldPoints is a Shopify loyalty program SaaS. Merchants connect their Shopify store via OAuth, install a floating widget on their storefront, and their customers earn/redeem points automatically. Built by Tony Abi Chahine (tonyabichahine@gmail.com), non-developer.

## Live URL
**https://goldpoints-shopify.vercel.app** — this is the real production URL. Do NOT use `goldpoints.vercel.app` (wrong, old).

## How to run locally
```
cd Desktop\goldpoints-app
npm run dev
```
Opens at http://localhost:3000

## How changes go live
1. Edit code locally
2. `git add . && git commit -m "your message"`
3. `git push`
4. Vercel auto-deploys in ~60 seconds → live at https://goldpoints-shopify.vercel.app

## Tech stack
| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) — project: `cybrenydxookzuexluni` |
| Auth | Shopify OAuth (merchants), bcryptjs passwords (customers), cookie session (admin) |
| Hosting | Vercel — repo: `tonyabichahine/goldpoints-shopify` |
| Shopify | Partner app — Client ID: `2236f7c85e070634127c0bbe6fdadbaa` |

## Environment variables (.env.local)
All secrets live in `Desktop\goldpoints-app\.env.local` — never commit this file.
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
│   ├── admin/page.tsx                        # Admin dashboard — only accessible at /admin directly (hidden from home page)
│   ├── merchant/page.tsx                     # Merchant dashboard (customers, offers, widget settings, install instructions)
│   ├── portal/[domain]/page.tsx             # Customer portal per merchant — shows points, history, redeem offers
│   ├── api/
│   │   ├── auth/
│   │   │   ├── install/route.ts              # Starts Shopify OAuth
│   │   │   └── callback/route.ts             # OAuth callback → upserts merchant in DB
│   │   ├── webhooks/
│   │   │   └── orders/route.ts               # Shopify webhook → awards points on purchase (HMAC verified)
│   │   ├── widget/                           # CORS-enabled (called from any Shopify storefront)
│   │   │   ├── config/route.ts               # Widget settings + offers for a shop
│   │   │   ├── register/route.ts             # Registers customer (name + email + password + optional phone/birthday)
│   │   │   ├── points/route.ts               # Looks up customer points by email
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
└── widget.js                                 # Embeddable IIFE widget — merchants paste 1 script tag
supabase/
└── schema.sql                                # DB schema (already applied — do NOT re-run blindly)
```

## Database (Supabase) — all tables are live
| Table | Key columns |
|---|---|
| `merchants` | id, shopify_domain, store_name, email, active, points_per_dollar, signup_bonus, widget_primary_color, widget_title, widget_position |
| `customers` | id, merchant_id, email, name, phone, birthday, password_hash, points, tier |
| `offers` | id, merchant_id, name, description, points_required, offer_type, offer_value, active |
| `point_transactions` | id, merchant_id, customer_id, type, points, description, created_at |
| `redemptions` | id, merchant_id, customer_id, offer_id, discount_code, created_at |

**Trigger:** `on_merchant_created` — auto-creates 3 default offers when a merchant is inserted.
**password_hash column** was added to `customers` via: `ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;` — already applied.

## How the product works end-to-end
1. **Merchant connects** → visits `goldpoints-shopify.vercel.app`, enters their `.myshopify.com` domain → Shopify OAuth → stored in `merchants` table
2. **Merchant installs widget** → copies 1 script tag from the Install tab → pastes into Shopify theme before `</body>`
3. **Customer registers** → widget floating button on storefront → customer enters name, email, password, optional phone + birthday → saved to `customers` table with signup bonus points
4. **Customer earns points** → every Shopify order triggers webhook → `points_per_dollar` × order total added to customer
5. **Customer redeems** → clicks offer in widget → GoldPoints creates a real Shopify discount code → customer copies it to checkout
6. **Customer views portal** → goes to `goldpoints-shopify.vercel.app` → "I'm a Customer" tab → email + password → auto-redirected to their dashboard
7. **Merchant manages** → dashboard at `goldpoints-shopify.vercel.app/merchant?shop=store.myshopify.com`
8. **Admin manages** → `goldpoints-shopify.vercel.app/admin` (password: admin123) — not linked from home page, URL-only access

## Customer auth flow
- **Registration (widget on store):** name + email + password (required) + phone + birthday (optional). Password hashed with bcryptjs before storing.
- **Widget login:** email lookup only (no password) — widget just checks if email exists and shows points
- **Portal login (goldpoints-shopify.vercel.app):** email + password → bcrypt verified → auto-logged into dashboard
- **Multi-store:** if same email+password is registered at multiple stores, a store picker is shown

## Tiers
| Tier | Points |
|---|---|
| Bronze | 0–499 |
| Silver | 500–999 |
| Gold | 1000+ |

## Merchant auth
Cookie `merchant_shop` set after Shopify OAuth. All `/api/merchant/*` routes verify this cookie.

## Admin
- URL: `goldpoints-shopify.vercel.app/admin` (not linked anywhere — Tony accesses it directly)
- Password: `admin123` (env var `ADMIN_PASSWORD`)
- Can: view all merchants, pause/activate merchants, delete merchants, add merchants manually, view portal for any merchant

## Widget (public/widget.js)
Self-contained IIFE. No dependencies. Reads `data-shop` from script tag. Stores customer email in `localStorage`.
```html
<script src="https://goldpoints-shopify.vercel.app/widget.js" data-shop="store.myshopify.com"></script>
```
Test file: `Desktop\widget-test.html` — open in browser to preview the widget without a real Shopify store.

## Webhook setup (merchant must do once in Shopify Admin)
Settings → Notifications → Webhooks:
- Event: Order creation
- URL: `https://goldpoints-shopify.vercel.app/api/webhooks/orders`
- Format: JSON

## What's working (as of 2026-05-15)
- Shopify OAuth for merchants
- Merchant dashboard: customers, offers CRUD, widget customization, install instructions
- Floating widget: register, points lookup, redeem offers (creates real Shopify discount codes)
- Customer portal: email+password login, points dashboard, transaction history, redeem offers
- Admin panel: platform stats, manage all merchants, add merchants manually
- Home page: Merchant tab + Customer tab (email+password → auto-login to portal)
- Password auth: bcryptjs hashing on register, verification on portal login
- Multi-store customer support: customers registered at multiple stores see a store picker

## What is NOT yet built (next priorities)
1. **Test the widget end-to-end** — add a test merchant via /admin, open `Desktop\widget-test.html`, register a test customer, verify points appear
2. **Birthday bonus** — `birthday` column exists in DB, logic not wired (award bonus points on customer's birthday)
3. **Email notifications** — tier upgrades, welcome email, birthday reward
4. **Subscription/billing** — merchants paying for GoldPoints (Stripe)
5. **Analytics charts** — visual graphs in merchant dashboard
6. **Forgot password flow** — customers can reset password via email

## Owner context
Tony is a non-developer building this as a SaaS product. Keep explanations clear, implement directly without long preambles. Use `py -m pip` (not `pip`) if Python is ever needed.
