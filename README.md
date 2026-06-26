# GD Level API

[![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-blue)](./LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/hosted-Cloudflare%20Workers-orange?logo=cloudflare)](https://gd-level-api.liamt.xyz)
[![Discord](https://img.shields.io/discord/wfWX2nuXw4?label=discord&logo=discord&logoColor=white&color=5865F2)](https://discord.gg/wfWX2nuXw4)
[![Status](https://img.shields.io/badge/status-operational-22c55e)](https://gd-level-api.liamt.xyz/status)

A free public REST API for **Geometry Dash** — level data, PNG card generation, player icons, search and more. No API key, no sign-up, free forever.

**Base URL:**
```
https://gd-level-api.liamt.xyz
```

---

## 📦 Usage

No installation required. Call any endpoint directly from your browser, bot, or server.

```js
const level = await fetch("https://gd-level-api.liamt.xyz/api/level?id=128").then(r => r.json());
console.log(level.name); // "1st level"
```

```python
import requests
level = requests.get("https://gd-level-api.liamt.xyz/api/level", params={"id": 128}).json()
print(level["name"])  # "1st level"
```

---

## 🔌 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/level?id={id}` | Full level data |
| GET | `/api/levels?ids={id1,id2,...}` | Batch fetch up to 10 levels |
| GET | `/api/card?id={id}` | PNG level card (800×260px) |
| GET | `/api/search?q={query}` | Search levels by name |
| GET | `/thumbnail/:id` | Level thumbnail image |
| GET | `/api/random` | Random featured level |
| GET | `/api/user?name={name}` | Player profile |
| GET | `/api/icon?name={name}` | Player icon PNG with real colors |
| GET | `/api/icon/composite?name={name}` | All 9 icon forms in one PNG |
| GET | `/api/leaderboard` | Top 10 most viewed levels |
| GET | `/api/status` | API health check |
| GET | `/api/stats` | Total request count |
| GET | `/api/rate-limit` | Your current rate limit usage |

> [!NOTE]
> CORS is fully open (`*`) — callable from any browser, bot, or server with no extra configuration.

---

## 🃏 Level Card

Generate a PNG card for any level, ready to embed in Discord or a website:

```
https://gd-level-api.liamt.xyz/api/card?id=128
```

```html
<img src="https://gd-level-api.liamt.xyz/api/card?id=128" alt="GD Level Card" />
```

---

## 🎮 Player Icons

Get a player's icon rendered with their real GD colors, glow and correct icon number:

```
https://gd-level-api.liamt.xyz/api/icon?name=RobTop&form=cube
```

Supported forms: `cube`, `ship`, `ball`, `ufo`, `wave`, `robot`, `spider`, `swing`, `jetpack`

Add `&all=1` to get JSON with all 9 forms instead of a PNG.

---

## ⚡ Rate Limits

Most endpoints are unlimited. Only two are rate-limited per IP:

| Endpoint | Limit |
|----------|-------|
| `/api/card` | 15 requests / 2 min |
| `/api/search` | 30 requests / 2 min |

Check your current usage at `/api/rate-limit`.

---

## 🤖 Discord Bot

A Discord bot powered by this API is available with the following commands:

| Command | Description |
|---------|-------------|
| `/level` | Get full info for a GD level |
| `/card` | Get the PNG card for a level |
| `/search` | Search levels by name |
| `/random` | Get a random featured level |
| `/user` | Get a player profile |
| `/icon` | Get a player's icon |
| `/leaderboard` | Top 10 most viewed levels |
| `/stats` | API status and stats |

[**Add to your server →**](https://discord.gg/wfWX2nuXw4)

---

## 📊 Status

Live uptime history and incident log: [gd-level-api.liamt.xyz/status](https://gd-level-api.liamt.xyz/status)

Subscribe to email alerts for incidents and downtime directly from the status page.

---

## 💛 Support

GD Level API is free and will stay free. If you'd like to support hosting costs, you can donate via [Ko-fi](https://ko-fi.com/liamt8d).

---

## 📎 Links

- 🌐 **Docs & Playground** — [gd-level-api.liamt.xyz](https://gd-level-api.liamt.xyz)
- 📊 **Status Page** — [gd-level-api.liamt.xyz/status](https://gd-level-api.liamt.xyz/status)
- 💬 **Discord** — [discord.gg/wfWX2nuXw4](https://discord.gg/wfWX2nuXw4)
- 🐛 **Report a bug** — [GitHub Issues](https://github.com/GD-Level-API/GD-Level-API/issues)

---

## 📄 License

[CC BY-NC 4.0](./LICENSE) © 2026 [GD-Level-API](https://github.com/GD-Level-API) — Not affiliated with RobTop Games.
