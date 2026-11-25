// Code viewer (reads the real files from this repo) + RLS policy tester.

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const SQL_KW = 'create|table|policy|on|for|to|using|with|check|select|insert|update|delete|from|where|and|or|not|exists|in|alter|enable|row|level|security|references|primary|key|unique|default|null|returns|trigger|language|as|begin|end|return|function|after|each|execute|extension|if|index|cascade|values|set|true|false|public';
const RE = {
  sql: new RegExp(`(--.*$)|('(?:[^'\\\\]|\\\\.)*')|\\b(${SQL_KW})\\b|\\b(\\d+)\\b`, 'gi'),
  ts: /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(import|from|export|const|let|async|await|function|return|if|else|throw|new|try|catch|case|switch|break|for|of|typeof|class|extends|constructor|public|default|type|null|true|false|undefined)\b|\b(\d[\d_]*)\b/g,
  json: /()("(?:[^"\\]|\\.)*")|\b(true|false|null)\b()|\b(\d+)\b/g,
};

function highlight(line, lang) {
  const re = RE[lang];
  re.lastIndex = 0;
  let out = '';
  let last = 0;
  for (const m of line.matchAll(re)) {
    out += esc(line.slice(last, m.index));
    const [all, c, s, k, n, n2] = m;
    if (c) out += `<span class="tok-c">${esc(all)}</span>`;
    else if (s) out += `<span class="tok-s">${esc(all)}</span>`;
    else if (k) out += `<span class="tok-k">${esc(all)}</span>`;
    else if (n || n2) out += `<span class="tok-n">${esc(all)}</span>`;
    else out += esc(all);
    last = m.index + all.length;
  }
  return out + esc(line.slice(last));
}

// Seed data the tester queries against.
const USERS = { anon: null, maya: 'u_maya', ines: 'u_ines', leo: 'u_leo' };
const LISTINGS = [
  { title: 'Ash glaze mug', seller_id: 'u_ines', price: '$48.00', is_published: true },
  { title: 'Speckled plate set', seller_id: 'u_ines', price: '$96.00', is_published: false },
  { title: 'Walnut bowl', seller_id: 'u_leo', price: '$64.00', is_published: true },
  { title: 'Oak stool (draft)', seller_id: 'u_leo', price: '$120.00', is_published: false },
];
const ORDERS = [
  { id: 'ord_7Hk2', buyer_id: 'u_maya', seller_id: 'u_ines', amount: '$48.00', status: 'paid' },
  { id: 'ord_9Qa1', buyer_id: 'u_maya', seller_id: 'u_leo', amount: '$64.00', status: 'pending' },
  { id: 'ord_3Zp8', buyer_id: 'u_leo', seller_id: 'u_ines', amount: '$48.00', status: 'paid' },
];
const SELLERS = [
  { user_id: 'u_ines', stripe_account_id: 'acct_1QInes...', charges_enabled: true },
  { user_id: 'u_leo', stripe_account_id: 'acct_1QLeo...', charges_enabled: false },
];

function evaluate(who, q) {
  const uid = USERS[who];
  switch (q) {
    case 'listings': {
      const rows = LISTINGS.filter((l) => l.is_published || (uid && l.seller_id === uid));
      const own = uid ? rows.filter((l) => !l.is_published).length : 0;
      return {
        kind: rows.length === LISTINGS.length ? 'allow' : 'part',
        head: `${rows.length} of ${LISTINGS.length} rows`,
        text: own ? 'Published items plus your own drafts.' : 'Only published items. Drafts stay private to their seller.',
        policy: uid ? ['listings: read published', 'listings: seller reads own'] : ['listings: read published'],
        rows,
        cols: ['title', 'seller_id', 'price', 'is_published'],
      };
    }
    case 'orders': {
      const rows = uid ? ORDERS.filter((o) => o.buyer_id === uid || o.seller_id === uid) : [];
      return {
        kind: rows.length ? 'part' : 'deny',
        head: `${rows.length} of ${ORDERS.length} rows`,
        text: uid ? 'Only orders where you are the buyer or the seller.' : 'No policy for anon. RLS returns an empty set, not an error.',
        policy: ['orders: parties read'],
        rows,
        cols: ['id', 'buyer_id', 'seller_id', 'amount', 'status'],
      };
    }
    case 'seller_accounts': {
      const rows = uid ? SELLERS.filter((s) => s.user_id === uid) : [];
      return {
        kind: rows.length ? 'part' : 'deny',
        head: `${rows.length} of ${SELLERS.length} rows`,
        text: rows.length ? 'Your own Stripe status only. Nobody else can read it.' : 'Nothing visible. Other sellers’ Stripe accounts are private.',
        policy: ['seller_accounts: read own'],
        rows,
        cols: ['user_id', 'stripe_account_id', 'charges_enabled'],
      };
    }
    case 'insert_listing': {
      const s = SELLERS.find((x) => x.user_id === uid);
      if (s?.charges_enabled) {
        return { kind: 'allow', head: 'INSERT 1', text: 'Verified seller inserting with seller_id = auth.uid().', policy: ['listings: verified seller inserts own'], rows: [], cols: [] };
      }
      return {
        kind: 'deny',
        head: 'ERROR 42501',
        text: !uid ? 'Anonymous users have no insert policy.' : s ? 'Seller exists but Stripe has not enabled charges yet.' : 'Not a seller. No Stripe Express account linked.',
        policy: ['listings: verified seller inserts own'],
        rows: [],
        cols: [],
        error: 'new row violates row-level security policy for table "listings"',
      };
    }
    case 'update_order':
      return {
        kind: 'deny',
        head: 'UPDATE 0',
        text: 'There is no update policy on orders, so nobody can mark an order paid from the app. Only the stripe-webhook function (service role) can.',
        policy: ['orders: parties read'],
        rows: [],
        cols: [],
      };
  }
}

export function initSecurity() {
  const body = document.getElementById('codeBody');
  const fileEl = document.getElementById('codeFile');
  const verdict = document.getElementById('verdict');
  const rowsEl = document.getElementById('rows');
  if (!body) return;

  let current = '';
  let lines = [];
  const cache = new Map();

  async function load(file) {
    current = file;
    fileEl.textContent = file;
    const lang = file.endsWith('.sql') ? 'sql' : file.endsWith('.json') ? 'json' : 'ts';
    let text = cache.get(file);
    if (!text) {
      try {
        const r = await fetch(file);
        if (!r.ok) throw new Error(r.status);
        text = await r.text();
        cache.set(file, text);
      } catch {
        text = `// Could not load ${file}. Open it from the repository instead.`;
      }
    }
    if (current !== file) return;
    lines = text.replace(/\r/g, '').split('\n');
    body.innerHTML = `<code>${lines.map((l) => `<span class="ln">${highlight(l, lang) || ' '}</span>`).join('')}</code>`;
    body.scrollTop = 0;
    if (lang === 'sql') markPolicies(lastPolicies);
  }

  let lastPolicies = [];
  function markPolicies(names) {
    lastPolicies = names;
    if (!current.endsWith('.sql')) return;
    const els = body.querySelectorAll('.ln');
    els.forEach((e) => e.classList.remove('hl'));
    let first = null;
    names.forEach((name) => {
      const start = lines.findIndex((l) => l.includes(`create policy "${name}"`));
      if (start < 0) return;
      let end = start;
      while (end < lines.length - 1 && !lines[end].trim().endsWith(';')) end++;
      for (let i = start; i <= end; i++) els[i]?.classList.add('hl');
      if (first === null) first = start;
    });
    if (first !== null && els[first]) {
      body.scrollTo({ top: els[first].offsetTop - 60, behavior: 'smooth' });
    }
  }

  document.querySelectorAll('.code__tabs button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.code__tabs button').forEach((x) => x.classList.toggle('on', x === b));
      load(b.dataset.file);
    });
  });

  let who = 'anon';
  let q = 'listings';

  function run() {
    const r = evaluate(who, q);
    const label = r.kind === 'allow' ? 'Allowed' : r.kind === 'deny' ? 'Blocked' : 'Filtered';
    verdict.className = `verdict ${r.kind}`;
    verdict.innerHTML = `<b>${label}</b><div><code>${r.head}</code> &middot; <span>${r.text}</span>${r.error ? `<br><code>${r.error}</code>` : ''}</div>`;
    if (r.rows.length) {
      rowsEl.innerHTML = `<table><thead><tr>${r.cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${r.rows
        .map((row, i) => `<tr>${r.cols.map((c) => `<td style="animation-delay:${i * 70}ms">${row[c]}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`;
    } else {
      rowsEl.innerHTML = `<p class="none">${r.kind === 'allow' ? '1 row inserted.' : 'No rows returned.'}</p>`;
    }
    // Switch the viewer to the migration so the matching policy is visible.
    const migBtn = document.querySelector('.code__tabs button[data-file$=".sql"]');
    if (!current.endsWith('.sql')) {
      lastPolicies = r.policy;
      migBtn.click();
    } else {
      markPolicies(r.policy);
    }
  }

  const bindSeg = (id, attr, set) => {
    document.querySelectorAll(`#${id} button`).forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle('on', x === b));
        set(b.dataset[attr]);
        run();
      });
    });
  };
  bindSeg('who', 'who', (v) => (who = v));
  bindSeg('query', 'q', (v) => (q = v));

  load('supabase/migrations/20261120000000_marketplace.sql').then(() => {
    const r = evaluate(who, q);
    lastPolicies = r.policy;
    run();
  });
}
