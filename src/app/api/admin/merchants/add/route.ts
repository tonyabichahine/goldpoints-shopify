import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function buildDefaultFlows(merchantId: string) {
  return [
    {
      merchant_id: merchantId, name: 'Welcome Series', trigger: 'signup', active: true, allow_reenroll: false,
      nodes: [
        { id: 'trigger-1', type: 'trigger', position: { x: 250, y: 50 }, data: { triggerType: 'signup' } },
        { id: 'email-1', type: 'email', position: { x: 250, y: 180 }, data: { subject: 'Welcome to {{store}}! Your rewards journey starts now', body: 'Hi {{name}},\n\nWelcome to {{store}} — you\'ve just joined our loyalty rewards program!\n\nEvery purchase earns you points. You already have {{points}} points to start. Here\'s what\'s ahead:\n\n• Earn points on every order\n• Reach Silver tier for 1.5x point multipliers\n• Reach Gold tier for 2x points and exclusive perks\n• Redeem points for discounts and free products\n\nYour current tier is {{tier}}. Keep shopping to unlock bigger rewards!' } },
        { id: 'wait-1', type: 'wait', position: { x: 250, y: 320 }, data: { amount: 3, unit: 'days' } },
        { id: 'condition-1', type: 'condition', position: { x: 250, y: 460 }, data: { conditionType: 'email_clicked' } },
        { id: 'end-1', type: 'end', position: { x: 100, y: 590 }, data: {} },
        { id: 'email-2', type: 'email', position: { x: 400, y: 590 }, data: { subject: 'Your {{points}} points are waiting, {{name}}!', body: 'Hi {{name}},\n\nWe noticed you haven\'t had a chance to shop at {{store}} since joining — just wanted to check in!\n\nYou have {{points}} points ready to use. Even your next small purchase brings you closer to a free reward.\n\nWe\'d love to see you come back. Here\'s what\'s in store for you:' } },
        { id: 'end-2', type: 'end', position: { x: 400, y: 730 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'email-1' },
        { id: 'e2', source: 'email-1', target: 'wait-1' },
        { id: 'e3', source: 'wait-1', target: 'condition-1' },
        { id: 'e4', source: 'condition-1', target: 'end-1', sourceHandle: 'true' },
        { id: 'e5', source: 'condition-1', target: 'email-2', sourceHandle: 'false' },
        { id: 'e6', source: 'email-2', target: 'end-2' },
      ],
    },
    {
      merchant_id: merchantId, name: 'Silver Milestone', trigger: 'tier_silver', active: true, allow_reenroll: false,
      nodes: [
        { id: 'trigger-1', type: 'trigger', position: { x: 250, y: 50 }, data: { triggerType: 'tier_silver' } },
        { id: 'email-1', type: 'email', position: { x: 250, y: 180 }, data: { subject: 'You\'ve reached Silver status at {{store}}! 🥈', body: 'Hi {{name}},\n\nCongratulations — you\'ve officially reached Silver status at {{store}}! 🥈\n\nHere\'s what you\'ve unlocked:\n\n• 1.5x points multiplier on every purchase\n• Early access to exclusive member offers\n• Priority customer support\n\nYou currently have {{points}} points. Keep earning to reach Gold status for even more exclusive perks.\n\nThank you for being a loyal customer — come enjoy your Silver rewards:' } },
        { id: 'wait-1', type: 'wait', position: { x: 250, y: 320 }, data: { amount: 5, unit: 'days' } },
        { id: 'condition-1', type: 'condition', position: { x: 250, y: 460 }, data: { conditionType: 'email_clicked' } },
        { id: 'end-1', type: 'end', position: { x: 100, y: 590 }, data: {} },
        { id: 'email-2', type: 'email', position: { x: 400, y: 590 }, data: { subject: 'Unlock your Silver rewards at {{store}}, {{name}}! 🥈', body: 'Hi {{name}},\n\nJust a reminder — you\'re now a Silver member at {{store}} and your exclusive benefits are ready!\n\nYour {{points}} points are waiting, plus you now earn 1.5x points on every purchase. Your rewards are growing faster than ever.\n\nDon\'t let your Silver status go to waste — come shop and enjoy your upgraded membership:' } },
        { id: 'end-2', type: 'end', position: { x: 400, y: 730 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'email-1' },
        { id: 'e2', source: 'email-1', target: 'wait-1' },
        { id: 'e3', source: 'wait-1', target: 'condition-1' },
        { id: 'e4', source: 'condition-1', target: 'end-1', sourceHandle: 'true' },
        { id: 'e5', source: 'condition-1', target: 'email-2', sourceHandle: 'false' },
        { id: 'e6', source: 'email-2', target: 'end-2' },
      ],
    },
    {
      merchant_id: merchantId, name: 'Birthday Reward', trigger: 'birthday', active: true, allow_reenroll: true,
      nodes: [
        { id: 'trigger-1', type: 'trigger', position: { x: 250, y: 50 }, data: { triggerType: 'birthday' } },
        { id: 'email-1', type: 'email', position: { x: 250, y: 180 }, data: { subject: 'Happy Birthday from {{store}}! 🎂', body: 'Hi {{name}},\n\nHappy Birthday from everyone at {{store}}! 🎂\n\nTo celebrate your special day, you\'ve received a birthday bonus — you now have {{points}} points ready to spend. Treat yourself to something you\'ve been eyeing!\n\nAs one of our {{tier}} members, you mean a lot to us. We hope you have a wonderful day, {{name}}.\n\nCome celebrate with us:' } },
        { id: 'end-1', type: 'end', position: { x: 250, y: 320 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'email-1' },
        { id: 'e2', source: 'email-1', target: 'end-1' },
      ],
    },
    {
      merchant_id: merchantId, name: 'Gold VIP Welcome', trigger: 'tier_gold', active: true, allow_reenroll: false,
      nodes: [
        { id: 'trigger-1', type: 'trigger', position: { x: 250, y: 50 }, data: { triggerType: 'tier_gold' } },
        { id: 'email-1', type: 'email', position: { x: 250, y: 180 }, data: { subject: 'You\'re a Gold VIP at {{store}} now! 🥇', body: 'Hi {{name}},\n\nWow — you\'ve reached Gold VIP status at {{store}}! 🥇 You\'re among our most loyal customers and we want to show our appreciation.\n\nAs a Gold VIP, you now enjoy:\n\n• 2x points on every purchase\n• Access to exclusive Gold-only offers\n• First access to new products and sales\n• Premium customer support\n\nYou currently have {{points}} points — that\'s incredible. Keep shopping and watch your rewards grow even faster.\n\nThis one\'s for you, {{name}}:' } },
        { id: 'wait-1', type: 'wait', position: { x: 250, y: 320 }, data: { amount: 7, unit: 'days' } },
        { id: 'condition-1', type: 'condition', position: { x: 250, y: 460 }, data: { conditionType: 'email_clicked' } },
        { id: 'end-1', type: 'end', position: { x: 100, y: 590 }, data: {} },
        { id: 'email-2', type: 'email', position: { x: 400, y: 590 }, data: { subject: 'Your exclusive Gold benefits are ready, {{name}}! 🥇', body: 'Hi {{name}},\n\nWe sent you a Gold VIP welcome email a week ago and wanted to follow up — your exclusive member benefits are still waiting at {{store}}!\n\nAs a Gold VIP, you earn 2x points on every order. With {{points}} points already in your account, you\'re well on your way to even bigger rewards.\n\nCome shop and see what\'s new:' } },
        { id: 'end-2', type: 'end', position: { x: 400, y: 730 }, data: {} },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'email-1' },
        { id: 'e2', source: 'email-1', target: 'wait-1' },
        { id: 'e3', source: 'wait-1', target: 'condition-1' },
        { id: 'e4', source: 'condition-1', target: 'end-1', sourceHandle: 'true' },
        { id: 'e5', source: 'condition-1', target: 'email-2', sourceHandle: 'false' },
        { id: 'e6', source: 'email-2', target: 'end-2' },
      ],
    },
  ]
}

export async function POST(req: NextRequest) {
  const pw = req.cookies.get('admin_session')?.value
  if (pw !== (process.env.ADMIN_PASSWORD || 'admin123')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shopify_domain, store_name, email, password } = await req.json()
  if (!store_name || !email || !password) return NextResponse.json({ error: 'Store name, email, and password are required.' }, { status: 400 })

  const password_hash = await bcrypt.hash(password, 10)
  const domain = shopify_domain ? (shopify_domain.includes('.') ? shopify_domain : `${shopify_domain}.myshopify.com`) : null

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('merchants')
    .insert({ shopify_domain: domain, store_name, email: email.toLowerCase().trim(), password_hash, shopify_access_token: 'pending', trial_ends_at: trialEndsAt })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Seed default automation flows
  try { await supabaseAdmin.from('automation_flows').insert(buildDefaultFlows(data.id)) } catch {}

  // Send welcome email
  const emailResult = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GoldPoints <onboarding@resend.dev>',
    to: process.env.TEST_EMAIL || email,
    subject: 'Welcome to GoldPoints — Your Account is Ready',
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#0f0f1a;color:#e0e0f0;padding:40px;border-radius:16px">
        <div style="margin-bottom:24px">
          <img src="https://goldpoints-shopify.vercel.app/logo.png" alt="GoldPoints" width="72" height="72" style="border-radius:16px" />
        </div>
        <div style="font-size:28px;font-weight:800;margin-bottom:4px">
          <span style="color:#a78bfa">Gold</span><span style="color:#fbbf24">Points</span>
        </div>
        <p style="color:#8080a0;margin-top:4px;margin-bottom:32px">Loyalty rewards for Shopify merchants</p>

        <p style="font-size:16px;margin-bottom:24px">Hi ${store_name},</p>
        <p style="color:#c0c0d8;line-height:1.6">Your GoldPoints account has been created. Here are your login details:</p>

        <div style="background:#16162a;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin:24px 0">
          <div style="margin-bottom:12px">
            <span style="color:#8080a0;font-size:12px;text-transform:uppercase;letter-spacing:1px">Email</span>
            <div style="font-weight:600;margin-top:4px">${email}</div>
          </div>
          <div>
            <span style="color:#8080a0;font-size:12px;text-transform:uppercase;letter-spacing:1px">Password</span>
            <div style="font-weight:600;margin-top:4px;font-family:monospace;font-size:18px;color:#a78bfa">${password}</div>
          </div>
        </div>

        <p style="color:#e74c3c;font-size:13px;margin-bottom:24px">⚠️ Please change your password after your first login.</p>

        <a href="https://goldpoints-shopify.vercel.app" style="display:inline-block;background:linear-gradient(to right,#7c3aed,#6d28d9);color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px">Log In to Dashboard →</a>

        <p style="color:#8080a0;font-size:12px;margin-top:32px;line-height:1.6">Your 14-day free trial starts today. Once logged in, connect your Shopify store to activate the loyalty widget on your storefront.<br/>Need help? Reply to this email or WhatsApp us at +961 71 552 479.</p>
      </div>
    `,
  })

  return NextResponse.json({ ...data, email_sent: !emailResult.error, email_error: emailResult.error?.message || null })
}
