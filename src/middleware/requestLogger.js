// src/middleware/requestLogger.js

const crypto = require('crypto');

/**
 * Middleware para logging de requests (opcional)
 * SECURITY: Usa hash anónimo de sessionId para prevenir exposición en logs
 */
function requestLogger(req, res, next) {
    const start = Date.now();

    // Log de requests entrantes (especialmente para debugging)
    if (req.path.includes('/notes')) {
        // SECURITY: Hash anónimo del sessionId con SHA-256 truncado
        const sessionHash = req.sessionId
            ? crypto.createHash('sha256')
                .update(req.sessionId)
                .digest('hex')
                .substring(0, 8)
            : 'anon';
        
        console.log(`[REQUEST] ${req.method} ${req.path}`, {
            sessionHash,
            params: req.params,
            query: req.query,
        });
    }

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });

    next();
}

module.exports = requestLogger;