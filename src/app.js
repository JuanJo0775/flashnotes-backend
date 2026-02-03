const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const notesRoutes = require('./routes/notes.routes');
const sessionMiddleware = require('./middleware/session');
const responseFormatter = require('./middleware/responseFormatter');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// IMPORTANTE: cookieParser debe ir ANTES de cors
app.use(cookieParser());

// CORS configurado para permitir cookies y múltiples orígenes
// En desarrollo: permite localhost:3000, localhost:3001, localhost:5000
// En producción: ajustar según dominio real
const allowedOrigins = [
    'http://localhost:3000',    // Next.js dev
    'http://localhost:3001',    // Next.js alternativo
    'http://localhost:5000',    // Backend mismo
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5000',
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

// Aplicar middleware de sesión a todas las rutas
app.use(sessionMiddleware);

// Aplicar formateador de respuestas ANTES de las rutas
app.use(responseFormatter);

// Rutas
app.use('/api/notes', notesRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Ruta no encontrada',
        statusCode: 404
    });
});

// Middleware global de manejo de errores (DEBE IR AL FINAL)
app.use(errorHandler);

module.exports = app;