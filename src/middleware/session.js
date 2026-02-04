// src/middleware/session.js

// Usar crypto.randomUUID para evitar problemas con la versión ESM de 'uuid' en entornos de test
const crypto = require('crypto');

/**
 * Middleware que asegura que cada navegador tenga un sessionId único.
 * Si no existe cookie de sesión, crea una nueva.
 */
const sessionMiddleware = (req, res, next) => {
    // Si ya existe sessionId en la cookie, usarlo
    if (req.cookies && req.cookies.sessionId) {
        req.sessionId = req.cookies.sessionId;
    } else {
        // Generar nuevo sessionId
        req.sessionId = (crypto.randomUUID && crypto.randomUUID()) || require('uuid').v4();

        // Configurar cookie que persiste al cerrar el navegador
        // httpOnly: true -> no accesible desde JavaScript del cliente (seguridad)
        // maxAge: 10 años -> prácticamente permanente para una sesión local
        res.cookie('sessionId', req.sessionId, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 años
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production' // HTTPS en producción
        });
    }

    next();
};

module.exports = sessionMiddleware;