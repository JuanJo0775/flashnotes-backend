// src/middleware/session.js

const crypto = require('crypto');

const TEN_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 10;

/**
 * Asegura que cada navegador tenga un sessionId propio y estable.
 *
 * No es autenticación: identifica un navegador, no a una persona. Es lo que
 * permite que cada quien vea sólo sus notas sin pedir cuenta ni contraseña.
 */
const sessionMiddleware = (req, res, next) => {
    if (req.cookies && req.cookies.sessionId) {
        req.sessionId = req.cookies.sessionId;
        return next();
    }

    req.sessionId = crypto.randomUUID();

    res.cookie('sessionId', req.sessionId, {
        httpOnly: true,          // inaccesible desde JavaScript del cliente
        maxAge: TEN_YEARS_MS,    // sobrevive a cerrar el navegador
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    });

    next();
};

module.exports = sessionMiddleware;
