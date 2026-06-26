# GD Level API

Public REST API for **Geometry Dash** — full level data, PNG card generation, name search, thumbnails, random levels and user profiles. No API key, no sign-up, free forever.

[![Discord](https://img.shields.io/discord/wfWX2nuXw4?label=Discord&logo=discord&logoColor=white&color=5865F2)](https://discord.gg/wfWX2nuXw4)

Hosted on Cloudflare Workers. Base URL:

```
https://gd-level-api.liamt.xyz
```

Docs & playground: **[gd-level-api.liamt.xyz](https://gd-level-api.liamt.xyz)**  
Discord: **[discord.gg/wfWX2nuXw4](https://discord.gg/wfWX2nuXw4)**  
Made by **[Liam](https://github.com/liamt8d)**

---

## Endpoints

### `GET /api/level?id={levelId}`

Returns full JSON data for a level.

| Param | Type    | Required | Description          |
|-------|---------|----------|----------------------|
| `id`  | integer | ✅       | Geometry Dash level ID |

```
GET /api/level?id=128
```

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
    "thumbnail": "https://levelthumbs.prevter.me/thumbnail/128",
    "diffFace": "https://autonick.github.io/diff-faces/levels/none/normal/none/3s.png",
    "card": "https://gd-level-api.liamt.xyz/api/card?id=128"
  }
}
```

---

### `GET /api/card?id={levelId}`

Returns a **PNG image (800×260px)** with the level card.

| Param | Type    | Required | Description          |
|-------|---------|----------|----------------------|
| `id`  | integer | ✅       | Geometry Dash level ID |

```html
<img src="https://gd-level-api.liamt.xyz/api/card?id=128" alt="GD Level Card" />
```

---

### `GET /api/search?q={query}`

Search levels by name. Returns a JSON array.

| Param | Type   | Required | Description   |
|-------|--------|----------|---------------|
| `q`   | string | ✅       | Level name    |

---

### `GET /api/thumbnail?id={levelId}`

Proxies the level thumbnail as a PNG.

| Param | Type    | Required | Description          |
|-------|---------|----------|----------------------|
| `id`  | integer | ✅       | Geometry Dash level ID |

---

### `GET /api/random`

Returns a random featured level with full data.

---

### `GET /api/user?name={username}`

Returns profile data for a Geometry Dash player.

| Param  | Type   | Required | Description    |
|--------|--------|----------|----------------|
| `name` | string | ✅       | GD player name |

---

## CORS

All endpoints return `Access-Control-Allow-Origin: *`. Usable directly from the browser with no extra configuration.

## Rate Limits

Requests are rate-limited per IP to prevent abuse. Limits are generous for normal use.

---

## License

[CC BY-NC 4.0](./LICENSE) © 2026 [GD-Level-API](https://github.com/GD-Level-API)
