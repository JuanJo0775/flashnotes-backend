# API de FlashNotes

Base: `http://localhost:5000/api`

Todas las respuestas son JSON con la misma envoltura, éxito o error:

```json
{ "success": true,  "data": { }, "statusCode": 200 }
{ "success": false, "error": "CODIGO", "message": "Texto legible", "statusCode": 400 }
```

Los errores de validación añaden `details`, un array de cadenas.
Los listados añaden `pagination`.

---

## Sesión

No hay cuentas. En la primera petición el servidor emite una cookie `sessionId`
(`httpOnly`, `sameSite=lax`, 10 años) y todas las notas quedan atadas a ella.
El cliente debe mandar credenciales en cada petición
(`fetch` con `credentials: 'include'`, o `withCredentials: true` en axios).

Consecuencia: borrar las cookies del navegador equivale a perder las notas.

---

## CSRF

Las peticiones de **escritura** (`POST`, `PATCH`, `DELETE`) exigen la cabecera
`X-CSRF-Token`. Las de lectura no.

```
GET /api/csrf-token   →  { "success": true, "data": { "csrfToken": "..." }, "statusCode": 200 }
```

Pedí el token al arrancar la app y mandalo en cada escritura. Un token ausente o
inválido devuelve `403 INVALID_CSRF_TOKEN`.

Se puede apagar con `DISABLE_CSRF=true`, y sólo debe hacerse en tests.

---

## Rate limiting

- **Global:** 300 peticiones por IP cada 15 minutos, sobre `/api/`.
- **Exentas:** `/api/health` y `/api/csrf-token`. Son sondas que hace el propio
  cliente; contarlas hacía que la app agotara su presupuesto sola y se
  autobloqueara con 429 sin que el usuario tocara nada.
- **Borrado permanente:** 10 peticiones por IP cada 15 minutos.

Al pasarse: `429 TOO_MANY_REQUESTS`. **No lo reintentes automáticamente** —
reintentar consume más del mismo presupuesto que acaba de agotarse.

---

## Límites de contenido

| Campo    | Máximo                | Notas                                              |
| -------- | --------------------- | -------------------------------------------------- |
| `title`  | 100 caracteres        | Una línea. Se recorta. Sin controles, sin `<` ni `>` |
| `content`| 10 000 caracteres     | **Se guarda literal**: no se recorta ni se escapa   |
| Cuerpo   | 16 kb                 | Por encima: `413 PAYLOAD_TOO_LARGE`                 |

El título acepta acentos, `¿`, `¡`, `€`, `ñ`, alfabetos no latinos y emojis. La
lista blanca de puntuación anterior rechazaba `¿Qué compro?` con un 400.

---

## Rutas

### `POST /api/notes` — crear

```json
{ "title": "Lista de compras", "content": "" }
```

`201` con la nota creada. Si `title` viene vacío, se usa `"Nueva nota"`.

---

### `GET /api/notes` — listar activas

Query: `?page=1&limit=50` (por defecto 1 y 50; el máximo es 100).
Orden: `editedAt` descendente.

```json
{
  "success": true,
  "data": [ /* notas */ ],
  "pagination": { "page": 1, "limit": 50, "total": 128, "pages": 3 },
  "statusCode": 200
}
```

---

### `GET /api/notes/trash` — listar papelera

Mismos parámetros. Orden: `deletedAt` descendente. Devuelve campos reducidos
(sin historial).

---

### `PATCH /api/notes/:id` — actualizar

```json
{ "title": "Nuevo título", "content": "Nuevo contenido" }
```

Los dos campos son opcionales, pero tiene que venir al menos uno.

Cada petición **con cambios reales** crea un punto en el historial de undo. Es
el contrato: *un PATCH = un paso de deshacer*. Si tu cliente auto-guarda, agrupá
las pulsaciones con un debounce antes de llamar, o el historial se llenará de
estados separados por un segundo.

Opcional, para concurrencia optimista: mandá `lastKnownUpdate` con el
`updatedAt` que conocés. Si no coincide, responde `409 CONFLICT`.

---

### `PATCH /api/notes/:id/undo` · `PATCH /api/notes/:id/redo`

Sin cuerpo. Devuelven la nota resultante.

- Sin historial: `400 NO_HISTORY`
- Sin nada que rehacer: `400 NO_REDO`

El historial guarda hasta 20 versiones. Editar invalida la pila de redo.

---

### `PATCH /api/notes/:id/trash` — mover a papelera

Borrado suave: marca `isDeleted` y `deletedAt`. Reversible.

### `PATCH /api/notes/:id/restore` — restaurar

Sólo funciona sobre notas en la papelera; si no, `404 NOTE_NOT_IN_TRASH`.

### `DELETE /api/notes/:id/permanent` — borrar para siempre

Sólo sobre notas ya en la papelera. **Irreversible.** Limitada a 10 por IP cada
15 minutos.

---

### `GET /api/notes/:id/history` — historial

```json
{ "success": true, "data": { "versions": [ ], "redoStack": [ ] }, "statusCode": 200 }
```

Cada entrada trae `title`, `content` y `editedAt`.

---

### `GET /api/health`

```json
{ "success": true, "data": { "status": "OK", "timestamp": "..." }, "statusCode": 200 }
```

Exenta del rate limiting. Pensada para sondeo periódico.

---

## Códigos de error

| Código                   | HTTP | Cuándo                                        |
| ------------------------ | ---- | --------------------------------------------- |
| `VALIDATION_FAILED`      | 400  | Datos inválidos; mirá `details`                |
| `INVALID_ID_FORMAT`      | 400  | El `:id` no es un ObjectId                     |
| `NO_HISTORY` / `NO_REDO` | 400  | Nada que deshacer o rehacer                    |
| `INVALID_CSRF_TOKEN`     | 403  | Token de escritura ausente o inválido          |
| `NOT_FOUND`              | 404  | La ruta no existe                              |
| `NOTE_NOT_FOUND`         | 404  | La nota no existe o no es de esta sesión       |
| `NOTE_NOT_IN_TRASH`      | 404  | La operación exige que esté en la papelera     |
| `CONFLICT`               | 409  | Otra sesión modificó la nota                   |
| `PAYLOAD_TOO_LARGE`      | 413  | El cuerpo supera 16 kb                         |
| `UNSUPPORTED_MEDIA_TYPE` | 415  | Cuerpo sin `Content-Type: application/json`    |
| `TOO_MANY_REQUESTS`      | 429  | Rate limit                                     |
| `INTERNAL_SERVER_ERROR`  | 500  | Error no previsto                              |

---

## Probar a mano

En `api-collection/` hay una colección de [Bruno](https://www.usebruno.com/) con
todas las rutas. Ejecutá primero *Health check* para que se emita la cookie de
sesión.
