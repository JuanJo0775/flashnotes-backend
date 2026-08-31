# FlashNotes · Backend

API REST de notas efímeras. Express 4 + MongoDB (Mongoose).
Sin cuentas: una cookie `sessionId` identifica el navegador y cada sesión ve
sólo sus notas.

## Arrancar

```bash
npm install
cp .env.example .env     # ajustá MONGO_URI y CORS_ORIGINS si hace falta
npm run dev              # http://localhost:5000
```

Necesita un MongoDB escuchando en `localhost:27017`.

## Tests

```bash
npm test                 # 148 tests: unidad + integración
npm run test:unit
npm run test:integration
npm run test:csrf        # verifica la protección CSRF con CSRF activo
npm run test:coverage
```

Los tests de integración levantan un MongoDB en memoria; no tocan tu base local.

## Estructura

```
src/
├── app.js            Middleware: helmet, CORS, rate limiting, CSRF, parseo
├── config/
│   ├── db.js         Conexión a MongoDB
│   └── limits.js     Límites de validación (espejo de los del frontend)
├── routes/           Rutas HTTP
├── controllers/      HTTP ↔ dominio. Sin reglas de negocio
├── services/         Reglas de negocio
├── repositories/     Acceso a datos
├── domain/           Undo/redo puro, sin dependencias externas
├── dto/              Validación y saneamiento de entrada
├── models/           Esquemas de Mongoose
└── middleware/       Sesión, logging, errores, validación de :id
```

## Documentación

- [docs/API.md](docs/API.md) — contrato HTTP completo
- [docs/SEGURIDAD.md](docs/SEGURIDAD.md) — qué defiende cada capa, y qué no
- `api-collection/` — colección de [Bruno](https://www.usebruno.com/) para
  probar la API a mano. Ejecutá *Health check* primero, para que se emita la cookie.

## Variables de entorno

| Variable        | Por defecto                                        | Para qué                                   |
| --------------- | -------------------------------------------------- | ------------------------------------------ |
| `PORT`          | `5000`                                             | Puerto                                     |
| `MONGO_URI`     | —                                                  | Cadena de conexión                         |
| `NODE_ENV`      | `development`                                      | En `production` activa cookies `secure`    |
| `CORS_ORIGINS`  | `http://localhost:3000,http://127.0.0.1:3000`      | Lista blanca, separada por comas           |
| `DISABLE_CSRF`  | `false`                                            | `true` **sólo** en tests                   |

## Una regla que no se toca

**El contenido de una nota se guarda literal.** Sin `trim`, sin escapado, sin
filtros. Había tres capas recortándolo y escapándolo a la vez y entre las tres
se comían el salto de línea final y borraban cualquier `<div>` que escribieras.
La defensa contra XSS es no renderizarlo nunca como HTML.
Está fijado en `tests/integration/content-fidelity.test.js`.
