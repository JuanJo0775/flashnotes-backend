const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const sessionMiddleware = require('./middleware/session');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const notesRoutes = require('./routes/notes.routes');

const app = express();

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
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Cookie parser: DEBE ir ANTES del middleware de sesión
app.use(cookieParser());

// Aplicar middleware de sesión a todas las rutas
app.use(sessionMiddleware);

// Logger de requests (desarrollo)
if (process.env.NODE_ENV !== 'test') {
    app.use(requestLogger);
}

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