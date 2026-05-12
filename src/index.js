/**
 * Hash Generator API — api.gadgethumans.com
 * 
 * Hash any text using MD5, SHA-1, SHA-256, SHA-512. Multiple formats in one call.
 * Free tier: 100 requests/day. Pro: $5/mo for 10,000/day. Business: $15/mo for 100,000/day.
 * 
 * Endpoints:
 *   GET  /hash?text=hello&algorithm=sha256   — Generate a hash of text
 *   GET  /hash/                                      — Docs page
 *   POST /subscribe?tier=pro|biz               — Stripe checkout (returns URL)
 *   POST /webhook                               — Stripe webhook
 */



// ─── In-Memory Store ────────────────────────────────────────────
// For production, add KV namespace "API_KEYS" in wrangler.toml
const keyStore = new Map();
const dailyUsage = new Map();

// ─── Rate Limiting ──────────────────────────────────────────────
const rateLimitMap = new Map();

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For') || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  const maxRequests = 100;
  for (const [cachedIp, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(cachedIp);
  }
  const entry = rateLimitMap.get(ip);
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: maxRequests - 1 };
  }
  if (now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: maxRequests - 1 };
  }
  entry.count++;
  return { limited: entry.count > maxRequests, remaining: Math.max(0, maxRequests - entry.count) };
}

// ─── Tiers ───────────────────────────────────────────────────────
const TIERS = {
  free: { maxDaily: 100 },
  pro:  { maxDaily: 10000, label: 'Pro', price: 500 },
  biz:  { maxDaily: 100000, label: 'Business', price: 1500 },
};

// ─── API Key Management ──────────────────────────────────────────
function isValidApiKey(key) {
  if (!key) return null;
  const raw = keyStore.get(key);
  if (!raw) return null;
  const info = JSON.parse(raw);
  if (info.revoked) return null;
  if (info.expiresAt && Date.now() > info.expiresAt) return null;
  return info;
}

function generateApiKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'hash_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// ─── Stripe ──────────────────────────────────────────────────────
function encodeForm(obj, prefix) {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      parts.push(encodeForm(v, key));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        const aKey = `${key}[${i}]`;
        if (item && typeof item === 'object') {
          parts.push(encodeForm(item, aKey));
        } else {
          parts.push(`${encodeURIComponent(aKey)}=${encodeURIComponent(item)}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.join('&');
}

async function stripeRequest(path, opts = {}) {
  const body = opts.body ? encodeForm(opts.body) : undefined;
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: opts.method || 'GET',
    headers: { 'Authorization': `Bearer ${opts.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

async function handleSubscribe(request, env) {
  const url = new URL(request.url);
  const tier = url.searchParams.get('tier') || 'pro';
  if (!TIERS[tier]) return jsonResponse({ error: 'Invalid tier' }, 400);

  const t = TIERS[tier];
  const baseUrl = request.headers.get('Origin') || `https://${url.host}`;
  try {
    const session = await stripeRequest('/checkout/sessions', {
      method: 'POST',
      secretKey: env.STRIPE_SECRET_KEY,
      body: {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: `Hash Generator API — ${t.label}`, description: `${t.maxDaily.toLocaleString()} requests/day` },
            unit_amount: t.price,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        success_url: `${baseUrl}/?payment=success`,
        cancel_url: `${baseUrl}/?payment=cancelled`,
        metadata: { tier },
      },
    });
    if (request.method === 'GET') {
      return Response.redirect(session.url, 302);
    }
    return jsonResponse({ url: session.url, session_id: session.id });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

async function handleWebhook(request, env) {
  if (request.method !== 'POST')
    return jsonResponse({ error: 'Use POST' }, 405);

  const body = await request.text();
  let event;
  try { event = JSON.parse(body); } catch { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const created = event.created || 0;
  if (Date.now() / 1000 - created > 300)
    return jsonResponse({ error: 'Event too old' }, 400);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email || 'unknown';
    const tier = session.metadata?.tier || 'pro';
    const stripeCustomerId = session.customer;

    const apiKey = generateApiKey();
    const keyInfo = JSON.stringify({
      tier, maxDaily: TIERS[tier].maxDaily, stripeCustomerId,
      customerEmail, createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      revoked: false,
    });

    keyStore.set(apiKey, keyInfo);
    keyStore.set(`stripe:${stripeCustomerId}`, apiKey);

    console.log(`✅ ${customerEmail} — ${tier} — key: ${apiKey.slice(0, 12)}...`);
    return jsonResponse({ received: true });
  }

  return jsonResponse({ received: true });
}

// ─── Response Helpers ────────────────────────────────────────────
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

// ─── CORE API LOGIC ─────────────────────────────────────────────
async function computeHash(text, algorithm) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  let hash;
  switch(algorithm) {
    case 'md5': {
      // Simple MD5 - use SubtleCrypto when available
      const buf = await crypto.subtle.digest('MD5', data);
      hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      break;
    }
    case 'sha1':
    case 'sha-1':
      hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', data))).map(b => b.toString(16).padStart(2, '0')).join('');
      break;
    case 'sha512':
    case 'sha-512':
      hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-512', data))).map(b => b.toString(16).padStart(2, '0')).join('');
      break;
    case 'sha256':
    case 'sha-256':
    case 'all':
    default:
      const r = {};
      if (algorithm === 'all') {
        r.md5 = Array.from(new Uint8Array(await crypto.subtle.digest('MD5', data))).map(b => b.toString(16).padStart(2, '0')).join('');
        r.sha1 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', data))).map(b => b.toString(16).padStart(2, '0')).join('');
        r.sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data))).map(b => b.toString(16).padStart(2, '0')).join('');
        r.sha512 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-512', data))).map(b => b.toString(16).padStart(2, '0')).join('');
        return r;
      }
      hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data))).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return { [algorithm]: hash };
}

async function handleRequest(request, env, ctx, url, isPaid, keyInfo) {
  const path = url.pathname;
  if (path !== '/hash') return jsonResponse({ error: 'Not found. Try /hash?text=hello', docs: '/' }, 404);

  const text = url.searchParams.get('text');
  if (!text) return jsonResponse({ error: 'Missing text parameter', example: '/hash?text=hello&algorithm=sha256' }, 400);
  if (text.length > 5000) return jsonResponse({ error: 'Max 5000 chars' }, 400);

  const algorithm = (url.searchParams.get('algorithm') || 'sha256').toLowerCase();

  try {
    const result = await computeHash(text, algorithm);
    return jsonResponse({
      input: text,
      ...result,
      info: isPaid ? `${keyInfo.tier} plan` : 'Free plan - 100/day'
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ─── Main Handler ────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, x-api-key' },
      });
    }

    // Routes
    if (path === '/subscribe') return handleSubscribe(request, env);
    if (path === '/webhook' || path === '/stripe-webhook') return handleWebhook(request, env);

    if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);

    // API key check
    const apiKey = request.headers.get('x-api-key') || url.searchParams.get('api_key');
    const keyInfo = isValidApiKey(apiKey);
    const isPaid = !!keyInfo;

    // Rate limiting (free only)
    if (!isPaid) {
      const ip = getClientIp(request);
      const rl = checkRateLimit(ip);
      if (rl.limited) {
        return jsonResponse({ error: 'Free limit reached (100/day). Subscribe: /subscribe?tier=pro', docs: '/' }, 429);
      }
    }

    // Docs page
    if (path === '/' || path === '/docs') {
      return new Response(HTML_DOCS, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }

    // Execute API logic
    return handleRequest(request, env, ctx, url, isPaid, keyInfo);
  },
};

// ─── Docs HTML ──────────────────────────────────────────────────
const HTML_DOCS = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hash Generator API — Gadget Humans</title>
  <meta name="description" content="Hash any text using MD5, SHA-1, SHA-256, SHA-512. Multiple formats in one call. Free tier: 100/day. Pro: $5/mo. Business: $15/mo.">
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #1a1a2e; background: #fafafa; }
    h1 { font-size: 2.2rem; margin-bottom: 0.25rem; }
    .subtitle { color: #666; margin-top: 0; font-size: 1.1rem; }
    h2 { margin-top: 2.5rem; }
    code { background: #e8e8e8; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9rem; }
    pre { background: #1a1a2e; color: #e4e4e4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    .endpoint { background: #e8f4f8; border-left: 4px solid #2563eb; padding: 1rem; margin: 1rem 0; border-radius: 0 8px 8px 0; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #ddd; }
    th { background: #f0f0f0; font-weight: 600; }
    .tiers { display: flex; flex-wrap: wrap; gap: 16px; margin: 1.5rem 0; }
    .tier-card { flex: 1; min-width: 200px; border: 1px solid #ddd; border-radius: 12px; padding: 1.5rem; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .tier-card.popular { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.15); position: relative; }
    .badge { position: absolute; top: -8px; right: 16px; background: #2563eb; color: white; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
    .price { font-size: 2rem; font-weight: 700; color: #1a1a2e; margin: 0.5rem 0; }
    .price small { font-size: 1rem; font-weight: 400; color: #666; }
    .btn { display: inline-block; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; text-align: center; width: 100%; }
    .btn-pro { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; }
    .btn-biz { background: linear-gradient(135deg, #7c3aed, #db2777); color: white; }
    .btn-free { background: #f0f0f0; color: #333; }
    ul { list-style: none; padding: 0; }
    ul li { padding: 0.3rem 0; }
    ul li:before { content: "\u2705 "; }
    .nav { margin: 1rem 0; display: flex; gap: 1rem; }
    .nav a { color: #2563eb; text-decoration: none; }
    .nav a:hover { text-decoration: underline; }
    footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #ddd; color: #666; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>\u{1F4C1} Hash Generator API</h1>
  <p class="subtitle">Hash any text using MD5, SHA-1, SHA-256, SHA-512. Multiple formats in one call.</p>
  <div class="nav">
    <a href="#pricing">Pricing</a>
    <a href="#docs">Docs</a>
    <a href="#examples">Examples</a>
  </div>

  <h2 id="pricing">\u{1F4B3} Pricing</h2>
  <div class="tiers">
    <div class="tier-card">
      <h3>\u{1F193} Free</h3>
      <div class="price">$0 <small>/mo</small></div>
      <ul><li>100 requests/day</li><li>No API key needed</li></ul>
      <span class="btn btn-free">Ready to use</span>
    </div>
    <div class="tier-card popular">
      <span class="badge">POPULAR</span>
      <h3>\u{1F680} Pro</h3>
      <div class="price">$5 <small>/mo</small></div>
      <ul><li>10,000 requests/day</li><li>Dedicated API key</li></ul>
      <a href="/subscribe?tier=pro" class="btn btn-pro">Subscribe \u2014 $5/mo</a>
    </div>
    <div class="tier-card">
      <h3>\u{1F4BC} Business</h3>
      <div class="price">$15 <small>/mo</small></div>
      <ul><li>100,000 requests/day</li><li>Dedicated API key</li></ul>
      <a href="/subscribe?tier=biz" class="btn btn-biz">Subscribe \u2014 $15/mo</a>
    </div>
  </div>

  <h2 id="docs">\u{1F4D6} API Reference</h2>
  <div class="endpoint"><strong>GET</strong> <code>/hash?text=hello&algorithm=sha256</code></div>
  <table>
    <tr><td><code>text</code></td><td>\u2705</td><td>\u2014</td><td>Text to hash (max 5000 chars)</td></tr>
    <tr><td><code>algorithm</code></td><td>\u274c</td><td><code>sha256</code></td><td>md5, sha1, sha256, or sha512</td></tr>
    <tr><td><code>x-api-key</code></td><td>\u274c</td><td>\u2014</td><td>Header for paid tiers</td></tr>
  </table>

  <h2 id="examples">\u{1F3AF} Examples</h2>
    <h3>SHA-256 hash</h3>
  <pre>curl "https://api.gadgethumans.com/hash?text=hello&algorithm=sha256"</pre>
  <h3>All algorithms at once</h3>
  <pre>curl "https://api.gadgethumans.com/hash?text=mypassword&algorithm=all"</pre>
  <h3>Response</h3>
  <pre>{"algorithm":"sha256","hash":"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"}</pre>

  <footer>
    <p>Powered by <a href="https://gadgethumans.com">Gadget Humans</a> \u00b7 <a href="mailto:scotia1973@gmail.com">Contact</a></p>
  </footer>
</body>
</html>`;
