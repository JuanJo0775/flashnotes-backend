const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sessionMiddleware = require('./middleware/session');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const notesRoutes = require('./routes/notes.routes');
const { LIMITS } = require('./config/limits');

const app = express();

// El health check y el token CSRF son sondas del propio cliente y no deben
// contar contra el límite (ver más abajo).
const UNMETERED_PATHS = ['/api/health', '/api/csrf-token'];

/* ============================================================
   SEGURIDAD: cabeceras
============================================================ */
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"]
    }
}));

/* ============================================================
   SEGURIDAD: rate limiting

   El límite anterior (100 req / 15 min) lo agotaba la propia app: entre el
   health check cada 30 s y el heartbeat del token CSRF, el cliente gastaba
   ~90 peticiones en reposo y se autobloqueaba con 429 antes de que el usuario
   escribiera nada. Dos cambios:

   1. Las sondas del cliente (/health, /csrf-token) no se contabilizan.
   2. El presupuesto sube a 300, que es lo que consume una sesión de escritura
      real con auto-guardado.
============================================================ */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    skip: (req) =>
        UNMETERED_PATHS.includes(req.path) ||
        // El contador vive en memoria y lo comparte todo el proceso, así que
        // con --runInBand la suite entera gasta un único presupuesto y las
        // últimas suites en ejecutarse recibían 429 según el orden. El límite
        // por ruta destructiva sigue activo y es el que verifica
        // security.integration.test.js.
        process.env.NODE_ENV === 'test',
    message: {
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: 'Demasiadas solicitudes desde esta IP. Intente más tarde.',
        statusCode: 429
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', globalLimiter);

/* ============================================================
   CORS

   La lista blanca se lee de CORS_ORIGINS (separada por comas) y se aplica de
   verdad: la versión anterior registraba el origen desconocido en consola y lo
   dejaba pasar igual, lo que con `credentials: true` permitía a cualquier web
   leer las notas usando la cookie de sesión del navegador.
============================================================ */
const allowedOrigins = (
    process.env.CORS_ORIGINS ||
    'http://localhost:3000,http://127.0.0.1:3000'
)
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Sin origin: peticiones del mismo servidor, curl o herramientas de test.
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.warn(`[CORS] Origen rechazado: ${origin}`);
        return callback(new Error('CORS_NOT_ALLOWED'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}));

/* ============================================================
   Parseo de cuerpo
============================================================ */
app.use(express.json({
    type: ['application/json'],
    strict: true,
    limit: LIMITS.BODY_LIMIT
}));

app.use(express.urlencoded({ extended: true, limit: LIMITS.BODY_LIMIT }));

// Rechazar cuerpos que no sean JSON en métodos de escritura.
// Se comprueba sólo si hay cuerpo: undo, redo, trash y restore son PATCH sin
// payload y no llevan (ni necesitan) cabecera Content-Type.
app.use((req, res, next) => {
    if (!['POST', 'PATCH', 'PUT'].includes(req.method)) return next();

    const hasBody = Number(req.get('content-length') || 0) > 0;
    if (!hasBody) return next();

    const contentType = req.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        return res.status(415).json({
            success: false,
            error: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Content-Type debe ser application/json',
            statusCode: 415
        });
    }

    next();
});

// Cookie parser: DEBE ir ANTES del middleware de sesión
app.use(cookieParser());
app.use(sessionMiddleware);

/* ============================================================
   SEGURIDAD: CSRF

   Se controla con DISABLE_CSRF, no con NODE_ENV. Antes se apagaba en el entorno
   de test — justo donde se verifica — así que la suite en verde no decía nada
   sobre si la protección funciona. Ahora los tests la apagan explícitamente y
   csrf.integration.test.js la enciende para comprobarla de verdad.
============================================================ */
const csrfEnabled = process.env.DISABLE_CSRF !== 'true';

if (csrfEnabled) {
    app.use(csrf({ cookie: true }));
}

if (process.env.NODE_ENV !== 'test') {
    app.use(requestLogger);
}

/* ============================================================
   Rutas
============================================================ */
app.get('/api/csrf-token', (req, res) => {
    res.json({
        success: true,
        data: {
            csrfToken: csrfEnabled ? req.csrfToken() : null
        },
        statusCode: 200
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'OK',
            timestamp: new Date().toISOString()
        },
        statusCode: 200
    });
});

app.use('/api/notes', notesRoutes);

// 404 en JSON, para que el cliente nunca reciba el HTML por defecto de Express
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `La ruta ${req.method} ${req.path} no existe`,
        statusCode: 404
    });
});

// Middleware de errores (DEBE IR AL FINAL)
app.use(errorHandler);

module.exports = app;
