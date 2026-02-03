# API FlashNotes - Especificación Formal

**Versión:** 1.0  
**Base URL:** `http://localhost:5000/api` (desarrollo) | `{PRODUCTION_URL}/api` (producción)  
**Formato de datos:** JSON  
**Autenticación:** Cookie de sesión (vía middleware `session.js`)

---

## Contrato de Respuestas HTTP

Todas las respuestas siguen este formato estandarizado:

### ✅ Respuesta Exitosa (2xx)

```json
{
  "success": true,
  "data": {},
  "statusCode": 200
}
```

### ❌ Respuesta de Error (4xx, 5xx)

```json
{
  "success": false,
  "error": "Error code",
  "message": "Descripción legible del error",
  "statusCode": 400
}
```

---

## Endpoints

### 1. Crear Nota
**POST** `/notes`

**Request Body:**
```json
{
  "title": "string (1-200 caracteres, requerido)",
  "content": "string (requerido)"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "_id": "string (MongoDB ObjectId)",
    "title": "string",
    "content": "string",
    "createdAt": "ISO 8601 datetime",
    "editedAt": "ISO 8601 datetime",
    "isDeleted": false,
    "versionHistory": [],
    "redoStack": []
  },
  "statusCode": 201
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "VALIDATION_FAILED",
  "message": "El título no puede estar vacío",
  "details": ["El título debe tener entre 1 y 200 caracteres"],
  "statusCode": 400
}
```

**Response 500:**
```json
{
  "success": false,
  "error": "INTERNAL_SERVER_ERROR",
  "message": "Error interno del servidor",
  "statusCode": 500
}
```

---

### 2. Listar Notas Activas
**GET** `/notes`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "string",
      "title": "string",
      "content": "string",
      "createdAt": "ISO 8601 datetime",
      "editedAt": "ISO 8601 datetime",
      "isDeleted": false,
      "versionHistory": [],
      "redoStack": []
    }
  ],
  "statusCode": 200
}
```

---

### 3. Listar Notas en Papelera
**GET** `/notes/trash`

**Response 200:** (mismo formato que listar activas, pero `isDeleted: true`)

---

### 4. Actualizar Nota
**PATCH** `/notes/:id`

**Request Body:**
```json
{
  "title": "string (opcional)",
  "content": "string (opcional)",
  "lastKnownUpdate": "ISO 8601 datetime (opcional, para concurrencia optimista)"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { /* nota actualizada */ },
  "statusCode": 200
}
```

**Response 404:**
```json
{
  "success": false,
  "error": "NOTE_NOT_FOUND",
  "message": "La nota solicitada no existe o fue eliminada",
  "statusCode": 404
}
```

**Response 409:**
```json
{
  "success": false,
  "error": "CONFLICT",
  "message": "La nota fue modificada por otra sesión. Recarga la página.",
  "statusCode": 409
}
```

---

### 5. Deshacer (Undo)
**POST** `/notes/:id/undo`

**Response 200:** (nota con estado anterior)

**Response 400:**
```json
{
  "success": false,
  "error": "NO_HISTORY",
  "message": "No hay cambios para deshacer",
  "statusCode": 400
}
```

---

### 6. Rehacer (Redo)
**POST** `/notes/:id/redo`

**Response 200:** (nota con estado siguiente)

**Response 400:**
```json
{
  "success": false,
  "error": "NO_REDO",
  "message": "No hay cambios para rehacer",
  "statusCode": 400
}
```

---

### 7. Mover a Papelera
**PATCH** `/notes/:id/trash`

**Response 200:** (nota con `isDeleted: true`)

---

### 8. Restaurar desde Papelera
**PATCH** `/notes/:id/restore`

**Response 200:** (nota con `isDeleted: false`)

**Response 404:**
```json
{
  "success": false,
  "error": "NOTE_NOT_IN_TRASH",
  "message": "La nota no está en la papelera",
  "statusCode": 404
}
```

---

### 9. Eliminar Permanentemente
**DELETE** `/notes/:id/permanent`

**Response 204:** (sin cuerpo, solo headers)

**Response 404:**
```json
{
  "success": false,
  "error": "NOTE_NOT_IN_TRASH",
  "message": "La nota no está en la papelera",
  "statusCode": 404
}
```

---

### 10. Health Check
**GET** `/health`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "OK",
    "timestamp": "ISO 8601 datetime"
  },
  "statusCode": 200
}
```

---

## Códigos de Error Estandarizados

| Error Code | HTTP | Significado |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Validación de entrada fallida |
| `NOTE_NOT_FOUND` | 404 | Nota no existe o fue eliminada |
| `NOTE_NOT_IN_TRASH` | 404 | Nota no está en papelera |
| `NO_HISTORY` | 400 | No hay historial para deshacer |
| `NO_REDO` | 400 | No hay cambios para rehacer |
| `CONFLICT` | 409 | Conflicto de concurrencia optimista |
| `INTERNAL_SERVER_ERROR` | 500 | Error no controlado del servidor |

---

## Headers Requeridos

### Request
```
Content-Type: application/json
Cookie: connect.sid={sessionId} (automático del navegador)
```

### Response
```
Content-Type: application/json
Set-Cookie: connect.sid={sessionId}; Path=/; HttpOnly; SameSite=Lax
```

---

## Ejemplos cURL

### Crear nota
```bash
curl -X POST http://localhost:5000/api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Mi primer nota",
    "content": "Contenido de la nota"
  }' \
  -b "connect.sid=example_session"
```

### Listar notas
```bash
curl http://localhost:5000/api/notes \
  -b "connect.sid=example_session"
```

### Actualizar nota
```bash
curl -X PATCH http://localhost:5000/api/notes/507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Título actualizado"
  }' \
  -b "connect.sid=example_session"
```

### Mover a papelera
```bash
curl -X PATCH http://localhost:5000/api/notes/507f1f77bcf86cd799439011/trash \
  -b "connect.sid=example_session"
```

### Deshacer
```bash
curl -X POST http://localhost:5000/api/notes/507f1f77bcf86cd799439011/undo \
  -b "connect.sid=example_session"
```

---

## Guía de Debugging

### Problema: 404 en GET /notes
**Causa típica:** Sesión no inicializada o cookie no enviada  
**Solución:** Verificar que el navegador envía `Cookie` header con `connect.sid`

### Problema: 409 Conflict en PATCH
**Causa:** Otra sesión modificó la nota después de que tu cliente la leyó  
**Solución:** Frontend debe refrescar la nota con GET, mostrar modal de conflicto, y reintatar

### Problema: CORS error en navegador
**Causa:** Backend no permite origen del frontend  
**Solución:** Verificar CORS en `app.js` incluye `origin` correcto y `credentials: true`

### Problema: No hay historial para undo
**Causa:** Nota acaba de ser creada o no tiene cambios guardados  
**Solución:** Normal, solo mostrar botón undo deshabilitado

---

## Configuración de Entorno

### Backend (.env)
```
MONGO_URI=mongodb://localhost:27017/flashnotes
PORT=5000
NODE_ENV=development
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

## Versionado Futuro

Para cambios no retrocompatibles, incrementar versión:
- `/api/v1/notes` (actual)
- `/api/v2/notes` (futuro)

Esto permite que clientes antiguos sigan funcionando mientras se despliegan nuevas versiones.
