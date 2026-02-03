const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const notesRoutes = require('./routes/notes.routes');
const sessionMiddleware = require('./middleware/session');

const app = express();

// IMPORTANTE: cookieParser debe ir ANTES de cors
app.use(cookieParser());

// CORS configurado para permitir cookies
app.use(cors({
    origin: true, // Permite cualquier origen (ajusta según necesites)
    credentials: true // CRITICAL: permite envío de cookies
}));

app.use(express.json());

// Aplicar middleware de sesión a todas las rutas
app.use(sessionMiddleware);

app.use('/api/notes', notesRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', sessionId: req.sessionId });
});

module.exports = app;