(function () {
  const BASE = 'https://goldpoints-shopify.vercel.app'
  const script = document.currentScript || document.querySelector('script[data-shop]')
  const SHOP = script ? script.getAttribute('data-shop') : ''
  if (!SHOP) return

  // Shopify passes logged-in customer data via Liquid in the script tag
  const CUSTOMER_EMAIL = (script && script.getAttribute('data-customer-email')) || ''
  const CUSTOMER_NAME = (script && script.getAttribute('data-customer-name')) || ''

  let config = null
  let customer = null
  let open = false
  let view = 'loading'

  const STORAGE_KEY = `gp_email_${SHOP}`

  // ── Styles ──────────────────────────────────────────────────────────
  const style = document.createElement('style')
  style.textContent = `
    #gp-btn { position:fixed; bottom:24px; right:24px; width:56px; height:56px; border-radius:50%; border:none; cursor:pointer; box-shadow:0 4px 20px rgba(0,0,0,.4); display:flex; align-items:center; justify-content:center; z-index:99998; font-size:24px; transition:transform .2s; }
    #gp-btn:hover { transform:scale(1.1); }
    #gp-panel { position:fixed; bottom:90px; right:24px; width:340px; max-height:540px; background:#16162a; border:1px solid rgba(255,255,255,.1); border-radius:20px; overflow:hidden; display:none; flex-direction:column; z-index:99999; box-shadow:0 8px 40px rgba(0,0,0,.6); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#e0e0f0; }
    #gp-panel.open { display:flex; }
    .gp-header { padding:16px 20px; display:flex; align-items:center; justify-content:space-between; }
    .gp-title { font-weight:700; font-size:1rem; }
    .gp-close { background:rgba(255,255,255,.1); border:none; color:#fff; width:28px; height:28px; border-radius:50%; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; }
    .gp-body { padding:0 20px 20px; overflow-y:auto; flex:1; }
    .gp-input { width:100%; background:#0f0f1a; border:1px solid rgba(255,255,255,.15); border-radius:10px; padding:10px 12px; color:#e0e0f0; font-size:.9rem; outline:none; box-sizing:border-box; margin-bottom:10px; }
    .gp-input:focus { border-color:#6c3fff; }
    .gp-input:disabled { opacity:.5; cursor:not-allowed; }
    .gp-btn-main { width:100%; padding:11px; border:none; border-radius:10px; font-size:.9rem; font-weight:700; cursor:pointer; transition:opacity .2s; }
    .gp-btn-main:hover { opacity:.88; }
    .gp-btn-outline { width:100%; padding:11px; border-radius:10px; font-size:.9rem; font-weight:700; cursor:pointer; transition:opacity .2s; background:transparent; }
    .gp-btn-outline:hover { opacity:.88; }
    .gp-points { text-align:center; padding:16px 0 8px; }
    .gp-pts-num { font-size:2.4rem; font-weight:800; }
    .gp-pts-lbl { font-size:.8rem; color:#7878a0; }
    .gp-tier { display:inline-block; padding:3px 14px; border-radius:20px; font-size:.75rem; font-weight:700; margin-top:6px; }
    .gp-tier-bronze { background:#4a2a10; color:#cd7f32; border:1px solid #cd7f32; }
    .gp-tier-silver { background:#1e2a30; color:#b0c4c4; border:1px solid #b0c4c4; }
    .gp-tier-gold { background:#2a2000; color:#ffd700; border:1px solid #ffd700; }
    .gp-offer { background:#0f0f1a; border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:12px 14px; margin-bottom:8px; }
    .gp-offer-name { font-weight:600; font-size:.9rem; }
    .gp-offer-meta { font-size:.78rem; color:#7878a0; margin-top:2px; }
    .gp-redeem-btn { margin-top:8px; background:rgba(108,63,255,.25); border:1px solid #6c3fff; color:#c47aff; padding:5px 14px; border-radius:8px; font-size:.78rem; cursor:pointer; }
    .gp-redeem-btn:disabled { opacity:.4; cursor:not-allowed; }
    .gp-code-box { background:#0f0f1a; border:1px solid #2ecc71; border-radius:10px; padding:12px; text-align:center; margin:12px 0; }
    .gp-code { font-size:1.2rem; font-weight:800; color:#2ecc71; letter-spacing:2px; }
    .gp-msg { font-size:.8rem; color:#7878a0; text-align:center; padding:8px 0; }
    .gp-logout { font-size:.75rem; color:#5050a0; background:none; border:none; cursor:pointer; margin-top:8px; text-decoration:underline; }
    .gp-section-title { font-size:.78rem; color:#7878a0; text-transform:uppercase; letter-spacing:.5px; margin:14px 0 8px; }
    .gp-progress { background:#0f0f1a; border-radius:10px; height:6px; margin:8px 0; overflow:hidden; }
    .gp-progress-fill { height:100%; border-radius:10px; background:linear-gradient(90deg,#6c3fff,#ffd700); transition:width .6s; }
    .gp-auth-btns { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px; }
    .gp-consent { display:flex; align-items:flex-start; gap:10px; font-size:.82rem; color:#aaa; margin:4px 0 16px; cursor:pointer; line-height:1.4; }
    .gp-consent input[type=checkbox] { width:16px; height:16px; margin-top:1px; flex-shrink:0; cursor:pointer; accent-color:#6c3fff; }
    .gp-field-label { font-size:.78rem; color:#7878a0; display:block; margin-bottom:4px; }
  `
  document.head.appendChild(style)

  // ── Button & Panel ───────────────────────────────────────────────────
  const btn = document.createElement('button')
  btn.id = 'gp-btn'
  btn.innerHTML = '⭐'
  btn.setAttribute('aria-label', 'Loyalty rewards')
  document.body.appendChild(btn)

  const panel = document.createElement('div')
  panel.id = 'gp-panel'
  document.body.appendChild(panel)

  btn.addEventListener('click', () => { open = !open; panel.classList.toggle('open', open); if (open && !config) loadConfig() })

  // ── API helpers ───────────────────────────────────────────────────────
  async function api(path, opts = {}) {
    const r = await fetch(BASE + path, opts)
    return r.json()
  }

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  }

  async function loadConfig() {
    render('loading')
    config = await api(`/api/widget/config?shop=${SHOP}`)
    if (config.error) { render('error'); return }
    btn.style.background = config.widget_primary_color || '#6c3fff'
    if (config.widget_position === 'bottom-left') { btn.style.right = 'auto'; btn.style.left = '24px'; panel.style.right = 'auto'; panel.style.left = '24px' }

    if (CUSTOMER_EMAIL) {
      // Shopify logged-in customer — check their GoldPoints account
      const data = await api(`/api/widget/points?shop=${SHOP}&email=${encodeURIComponent(CUSTOMER_EMAIL)}`)
      if (data.found && data.customer.birthday) {
        customer = data.customer
        localStorage.setItem(STORAGE_KEY, CUSTOMER_EMAIL)
        render('home')
      } else {
        render('profile')
      }
    } else {
      // Not logged into Shopify — check localStorage fallback
      const savedEmail = localStorage.getItem(STORAGE_KEY) || ''
      if (savedEmail) {
        const data = await api(`/api/widget/points?shop=${SHOP}&email=${encodeURIComponent(savedEmail)}`)
        if (data.found) { customer = data.customer; render('home') } else render('welcome')
      } else {
        render('welcome')
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  function render(v) {
    view = v
    const color = (config && config.widget_primary_color) || '#6c3fff'
    const title = (config && config.widget_title) || 'Rewards'

    panel.innerHTML = `
      <div class="gp-header" style="background:${color}20; border-bottom:1px solid ${color}40">
        <span class="gp-title">⭐ ${title}</span>
        <button class="gp-close" id="gp-close-btn">✕</button>
      </div>
      <div class="gp-body" id="gp-body">${bodyHTML(v, color)}</div>
    `
    document.getElementById('gp-close-btn').addEventListener('click', () => { open = false; panel.classList.remove('open') })
    bindEvents(v, color)
  }

  function tierClass(tier) { return `gp-tier gp-tier-${(tier||'bronze').toLowerCase()}` }

  function progressPct(pts) {
    if (pts >= 1000) return 100
    if (pts >= 500) return Math.round(((pts - 500) / 500) * 100)
    return Math.round((pts / 500) * 100)
  }

  function nextTier(pts) {
    if (pts < 500) return `${500 - pts} pts to Silver`
    if (pts < 1000) return `${1000 - pts} pts to Gold`
    return '🏆 Max tier!'
  }

  function bodyHTML(v, color) {
    if (v === 'loading') return '<p class="gp-msg" style="padding:30px 0">Loading...</p>'
    if (v === 'error') return '<p class="gp-msg" style="padding:30px 0;color:#e74c3c">Could not load rewards. Try again later.</p>'

    if (v === 'welcome') {
      return `
        <div style="padding-top:12px">
          <p style="font-weight:700;font-size:1rem;margin-bottom:4px">Welcome to our Loyalty Program</p>
          <p class="gp-msg" style="text-align:left;padding:0 0 16px">Earn points on every purchase and redeem them for exclusive rewards.</p>
          <div class="gp-auth-btns">
            <button class="gp-btn-main" id="gp-shopify-register" style="background:${color}">Register</button>
            <button class="gp-btn-outline" id="gp-shopify-login" style="border:2px solid ${color};color:${color}">Login</button>
          </div>
          <p class="gp-msg" style="margin-top:12px">Already logged in? <button style="background:none;border:none;color:#c47aff;cursor:pointer;text-decoration:underline;font-size:.8rem" id="gp-lookup-link">Look up my points</button></p>
        </div>
      `
    }

    if (v === 'profile') {
      return `
        <div style="padding-top:12px">
          <p style="font-weight:700;font-size:1rem;margin-bottom:4px">Complete your profile</p>
          <p class="gp-msg" style="text-align:left;padding:0 0 14px">Just a couple more details to start earning points!</p>
          <label class="gp-field-label">Name</label>
          <input class="gp-input" id="gp-profile-name" value="${esc(CUSTOMER_NAME)}" placeholder="Your name" ${CUSTOMER_NAME ? 'disabled' : ''} />
          <label class="gp-field-label">Email</label>
          <input class="gp-input" id="gp-profile-email" value="${esc(CUSTOMER_EMAIL)}" type="email" disabled />
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
        <button class="gp-btn-main" id="gp-lookup-btn" style="background:${color}">Look Up Points</button>
        <p id="gp-lookup-msg" class="gp-msg"></p>
      `
    }

    if (v === 'home') {
      const pts = customer.points || 0
      const pct = progressPct(pts)
      const offers = (config.offers || []).map(o => `
        <div class="gp-offer">
          <div class="gp-offer-name">${o.name}</div>
          <div class="gp-offer-meta">${o.description || ''} · <span style="color:#c47aff">${o.points_required} pts</span></div>
          <button class="gp-redeem-btn" data-offer-id="${o.id}" data-pts="${o.points_required}" ${pts < o.points_required ? 'disabled' : ''}>${pts >= o.points_required ? 'Redeem' : `Need ${o.points_required - pts} more pts`}</button>
        </div>`).join('')

      return `
        <div class="gp-points">
          <div class="gp-pts-num" style="color:${color}">${pts.toLocaleString()}</div>
          <div class="gp-pts-lbl">points</div>
          <div class="${tierClass(customer.tier)}">${customer.tier}</div>
          <div class="gp-progress"><div class="gp-progress-fill" style="width:${pct}%"></div></div>
          <div style="font-size:.75rem;color:#7878a0">${nextTier(pts)}</div>
        </div>
        <div class="gp-section-title">Available Rewards</div>
        ${offers || '<p class="gp-msg">No offers yet — check back soon!</p>'}
        <div id="gp-code-area"></div>
        <button class="gp-logout" id="gp-logout-btn">Not ${esc(customer.name)}? Sign out</button>
      `
    }
    return ''
  }

  function bindEvents(v, color) {
    if (v === 'welcome') {
      document.getElementById('gp-shopify-register').addEventListener('click', () => {
        window.location.href = '/account/register'
      })
      document.getElementById('gp-shopify-login').addEventListener('click', () => {
        window.location.href = '/account/login'
      })
      document.getElementById('gp-lookup-link').addEventListener('click', () => render('lookup'))
    }

    if (v === 'profile') {
      document.getElementById('gp-profile-save').addEventListener('click', async () => {
        const nameEl = document.getElementById('gp-profile-name')
        const name = CUSTOMER_NAME || nameEl.value.trim()
        const birthday = document.getElementById('gp-profile-birthday').value
        const marketing_consent = document.getElementById('gp-marketing-consent').checked
        const msg = document.getElementById('gp-profile-msg')
        msg.textContent = 'Saving...'; msg.style.color = '#7878a0'
        const data = await api('/api/widget/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop: SHOP, email: CUSTOMER_EMAIL, name, birthday, marketing_consent })
        })
        if (data.error) { msg.textContent = data.error; msg.style.color = '#e74c3c'; return }
        localStorage.setItem(STORAGE_KEY, CUSTOMER_EMAIL)
        customer = data.customer
        render('home')
      })
    }

    if (v === 'lookup') {
      document.getElementById('gp-lookup-btn').addEventListener('click', async () => {
        const email = document.getElementById('gp-lookup-email').value.trim()
        const msg = document.getElementById('gp-lookup-msg')
        if (!email) return
        msg.textContent = 'Looking up...'; msg.style.color = '#7878a0'
        const data = await api(`/api/widget/points?shop=${SHOP}&email=${encodeURIComponent(email)}`)
        if (!data.found) { msg.textContent = 'Email not found. Register first.'; msg.style.color = '#e74c3c'; return }
        localStorage.setItem(STORAGE_KEY, email)
        customer = data.customer
        render('home')
      })
    }

    if (v === 'home') {
      document.querySelectorAll('.gp-redeem-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', async () => {
          const offerId = btn.getAttribute('data-offer-id')
          const email = customer.email || localStorage.getItem(STORAGE_KEY)
          btn.disabled = true; btn.textContent = 'Processing...'
          const data = await api('/api/widget/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop: SHOP, email, offerId }) })
          const area = document.getElementById('gp-code-area')
          if (data.error) { area.innerHTML = `<p class="gp-msg" style="color:#e74c3c">${data.error}</p>`; btn.disabled = false; btn.textContent = 'Redeem'; return }
          customer.points = data.newPoints
          area.innerHTML = `<div class="gp-code-box"><div style="font-size:.8rem;color:#7878a0;margin-bottom:4px">Your discount code:</div><div class="gp-code">${data.discountCode}</div><div style="font-size:.75rem;color:#7878a0;margin-top:4px">Copy and paste at checkout</div></div>`
          document.querySelector('.gp-pts-num').textContent = data.newPoints.toLocaleString()
        })
      })
      document.getElementById('gp-logout-btn').addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY)
        customer = null
        render('welcome')
      })
    }
  }
})()
