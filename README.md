# GD API

API pública para obtener datos de niveles de **Geometry Dash** — JSON completo + card PNG generada al vuelo.

Hosteada en Cloudflare Workers. Base URL:

```
https://thumball.liamt.xyz
```

---

## Endpoints

### `GET /api/level?id={levelId}`

Devuelve un JSON con todos los datos del nivel ya resueltos.

**Parámetros**

| Nombre | Tipo    | Requerido | Descripción                     |
|--------|---------|-----------|---------------------------------|
| `id`   | integer | ✅        | ID del nivel en Geometry Dash   |

**Ejemplo**

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
  "lengthEs": "Medio",
  "difficulty": "Normal",
  "stars": 3,
  "coins": 0,
  "verifiedCoins": false,
  "featured": false,
  "epic": false,
  "legendary": false,
  "mythic": false,
  "extras": [],
  "song": {
    "name": "Base After Base",
    "author": "DJVI"
  },
  "urls": {
    "thumbnail": "https://levelthumbs.prevter.me/thumbnail/128",
    "diffFace": "https://autonick.github.io/diff-faces/levels/none/normal/none/3s.png",
    "card": "https://thumball.liamt.xyz/api/card?id=128"
  }
}
```

---

### `GET /api/card?id={levelId}`

Devuelve directamente una imagen **PNG (800×260px)** con la card del nivel.

**Parámetros**

| Nombre | Tipo    | Requerido | Descripción                     |
|--------|---------|-----------|---------------------------------|
| `id`   | integer | ✅        | ID del nivel en Geometry Dash   |

**Uso en web**

```html
<img src="https://thumball.liamt.xyz/api/card?id=128" alt="GD Level Card" />
```

**Uso en bot de Discord (discord.js)**

```js
const { AttachmentBuilder } = require('discord.js');

const res    = await fetch(`https://thumball.liamt.xyz/api/card?id=${levelId}`);
const buffer = Buffer.from(await res.arrayBuffer());
const file   = new AttachmentBuilder(buffer, { name: 'card.png' });

await channel.send({ files: [file] });
```

---

## CORS

Todos los endpoints incluyen `Access-Control-Allow-Origin: *`. Podés consumir la API directamente desde el browser sin configuración extra.

---

## Licencia

[MIT](./LICENSE) © liamt8d
