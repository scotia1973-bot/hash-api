# #️⃣ Hash Generator API

> Hash any text using MD5, SHA-1, SHA-256, or SHA-512 — no API key required for the free tier. Built on Cloudflare Workers.

**Base URL:** `https://api.gadgethumans.com/hash`

## Self-Host

```bash
git clone https://github.com/scotia1973-bot/hash-api.git
cd hash-api
npm install
npx wrangler deploy
```

## Hosted Version

Don't want to self-host? Use the hosted version at **[api.gadgethumans.com/hash](https://api.gadgethumans.com/hash)**.

| Tier     | Price   | Requests/day | Auth        |
|----------|---------|--------------|-------------|
| Free     | **$0**  | 100          | No API key  |
| Pro      | **$5/mo** | 10,000     | API key     |
| Business | **$15/mo** | 100,000  | API key     |

## Comparison: Self-Host vs $5/mo Hosted

| Feature              | Self-Host | Hosted ($5/mo) |
|----------------------|:---------:|:--------------:|
| Upfront cost         |  Free*    | $5/mo          |
| Maintenance          |   You     | None           |
| Cloudflare Worker req|   ✅      | ❌             |
| API key              |   ❌      | ✅ (higher limits) |
| Global edge network  |   ✅      | ✅             |
| Time to first use    |   ~10 min | Instant        |

*\* Self-hosting costs depend on your Cloudflare Workers plan.*

## Quick Start

```bash
curl "https://api.gadgethumans.com/hash?text=hello&algorithm=sha256"
```

## License

MIT
