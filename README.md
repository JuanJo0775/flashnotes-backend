# Flashnotes - Backend

API backend ligera para una aplicación de notas con soporte de historial (undo/redo), papelera y concurrencia optimista.

Características principales:
- CRUD de notas con validaciones (título, contenido).
- Historial de versiones (snapshots) con límite configurable (20) para undo/redo.
- Redo stack y invalidación al editar después de un undo.
- Soft delete (papelera) y eliminación permanente.
- Control de concurrencia mediante `editedAt` (optimistic concurrency).
- Tests automatizados (unit + integration) con MongoDB en memoria.

---

## Requisitos

- Node.js 18+ (recomendado)
- npm (v9+)
- MongoDB no es necesario para tests; en desarrollo/producción necesitas una instancia MongoDB accesible.

---

## Variables de entorno

Crea un archivo `.env` en la raíz con al menos:

```
MONGO_URI=mongodb://user:pass@host:port/dbname
PORT=3000
```

---

## Instalación

```bash
npm install
```

---

## Comandos útiles

- Iniciar servidor:

```bash
npm start
```

- Tests:

```bash
npm test            # Ejecuta todos los tests (jest --runInBand)
npm run test:unit  # Solo tests unitarios
npm run test:integration # Solo tests de integración
npm run test:coverage # Coverage
npm run test:watch  # Watch mode
```

---

## Rutas principales

Basadas en `src/routes/notes.routes.js`:

- POST /api/notes — crear nota
- GET /api/notes — listar notas activas
- GET /api/notes/trash — listar notas en papelera
- PATCH /api/notes/:id — actualizar nota (parcial)
- POST /api/notes/:id/undo — deshacer último cambio
- POST /api/notes/:id/redo — rehacer último cambio
- PATCH /api/notes/:id/trash — mover a papelera
- PATCH /api/notes/:id/restore — restaurar de papelera
- DELETE /api/notes/:id/permanent — eliminar permanentemente
- GET /api/health — health check

---

## Estructura del proyecto

- src/ — código fuente
- tests/ — pruebas unitarias e integración
- bin/www — punto de entrada del servidor

---

## Notas para desarrolladores

- Los tests de integración usan `mongodb-memory-server` y `tests/setup.js` crea `global.mockSessionId` para simular la sesión.
- Para trabajo en CI, ejecutar `npm test` y publicar coverage si lo deseas.

---

## Contribuir

Abre un PR con cambios pequeños y tests que cubran la nueva funcionalidad.

---

Si quieres, puedo añadir:
- Plantilla básica de GitHub Actions para ejecutar tests.
- Badges de estado/coverage en este README.
- Documentación OpenAPI / Postman collection.
