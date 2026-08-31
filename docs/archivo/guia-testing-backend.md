# 🧪 Testing

## 🚀 Comandos para ejecutar

Los scripts de test están definidos en `package.json`.

### Ejecutar todos los tests
```bash
npm test
```

> Esto ejecuta `jest --runInBand` (útil para tests que interactúan con MongoDB en memoria).

### Solo tests unitarios
```bash
npm run test:unit
```

### Solo tests de integración
```bash
npm run test:integration
```

### Generar coverage
```bash
npm run test:coverage
```

### Watch mode (desarrollo)
```bash
npm run test:watch
```

### Ejecutar un archivo de test específico
```bash
# Con npx jest (rápido y directo)
npx jest tests/unit/domain/noteHistory.test.js --runInBand

# O usando npm (los argumentos después de -- se pasan a jest)
npm test -- tests/unit/domain/noteHistory.test.js
```

---

## ⚙️ Configuración de tests (automática)

La carpeta `tests/setup.js` inicializa un servidor MongoDB en memoria mediante `mongodb-memory-server` y conecta `mongoose`. Esto significa que las pruebas de integración no requieren una base de datos MongoDB externa.

Puntos clave de `tests/setup.js`:
- Se crea un `MongoMemoryServer` antes de todos los tests.
- Se limpia la base de datos entre tests (`afterEach`).
- Se cierra todo al finalizar (`afterAll`).
- Define `global.mockSessionId = 'test-session-123'` para simular sesión en requests.
- `jest.setTimeout(30000)` para evitar timeouts en CI lentos.

---

## 📊 Estructura de Tests

```text
tests/
├── setup.js                              ← Configuración global (mongodb-memory-server, timeout, mock session)
├── unit/
│   ├── domain/
│   │   └── noteHistory.test.js          ← Tests de la lógica pura (undo/redo, snapshots, límites)
│   └── services/
│       └── note.service.test.js         ← Tests de casos de uso con mocks del repositorio
└── integration/
    └── note.integration.test.js         ← Tests end-to-end (supertest + app + mongodb-memory-server)
```

---

## 🧩 Archivos de tests actuales

- `tests/unit/domain/noteHistory.test.js` — pruebas unitarias de la lógica de historial (undo/redo, versiones, límites, snapshots).
- `tests/unit/services/note.service.test.js` — pruebas de la capa de servicios usando mock del repositorio (`jest.mock`).
- `tests/integration/note.integration.test.js` — pruebas de API con `supertest` que ejercitan rutas de `src/app`.

---

## ✅ Checklist de Cobertura (estado actual)

> Esta lista refleja las suites y casos cubiertos por los tests presentes en el repositorio.

### Tests de Dominio
- [x] hasRealChanges - casos positivos/negativos
- [x] createSnapshot - inmutabilidad y propiedades
- [x] applyUpdate - primera edición
- [x] applyUpdate - cambios subsecuentes
- [x] applyUpdate - límite de 20 versiones
- [x] applyUpdate - sin cambios reales
- [x] undo - éxito y error (NO_HISTORY)
- [x] redo - éxito y error (NO_REDO)
- [x] Flujo undo → redo completo

### Tests de Servicio
- [x] createNote
- [x] updateNote - conflicto optimista (409)
- [x] updateNote - edición parcial (title / content)
- [x] undoNote - con y sin historial
- [x] redoNote - con y sin redo
- [x] moveToTrash
- [x] restoreFromTrash
- [x] deletePermanently
- [x] Flujo undo → edit → redo (invalidación de redo)

### Tests de Integración
- [x] POST /api/notes - 201, 400 (validaciones)
- [x] GET /api/notes - listar activas
- [x] GET /api/notes/trash - listar papelera
- [x] PATCH /api/notes/:id - 200, 404, 400, 409
- [x] POST /api/notes/:id/undo - 200, 400, 404
- [x] POST /api/notes/:id/redo - 200, 400
- [x] PATCH /api/notes/:id/trash
- [x] PATCH /api/notes/:id/restore
- [x] DELETE /api/notes/:id/permanent
- [x] Flujos complejos (crear→editar→undo→redo, papelera→restaurar→eliminar)
- [x] Tests de seguridad (longitud, sanitización básica)

---

## 📈 Resultado Esperado

Al ejecutar:

```bash
npm test
```

Deberías ver las tres suites principales pasando (unit + unit + integration). Ejemplo:

```text
PASS tests/unit/domain/noteHistory.test.js
PASS tests/unit/services/note.service.test.js
PASS tests/integration/note.integration.test.js

Test Suites: 3 passed, 3 total
Tests:       70+ passed, 70+ total
Time:        ~10s
```

> Nota: los tiempos pueden variar localmente o en CI. El número de tests y coverage es orientativo según el estado actual del repo.

---

## 🛠️ Consejos y debugging

- Si una prueba de integración falla por tiempo de conexión con MongoDB, confirma que `tests/setup.js` esté siendo ejecutado (Jest lo carga automáticamente si está configurado en `jest.config.js` o en `package.json`). Este proyecto ya incluye `tests/setup.js` y en `package.json` se usa `jest` como runner.

- Para ejecutar en modo verbose:

```bash
npx jest --verbose
```

- Testear solo una suite o un test con `-t` (pattern) para filtrar por nombre de test:

```bash
npx jest -t "debe aplicar cambio en title"
```

---

## 📎 Enlaces

- Código de la API: `src/`
- Tests: `tests/`

---

Si quieres, puedo también añadir un badge de CI/coverage en el `README.md` raíz y una plantilla de GitHub Actions para ejecutar los tests en cada push/PR.
