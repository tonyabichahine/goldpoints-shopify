@AGENTS.md

# GoldPoints — Full Project Guide for Claude

## What this is
GoldPoints is a Shopify loyalty program SaaS. Merchants connect their Shopify store via OAuth, install a floating widget on their storefront, and their customers earn/redeem points automatically. Built by Tony Abi Chahine (tonyabichahine@gmail.com), non-developer.

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
| Auth | Shopify OAuth (merchants), cookie session, admin password |
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
On Vercel these are set as Environment Variables in the project dashboard.

## File map
```
src/
├── app/
│   ├── page.tsx                          # Login page (merchant OAuth + admin password)
│   ├── merchant/page.tsx                 # Merchant dashboard (customers, offers, widget, install)
│   ├── api/
│   │   ├── auth/
│   │   │   ├── install/route.ts          # Starts Shopify OAuth (redirects to Shopify)
│   │   │   └── callback/route.ts         # Shopify OAuth callback → saves merchant to DB
│   │   ├── webhooks/
│   │   │   └── orders/route.ts           # Shopify webhook → auto-awards points on purchase
│   │   ├── widget/                       # All CORS-enabled (called from Shopify stores)
│   │   │   ├── config/route.ts           # Returns widget settings + offers for a shop
│   │   │   ├── register/route.ts         # Registers a new loyalty customer
│   │   │   ├── points/route.ts           # Looks up a customer's points by email
│   │   │   └── redeem/route.ts           # Redeems an offer → creates Shopify discount code
│   │   └── merchant/
│   │       ├── customers/route.ts        # Lists customers for the logged-in merchant
│   │       ├── offers/route.ts           # CRUD for merchant offers
│   │       └── settings/route.ts         # Saves widget/point settings
├── lib/
│   ├── supabase.ts                       # supabase (anon) + supabaseAdmin (service role)
│   └── shopify.ts                        # OAuth helpers, Shopify API fetch, discount code creator
public/
└── widget.js                             # Embeddable JS widget — merchants paste 1 script tag
supabase/
└── schema.sql                            # DB schema (already applied — do not re-run blindly)
```

## Database (Supabase) — all tables are live
| Table | Purpose |
|---|---|
| `merchants` | One row per connected Shopify store |
| `customers` | Loyalty members, one per merchant+email |
| `offers` | Rewards merchants create (% off, free shipping, etc.) |
| `point_transactions` | Full audit log of every point earned or spent |
| `redemptions` | Discount codes issued when customers redeem offers |

**Trigger:** `on_merchant_created` — when a new merchant is inserted, 3 default offers are auto-created (10% off / 300pts, Free Shipping / 300pts, 20% off / 1000pts).

## How the product works end-to-end
1. **Merchant connects** → visits `goldpoints.vercel.app`, enters their `.myshopify.com` domain → Shopify OAuth → stored in `merchants` table
2. **Merchant installs widget** → copies 1 script tag from the Install tab → pastes into Shopify theme before `</body>`
3. **Customer registers** → widget floating button appears on store → customer enters name/email/birthday → saved to `customers` table with signup bonus points
4. **Customer earns points** → every Shopify order triggers webhook → `points_per_dollar` × order total added to customer
5. **Customer redeems** → clicks offer in widget → GoldPoints creates a real Shopify discount code → customer copies it to checkout
6. **Merchant manages** → dashboard at `goldpoints.vercel.app/merchant?shop=store.myshopify.com` → see all customers, edit offers, customize widget colors/title/position

## Tiers
| Tier | Points |
|---|---|
| Bronze | 0–499 |
| Silver | 500–999 |
| Gold | 1000+ |

## Merchant auth
Merchants are authenticated via a `merchant_shop` cookie set after Shopify OAuth. Server-side API routes check `req.cookies.get('merchant_shop')` to identify which merchant is making the request.

## Admin login
Password: `admin123` (set in `ADMIN_PASSWORD` env var). Admin page at `/admin` — not yet fully built, placeholder for managing all merchants across the platform.

## Widget (public/widget.js)
Self-contained IIFE. No dependencies. Reads `data-shop` from the script tag, calls the widget API routes, renders a floating panel. Stores customer email in `localStorage` so customers stay logged in across visits. Install snippet:
```html
<script src="https://goldpoints-shopify.vercel.app/widget.js" data-shop="store.myshopify.com"></script>
```

## Webhook setup (merchant must do this once)
In Shopify Admin → Settings → Notifications → Webhooks:
- Event: Order creation
- URL: `https://goldpoints-shopify.vercel.app/api/webhooks/orders`
- Format: JSON

## What is NOT yet built (future work)
- `/admin` page — full admin dashboard to manage all merchants
- Birthday bonus — DB column exists, logic not wired
- Email notifications on tier upgrade
- Customer portal (separate page for customers to see full history)
- Subscription/billing for merchants
- Analytics charts in merchant dashboard

## Owner context
Tony is a non-developer building this as a SaaS product. Keep explanations clear, implement directly without long preambles, use `py -m pip` (not `pip`) if Python is ever needed. Preferred stack is Next.js + Supabase + Vercel.
