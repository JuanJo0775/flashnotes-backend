# Seguridad

## Qué protege esto, y qué no

FlashNotes no tiene autenticación. Una cookie `sessionId` identifica un
**navegador**, no a una persona. El aislamiento entre sesiones evita que veas
las notas de otro, pero cualquiera con acceso físico a ese navegador ve las
notas. No guardes nada sensible acá.

---

## Capas activas

### Sesión

`src/middleware/session.js` emite una cookie `sessionId` (`crypto.randomUUID`)
con `httpOnly` —inaccesible desde JavaScript—, `sameSite=lax` y `secure` en
producción. Todas las consultas al repositorio filtran por `sessionId`, así que
el aislamiento se aplica en la capa de datos y no depende de la ruta.

### CSRF

`csurf` en modo cookie, sobre toda escritura. El cliente pide el token a
`GET /api/csrf-token` al arrancar y lo manda en `X-CSRF-Token`.

Se controla con la variable `DISABLE_CSRF`, **no con `NODE_ENV`**. La versión
anterior lo apagaba cuando `NODE_ENV === 'test'`, es decir, justo en el entorno
donde se verifica: la suite en verde no decía nada sobre si la protección
funcionaba. Ahora `tests/integration/csrf.integration.test.js` la enciende y
comprueba el ciclo completo — sin token, con token falso y con token válido.

> `csurf` está archivado por su autor desde 2022. Funciona, pero si el proyecto
> sale a producción de verdad conviene migrar a `csrf-csrf` (double submit) o al
> patrón de cabecera propia con `SameSite=Strict`.

### CORS

Lista blanca leída de `CORS_ORIGINS`, y **se aplica**. La versión anterior
registraba el origen desconocido en consola y lo dejaba pasar igual; con
`credentials: true`, eso permitía a cualquier web leer tus notas usando la
cookie de sesión del navegador.

### Rate limiting

300 peticiones por IP cada 15 minutos sobre `/api/`, y 10 borrados permanentes.
`/api/health` y `/api/csrf-token` están exentas: son sondas del propio cliente y
contarlas hacía que la app agotara su presupuesto sola.

El cliente **no reintenta los 429**. Reintentarlos consume más del mismo
presupuesto que acaba de agotarse; sólo se reintentan 502, 503 y 504.

### Cabeceras

`helmet` con CSP explícita: `default-src 'self'`, sin `script-src 'unsafe-inline'`,
`object-src 'none'`, `frame-ancestors 'none'`.

### Tamaño y tipo del cuerpo

Máximo 16 kb; por encima, `413`. Las escrituras **con cuerpo** exigen
`Content-Type: application/json`; las que no lo llevan (undo, redo, trash,
restore son `PATCH` sin payload) pasan sin cabecera.

### Validación

`NoteDTO` valida antes de tocar la base. El título usa **lista negra**: se
prohíben caracteres de control, de formato, y `<` y `>`. Todo lo demás vale.
La lista blanca de puntuación anterior rechazaba `¿Qué compro?`, `Gastos 100€` y
cualquier emoji — o sea, español correcto.

---

## Lo que se quitó a propósito

**La sanitización del contenido.** Pasaba por `DOMPurify` en el cliente y por
`xss()` en el servidor. Las dos librerías escapan HTML para insertarlo en el DOM;
acá el texto nunca se inserta como HTML — se pinta en un `<textarea>` y en nodos
de texto, que escapan solos. Lo único que hacían era destruir notas:

```
"si a < b"        →  "si a &lt; b"
"usa <div>hola"   →  "usa hola"        ← texto borrado en silencio
```

La defensa correcta no es limpiar al guardar, es **no renderizar como HTML**. Si
algún día se añade vista previa en Markdown, se sanea al pintar esa vista, no al
escribir en la base. Está fijado en `tests/integration/content-fidelity.test.js`.

---

## Antes de producción

- [ ] Migrar `csurf` a una alternativa mantenida
- [ ] `CORS_ORIGINS` con el dominio real y `NODE_ENV=production` (activa `secure`)
- [ ] HTTPS y `trust proxy` en Express si hay proxy inverso delante
- [ ] MongoDB con autenticación y sin exponer el puerto
- [ ] Rotar los logs y revisar que no queda ningún `sessionId` en claro
      (`requestLogger` y `errorHandler` ya sólo escriben un hash SHA-256 truncado)
- [ ] Purgar la papelera periódicamente: hoy las notas borradas se quedan para siempre
