// src/middleware/requestLogger.js

/**
 * Middleware para logging de requests (opcional)
 */
function requestLogger(req, res, next) {
    const start = Date.now();

    // Log de requests entrantes (especialmente para debugging)
    if (req.path.includes('/notes')) {
        console.log(`[REQUEST] ${req.method} ${req.path}`, {
            sessionId: req.sessionId?.substring(0, 8) + '...',
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