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

const app = express();

// SECURITY: Helmet para prevenir inyecciones y configurar headers de seguridad
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"]
    }
}));

// SECURITY: Rate limiting global para prevenir DoS y brute force
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // 100 requests por IP
    message: {
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: 'Demasiadas solicitudes desde esta IP. Intente más tarde.',
        statusCode: 429
    },
    standardHeaders: true, // Retornar límites de rata en headers RateLimit-*
    legacyHeaders: false // Deshabilitar headers X-RateLimit-*
});

// SECURITY: Rate limiting estricto para operaciones sensibles
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 requests por IP en operaciones sensibles
    message: {
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: 'Demasiadas solicitudes. Intente más tarde.',
        statusCode: 429
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Aplicar rate limiting global a toda la API
app.use('/api/', globalLimiter);

// CORS: permitir múltiples orígenes en desarrollo
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
];

app.use(cors({
    origin: (origin, callback) => {
        // Si no hay origin (ej: requests desde mismo servidor), permitir
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // En producción, cambiar a: callback(new Error('CORS not allowed'))
            console.warn(`CORS: Origen no permitido: ${origin}`);
            callback(null, true); // Permitir por ahora para desarrollo
        }
    },
    credentials: true, // CRITICAL: permite envío de cookies
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// SECURITY: Validar strict JSON content-type y limitar tamaño de payload
app.use(express.json({ 
    type: ['application/json'],
    strict: true,
    limit: '10kb' // Limitar a 10kb para prevenir ataques de payload gigante
}));

app.use(express.urlencoded({
    extended: true,
    limit: '10kb' // Limitar a 10kb
}));

// SECURITY: Rechazar requests con Content-Type inválido para métodos de escritura con payload
app.use((req, res, next) => {
    if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
        const ct = req.get('content-type');
        // Si hay Content-Type pero NO es application/json, rechazar
        if (ct && !ct.includes('application/json')) {
            return res.status(415).json({
                success: false,
                error: 'UNSUPPORTED_MEDIA_TYPE',
                message: 'Content-Type debe ser application/json',
                statusCode: 415
            });
        }
    }
    next();
});

// Cookie parser: DEBE ir ANTES del middleware de sesión
app.use(cookieParser());

// Aplicar middleware de sesión a todas las rutas
app.use(sessionMiddleware);

// SECURITY: Protección CSRF (cookie-based para simplicidad)
// CRÍTICO: Habilitado en todos los entornos excepto test
if (process.env.NODE_ENV !== 'test') {
    const csrfProtection = csrf({ cookie: true });
    app.use(csrfProtection);
    console.log('[SECURITY] CSRF protection enabled (cookie-based)');
}

// Logger de requests (desarrollo)
if (process.env.NODE_ENV !== 'test') {
    app.use(requestLogger);
}

// SECURITY: Ruta para obtener token CSRF
app.get('/api/csrf-token', (req, res) => {
    res.json({
        success: true,
        data: {
            csrfToken: req.csrfToken()
        },
        statusCode: 200
    });
});

// Rutas
app.use('/api/notes', notesRoutes);

// Health check
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

// Middleware de errores (DEBE IR AL FINAL)
app.use(errorHandler);

module.exports = app;