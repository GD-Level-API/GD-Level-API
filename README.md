# GD Level API

Public REST API for **Geometry Dash** — full level data, PNG card generation, name search, thumbnails, random levels, user profiles and player icons. No API key, no sign-up, free forever.

[![Discord](https://img.shields.io/discord/wfWX2nuXw4?label=Discord&logo=discord&logoColor=white&color=5865F2)](https://discord.gg/wfWX2nuXw4)

Hosted on **Cloudflare Workers**. Base URL:

```
https://gd-level-api.liamt.xyz
```

**Docs & playground:** [gd-level-api.liamt.xyz](https://gd-level-api.liamt.xyz)  
**Status page:** [gd-level-api.liamt.xyz/status](https://gd-level-api.liamt.xyz/status)  
**Discord:** [discord.gg/wfWX2nuXw4](https://discord.gg/wfWX2nuXw4)  
Made by **[Liam](https://github.com/liamt8d)**

---

## Endpoints

### `GET /api/level?id={levelId}`

Full JSON data for a single level.

| Param | Type    | Required | Description |
|-------|---------|----------|-------------|
| `id`  | integer | ✅       | GD level ID |

```json
{
  "id": 128,
  "name": "1st level",
  "author": "real storm",
  "downloads": 4011196,
  "likes": 297980,
  "length": "Medium",
  "difficulty": "Normal",
  "stars": 3,
  "coins": 0,
  "verifiedCoins": false,
  "featured": false,
  "epic": false,
  "legendary": false,
  "mythic": false,
  "song": { "name": "Base After Base", "author": "DJVI" },
  "urls": {
    "thumbnail": "https://gd-level-api.liamt.xyz/thumbnail/128",
    "diffFace": "https://autonick.github.io/diff-faces/levels/none/normal/none/3s.png",
    "card": "https://gd-level-api.liamt.xyz/api/card?id=128"
  }
}
```

---

### `GET /api/levels?ids={id1,id2,...}`

Fetch up to 10 levels in a single request.

| Param | Type   | Required | Description |
|-------|--------|----------|-------------|
| `ids` | string | ✅       | Comma-separated level IDs (max 10) |

```
GET /api/levels?ids=128,1,2,3
```

Returns an array of level objects in the same format as `/api/level`.

---

### `GET /api/card?id={levelId}`

Returns a **PNG image (800×260px)** level card.

| Param  | Type    | Required | Description |
|--------|---------|----------|-------------|
| `id`   | integer | ✅       | GD level ID |
| `size` | string  | ❌       | `normal` (default) or `small` |

```html
<img src="https://gd-level-api.liamt.xyz/api/card?id=128" />
```

Rate limit: **15 requests / 2 min** per IP.

---

### `GET /api/search?q={query}`

Search levels by name. Returns a JSON array.

| Param    | Type    | Required | Description |
|----------|---------|----------|-------------|
| `q`      | string  | ✅       | Level name  |
| `count`  | integer | ❌       | Results to return (default 10, max 20) |

Rate limit: **30 requests / 2 min** per IP.

---

### `GET /thumbnail/:id`

Proxies the level thumbnail image.

```
GET /thumbnail/128
```

Returns the thumbnail PNG/WebP directly.

---

### `GET /api/random`

Returns a random featured level with full data.

---

### `GET /api/user?name={username}`

Profile data for a GD player.

| Param  | Type   | Required | Description |
|--------|--------|----------|-------------|
| `name` | string | ✅       | GD username |

---

### `GET /api/icon?name={username}`

Player's GD icon as a **PNG** with real colors and glow.

| Param  | Type   | Required | Description |
|--------|--------|----------|-------------|
| `name` | string | ✅       | GD username |
| `form` | string | ❌       | `cube`, `ship`, `ball`, `ufo`, `wave`, `robot`, `spider`, `swing`, `jetpack` |
| `all`  | string | ❌       | `1` to return JSON with all 9 forms instead of PNG |

```html
<img src="https://gd-level-api.liamt.xyz/api/icon?name=RobTop&form=cube" />
```

---

### `GET /api/icon/composite?name={username}`

Returns a single PNG strip with all 9 icon forms side by side.

| Param  | Type   | Required | Description |
|--------|--------|----------|-------------|
| `name` | string | ✅       | GD username |

---

### `GET /api/leaderboard`

Top 10 most viewed levels through the API, ranked by view count.

```json
[
  { "id": 128, "name": "1st level", "author": "real storm", "views": 42 },
  { "id": 1, "name": "Stereo Madness", "author": "RobTop", "views": 18 }
]
```

---

### `GET /api/status`

Current operational status. Always responds instantly.

```json
{
  "status": "operational",
  "latency_ms": 0,
  "upstream": { "gdbrowser": "up" },
  "timestamp": "2026-06-26T12:00:00.000Z"
}
```

---

### `GET /api/stats`

Total API request count since launch.

```json
{ "total_requests": 12048, "since": "2026-06-26" }
```

---

### `GET /api/rate-limit`

Current rate limit usage for your IP. Resets every 2 minutes.

```json
{
  "ip": "152.202.***",
  "window_seconds": 120,
  "limits": {
    "card":   { "used": 2, "limit": 15, "remaining": 13 },
    "search": { "used": 0, "limit": 30, "remaining": 30 }
  }
}
```

---

## CORS

All endpoints return `Access-Control-Allow-Origin: *` — callable from any browser, bot, or server with no extra configuration.

## Rate Limits

Only `/api/card` (15/2min) and `/api/search` (30/2min) are rate limited per IP. All other endpoints are unlimited.

## Status & Uptime

Live status page with 90-day uptime history: [gd-level-api.liamt.xyz/status](https://gd-level-api.liamt.xyz/status)

Subscribe to email alerts for incidents and downtime.

---

## License

[CC BY-NC 4.0](./LICENSE) © 2026 [GD-Level-API](https://github.com/GD-Level-API)
