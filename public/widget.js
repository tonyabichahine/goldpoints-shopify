(function () {
  const BASE = 'https://goldpoints-shopify.vercel.app'
  const script = document.currentScript || document.querySelector('script[data-shop]')
  const SHOP = script ? script.getAttribute('data-shop') : ''
  if (!SHOP) return

  const CUSTOMER_EMAIL = (script && script.getAttribute('data-customer-email')) || ''
  const CUSTOMER_NAME  = (script && script.getAttribute('data-customer-name'))  || ''

  let config        = null
  let customer      = null
  let open          = false
  let view          = 'loading'
  let welcomeSlide  = 0   // 0 = earn cards, 1 = follow us
  let welcomeDetail = null // null | 'order' | 'refer' | 'follow'

  const STORAGE_KEY = `gp_email_${SHOP}`

  // ── Styles ────────────────────────────────────────────────────────────
  const style = document.createElement('style')
  style.textContent = `
    #gp-btn{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:99998;font-size:24px;transition:transform .2s}
    #gp-btn:hover{transform:scale(1.1)}
    #gp-panel{position:fixed;bottom:90px;right:24px;width:340px;max-height:560px;background:#16162a;border:1px solid rgba(255,255,255,.1);border-radius:20px;overflow:hidden;display:none;flex-direction:column;z-index:99999;box-shadow:0 8px 40px rgba(0,0,0,.6);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e0e0f0}
    #gp-panel.open{display:flex}
    .gp-header{padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
    .gp-header-back{background:rgba(255,255,255,.1);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}
    .gp-title{font-weight:700;font-size:1rem}
    .gp-close{background:rgba(255,255,255,.1);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}
    .gp-body{padding:0 18px 16px;overflow-y:auto;flex:1}
    .gp-footer{padding:12px 18px 16px;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0}
    .gp-input{width:100%;background:#0f0f1a;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 12px;color:#e0e0f0;font-size:.9rem;outline:none;box-sizing:border-box;margin-bottom:10px}
    .gp-input:focus{border-color:#6c3fff}
    .gp-input:disabled{opacity:.5;cursor:not-allowed}
    .gp-btn-main{width:100%;padding:11px;border:none;border-radius:10px;font-size:.9rem;font-weight:700;cursor:pointer;transition:opacity .2s}
    .gp-btn-main:hover{opacity:.88}
    .gp-btn-outline{width:100%;padding:11px;border-radius:10px;font-size:.9rem;font-weight:700;cursor:pointer;background:transparent;transition:opacity .2s}
    .gp-btn-outline:hover{opacity:.88}
    .gp-auth-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .gp-card{display:flex;align-items:center;gap:12px;background:#0f0f1a;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer;transition:border-color .2s}
    .gp-card:hover{border-color:rgba(255,255,255,.2)}
    .gp-card-icon{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
    .gp-card-text{flex:1}
    .gp-card-title{font-weight:700;font-size:.9rem}
    .gp-card-sub{font-size:.75rem;color:#7878a0;margin-top:2px}
    .gp-card-arrow{color:#7878a0;font-size:.9rem}
    .gp-dots{display:flex;justify-content:center;gap:6px;margin:10px 0 4px}
    .gp-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.2);cursor:pointer;transition:background .2s}
    .gp-dot.active{background:#fff}
    .gp-detail-icon{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;margin:20px auto 14px}
    .gp-detail-title{font-size:1.1rem;font-weight:800;text-align:center;margin-bottom:8px}
    .gp-detail-desc{font-size:.85rem;color:#aaa;text-align:center;line-height:1.5;margin-bottom:16px}
    .gp-detail-stat{font-size:1rem;font-weight:700;text-align:center;margin-bottom:20px}
    .gp-points{text-align:center;padding:14px 0 6px}
    .gp-pts-num{font-size:2.4rem;font-weight:800}
    .gp-pts-lbl{font-size:.8rem;color:#7878a0}
    .gp-tier{display:inline-block;padding:3px 14px;border-radius:20px;font-size:.75rem;font-weight:700;margin-top:6px}
    .gp-tier-bronze{background:#4a2a10;color:#cd7f32;border:1px solid #cd7f32}
    .gp-tier-silver{background:#1e2a30;color:#b0c4c4;border:1px solid #b0c4c4}
    .gp-tier-gold{background:#2a2000;color:#ffd700;border:1px solid #ffd700}
    .gp-offer{background:#0f0f1a;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 14px;margin-bottom:8px}
    .gp-offer-name{font-weight:600;font-size:.9rem}
    .gp-offer-meta{font-size:.78rem;color:#7878a0;margin-top:2px}
    .gp-redeem-btn{margin-top:8px;border:1px solid #6c3fff;color:#c47aff;padding:5px 14px;border-radius:8px;font-size:.78rem;cursor:pointer;background:rgba(108,63,255,.25)}
    .gp-redeem-btn:disabled{opacity:.4;cursor:not-allowed}
    .gp-code-box{background:#0f0f1a;border:1px solid #2ecc71;border-radius:10px;padding:12px;text-align:center;margin:10px 0}
    .gp-code{font-size:1.2rem;font-weight:800;color:#2ecc71;letter-spacing:2px}
    .gp-msg{font-size:.8rem;color:#7878a0;text-align:center;padding:6px 0}
    .gp-logout{font-size:.75rem;color:#5050a0;background:none;border:none;cursor:pointer;margin-top:6px;text-decoration:underline}
    .gp-section-title{font-size:.78rem;color:#7878a0;text-transform:uppercase;letter-spacing:.5px;margin:12px 0 8px}
    .gp-progress{background:#0f0f1a;border-radius:10px;height:6px;margin:8px 0;overflow:hidden}
    .gp-progress-fill{height:100%;border-radius:10px;background:linear-gradient(90deg,#6c3fff,#ffd700);transition:width .6s}
    .gp-consent{display:flex;align-items:flex-start;gap:10px;font-size:.82rem;color:#aaa;margin:4px 0 16px;cursor:pointer;line-height:1.4}
    .gp-consent input{width:16px;height:16px;margin-top:1px;flex-shrink:0;cursor:pointer;accent-color:#6c3fff}
    .gp-field-label{font-size:.78rem;color:#7878a0;display:block;margin-bottom:4px}
  `
  document.head.appendChild(style)

  // ── Button & Panel ────────────────────────────────────────────────────
  const btn = document.createElement('button')
  btn.id = 'gp-btn'; btn.innerHTML = '⭐'; btn.setAttribute('aria-label','Loyalty rewards')
  document.body.appendChild(btn)
  const panel = document.createElement('div')
  panel.id = 'gp-panel'; document.body.appendChild(panel)
  btn.addEventListener('click', () => { open = !open; panel.classList.toggle('open', open); if (open && !config) loadConfig() })

  // ── Helpers ───────────────────────────────────────────────────────────
  async function api(path, opts = {}) { const r = await fetch(BASE + path, opts); return r.json() }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
  function tierClass(t) { return `gp-tier gp-tier-${(t||'bronze').toLowerCase()}` }
  function progressPct(p) { if(p>=1000)return 100; if(p>=500)return Math.round(((p-500)/500)*100); return Math.round((p/500)*100) }
  function nextTier(p) { if(p<500)return `${500-p} pts to Silver`; if(p<1000)return `${1000-p} pts to Gold`; return '🏆 Max tier!' }

  // ── Load ──────────────────────────────────────────────────────────────
  async function loadConfig() {
    render('loading')
    config = await api(`/api/widget/config?shop=${SHOP}`)
    if (config.error) { render('error'); return }
    btn.style.background = config.widget_primary_color || '#6c3fff'
    if (config.widget_position === 'bottom-left') { btn.style.right='auto'; btn.style.left='24px'; panel.style.right='auto'; panel.style.left='24px' }

    if (CUSTOMER_EMAIL) {
      const data = await api(`/api/widget/points?shop=${SHOP}&email=${encodeURIComponent(CUSTOMER_EMAIL)}`)
      if (data.found && data.customer.birthday) {
        customer = data.customer; localStorage.setItem(STORAGE_KEY, CUSTOMER_EMAIL); render('home')
      } else { render('profile') }
    } else {
      const saved = localStorage.getItem(STORAGE_KEY) || ''
      if (saved) {
        const data = await api(`/api/widget/points?shop=${SHOP}&email=${encodeURIComponent(saved)}`)
        if (data.found) { customer = data.customer; render('home') } else { welcomeSlide=0; render('welcome') }
      } else { welcomeSlide=0; render('welcome') }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  function render(v) {
    view = v
    const color = (config && config.widget_primary_color) || '#6c3fff'
    const title = (config && config.widget_title) || 'Rewards'
    const hasFollow = !!(config && config.social_follow_url)
    const isDetailView = v === 'welcome' && welcomeDetail !== null

    const backBtn = isDetailView ? `<button class="gp-header-back" id="gp-back-btn">‹</button>` : `<span style="width:28px"></span>`
    const detailTitle = welcomeDetail === 'order' ? 'Place an order' : welcomeDetail === 'refer' ? 'Refer a Friend' : welcomeDetail === 'follow' ? 'Follow us online' : ''

    panel.innerHTML = `
      <div class="gp-header" style="background:${color}20;border-bottom:1px solid ${color}40">
        ${backBtn}
        <span class="gp-title">${isDetailView ? detailTitle : '⭐ ' + title}</span>
        <button class="gp-close" id="gp-close-btn">✕</button>
      </div>
      <div class="gp-body" id="gp-body">${bodyHTML(v, color)}</div>
      ${(v === 'welcome' || v === 'lookup') ? `<div class="gp-footer">${footerHTML(color)}</div>` : ''}
    `
    document.getElementById('gp-close-btn').addEventListener('click', () => { open=false; panel.classList.remove('open') })
    if (isDetailView) document.getElementById('gp-back-btn').addEventListener('click', () => { welcomeDetail=null; render('welcome') })
    bindEvents(v, color)
  }

  function footerHTML(color) {
    return `
      <div class="gp-auth-row">
        <button class="gp-btn-main" id="gp-shopify-register" style="background:${color}">Register</button>
        <button class="gp-btn-outline" id="gp-shopify-login" style="border:2px solid ${color};color:${color}">Login</button>
      </div>
    `
  }

  function bodyHTML(v, color) {
    if (v === 'loading') return '<p class="gp-msg" style="padding:30px 0">Loading...</p>'
    if (v === 'error')   return '<p class="gp-msg" style="padding:30px 0;color:#e74c3c">Could not load rewards.</p>'

    if (v === 'welcome') {
      const hasFollow = !!(config && config.social_follow_url)
      const followPts = (config && config.follow_points) || 50
      const ptsPerDollar = (config && config.points_per_dollar) || 1

      // Detail views
      if (welcomeDetail === 'order') {
        return `
          <div class="gp-detail-icon" style="background:${color}25">${icon('bag',color)}</div>
          <div class="gp-detail-stat" style="color:${color}">1 USD earns you ${ptsPerDollar} loyalty point${ptsPerDollar>1?'s':''}</div>
          <div class="gp-detail-desc">Shop and earn points automatically on every order — no extra steps needed.</div>
        `
      }
      if (welcomeDetail === 'refer') {
        return `
          <div class="gp-detail-icon" style="background:${color}25">${icon('refer',color)}</div>
          <div class="gp-detail-title" style="color:${color}">Coming soon</div>
          <div class="gp-detail-desc">Refer friends and family to earn bonus points and exclusive rewards. Stay tuned!</div>
        `
      }
      if (welcomeDetail === 'follow') {
        const loggedIn = !!(customer || CUSTOMER_EMAIL)
        return `
          <div class="gp-detail-icon" style="background:${color}25">${icon('follow',color)}</div>
          <div class="gp-detail-stat" style="color:${color}">Earn ${followPts} points for following us</div>
          <div class="gp-detail-desc">Follow our page and claim your reward. One-time bonus per account.</div>
          ${loggedIn
            ? `<button class="gp-btn-main" id="gp-claim-follow" style="background:${color}">Follow & Claim ${followPts} pts</button><p id="gp-follow-msg" class="gp-msg"></p>`
            : `<p class="gp-msg">Log in first to claim your follow reward.</p>`}
        `
      }

      // Slide 0: earn cards
      if (welcomeSlide === 0) {
        return `
          <p style="font-weight:700;font-size:.95rem;margin:12px 0 4px">Welcome to our Loyalty Program</p>
          <p class="gp-msg" style="text-align:left;padding:0 0 14px;margin:0">Earn points on every purchase and redeem for exclusive rewards.</p>
          <div class="gp-card" id="gp-card-order">
            <div class="gp-card-icon" style="background:${color}25">${icon('bag',color)}</div>
            <div class="gp-card-text">
              <div class="gp-card-title">Place an order</div>
              <div class="gp-card-sub">Every order earns you points</div>
            </div>
            <div class="gp-card-arrow">›</div>
          </div>
          <div class="gp-card" id="gp-card-refer">
            <div class="gp-card-icon" style="background:${color}25">${icon('refer',color)}</div>
            <div class="gp-card-text">
              <div class="gp-card-title">Refer a Friend</div>
              <div class="gp-card-sub">Refer and earn</div>
            </div>
            <div class="gp-card-arrow">›</div>
          </div>
          ${hasFollow ? `<div class="gp-dots"><span class="gp-dot active" data-slide="0"></span><span class="gp-dot" data-slide="1"></span></div>` : ''}
        `
      }

      // Slide 1: follow us
      return `
        <p style="font-weight:700;font-size:.95rem;margin:12px 0 4px">Earn more ways</p>
        <p class="gp-msg" style="text-align:left;padding:0 0 14px;margin:0">Get bonus points for following us on social media.</p>
        <div class="gp-card" id="gp-card-follow">
          <div class="gp-card-icon" style="background:${color}25">${icon('follow',color)}</div>
          <div class="gp-card-text">
            <div class="gp-card-title">Follow us online</div>
            <div class="gp-card-sub">You will earn points for every page you follow</div>
          </div>
          <div class="gp-card-arrow">›</div>
        </div>
        <div class="gp-dots"><span class="gp-dot" data-slide="0"></span><span class="gp-dot active" data-slide="1"></span></div>
      `
    }

    if (v === 'profile') {
      return `
        <div style="padding-top:10px">
          <p style="font-weight:700;font-size:.95rem;margin-bottom:4px">Complete your profile</p>
          <p class="gp-msg" style="text-align:left;padding:0 0 12px;margin:0">Just a couple more details to start earning!</p>
          <label class="gp-field-label">Name</label>
          <input class="gp-input" id="gp-profile-name" value="${esc(CUSTOMER_NAME)}" placeholder="Your name" ${CUSTOMER_NAME?'disabled':''} />
          <label class="gp-field-label">Email</label>
          <input class="gp-input" value="${esc(CUSTOMER_EMAIL)}" type="email" disabled />
          <label class="gp-field-label">Date of birth</label>
          <input class="gp-input" id="gp-profile-birthday" type="date" />
          <label class="gp-consent">
            <input type="checkbox" id="gp-marketing-consent" />
            I would like to receive promotions by email
          </label>
          <button class="gp-btn-main" id="gp-profile-save" style="background:${color}">Save & Start Earning</button>
          <p id="gp-profile-msg" class="gp-msg"></p>
        </div>
      `
    }

    if (v === 'lookup') {
      return `
        <p class="gp-msg" style="padding-top:8px;margin-bottom:10px">Enter your email to check your points</p>
        <input class="gp-input" id="gp-lookup-email" placeholder="Email address" type="email" />
        <button class="gp-btn-main" id="gp-lookup-btn" style="background:${color};margin-bottom:8px">Look Up Points</button>
        <p id="gp-lookup-msg" class="gp-msg"></p>
      `
    }

    if (v === 'home') {
      const pts = customer.points || 0
      const offers = (config.offers||[]).map(o=>`
        <div class="gp-offer">
          <div class="gp-offer-name">${esc(o.name)}</div>
          <div class="gp-offer-meta">${esc(o.description||'')} · <span style="color:#c47aff">${o.points_required} pts</span></div>
          <button class="gp-redeem-btn" data-offer-id="${o.id}" ${pts<o.points_required?'disabled':''}>${pts>=o.points_required?'Redeem':`Need ${o.points_required-pts} more pts`}</button>
        </div>`).join('')
      return `
        <div class="gp-points">
          <div class="gp-pts-num" style="color:${color}">${pts.toLocaleString()}</div>
          <div class="gp-pts-lbl">points</div>
          <div class="${tierClass(customer.tier)}">${esc(customer.tier)}</div>
          <div class="gp-progress"><div class="gp-progress-fill" style="width:${progressPct(pts)}%"></div></div>
          <div style="font-size:.75rem;color:#7878a0">${nextTier(pts)}</div>
        </div>
        <div class="gp-section-title">Available Rewards</div>
        ${offers||'<p class="gp-msg">No offers yet — check back soon!</p>'}
        <div id="gp-code-area"></div>
        <button class="gp-logout" id="gp-logout-btn">Not ${esc(customer.name)}? Sign out</button>
      `
    }
    return ''
  }

  function icon(type, color) {
    if (type==='bag')    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="${color}"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3.8 6h16.4M16 10a4 4 0 01-8 0"/></svg>`
    if (type==='refer')  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="${color}"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`
    if (type==='follow') return `<svg width="20" height="20" viewBox="0 0 24 24" fill="${color}"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>`
    return '⭐'
  }

  // ── Events ────────────────────────────────────────────────────────────
  function bindEvents(v, color) {
    if (v === 'welcome') {
      // Footer auth buttons
      const regBtn = document.getElementById('gp-shopify-register')
      const loginBtn = document.getElementById('gp-shopify-login')
      if (regBtn) regBtn.addEventListener('click', () => { window.location.href = '/account/register' })
      if (loginBtn) loginBtn.addEventListener('click', () => { window.location.href = '/account/login' })

      // Dot navigation
      document.querySelectorAll('.gp-dot').forEach(dot => {
        dot.addEventListener('click', () => { welcomeSlide = parseInt(dot.getAttribute('data-slide')); welcomeDetail=null; render('welcome') })
      })

      // Cards
      const cardOrder = document.getElementById('gp-card-order')
      const cardRefer = document.getElementById('gp-card-refer')
      const cardFollow = document.getElementById('gp-card-follow')
      if (cardOrder)  cardOrder.addEventListener('click',  () => { welcomeDetail='order';  render('welcome') })
      if (cardRefer)  cardRefer.addEventListener('click',  () => { welcomeDetail='refer';  render('welcome') })
      if (cardFollow) cardFollow.addEventListener('click', () => { welcomeDetail='follow'; render('welcome') })

      // Claim follow points
      const claimBtn = document.getElementById('gp-claim-follow')
      if (claimBtn) {
        claimBtn.addEventListener('click', async () => {
          const email = (customer && customer.email) || CUSTOMER_EMAIL || localStorage.getItem(STORAGE_KEY)
          claimBtn.disabled = true; claimBtn.textContent = 'Claiming...'
          const socialUrl = config && config.social_follow_url
          if (socialUrl) window.open(socialUrl, '_blank')
          const data = await api('/api/widget/follow', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({shop:SHOP, email}) })
          const msg = document.getElementById('gp-follow-msg')
          if (data.error) { msg.textContent = data.error; msg.style.color='#e74c3c'; claimBtn.disabled=false; claimBtn.textContent=`Follow & Claim ${config.follow_points||50} pts`; return }
          if (customer) customer.points = data.newPoints
          msg.textContent = `+${data.pointsEarned} points added!`; msg.style.color='#2ecc71'
          claimBtn.disabled = true; claimBtn.textContent = '✓ Claimed'
        })
      }
    }

    if (v === 'profile') {
      document.getElementById('gp-profile-save').addEventListener('click', async () => {
        const name = CUSTOMER_NAME || document.getElementById('gp-profile-name').value.trim()
        const birthday = document.getElementById('gp-profile-birthday').value
        const marketing_consent = document.getElementById('gp-marketing-consent').checked
        const msg = document.getElementById('gp-profile-msg')
        msg.textContent = 'Saving...'; msg.style.color='#7878a0'
        const data = await api('/api/widget/profile', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({shop:SHOP, email:CUSTOMER_EMAIL, name, birthday, marketing_consent}) })
        if (data.error) { msg.textContent=data.error; msg.style.color='#e74c3c'; return }
        localStorage.setItem(STORAGE_KEY, CUSTOMER_EMAIL)
        customer = data.customer; render('home')
      })
    }

    if (v === 'lookup') {
      const regBtn = document.getElementById('gp-shopify-register')
      const loginBtn = document.getElementById('gp-shopify-login')
      if (regBtn) regBtn.addEventListener('click', () => { window.location.href='/account/register' })
      if (loginBtn) loginBtn.addEventListener('click', () => { window.location.href='/account/login' })
      document.getElementById('gp-lookup-btn').addEventListener('click', async () => {
        const email = document.getElementById('gp-lookup-email').value.trim()
        const msg = document.getElementById('gp-lookup-msg')
        if (!email) return
        msg.textContent='Looking up...'; msg.style.color='#7878a0'
        const data = await api(`/api/widget/points?shop=${SHOP}&email=${encodeURIComponent(email)}`)
        if (!data.found) { msg.textContent='Email not found. Register first.'; msg.style.color='#e74c3c'; return }
        localStorage.setItem(STORAGE_KEY, email); customer=data.customer; render('home')
      })
    }

    if (v === 'home') {
      document.querySelectorAll('.gp-redeem-btn:not([disabled])').forEach(b => {
        b.addEventListener('click', async () => {
          const offerId = b.getAttribute('data-offer-id')
          const email = (customer&&customer.email)||localStorage.getItem(STORAGE_KEY)
          b.disabled=true; b.textContent='Processing...'
          const data = await api('/api/widget/redeem', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({shop:SHOP,email,offerId}) })
          const area = document.getElementById('gp-code-area')
          if (data.error) { area.innerHTML=`<p class="gp-msg" style="color:#e74c3c">${esc(data.error)}</p>`; b.disabled=false; b.textContent='Redeem'; return }
          customer.points=data.newPoints
          area.innerHTML=`<div class="gp-code-box"><div style="font-size:.8rem;color:#7878a0;margin-bottom:4px">Your discount code:</div><div class="gp-code">${esc(data.discountCode)}</div><div style="font-size:.75rem;color:#7878a0;margin-top:4px">Copy and paste at checkout</div></div>`
          document.querySelector('.gp-pts-num').textContent=data.newPoints.toLocaleString()
        })
      })
      document.getElementById('gp-logout-btn').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); customer=null; welcomeSlide=0; welcomeDetail=null; render('welcome') })
    }
  }
})()
