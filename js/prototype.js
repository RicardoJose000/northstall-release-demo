// Interactive phone prototype + backstage (events / database).
// Simulation of the real flow in /supabase and /src. Runs fully in the browser, test mode only.

const IMG = 'assets/img/';
const FEE_BPS = 1000; // 10%
const ME = 'u_maya';

const SEED = [
  { id: 'lst_mug', title: 'Ash glaze mug', maker: 'Ines Ceramics', price: 4800, img: 'product-mug.jpg', seller: 'u_ines', acct: 'acct_1QInesCeram8x' },
  { id: 'lst_wallet', title: 'Bifold wallet', maker: 'Tomas Leather', price: 8600, img: 'product-wallet.jpg', seller: 'u_tomas', acct: 'acct_1QTomasLth42k' },
  { id: 'lst_bowl', title: 'Walnut bowl', maker: 'Oak & Ash', price: 6400, img: 'product-bowl.jpg', seller: 'u_oak', acct: 'acct_1QOakAsh77Wd' },
  { id: 'lst_candle', title: 'Cedar candle', maker: 'Lumen Wax', price: 2800, img: 'product-candle.jpg', seller: 'u_lumen', acct: 'acct_1QLumenWx3Qa' },
];

const ICON = {
  apple: '<svg viewBox="0 0 24 24"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.2 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.6-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0110 0v3h1a1 1 0 011 1v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9a1 1 0 011-1h1zm2 0h6V7a3 3 0 00-6 0v3z"/></svg>',
  shop: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>',
  sell: '<svg viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8" r="1.4"/></svg>',
  orders: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/></svg>',
  account: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
};

const fmt = (c) => '$' + (c / 100).toFixed(2);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const rid = (p, n = 14) => p + Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => B62[b % 62]).join('');
const short = (id) => (id.length > 18 ? id.slice(0, 14) + '...' : id);

export function initPrototype() {
  const app = document.getElementById('app');
  const logEl = document.getElementById('log');
  const dbEl = document.getElementById('db');
  const stepsEl = document.getElementById('steps');
  const replayBtn = document.getElementById('replayWebhook');
  const body = document.querySelector('.backstage__body');
  if (!app) return;

  let S;
  let t0;
  let busy = false;
  let gen = 0;
  // A reset in the middle of an async action cancels the rest of that action.
  const sleep = async (ms) => {
    const g = gen;
    await wait(ms);
    if (g !== gen) throw new Error('reset');
  };

  function reset() {
    gen++;
    S = {
      user: null,
      seller: null,
      listings: SEED.map((l) => ({ ...l, published: true })),
      orders: [],
      events: [],
      lastEvent: null,
      done: new Set(),
      screen: 'welcome',
      detail: null,
      order: null,
      overlay: null,
      fresh: true,
      toast: null,
      loading: null,
      card: '4242',
      changed: new Set(),
    };
    t0 = performance.now();
    logEl.innerHTML = '';
    replayBtn.disabled = true;
    busy = false;
    render();
    renderDb();
  }

  /* ---------------- backstage ---------------- */
  const KIND = { fn: ['k-fn', 'function'], wh: ['k-wh', 'webhook'], db: ['k-db', 'database'], rls: ['k-rls', 'rls'], auth: ['k-auth', 'app'] };
  function stamp() {
    const s = (performance.now() - t0) / 1000;
    const m = Math.floor(s / 60);
    return String(m).padStart(2, '0') + ':' + (s % 60).toFixed(1).padStart(4, '0');
  }
  function log(kind, title, detail = '', flash = false) {
    const [cls, label] = KIND[kind];
    const li = document.createElement('li');
    if (flash) li.className = 'flash';
    li.innerHTML = `<time>${stamp()}</time><div><span class="k ${cls}">${label}</span><span class="t">${title}</span>${detail ? `<p>${detail}</p>` : ''}</div>`;
    logEl.appendChild(li);
    body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
  }
  const good = (t) => `<span class="good">${t}</span>`;
  const bad = (t) => `<span class="bad">${t}</span>`;

  function table(name, note, cols, rows) {
    const head = cols.map((c) => `<th>${c[0]}</th>`).join('');
    const trs = rows.length
      ? rows.map((r) => `<tr class="${S.changed.has(r._k) ? 'new' : ''}">${cols.map((c) => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')
      : `<tr><td class="empty" colspan="${cols.length}">no rows</td></tr>`;
    return `<h4>${name}<small>${note}</small></h4><table><thead><tr>${head}</tr></thead><tbody>${trs}</tbody></table>`;
  }
  const yn = (v) => (v ? '<span class="yes">true</span>' : '<span class="no">false</span>');

  function renderDb() {
    const profiles = S.user ? [{ _k: 'p_me', id: ME, name: 'Maya' }] : [];
    const sellers = S.seller ? [{ _k: 's_me', ...S.seller }] : [];
    dbEl.innerHTML =
      table('profiles', 'rls: own row', [['id', (r) => r.id], ['display_name', (r) => r.name]], profiles) +
      table('seller_accounts', 'rls: read own, writes via webhook', [
        ['stripe_account_id', (r) => short(r.acct)], ['charges', (r) => yn(r.charges)], ['payouts', (r) => yn(r.payouts)], ['details', (r) => yn(r.details)],
      ], sellers) +
      table('listings', 'rls: published or own', [
        ['title', (r) => esc(r.title)], ['price', (r) => fmt(r.price)], ['seller_id', (r) => r.seller], ['published', (r) => yn(r.published)],
      ], S.listings.map((l) => ({ ...l, _k: l.id }))) +
      table('orders', 'rls: buyer or seller', [
        ['id', (r) => short(r.id)], ['amount', (r) => fmt(r.amount)], ['fee', (r) => fmt(r.fee)], ['status', (r) => r.status], ['buyer_id', (r) => r.buyer ?? 'null'],
      ], S.orders.map((o) => ({ ...o, _k: o.id }))) +
      table('stripe_events', 'service role only', [['id', (r) => short(r.id)], ['type', (r) => r.type]], S.events.map((e) => ({ ...e, _k: e.id })));
    S.changed.clear();
  }

  function webhook(type, detail, apply) {
    const id = rid('evt_1Q', 20);
    S.events.push({ id, type });
    S.lastEvent = { id, type };
    S.changed.add(id);
    log('wh', type, `${short(id)} &middot; Stripe-Signature ${good('verified')} &middot; ${detail}`);
    apply();
    replayBtn.disabled = false;
  }

  replayBtn.addEventListener('click', () => {
    if (!S.lastEvent) return;
    log('wh', `${S.lastEvent.type} (redelivery)`, `${short(S.lastEvent.id)} &middot; signature ${good('verified')} &middot; insert stripe_events &rarr; ${bad('23505 duplicate')} &rarr; skipped, 200 OK. Nothing changed.`, true);
  });

  /* ---------------- steps ---------------- */
  const ORDER = ['signin', 'onboard', 'verified', 'list', 'buy', 'paid'];
  function renderSteps() {
    const now = ORDER.find((s) => !S.done.has(s));
    stepsEl.querySelectorAll('li').forEach((li) => {
      const k = li.dataset.step;
      li.classList.toggle('is-done', S.done.has(k));
      li.classList.toggle('is-now', k === now);
    });
  }

  /* ---------------- screens ---------------- */
  const status = '<div class="a-status"><span>9:41</span><span>5G <i></i></span></div>';
  const btn = (act, label, cls = '', extra = '') =>
    `<button class="a-btn ${cls}" data-act="${act}" ${extra} ${S.loading === act ? 'disabled' : ''}>${S.loading === act ? '<span class="spin"></span>' : label}</button>`;

  function tabbar(active) {
    const t = (k, label) => `<button data-act="tab" data-arg="${k}" class="${active === k ? 'on' : ''}">${ICON[k]}${label}</button>`;
    return `<nav class="a-tabbar">${t('shop', 'Shop')}${t('sell', 'Sell')}${t('orders', 'Orders')}${t('account', 'Account')}</nav>`;
  }

  function badge(st) {
    const map = { pending: ['wait', 'processing'], paid: ['ok', 'paid'], failed: ['bad', 'failed'] };
    const [c, l] = map[st] || ['mute', st];
    return `<span class="a-badge a-badge--${c}">${l}</span>`;
  }

  function cardFor(l) {
    const mine = l.seller === ME;
    const img = l.img ? `<img src="${IMG + l.img}" alt="">` : `<span class="ph">${esc(l.title[0])}</span>`;
    return `<button class="a-card" data-act="open" data-arg="${l.id}">${img}<div><b>${esc(l.title)}</b><small>${esc(l.maker)}</small>${mine ? '<span class="a-badge a-badge--mute" style="margin-top:6px">yours</span>' : ''}</div><span class="price">${fmt(l.price)}</span></button>`;
  }

  const SCREENS = {
    welcome: () => `
      <div class="a-body" style="padding-bottom:30px">
        <div class="a-hero"><img src="${IMG}maker-ceramics.jpg" alt=""></div>
        <div class="a-head" style="padding:0 0 18px"><small>Northstall</small><h3>Made by hand,<br><em>near you.</em></h3></div>
        ${btn('signin', ICON.apple + ' Continue with Apple', '', 'data-arg="apple"')}
        ${btn('signinEmail', 'Continue with email', 'a-btn--line')}
        <p class="a-note">Demo sign-in. No real account is created. Sign in with Apple is offered because other login options exist (App Store 4.8).</p>
      </div>`,

    shop: () => `
      <div class="a-head"><small>Good evening, Maya</small><h3>Made by hand,<br><em>near you.</em></h3></div>
      <div class="a-body"><div class="a-cards">${S.listings.filter((l) => l.published).map(cardFor).join('')}</div></div>
      ${tabbar('shop')}`,

    detail: () => {
      const l = S.listings.find((x) => x.id === S.detail);
      if (!l) return SCREENS.shop();
      const mine = l.seller === ME;
      const fee = Math.round((l.price * FEE_BPS) / 10000);
      return `
      <button class="a-back" data-act="back" aria-label="Back">${ICON.back}</button>
      <div class="a-body" style="padding-top:0">
        <div class="a-detail-img">${l.img ? `<img src="${IMG + l.img}" alt="">` : `<div class="a-hero" style="height:100%;margin:0;display:grid;place-items:center;background:var(--ink-3);font:italic 400 90px/1 var(--serif);color:var(--brass-2)">${esc(l.title[0])}</div>`}</div>
        <div class="a-head" style="padding:18px 0 6px"><small>${esc(l.maker)}</small><h3>${esc(l.title)}</h3></div>
        <div class="a-row"><span>Price</span><b>${fmt(l.price)}</b></div>
        <div class="a-row"><span>Seller payouts</span><span class="a-badge a-badge--ok">Stripe Express</span></div>
        <div class="a-row" style="margin-bottom:18px"><span>Platform fee (10%)</span><b>${fmt(fee)}</b></div>
        ${mine ? `<button class="a-btn a-btn--line" disabled>This is your listing</button><p class="a-note">create-payment rejects this on the server too: <code>cannot_buy_own_listing</code>.</p>` : btn('buy', `Buy for ${fmt(l.price)}`, 'a-btn--brass')}
      </div>`;
    },

    order: () => {
      const o = S.orders.find((x) => x.id === S.order);
      if (!o) return SCREENS.orders();
      const waiting = o.status === 'pending';
      return `
      <button class="a-back" data-act="tab" data-arg="orders" aria-label="Back">${ICON.back}</button>
      <div class="a-head" style="padding-top:52px"><small>Order ${short(o.id)}</small><h3>${waiting ? 'Payment<br><em>processing...</em>' : o.status === 'paid' ? 'Paid.<br><em>Thank you.</em>' : 'Payment<br><em>failed.</em>'}</h3></div>
      <div class="a-body">
        <div class="a-status-card">
          <div class="a-row"><span>Status</span>${badge(o.status)}</div>
          <div class="a-row"><span>Item</span><b>${esc(o.title)}</b></div>
          <div class="a-row"><span>You paid</span><b>${fmt(o.amount)}</b></div>
          <div class="a-row"><span>Seller receives</span><b>${fmt(o.amount - o.fee)}</b></div>
          <div class="a-row"><span>Platform fee</span><b>${fmt(o.fee)}</b></div>
          <div class="a-row"><span>PaymentIntent</span><code>${short(o.pi)}</code></div>
        </div>
        <p class="a-note">${waiting ? '<span class="spin" style="display:inline-block;vertical-align:middle;width:12px;height:12px;margin-right:6px"></span>The app does not mark this paid. It waits for the signed webhook to update the row.' : 'Status came from the payment_intent webhook, not from the app.'}</p>
        <div style="margin-top:16px">${btn('tab', 'Back to shop', 'a-btn--line', 'data-arg="shop"')}</div>
      </div>`;
    },

    orders: () => `
      <div class="a-head"><small>Orders</small><h3>Your <em>orders</em></h3></div>
      <div class="a-body">${
        S.orders.filter((o) => o.buyer === ME).length
          ? `<div class="a-cards">${S.orders.filter((o) => o.buyer === ME).map((o) => `<button class="a-card" data-act="viewOrder" data-arg="${o.id}">${o.img ? `<img src="${IMG + o.img}" alt="">` : '<span class="ph">N</span>'}<div><b>${esc(o.title)}</b><small>${short(o.id)}</small><div style="margin-top:6px">${badge(o.status)}</div></div><span class="price">${fmt(o.amount)}</span></button>`).join('')}</div>`
          : '<div class="a-empty"><b>No orders yet</b>Buy something in the Shop tab with the 4242 test card.</div>'
      }<p class="a-note">RLS policy "orders: parties read" means you only ever get rows where you are the buyer or the seller.</p></div>
      ${tabbar('orders')}`,

    sell: () => {
      const s = S.seller;
      let inner;
      if (!s) {
        inner = `
          <div class="a-hero" style="height:200px"><img src="${IMG}maker-leather.jpg" alt=""></div>
          <p style="font-size:14px;color:var(--bone-2);margin:0 0 18px">Payouts run through Stripe Connect Express. Stripe checks identity and bank details; Northstall never stores them.</p>
          ${btn('startSelling', 'Start selling', 'a-btn--brass')}`;
      } else if (!s.details) {
        inner = `
          <div class="a-status-card"><h4>Onboarding not finished</h4>
            <div class="a-row"><span>Account</span><code>${short(s.acct)}</code></div>
            <div class="a-row"><span>details_submitted</span>${yn(false)}</div></div>
          ${btn('startSelling', 'Continue onboarding', 'a-btn--brass')}
          <p class="a-note">Same Express account, new Account Link. Links expire fast, so a fresh one is created every time.</p>`;
      } else if (!s.charges) {
        inner = `
          <div class="a-status-card"><h4><span class="spin" style="display:inline-block;width:14px;height:14px;margin-right:8px;vertical-align:-1px"></span>Verifying with Stripe</h4>
            <div class="a-row"><span>Account</span><code>${short(s.acct)}</code></div>
            <div class="a-row"><span>charges_enabled</span>${yn(false)}</div></div>
          <p class="a-note">The return redirect is not proof. The listing button unlocks when account.updated arrives.</p>
          <div style="margin-top:14px">${btn('tryList', 'Try to list anyway', 'a-btn--line')}</div>`;
      } else {
        const mine = S.listings.filter((l) => l.seller === ME);
        inner = `
          <div class="a-status-card"><h4>Payouts active</h4>
            <div class="a-row"><span>Account</span><code>${short(s.acct)}</code></div>
            <div class="a-row"><span>charges_enabled</span>${yn(true)}</div>
            <div class="a-row"><span>payouts_enabled</span>${yn(true)}</div></div>
          ${mine.length ? `<div class="a-cards" style="margin-bottom:14px">${mine.map(cardFor).join('')}</div>` : ''}
          ${btn('newListing', 'New listing', 'a-btn--brass')}`;
      }
      return `<div class="a-head"><small>Sell</small><h3>Sell your work<br>on <em>Northstall.</em></h3></div><div class="a-body">${inner}</div>${tabbar('sell')}`;
    },

    newListing: () => `
      <button class="a-back" data-act="tab" data-arg="sell" aria-label="Back">${ICON.back}</button>
      <div class="a-head" style="padding-top:52px"><small>New listing</small><h3>What are you <em>selling?</em></h3></div>
      <div class="a-body">
        <label class="a-field"><span>Title</span><input id="fTitle" value="Speckled stoneware cup" maxlength="120"></label>
        <label class="a-field"><span>Price (USD)</span><input id="fPrice" value="36" inputmode="decimal"></label>
        <p class="a-note" style="margin:0 0 16px">seller_id is set to auth.uid(). RLS rejects the insert if it is anyone else or if Stripe has not enabled charges.</p>
        ${btn('publish', 'Publish listing', 'a-btn--brass')}
        <p class="a-note" id="fErr" style="color:var(--danger)"></p>
      </div>`,

    account: () => `
      <div class="a-head"><small>Account</small><h3>Maya <em>Rossi</em></h3></div>
      <div class="a-body">
        <div class="a-status-card">
          <div class="a-row"><span>Email</span><b>maya@northstall.test</b></div>
          <div class="a-row"><span>Sign in</span><b>Apple</b></div>
          <div class="a-row"><span>Seller</span>${S.seller?.charges ? '<span class="a-badge a-badge--ok">verified</span>' : '<span class="a-badge a-badge--mute">no</span>'}</div>
        </div>
        ${btn('signout', 'Sign out', 'a-btn--line')}
        ${btn('deleteAsk', 'Delete account', 'a-btn--danger')}
        <p class="a-note">In-app account deletion is required by App Store guideline 5.1.1(v) and by Google Play.</p>
      </div>
      ${tabbar('account')}`,
  };

  function overlayHtml() {
    const o = S.overlay;
    if (!o) return '';
    const noanim = S.fresh ? '' : ' style="animation:none"';
    if (o.type === 'checkout') {
      const order = S.orders.find((x) => x.id === o.order);
      const n = S.card === '4242' ? '4242 4242 4242 4242' : '4000 0000 0000 0002';
      return `<div class="sheet-wrap"${noanim}><div class="sheet"${noanim}>
        <div class="grab"></div>
        <h4>Pay Northstall</h4><p class="sub">Simulated PaymentSheet &middot; test mode</p>
        <div class="test-pick">
          <button data-act="card" data-arg="4242" class="${S.card === '4242' ? 'on' : ''}">4242 ...<small>succeeds</small></button>
          <button data-act="card" data-arg="0002" class="${S.card === '0002' ? 'on' : ''}">0002 ...<small>declined</small></button>
        </div>
        <label class="a-field"><span>Card number</span><input value="${n}" readonly></label>
        <div class="card-row"><label class="a-field"><span>Country</span><input value="United States" readonly></label><label class="a-field"><span>MM / YY</span><input value="12 / 34" readonly></label><label class="a-field"><span>CVC</span><input value="123" readonly></label></div>
        <div class="total"><span>Total</span><b>${fmt(order.amount)}</b></div>
        ${o.err ? `<p class="sub" style="color:#c4412e;margin:4px 0 10px">${o.err}</p>` : ''}
        ${btn('pay', `Pay ${fmt(order.amount)}`)}
        ${btn('closeSheet', 'Cancel', 'a-btn--line')}
        <p class="secure">${ICON.lock} Card details go straight to Stripe</p>
      </div></div>`;
    }
    if (o.type === 'web') {
      const pages = [
        `<h4>Tell us about your business</h4><p class="sub">Express onboarding is hosted by Stripe in the real app.</p>
         <label class="a-field"><span>Business type</span><select><option>Individual / sole proprietor</option><option>Company</option></select></label>
         <label class="a-field"><span>Country</span><select><option>United States</option></select></label>
         <label class="a-field"><span>Mobile (test)</span><input value="000 000 0000" readonly></label>`,
        `<h4>Where should payouts go?</h4><p class="sub">Stripe test bank account.</p>
         <label class="a-field"><span>Routing number</span><input value="110000000" readonly></label>
         <label class="a-field"><span>Account number</span><input value="000123456789" readonly></label>`,
        `<h4>Review and submit</h4><p class="sub">Stripe verifies the details, then notifies the platform by webhook.</p>
         <div class="a-row" style="border-color:#e4e0d8"><span>Business</span><b>Maya Rossi</b></div>
         <div class="a-row" style="border-color:#e4e0d8;margin-bottom:18px"><span>Payouts</span><b>Bank ****6789</b></div>`,
      ];
      const step = o.step;
      return `<div class="web"${noanim}>
        <div class="web__bar"><button data-act="webClose">Done</button><div class="web__url">${ICON.lock} connect.stripe.com/setup/e/${short(S.seller.acct)}</div></div>
        <div class="web__body">
          <span class="web__tag">Test mode &middot; simulated</span>
          <div class="web__progress"><i style="width:${((step + 1) / 3) * 100}%"></i></div>
          ${pages[step]}
          ${btn('webNext', step < 2 ? 'Continue' : 'Submit')}
        </div></div>`;
    }
    if (o.type === 'delete') {
      return `<div class="sheet-wrap"${noanim}><div class="sheet"${noanim}>
        <div class="grab"></div>
        <h4>Delete your account?</h4>
        <p class="sub">This removes your profile, seller account link and listings. Past orders stay for accounting with your name removed.</p>
        ${btn('deleteConfirm', 'Delete account')}
        ${btn('closeSheet', 'Keep my account', 'a-btn--line')}
      </div></div>`;
    }
    return '';
  }

  function render(animate = true) {
    const scr = (SCREENS[S.screen] || SCREENS.shop)();
    const toast = S.toast
      ? `<div class="a-toast ${S.toast.bad ? 'bad' : ''}"><span class="dot"></span><div><b>${S.toast.title}</b>${S.toast.text}</div></div>`
      : '';
    app.innerHTML = `<div class="scr" ${animate ? '' : 'style="animation:none"'}>${status}${scr}</div>${overlayHtml()}${toast}`;
    S.toast = null;
    S.fresh = false;
    renderSteps();
  }

  function go(screen) {
    S.screen = screen;
    render(true);
  }
  function toast(title, text, isBad = false) {
    S.toast = { title, text, bad: isBad };
  }
  function openOverlay(o) {
    S.overlay = o;
    S.fresh = true;
  }

  /* ---------------- actions ---------------- */
  const A = {
    async signin(arg) {
      S.loading = arg === 'apple' ? 'signin' : 'signinEmail';
      render(false);
      await sleep(650);
      log('auth', arg === 'apple' ? 'Sign in with Apple' : 'Email magic link', arg === 'apple' ? 'supabase.auth.signInWithIdToken({ provider: "apple" }) &rarr; session stored in SecureStore' : 'supabase.auth.signInWithOtp() &rarr; session stored in SecureStore');
      if (!S.user) {
        log('db', 'insert into profiles', `trigger on_auth_user_created &rarr; id=${ME}`);
        S.changed.add('p_me');
      }
      S.user = { id: ME };
      S.done.add('signin');
      S.loading = null;
      renderDb();
      go('shop');
    },
    signinEmail() { return A.signin('email'); },
    tab(arg) { S.overlay = null; go(arg); },
    open(arg) { S.detail = arg; go('detail'); },
    back() { go('shop'); },
    viewOrder(arg) { S.order = arg; go('order'); },
    card(arg) { S.card = arg; if (S.overlay) S.overlay.err = null; render(false); },
    closeSheet() { S.overlay = null; render(false); },

    async buy() {
      const l = S.listings.find((x) => x.id === S.detail);
      S.loading = 'buy';
      render(false);
      await sleep(550);
      const fee = Math.round((l.price * FEE_BPS) / 10000);
      const order = { id: rid('ord_', 12), title: l.title, img: l.img, amount: l.price, fee, status: 'pending', pi: rid('pi_3Q', 18), buyer: ME, listing: l.id };
      S.orders.unshift(order);
      S.changed.add(order.id);
      log('fn', 'POST /functions/v1/create-payment', `listing_id=${l.id} &middot; price ${fmt(l.price)} read from DB &middot; application_fee_amount ${fmt(fee)} &middot; transfer_data.destination ${short(l.acct)}`);
      log('db', 'insert into orders', `${short(order.id)} status=pending &middot; ${short(order.pi)}`);
      renderDb();
      S.loading = null;
      openOverlay({ type: 'checkout', order: order.id, err: null });
      render(false);
    },

    async pay() {
      const order = S.orders.find((x) => x.id === S.overlay.order);
      S.loading = 'pay';
      render(false);
      await sleep(950);
      S.loading = null;
      if (S.card === '0002') {
        S.overlay.err = 'Your card was declined. Pick the 4242 test card and try again.';
        render(false);
        await sleep(700);
        webhook('payment_intent.payment_failed', `${short(order.pi)} &middot; card_declined`, () => {
          order.status = 'failed';
          S.changed.add(order.id);
          log('db', 'update orders set status = failed', `where stripe_payment_intent_id = ${short(order.pi)}`);
        });
        renderDb();
        return;
      }
      S.overlay = null;
      S.order = order.id;
      S.done.add('buy');
      go('order');
      await sleep(1500);
      webhook('payment_intent.succeeded', `${short(order.pi)} &middot; amount ${fmt(order.amount)} &middot; fee ${fmt(order.fee)} kept by platform`, () => {
        order.status = 'paid';
        S.changed.add(order.id);
        log('db', 'update orders set status = paid', `where stripe_payment_intent_id = ${short(order.pi)}`);
      });
      S.done.add('paid');
      toast('Order paid', `${fmt(order.amount - order.fee)} on its way to the seller`);
      renderDb();
      render(false);
    },

    async startSelling() {
      S.loading = 'startSelling';
      render(false);
      await sleep(650);
      if (!S.seller) {
        const acct = rid('acct_1Q', 14);
        S.seller = { acct, charges: false, payouts: false, details: false };
        S.changed.add('s_me');
        log('fn', 'POST /functions/v1/stripe-onboarding', `accounts.create({ type: "express" }) &middot; idempotencyKey express-account-${ME} &rarr; ${short(acct)}`);
        log('db', 'insert into seller_accounts', `${short(acct)} charges_enabled=false`);
      } else {
        log('fn', 'POST /functions/v1/stripe-onboarding', `existing ${short(S.seller.acct)} reused, no duplicate account`);
      }
      log('fn', 'accountLinks.create', 'type=account_onboarding &middot; short-lived URL &middot; return_url / refresh_url set');
      renderDb();
      S.loading = null;
      openOverlay({ type: 'web', step: 0 });
      render(false);
    },

    async webNext() {
      if (S.overlay.step < 2) {
        S.overlay.step++;
        render(false);
        return;
      }
      S.loading = 'webNext';
      render(false);
      await sleep(800);
      S.loading = null;
      S.overlay = null;
      S.seller.details = true;
      S.done.add('onboard');
      log('auth', 'return_url &rarr; northstall://seller/return', 'Redirect alone is not trusted. Waiting for account.updated...');
      render(false);
      await sleep(1700);
      webhook('account.updated', `${short(S.seller.acct)} &middot; charges_enabled=true &middot; payouts_enabled=true`, () => {
        S.seller.charges = true;
        S.seller.payouts = true;
        S.changed.add('s_me');
        log('db', 'update seller_accounts', `charges_enabled=true where stripe_account_id=${short(S.seller.acct)}`);
      });
      S.done.add('verified');
      toast('You are verified', 'Stripe enabled charges and payouts');
      renderDb();
      render(false);
    },

    webClose() {
      S.overlay = null;
      log('auth', 'Onboarding closed early', 'details_submitted=false &middot; Sell tab offers a fresh Account Link');
      render(false);
    },

    tryList() {
      log('rls', 'insert into listings', `${bad('denied')} &middot; new row violates row-level security policy for table "listings" &middot; "listings: verified seller inserts own" needs charges_enabled`, true);
      toast('Not yet', 'Listing unlocks after Stripe verifies you', true);
      render(false);
    },

    newListing() { go('newListing'); },

    async publish() {
      const title = document.getElementById('fTitle').value.trim();
      const price = Math.round(parseFloat(document.getElementById('fPrice').value) * 100);
      const err = document.getElementById('fErr');
      if (title.length < 3) { err.textContent = 'Title needs at least 3 characters.'; return; }
      if (!Number.isFinite(price) || price < 100) { err.textContent = 'Minimum price is $1.00.'; return; }
      const values = { title, price };
      S.loading = 'publish';
      render(false);
      await sleep(600);
      const l = { id: rid('lst_', 8), title: values.title, maker: 'Maya Rossi', price: values.price, img: null, seller: ME, acct: S.seller.acct, published: true };
      S.listings.unshift(l);
      S.changed.add(l.id);
      log('rls', 'policy check', `${good('allowed')} &middot; "listings: verified seller inserts own" &middot; seller_id = auth.uid() and charges_enabled`);
      log('db', 'insert into listings', `${esc(l.title)} &middot; ${fmt(l.price)} &middot; seller_id=${ME}`);
      S.done.add('list');
      S.loading = null;
      toast('Listed', 'Buyers can see it in the Shop now');
      renderDb();
      go('sell');
    },

    async signout() {
      log('auth', 'supabase.auth.signOut()', 'session removed from SecureStore');
      S.user = null;
      S.overlay = null;
      go('welcome');
    },

    deleteAsk() { openOverlay({ type: 'delete' }); render(false); },

    async deleteConfirm() {
      S.loading = 'deleteConfirm';
      render(false);
      await sleep(800);
      log('fn', 'POST /functions/v1/delete-account', 'auth.admin.deleteUser(uid)');
      log('db', 'on delete cascade', 'profiles, seller_accounts, listings removed &middot; orders kept with buyer_id = null');
      S.orders.forEach((o) => { if (o.buyer === ME) { o.buyer = null; S.changed.add(o.id); } });
      S.listings = S.listings.filter((l) => l.seller !== ME);
      S.user = null;
      S.seller = null;
      S.overlay = null;
      S.loading = null;
      toast('Account deleted', 'All personal data removed');
      renderDb();
      go('welcome');
    },
  };

  app.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled || busy) return;
    const fn = A[t.dataset.act];
    if (!fn) return;
    busy = true;
    try {
      await fn(t.dataset.arg);
    } catch (err) {
      if (err.message !== 'reset') console.error(err);
    } finally {
      busy = false;
    }
  });

  document.querySelectorAll('.backstage__tabs [data-tab]').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.backstage__tabs [data-tab]').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-selected', x === b);
      });
      logEl.hidden = b.dataset.tab !== 'log';
      dbEl.hidden = b.dataset.tab !== 'db';
    });
  });

  document.getElementById('resetDemo').addEventListener('click', reset);
  reset();
}
