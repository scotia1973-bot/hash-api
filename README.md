# 🔐 Hash API — [api.gadgethumans.com](https://api.gadgethumans.com/)

> A lightweight, zero-dependency public API for computing **MD5**, **SHA-1**, **SHA-256**, and **SHA-512** hashes.  
> No sign-up, no rate limits, no BS.

[![Deploy to Render](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?style=flat&logo=render&logoColor=white)](https://render.com/deploy)
[![Deploy on Railway](https://img.shields.io/badge/Deploy%20on-Railway-0B0D0E?style=flat&logo=railway&logoColor=white)](https://railway.app/template)
[![Deploy to Vercel](https://img.shields.io/badge/Deploy%20to-Vercel-000000?style=flat&logo=vercel&logoColor=white)](https://vercel.com/new)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌐 Live Demo

**`https://api.gadgethumans.com/hash`** — try it right now:

```bash
curl -s "https://api.gadgethumans.com/hash?text=hello+world&algorithm=sha256" | jq .
```

```json
{
  "algorithm": "sha-256",
  "input": "hello world",
  "hash": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
}
```

---

## 📖 API Documentation

### Base URL

```
https://api.gadgethumans.com/hash
```

### Query Parameters

| Parameter   | Type   | Required | Default   | Description                                      |
|------------|--------|----------|-----------|--------------------------------------------------|
| `text`     | string | ✅ Yes   | —         | The string to hash                               |
| `algorithm`| string | ❌ No    | `sha256`  | Hash algorithm: `md5`, `sha1`, `sha256`, `sha512`|

### Response Format

All responses are JSON with these fields:

| Field       | Type   | Description                          |
|------------|--------|--------------------------------------|
| `algorithm` | string | Normalized algorithm name            |
| `input`     | string | The original input text              |
| `hash`      | string | The computed hexadecimal hash digest |

### Error Responses

On missing or invalid input, the API returns a **400 Bad Request**:

```json
{
  "error": "Missing required parameter: text"
}
```

---

## 🧪 Examples

### MD5

```bash
curl "https://api.gadgethumans.com/hash?text=hello&algorithm=md5"
```

```json
{
  "algorithm": "md5",
  "input": "hello",
  "hash": "5d41402abc4b2a76b9719d911017c592"
}
```

### SHA-1

```bash
curl "https://api.gadgethumans.com/hash?text=hello&algorithm=sha1"
```

```json
{
  "algorithm": "sha-1",
  "input": "hello",
  "hash": "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d"
}
```

### SHA-256

```bash
curl "https://api.gadgethumans.com/hash?text=hello&algorithm=sha256"
```

```json
{
  "algorithm": "sha-256",
  "input": "hello",
  "hash": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
}
```

### SHA-512

```bash
curl "https://api.gadgethumans.com/hash?text=hello&algorithm=sha512"
```

```json
{
  "algorithm": "sha-512",
  "input": "hello",
  "hash": "9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3afef138c7b1f8092e"
}
```

### Using with `jq` (pipe-friendly)

```bash
curl -s "https://api.gadgethumans.com/hash?text=secret123&algorithm=sha256" | jq -r '.hash'
# → 6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090
```

### Using with `httpie`

```bash
http "https://api.gadgethumans.com/hash?text=hello&algorithm=sha256"
```
---

## 📊 Algorithm Comparison Table

| Algorithm  | Digest Size | Output Length (hex) | Speed (approx.)    | Security           | Best For                    |
|-----------|-------------|---------------------|--------------------|--------------------|-----------------------------|
| **MD5**   | 128 bits    | 32 chars            | 🚀 Fastest         | ❌ Broken (collisions) | Checksums, non-crypto use  |
| **SHA-1** | 160 bits    | 40 chars            | ⚡ Very Fast       | ⚠️ Deprecated      | Legacy compatibility        |
| **SHA-256**| 256 bits   | 64 chars            | 🐇 Fast            | ✅ Secure          | General purpose, TLS, APIs  |
| **SHA-512**| 512 bits   | 128 chars           | 🐢 Slower on 32-bit| ✅ Very Secure     | High-security applications  |

---

## 🏠 Self-Host

You can run your own instance in under 60 seconds.

### Option 1: Node.js (recommended)

```bash
# Clone the repo
git clone https://github.com/scotia1973-bot/hash-api.git
cd hash-api

# Install dependencies (if any)
npm install

# Start the server (port defaults to 3000)
npm start
```

Then query your local instance:

```bash
curl "http://localhost:3000/hash?text=hello&algorithm=sha256"
```

### Option 2: Docker

```bash
docker build -t hash-api .
docker run -p 3000:3000 hash-api
```

### Option 3: One-liner with Node.js

```bash
npx hash-api
```

### Environment Variables

| Variable     | Default  | Description          |
|-------------|----------|----------------------|
| `PORT`      | `3000`   | HTTP server port     |
---

## 📄 License

This project is **MIT licensed** — see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2026 scotia1973-bot

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<p align="center">
  Powered by <a href="https://api.gadgethumans.com">🔐 api.gadgethumans.com</a>
</p>