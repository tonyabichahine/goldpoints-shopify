(function () {
  const BASE = 'https://goldpoints-shopify.vercel.app'
  const script = document.currentScript || document.querySelector('script[data-shop]')
  const SHOP = script ? script.getAttribute('data-shop') : ''
  if (!SHOP) return

  const CUSTOMER_EMAIL = (script && script.getAttribute('data-customer-email')) || ''
  const CUSTOMER_NAME  = (script && script.getAttribute('data-customer-name'))  || ''
  const REF_STORAGE_KEY = `gp_ref_${SHOP}`
  const urlRef = new URLSearchParams(window.location.search).get('gp_ref') || ''
  if (urlRef) localStorage.setItem(REF_STORAGE_KEY, urlRef)
  const GP_REF = urlRef || localStorage.getItem(REF_STORAGE_KEY) || ''

  let config        = null
  let customer      = null
  let redemptions   = []
  let open          = false
  let view          = 'loading'
  let homeTab       = 'home'    // 'home' | 'rewards' | 'offers' | 'profile'
  let welcomeSlide  = 0
  let welcomeDetail = null

  const STORAGE_KEY = `gp_email_${SHOP}`

  // ── Styles ────────────────────────────────────────────────────────────
  const style = document.createElement('style')
  style.textContent = `
    #gp-btn{position:fixed;bottom:24px;right:24px;height:48px;padding:0 20px;border-radius:999px;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.4);display:flex;align-items:center;gap:8px;z-index:99998;font-size:.9rem;font-weight:700;color:#fff;transition:transform .2s;white-space:nowrap;background:#6c3fff;opacity:0;pointer-events:none}
    #gp-btn:hover{transform:translateY(-2px);opacity:.92}
    #gp-panel{position:fixed;bottom:90px;right:24px;width:340px;max-height:580px;background:#16162a;border:1px solid rgba(255,255,255,.1);border-radius:20px;overflow:hidden;display:none;flex-direction:column;z-index:99999;box-shadow:0 8px 40px rgba(0,0,0,.6);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e0e0f0}
    #gp-panel.open{display:flex}
    .gp-header{padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
    .gp-header-back{background:rgba(255,255,255,.1);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}
    .gp-title{font-weight:700;font-size:1rem}
    .gp-close{background:rgba(255,255,255,.1);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}
    .gp-welcome{padding:16px 18px 0;flex-shrink:0}
    .gp-welcome-name{font-size:1.3rem;font-weight:800}
    .gp-welcome-pts{font-size:.85rem;opacity:.8;margin-top:2px}
    .gp-tabs{display:flex;align-items:center;border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0;padding:0 18px}
    .gp-tab{background:none;border:none;color:rgba(255,255,255,.5);font-size:.82rem;font-weight:600;padding:10px 10px;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s}
    .gp-tab.active{color:#fff;border-bottom-color:#fff}
    .gp-tab-icon{background:none;border:none;color:rgba(255,255,255,.5);font-size:1rem;padding:8px 10px;cursor:pointer;margin-left:auto;border-bottom:2px solid transparent;transition:all .2s}
    .gp-tab-icon.active{color:#fff;border-bottom-color:#fff}
    .gp-body{padding:14px 18px 16px;overflow-y:auto;flex:1}
    .gp-footer{padding:10px 18px 14px;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0}
    .gp-input{width:100%;background:#0f0f1a;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 12px;color:#e0e0f0;font-size:.9rem;outline:none;box-sizing:border-box;margin-bottom:10px}
    .gp-input:focus{border-color:#6c3fff}
    .gp-input:disabled{opacity:.5;cursor:not-allowed}
    .gp-btn-main{width:100%;padding:11px;border:none;border-radius:10px;font-size:.9rem;font-weight:700;cursor:pointer;transition:opacity .2s}
    .gp-btn-main:hover{opacity:.88}
    .gp-btn-main:disabled{opacity:.5;cursor:not-allowed}
    .gp-btn-outline{width:100%;padding:11px;border-radius:10px;font-size:.9rem;font-weight:700;cursor:pointer;background:transparent;transition:opacity .2s}
    .gp-btn-outline:hover{opacity:.88}
    .gp-auth-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .gp-section{background:#0f0f1a;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px;margin-bottom:10px}
    .gp-section-title{font-weight:700;font-size:.9rem;margin-bottom:4px}
    .gp-section-sub{font-size:.78rem;color:#8080a0;line-height:1.4}
    .gp-ref-row{display:flex;align-items:center;gap:6px;margin-top:10px}
    .gp-ref-input{flex:1;background:#16162a;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 10px;color:#e0e0f0;font-size:.75rem;outline:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .gp-ref-btn{background:rgba(255,255,255,.1);border:none;color:#fff;width:32px;height:32px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;transition:background .2s}
    .gp-ref-btn:hover{background:rgba(255,255,255,.2)}
    .gp-tier-section{background:#0f0f1a;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px;margin-bottom:10px}
    .gp-tier-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
    .gp-tier-icon{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
    .gp-tier-info{flex:1}
    .gp-tier-name{font-weight:700;font-size:.9rem}
    .gp-tier-next{font-size:.75rem;color:#8080a0;margin-top:2px}
    .gp-progress{background:rgba(255,255,255,.1);border-radius:10px;height:5px;overflow:hidden}
    .gp-progress-fill{height:100%;border-radius:10px;transition:width .6s}
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
    .gp-detail-stat{font-size:1rem;font-weight:700;text-align:center;margin-bottom:8px}
    .gp-detail-desc{font-size:.85rem;color:#aaa;text-align:center;line-height:1.5;margin-bottom:16px}
    .gp-offer{background:#0f0f1a;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 14px;margin-bottom:8px}
    .gp-offer-name{font-weight:600;font-size:.9rem}
    .gp-offer-meta{font-size:.78rem;color:#7878a0;margin-top:2px}
    .gp-redeem-btn{margin-top:8px;border:1px solid #6c3fff;color:#c47aff;padding:5px 14px;border-radius:8px;font-size:.78rem;cursor:pointer;background:rgba(108,63,255,.25)}
    .gp-redeem-btn:disabled{opacity:.4;cursor:not-allowed}
    .gp-code-box{background:#0f0f1a;border:1px solid #2ecc71;border-radius:10px;padding:12px;text-align:center;margin:10px 0}
    .gp-code{font-size:1.2rem;font-weight:800;color:#2ecc71;letter-spacing:2px}
    .gp-earn-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)}
    .gp-earn-row:last-child{border-bottom:none}
    .gp-earn-label{font-size:.85rem;display:flex;align-items:center;gap:8px}
    .gp-earn-pts{font-size:.82rem;font-weight:700}
    .gp-msg{font-size:.8rem;color:#7878a0;text-align:center;padding:6px 0}
    .gp-consent{display:flex;align-items:flex-start;gap:10px;font-size:.82rem;color:#aaa;margin:4px 0 16px;cursor:pointer;line-height:1.4}
    .gp-consent input{width:16px;height:16px;margin-top:1px;flex-shrink:0;cursor:pointer;accent-color:#6c3fff}
    .gp-field-label{font-size:.78rem;color:#7878a0;display:block;margin-bottom:4px}
    .gp-logout{font-size:.75rem;color:#5050a0;background:none;border:none;cursor:pointer;margin-top:8px;text-decoration:underline;display:block}
    .gp-copy-toast{position:absolute;top:-28px;left:50%;transform:translateX(-50%);background:#2ecc71;color:#fff;font-size:.72rem;padding:3px 8px;border-radius:6px;white-space:nowrap;pointer-events:none}
  `
  document.head.appendChild(style)

  // ── Button & Panel ────────────────────────────────────────────────────
  const btn = document.createElement('button')
  btn.id = 'gp-btn'; btn.setAttribute('aria-label','Loyalty rewards')
  btn.innerHTML = '<span style="font-size:18px">🎁</span><span id="gp-btn-label">Rewards</span>'
  document.body.appendChild(btn)
  const panel = document.createElement('div')
  panel.id = 'gp-panel'; document.body.appendChild(panel)
  btn.addEventListener('click', () => { open = !open; panel.classList.toggle('open', open); if (open && !config) loadConfig() })

  // ── Helpers ───────────────────────────────────────────────────────────
  async function api(path, opts = {}) { const r = await fetch(BASE + path, opts); return r.json() }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
  function color() { return (config && config.widget_primary_color) || '#6c3fff' }

  function tierInfo(lifetimePts) {
    const silver = (config && config.tier_silver) || 500
    const gold   = (config && config.tier_gold)   || 1000
    if (lifetimePts >= gold)   return { name:'Gold',   next:null,                                    pct:100,                                                       icon:'🥇' }
    if (lifetimePts >= silver) return { name:'Silver', next:`${gold-lifetimePts} pts to Gold`,        pct:Math.round(((lifetimePts-silver)/(gold-silver))*100),       icon:'🥈' }
    return                             { name:'Bronze', next:`${silver-lifetimePts} pts to Silver`,   pct:Math.round((lifetimePts/silver)*100),                       icon:'🥉' }
  }

  function tierRank(tierName) {
    if (tierName === 'Gold')   return 2
    if (tierName === 'Silver') return 1
    return 0
  }

  function refUrl(code) { return `${BASE}/ref/${code}` }

  // ── Load ──────────────────────────────────────────────────────────────
  async function loadConfig() {
    render('loading')
    config = await api(`/api/widget/config?shop=${SHOP}`)
    if (config.error) { btn.style.opacity='1'; btn.style.pointerEvents='auto'; render('error'); return }
    btn.style.background = color()
    const tc = config.widget_btn_text_color || '#ffffff'
    btn.style.color = tc
    const existingTc = document.getElementById('gp-tc-style')
    if (existingTc) existingTc.remove()
    const tcStyle = document.createElement('style'); tcStyle.id='gp-tc-style'
    tcStyle.textContent = `.gp-btn-main{color:${tc}!important}`
    document.head.appendChild(tcStyle)
    const label = document.getElementById('gp-btn-label')
    if (label) label.textContent = config.widget_title || 'Rewards'
    // Apply position + offsets
    const pos = config.widget_position || 'bottom-right'
    const ob = config.widget_offset_bottom ?? 24
    const os = config.widget_offset_side ?? 24
    const isLeft = pos.includes('left')
    const isTop = pos.includes('top')
    btn.style.bottom = isTop ? 'auto' : `${ob}px`
    btn.style.top    = isTop ? `${ob}px` : 'auto'
    btn.style.right  = isLeft ? 'auto' : `${os}px`
    btn.style.left   = isLeft ? `${os}px` : 'auto'
    panel.style.bottom = isTop ? 'auto' : `${ob + 64}px`
    panel.style.top    = isTop ? `${ob + 64}px` : 'auto'
    panel.style.right  = isLeft ? 'auto' : `${os}px`
    panel.style.left   = isLeft ? `${os}px` : 'auto'
    btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'

    if (CUSTOMER_EMAIL) {
      const data = await api(`/api/widget/points?shop=${SHOP}&email=${encodeURIComponent(CUSTOMER_EMAIL)}`)
      if (data.found) { customer=data.customer; redemptions=data.redemptions||[]; localStorage.setItem(STORAGE_KEY,CUSTOMER_EMAIL); render('home') }
      else render('profile')
    } else {
      const saved = localStorage.getItem(STORAGE_KEY) || ''
      if (saved) {
        const data = await api(`/api/widget/points?shop=${SHOP}&email=${encodeURIComponent(saved)}`)
        if (data.found) { customer=data.customer; redemptions=data.redemptions||[]; render('home') } else { welcomeSlide=0; render('welcome') }
      } else { welcomeSlide=0; render('welcome') }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  function render(v) {
    view = v
    const c = color()
    const title = (config && config.widget_title) || 'Rewards'
    const isDetailView = (v === 'welcome' && welcomeDetail !== null) || v === 'register-form' || v === 'login-form' || v === 'forgot-password'
    const detailTitle = v === 'register-form' ? 'Create Account' : v === 'login-form' ? 'Sign In' : v === 'forgot-password' ? 'Forgot Password' : welcomeDetail === 'order' ? 'Place an order' : welcomeDetail === 'refer' ? 'Refer a Friend' : welcomeDetail === 'follow' ? 'Follow us online' : ''
    const backBtn = isDetailView ? `<button class="gp-header-back" id="gp-back-btn">‹</button>` : `<span style="width:28px"></span>`

    const showWelcomeBar = v === 'home' && customer
    const showTabs = v === 'home' && customer

    panel.innerHTML = `
      <div class="gp-header" style="background:${c}20;border-bottom:1px solid ${c}30">
        ${backBtn}
        <span class="gp-title">${isDetailView ? detailTitle : '⭐ '+title}</span>
        <button class="gp-close" id="gp-close-btn">✕</button>
      </div>
      ${showWelcomeBar ? `
        <div class="gp-welcome" style="background:${c}15">
          <div class="gp-welcome-name" style="color:${c}">Welcome ${esc(customer.name.split(' ')[0])}</div>
          <div class="gp-welcome-pts">You have ${(customer.points||0).toLocaleString()} pts</div>
        </div>
      ` : ''}
      ${showTabs ? `
        <div class="gp-tabs" style="background:${c}10">
          <button class="gp-tab ${homeTab==='home'?'active':''}" data-tab="home">Home</button>
          <button class="gp-tab ${homeTab==='rewards'?'active':''}" data-tab="rewards">Rewards</button>
          <button class="gp-tab ${homeTab==='offers'?'active':''}" data-tab="offers">Offers</button>
          <button class="gp-tab-icon ${homeTab==='profile'?'active':''}" data-tab="profile">👤</button>
        </div>
      ` : ''}
      <div class="gp-body" id="gp-body">${bodyHTML(v, c)}</div>
      ${(v === 'welcome' || v === 'lookup') ? `<div class="gp-footer">${footerHTML(c)}</div>` : ''}
    `
    document.getElementById('gp-close-btn').addEventListener('click', () => { open=false; panel.classList.remove('open') })
    if (isDetailView) document.getElementById('gp-back-btn').addEventListener('click', () => { if (v==='forgot-password') render('login-form'); else { welcomeDetail=null; render('welcome') } })
    if (showTabs) document.querySelectorAll('.gp-tab, .gp-tab-icon').forEach(t => t.addEventListener('click', () => { homeTab=t.getAttribute('data-tab'); render('home') }))
    bindEvents(v, c)
  }

  function footerHTML(c) {
    return `<div class="gp-auth-row">
      <button class="gp-btn-main" id="gp-shopify-register" style="background:${c}">Register</button>
      <button class="gp-btn-outline" id="gp-shopify-login" style="border:2px solid ${c};color:${c}">Login</button>
    </div>`
  }

  function bodyHTML(v, c) {
    if (v==='loading') return '<p class="gp-msg" style="padding:30px 0">Loading...</p>'
    if (v==='error')   return '<p class="gp-msg" style="padding:30px 0;color:#e74c3c">Could not load rewards.</p>'

    // ── WELCOME (not logged in) ──────────────────────────────────────────
    if (v === 'welcome') {
      const hasFollow = !!(config && config.social_follow_url)
      const ptsPerDollar = (config && config.points_per_dollar) || 1
      const followPts = (config && config.follow_points) || 50

      if (welcomeDetail === 'order') return `
        <div class="gp-detail-icon" style="background:${c}25">${svgIcon('bag',c)}</div>
        <div class="gp-detail-stat" style="color:${c}">1 USD earns you ${ptsPerDollar} loyalty point${ptsPerDollar>1?'s':''}</div>
        <div class="gp-detail-desc">Shop and earn points automatically on every order — no extra steps needed.</div>
      `
      if (welcomeDetail === 'refer') return `
        <div class="gp-detail-icon" style="background:${c}25">${svgIcon('refer',c)}</div>
        <div class="gp-detail-stat" style="color:${c}">Coming soon</div>
        <div class="gp-detail-desc">Refer friends and family to earn bonus points. Register first to get your unique referral link.</div>
      `
      if (welcomeDetail === 'follow') {
        return `
          <div class="gp-detail-icon" style="background:${c}25">${svgIcon('follow',c)}</div>
          <div class="gp-detail-stat" style="color:${c}">Earn ${followPts} points for following us</div>
          <div class="gp-detail-desc">Follow our page and claim your reward. One-time bonus per account.</div>
          <p class="gp-msg">Log in first to claim your follow reward.</p>
        `
      }

      if (welcomeSlide === 0) return `
        <p style="font-weight:700;font-size:.95rem;margin:10px 0 4px">Welcome to our Loyalty Program</p>
        <p class="gp-msg" style="text-align:left;padding:0 0 12px;margin:0">Earn points on every purchase and redeem for exclusive rewards.</p>
        <div class="gp-card" id="gp-card-order">
          <div class="gp-card-icon" style="background:${c}25">${svgIcon('bag',c)}</div>
          <div class="gp-card-text"><div class="gp-card-title">Place an order</div><div class="gp-card-sub">Every order earns you points</div></div>
          <div class="gp-card-arrow">›</div>
        </div>
        <div class="gp-card" id="gp-card-refer">
          <div class="gp-card-icon" style="background:${c}25">${svgIcon('refer',c)}</div>
          <div class="gp-card-text"><div class="gp-card-title">Refer a Friend</div><div class="gp-card-sub">Refer and earn</div></div>
          <div class="gp-card-arrow">›</div>
        </div>
        ${hasFollow ? `<div class="gp-dots"><span class="gp-dot active" data-slide="0"></span><span class="gp-dot" data-slide="1"></span></div>` : ''}
      `

      return `
        <p style="font-weight:700;font-size:.95rem;margin:10px 0 4px">Earn more ways</p>
        <p class="gp-msg" style="text-align:left;padding:0 0 12px;margin:0">Get bonus points for following us on social media.</p>
        <div class="gp-card" id="gp-card-follow">
          <div class="gp-card-icon" style="background:${c}25">${svgIcon('follow',c)}</div>
          <div class="gp-card-text"><div class="gp-card-title">Follow us online</div><div class="gp-card-sub">You will earn points for every page you follow</div></div>
          <div class="gp-card-arrow">›</div>
        </div>
        <div class="gp-dots"><span class="gp-dot" data-slide="0"></span><span class="gp-dot active" data-slide="1"></span></div>
      `
    }

    // ── PROFILE COMPLETION ───────────────────────────────────────────────
    if (v === 'profile') return `
      <div style="padding-top:10px">
        <p style="font-weight:700;font-size:.95rem;margin-bottom:4px">Complete your profile</p>
        <p class="gp-msg" style="text-align:left;padding:0 0 12px;margin:0">Just a couple more details to start earning!</p>
        <label class="gp-field-label">Name</label>
        <input class="gp-input" id="gp-profile-name" value="${esc(CUSTOMER_NAME)}" placeholder="Your name" ${CUSTOMER_NAME?'disabled':''} />
        <label class="gp-field-label">Email</label>
        <input class="gp-input" value="${esc(CUSTOMER_EMAIL)}" type="email" disabled />
        <label class="gp-field-label">Date of birth <span style="opacity:.5;font-size:.72rem">(optional)</span></label>
        <input class="gp-input" id="gp-profile-birthday" type="date" />
        <label class="gp-field-label">Phone number <span style="opacity:.5;font-size:.72rem">(optional, include country code)</span></label>
        <input class="gp-input" id="gp-profile-phone" type="tel" placeholder="+1 555 000 0000" />
        <label class="gp-consent"><input type="checkbox" id="gp-marketing-consent" /> I would like to receive promotions by email <span style="opacity:.5">(optional)</span></label>
        <label class="gp-consent"><input type="checkbox" id="gp-whatsapp-consent" /> Send me updates on WhatsApp <span style="opacity:.5">(optional)</span></label>
        <button class="gp-btn-main" id="gp-profile-save" style="background:${c}">Save & Start Earning</button>
        <p id="gp-profile-msg" class="gp-msg"></p>
      </div>
    `

    // ── LOOKUP ───────────────────────────────────────────────────────────
    if (v === 'lookup') return `
      <p class="gp-msg" style="padding-top:8px;margin-bottom:10px">Enter your email to check your points</p>
      <input class="gp-input" id="gp-lookup-email" placeholder="Email address" type="email" />
      <button class="gp-btn-main" id="gp-lookup-btn" style="background:${c};margin-bottom:8px">Look Up Points</button>
      <p id="gp-lookup-msg" class="gp-msg"></p>
    `

    if (v === 'register-form') return `
      <div style="padding-top:10px">
        <p style="font-weight:700;font-size:.95rem;margin-bottom:4px">Create Account</p>
        <p class="gp-msg" style="text-align:left;padding:0 0 12px;margin:0">Join the loyalty program and start earning points.</p>
        <label class="gp-field-label">Name *</label>
        <input class="gp-input" id="gp-reg-name" placeholder="Your name" />
        <label class="gp-field-label">Email *</label>
        <input class="gp-input" id="gp-reg-email" type="email" placeholder="your@email.com" />
        <label class="gp-field-label">Password *</label>
        <input class="gp-input" id="gp-reg-password" type="password" placeholder="Create a password" />
        <label class="gp-field-label">Phone number <span style="opacity:.5;font-size:.72rem">(optional, include country code)</span></label>
        <input class="gp-input" id="gp-reg-phone" type="tel" placeholder="+1 555 000 0000" />
        <label class="gp-consent"><input type="checkbox" id="gp-reg-whatsapp" /> Send me updates on WhatsApp <span style="opacity:.5">(optional)</span></label>
        <button class="gp-btn-main" id="gp-reg-submit" style="background:${c}">Create Account</button>
        <p id="gp-reg-msg" class="gp-msg"></p>
      </div>
    `

    if (v === 'login-form') return `
      <div style="padding-top:10px">
        <p style="font-weight:700;font-size:.95rem;margin-bottom:4px">Sign In</p>
        <p class="gp-msg" style="text-align:left;padding:0 0 12px;margin:0">Sign in to see your points and rewards.</p>
        <label class="gp-field-label">Email *</label>
        <input class="gp-input" id="gp-login-email" type="email" placeholder="your@email.com" />
        <label class="gp-field-label">Password *</label>
        <input class="gp-input" id="gp-login-password" type="password" placeholder="Your password" />
        <button class="gp-btn-main" id="gp-login-submit" style="background:${c}">Sign In</button>
        <p id="gp-login-msg" class="gp-msg"></p>
        <button style="background:none;border:none;color:#7878a0;font-size:.78rem;cursor:pointer;margin-top:6px;padding:0;text-decoration:underline" id="gp-forgot-link">Forgot password?</button>
      </div>
    `

    if (v === 'forgot-password') return `
      <div style="padding-top:10px">
        <p style="font-weight:700;font-size:.95rem;margin-bottom:4px">Reset Password</p>
        <p class="gp-msg" style="text-align:left;padding:0 0 12px;margin:0">Enter your email and we'll send you a reset link.</p>
        <label class="gp-field-label">Email *</label>
        <input class="gp-input" id="gp-forgot-email" type="email" placeholder="your@email.com" />
        <button class="gp-btn-main" id="gp-forgot-submit" style="background:${c}">Send Reset Link</button>
        <p id="gp-forgot-msg" class="gp-msg"></p>
      </div>
    `

    // ── HOME (logged in) ─────────────────────────────────────────────────
    if (v === 'home' && customer) {
      const pts = customer.points || 0
      const lifetimePts = customer.lifetime_points || 0
      const tier = tierInfo(lifetimePts)
      const refCode = customer.referral_code || ''
      const url = refUrl(refCode)
      const refPts = (config && config.referral_points) || 100

      if (homeTab === 'home') {
        return `
          <!-- Refer a Friend -->
          <div class="gp-section">
            <div class="gp-section-title">Refer a Friend</div>
            <div class="gp-section-sub">Refer friends and family to earn ${refPts} loyalty points when they join.</div>
            ${refCode ? `
              <div class="gp-ref-row">
                <input class="gp-ref-input" value="${esc(url)}" readonly id="gp-ref-url" />
                <div style="position:relative">
                  <button class="gp-ref-btn" id="gp-copy-ref" title="Copy link">📋</button>
                </div>
                <button class="gp-ref-btn" id="gp-share-fb" title="Share on Facebook" style="background:#1877f2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
                </button>
              </div>
            ` : '<p class="gp-msg" style="font-size:.75rem">Your referral link will appear here shortly.</p>'}
          </div>

          <!-- Tier -->
          <div class="gp-tier-section">
            <div class="gp-tier-row">
              <div class="gp-tier-icon" style="background:${c}20">${tier.icon}</div>
              <div class="gp-tier-info">
                <div class="gp-tier-name">${tier.name} Member</div>
                <div class="gp-tier-next">${tier.next || 'Maximum tier reached!'}</div>
              </div>
            </div>
            <div class="gp-progress"><div class="gp-progress-fill" style="width:${tier.pct}%;background:${c}"></div></div>
          </div>

          <!-- Ways to earn -->
          <div class="gp-card" id="gp-ways-card">
            <div class="gp-card-icon" style="background:${c}25">💰</div>
            <div class="gp-card-text">
              <div class="gp-card-title">Ways to earn</div>
              <div class="gp-card-sub">Explore how we reward you</div>
            </div>
            <div class="gp-card-arrow">›</div>
          </div>
        `
      }

      if (homeTab === 'rewards') {
        const offers = (config.offers||[])
        const activeCodes = redemptions.slice(0,3)
        const codesHTML = activeCodes.length ? `
          <div style="margin-bottom:12px">
            <p style="font-weight:700;font-size:.85rem;margin-bottom:8px;color:#c0c0d8">Your Recent Codes</p>
            ${activeCodes.map(r => {
              const offerName = r.offers ? (Array.isArray(r.offers) ? r.offers[0]?.name : r.offers.name) : ''
              return `<div class="gp-code-box" style="margin-bottom:8px">
                <div style="font-size:.75rem;color:#7878a0;margin-bottom:2px">${esc(offerName||'Discount')}</div>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="gp-code" style="flex:1" id="rc-${esc(r.discount_code)}">${esc(r.discount_code)}</div>
                  <button class="gp-ref-btn gp-copy-rcode" data-code="${esc(r.discount_code)}" title="Copy">📋</button>
                </div>
              </div>`
            }).join('')}
          </div>` : ''
        if (!offers.length) return codesHTML || '<p class="gp-msg" style="padding:20px 0">No rewards available yet — check back soon!</p>'
        return codesHTML + offers.map(o => {
          const minTier = o.min_tier || 'Bronze'
          const tierLocked = tierRank(tier.name) < tierRank(minTier)
          const canAfford = pts >= o.points_required
          const tierBadge = minTier !== 'Bronze' ? `<span style="font-size:.7rem;background:rgba(255,255,255,.1);border-radius:4px;padding:2px 6px;margin-left:4px">${minTier==='Gold'?'🥇':'🥈'} ${minTier}+</span>` : ''
          if (tierLocked) {
            return `<div class="gp-offer" style="opacity:.55">
              <div class="gp-offer-name">${esc(o.name)}${tierBadge}</div>
              <div class="gp-offer-meta">${esc(o.description||'')} · <span style="color:#c47aff">${o.points_required} pts</span></div>
              <button class="gp-redeem-btn" disabled>🔒 Reach ${esc(minTier)} to unlock</button>
            </div>`
          }
          return `<div class="gp-offer">
            <div class="gp-offer-name">${esc(o.name)}${tierBadge}</div>
            <div class="gp-offer-meta">${esc(o.description||'')} · <span style="color:#c47aff">${o.points_required} pts</span></div>
            <button class="gp-redeem-btn" data-offer-id="${o.id}" ${canAfford?'':'disabled'}>${canAfford?'Redeem':`Need ${o.points_required-pts} more pts`}</button>
          </div>`
        }).join('') + '<div id="gp-code-area"></div>'
      }

      if (homeTab === 'offers') {
        const ptsPerDollar = (config && config.points_per_dollar) || 1
        const signupBonus = (config && config.signup_bonus) || 0
        const followPts = (config && config.follow_points) || 0
        const hasFollow = !!(config && config.social_follow_url)
        const bronzeMult = (config && config.tier_bronze_multiplier) || 1
        const silverMult = (config && config.tier_silver_multiplier) || 1.5
        const goldMult   = (config && config.tier_gold_multiplier)   || 2
        const rows = [
          ['🛍️', 'Place an order', `${ptsPerDollar} pt${ptsPerDollar>1?'s':''} per $1 spent`],
          signupBonus > 0 ? ['👋', 'Sign up bonus', `+${signupBonus} pts (one time)`] : null,
          ['👥', 'Refer a Friend', `+${refPts} pts per referral`],
          hasFollow ? ['📘', 'Follow us online', `+${followPts} pts (one time)`] : null,
          ['🎂', 'Birthday bonus', 'Coming soon'],
        ].filter(Boolean)
        return `
          <p style="font-weight:700;font-size:.9rem;margin-bottom:12px;margin-top:4px">Ways to Earn Points</p>
          <div class="gp-section" style="padding:8px 14px">
            ${rows.map(([ico, label, pts]) => `
              <div class="gp-earn-row">
                <div class="gp-earn-label">${ico} ${label}</div>
                <div class="gp-earn-pts" style="color:${c}">${pts}</div>
              </div>`).join('')}
          </div>
          <p style="font-weight:700;font-size:.9rem;margin-bottom:12px;margin-top:4px">Tier Multipliers</p>
          <div class="gp-section" style="padding:8px 14px">
            <div class="gp-earn-row">
              <div class="gp-earn-label">🥉 Bronze</div>
              <div class="gp-earn-pts" style="color:${c}">${bronzeMult}× points</div>
            </div>
            <div class="gp-earn-row">
              <div class="gp-earn-label">🥈 Silver</div>
              <div class="gp-earn-pts" style="color:${c}">${silverMult}× points</div>
            </div>
            <div class="gp-earn-row">
              <div class="gp-earn-label">🥇 Gold</div>
              <div class="gp-earn-pts" style="color:${c}">${goldMult}× points</div>
            </div>
          </div>
        `
      }

      if (homeTab === 'profile') {
        return `
          <div style="padding-top:4px">
            <label class="gp-field-label">Date of birth</label>
            <input class="gp-input" id="gp-edit-birthday" type="date" value="${esc(customer.birthday||'')}" />
            <label class="gp-field-label">Phone number <span style="opacity:.5;font-size:.72rem">(include country code)</span></label>
            <input class="gp-input" id="gp-edit-phone" type="tel" placeholder="+1 555 000 0000" value="${esc(customer.phone||'')}" />
            <label class="gp-consent"><input type="checkbox" id="gp-edit-consent" ${customer.marketing_consent?'checked':''} /> I would like to receive promotions by email</label>
            <label class="gp-consent"><input type="checkbox" id="gp-edit-whatsapp" ${customer.whatsapp_consent?'checked':''} /> Send me updates on WhatsApp</label>
            <button class="gp-btn-main" id="gp-edit-save" style="background:${c}">Save Changes</button>
            <p id="gp-edit-msg" class="gp-msg"></p>
            <button class="gp-logout" id="gp-logout-btn">Sign out</button>
          </div>
        `
      }
    }
    return ''
  }

  function svgIcon(type, c) {
    if (type==='bag')    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`
    if (type==='refer')  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`
    if (type==='follow') return `<svg width="20" height="20" viewBox="0 0 24 24" fill="${c}"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>`
    return '⭐'
  }

  // ── Events ────────────────────────────────────────────────────────────
  function bindEvents(v, c) {
    if (v === 'welcome') {
      const reg = document.getElementById('gp-shopify-register')
      const log = document.getElementById('gp-shopify-login')
      if (reg) reg.addEventListener('click', () => render('register-form'))
      if (log) log.addEventListener('click', () => render('login-form'))
      document.querySelectorAll('.gp-dot').forEach(d => d.addEventListener('click', () => { welcomeSlide=parseInt(d.getAttribute('data-slide')); welcomeDetail=null; render('welcome') }))
      const co = document.getElementById('gp-card-order')
      const cr = document.getElementById('gp-card-refer')
      const cf = document.getElementById('gp-card-follow')
      if (co) co.addEventListener('click', () => { welcomeDetail='order'; render('welcome') })
      if (cr) cr.addEventListener('click', () => { welcomeDetail='refer'; render('welcome') })
      if (cf) cf.addEventListener('click', () => { welcomeDetail='follow'; render('welcome') })

      const claimBtn = document.getElementById('gp-claim-follow')
      if (claimBtn) {
        claimBtn.addEventListener('click', async () => {
          const email = (customer&&customer.email)||CUSTOMER_EMAIL||localStorage.getItem(STORAGE_KEY)
          claimBtn.disabled=true; claimBtn.textContent='Claiming...'
          if (config.social_follow_url) window.open(config.social_follow_url,'_blank')
          const data = await api('/api/widget/follow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shop:SHOP,email})})
          const msg = document.getElementById('gp-follow-msg')
          if (data.error) { msg.textContent=data.error; msg.style.color='#e74c3c'; claimBtn.disabled=false; claimBtn.textContent=`Follow & Claim ${config.follow_points||50} pts`; return }
          if (customer) customer.points=data.newPoints
          msg.textContent=`+${data.pointsEarned} points added!`; msg.style.color='#2ecc71'
          claimBtn.disabled=true; claimBtn.textContent='✓ Claimed'
        })
      }
    }

    if (v === 'profile') {
      document.getElementById('gp-profile-save').addEventListener('click', async () => {
        const name = CUSTOMER_NAME || document.getElementById('gp-profile-name').value.trim()
        const birthday = document.getElementById('gp-profile-birthday').value
        const marketing_consent = document.getElementById('gp-marketing-consent').checked
        const whatsapp_consent = document.getElementById('gp-whatsapp-consent').checked
        const phone = document.getElementById('gp-profile-phone').value.trim()
        const msg = document.getElementById('gp-profile-msg')
        msg.textContent='Saving...'; msg.style.color='#7878a0'
        const data = await api('/api/widget/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shop:SHOP,email:CUSTOMER_EMAIL,name,birthday,marketing_consent,whatsapp_consent,phone,gp_ref:GP_REF})})
        if (data.error) { msg.textContent=data.error; msg.style.color='#e74c3c'; return }
        localStorage.setItem(STORAGE_KEY,CUSTOMER_EMAIL); localStorage.removeItem(REF_STORAGE_KEY); customer=data.customer; render('home')
      })
    }

    if (v === 'lookup') {
      const reg = document.getElementById('gp-shopify-register')
      const log = document.getElementById('gp-shopify-login')
      if (reg) reg.addEventListener('click', () => render('register-form'))
      if (log) log.addEventListener('click', () => render('login-form'))
      document.getElementById('gp-lookup-btn').addEventListener('click', async () => {
        const email = document.getElementById('gp-lookup-email').value.trim()
        const msg = document.getElementById('gp-lookup-msg')
        if (!email) return
        msg.textContent='Looking up...'; msg.style.color='#7878a0'
        const data = await api(`/api/widget/points?shop=${SHOP}&email=${encodeURIComponent(email)}`)
        if (!data.found) { msg.textContent='Email not found. Register first.'; msg.style.color='#e74c3c'; return }
        localStorage.setItem(STORAGE_KEY,email); customer=data.customer; render('home')
      })
    }

    if (v === 'register-form') {
      document.getElementById('gp-reg-submit').addEventListener('click', async () => {
        const name = document.getElementById('gp-reg-name').value.trim()
        const email = document.getElementById('gp-reg-email').value.trim()
        const password = document.getElementById('gp-reg-password').value
        const phone = document.getElementById('gp-reg-phone').value.trim()
        const whatsapp_consent = document.getElementById('gp-reg-whatsapp').checked
        const msg = document.getElementById('gp-reg-msg')
        if (!name || !email || !password) { msg.textContent='All fields are required.'; msg.style.color='#e74c3c'; return }
        msg.textContent='Creating account...'; msg.style.color='#7878a0'
        const data = await api('/api/widget/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shop:SHOP,email,name,password,phone,whatsapp_consent,gp_ref:GP_REF})})
        if (data.error) { msg.textContent=data.error; msg.style.color='#e74c3c'; return }
        localStorage.setItem(STORAGE_KEY,email); localStorage.removeItem(REF_STORAGE_KEY); customer=data.customer; render('home')
      })
    }

    if (v === 'login-form') {
      document.getElementById('gp-login-submit').addEventListener('click', async () => {
        const email = document.getElementById('gp-login-email').value.trim()
        const password = document.getElementById('gp-login-password').value
        const msg = document.getElementById('gp-login-msg')
        if (!email || !password) { msg.textContent='Email and password are required.'; msg.style.color='#e74c3c'; return }
        msg.textContent='Signing in...'; msg.style.color='#7878a0'
        const data = await api('/api/widget/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shop:SHOP,email,password})})
        if (data.error) { msg.textContent=data.error; msg.style.color='#e74c3c'; return }
        localStorage.setItem(STORAGE_KEY,email); customer=data.customer; render('home')
      })
      const forgotLink = document.getElementById('gp-forgot-link')
      if (forgotLink) forgotLink.addEventListener('click', () => render('forgot-password'))
    }

    if (v === 'forgot-password') {
      document.getElementById('gp-forgot-submit').addEventListener('click', async () => {
        const email = document.getElementById('gp-forgot-email').value.trim()
        const msg = document.getElementById('gp-forgot-msg')
        if (!email) { msg.textContent='Please enter your email.'; msg.style.color='#e74c3c'; return }
        msg.textContent='Sending...'; msg.style.color='#7878a0'
        await api('/api/widget/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shop:SHOP,email})})
        msg.textContent='Check your email for a reset link!'; msg.style.color='#2ecc71'
        document.getElementById('gp-forgot-submit').disabled=true
      })
    }

    if (v === 'home' && customer) {
      // Copy referral link
      const copyBtn = document.getElementById('gp-copy-ref')
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const url = document.getElementById('gp-ref-url')
          if (url) { navigator.clipboard.writeText(url.value).catch(()=>{}) }
          copyBtn.textContent = '✓'
          setTimeout(() => { copyBtn.textContent = '📋' }, 1500)
        })
      }
      // Facebook share
      const fbBtn = document.getElementById('gp-share-fb')
      if (fbBtn) {
        fbBtn.addEventListener('click', () => {
          const url = document.getElementById('gp-ref-url')
          if (url) window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url.value)}`,'_blank','width=600,height=400')
        })
      }
      // Ways to earn card → go to offers tab
      const waysCard = document.getElementById('gp-ways-card')
      if (waysCard) waysCard.addEventListener('click', () => { homeTab='offers'; render('home') })

      // Copy recent code buttons
      document.querySelectorAll('.gp-copy-rcode').forEach(b => {
        b.addEventListener('click', () => {
          navigator.clipboard.writeText(b.getAttribute('data-code')||'').catch(()=>{})
          b.textContent='✓'; setTimeout(()=>{ b.textContent='📋' },1500)
        })
      })

      // Redeem buttons
      document.querySelectorAll('.gp-redeem-btn:not([disabled])').forEach(b => {
        b.addEventListener('click', async () => {
          const offerId = b.getAttribute('data-offer-id')
          const email = (customer&&customer.email)||localStorage.getItem(STORAGE_KEY)
          b.disabled=true; b.textContent='Processing...'
          const data = await api('/api/widget/redeem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shop:SHOP,email,offerId})})
          const area = document.getElementById('gp-code-area')
          if (data.error) { area.innerHTML=`<p class="gp-msg" style="color:#e74c3c">${esc(data.error)}</p>`; b.disabled=false; b.textContent='Redeem'; return }
          customer.points=data.newPoints
          const offerName = b.closest('.gp-offer')?.querySelector('.gp-offer-name')?.textContent||''
          redemptions=[{discount_code:data.discountCode,offers:{name:offerName},created_at:new Date().toISOString()},...redemptions].slice(0,5)
          area.innerHTML=`<div class="gp-code-box"><div style="font-size:.8rem;color:#7878a0;margin-bottom:4px">Your discount code:</div><div class="gp-code">${esc(data.discountCode)}</div></div>`
        })
      })

      // Profile tab save
      const editSave = document.getElementById('gp-edit-save')
      if (editSave) {
        editSave.addEventListener('click', async () => {
          const birthday = document.getElementById('gp-edit-birthday').value
          const marketing_consent = document.getElementById('gp-edit-consent').checked
          const whatsapp_consent = document.getElementById('gp-edit-whatsapp').checked
          const phone = document.getElementById('gp-edit-phone').value.trim()
          const msg = document.getElementById('gp-edit-msg')
          msg.textContent='Saving...'; msg.style.color='#7878a0'
          const email = (customer&&customer.email)||CUSTOMER_EMAIL||localStorage.getItem(STORAGE_KEY)
          const data = await api('/api/widget/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shop:SHOP,email,name:customer.name,birthday,marketing_consent,whatsapp_consent,phone})})
          if (data.error) { msg.textContent=data.error; msg.style.color='#e74c3c'; return }
          customer=data.customer; msg.textContent='Saved!'; msg.style.color='#2ecc71'
        })
      }

      // Sign out
      const logoutBtn = document.getElementById('gp-logout-btn')
      if (logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); customer=null; homeTab='home'; welcomeSlide=0; render('welcome') })
    }
  }

  // Pre-fetch config on page load so button position/color/title are applied immediately
  loadConfig()
})()
