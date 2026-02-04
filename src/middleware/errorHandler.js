// src/middleware/errorHandler.js

const crypto = require('crypto');

/**
 * Middleware global de manejo de errores
 * Debe ir al final de todas las rutas en app.js
 *
 * Formato de respuesta de error:
 * {
 *   success: false,
 *   error: "ERROR_CODE",
 *   message: "Descripción legible",
 *   details?: [...],
 *   statusCode: 400
 * }
 */
function errorHandler(err, req, res, next) {
    // SECURITY: Hash anónimo del sessionId con SHA-256 truncado
    const sessionHash = req.sessionId
        ? crypto.createHash('sha256')
            .update(req.sessionId)
            .digest('hex')
            .substring(0, 8)
        : 'anon';
    
    // Loguear stack completo con timestamp para debugging
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] Error:`, {
        name: err.name,
        message: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        sessionHash
    });

    // Error de validación de Mongoose
    if (err.name === 'ValidationError') {
        const details = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_FAILED',
            message: 'Validación de datos fallida',
            details,
            statusCode: 400
        });
    }

    // Error de casteo (ID inválido)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            error: 'INVALID_ID_FORMAT',
            message: 'El ID proporcionado no es válido',
            statusCode: 400
        });
    }

    // Payload demasiado grande
    if (err.type === 'entity.too.large' || err.status === 413) {
        return res.status(413).json({
            success: false,
            error: 'PAYLOAD_TOO_LARGE',
            message: 'El payload excede el tamaño permitido',
            statusCode: 413
        });
    }

    // Error de token CSRF inválido
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({
            success: false,
            error: 'INVALID_CSRF_TOKEN',
            message: 'Token de seguridad inválido o expirado. Recarga la página.',
            statusCode: 403
        });
    }

    // Error de TypeError (posible problema de sesión/CSRF/middleware)
    if (err.name === 'TypeError') {
        console.error('[ERROR] TypeError detectado - posible problema de configuración:', err.message);
        return res.status(500).json({
            success: false,
            error: 'CONFIGURATION_ERROR',
            message: 'Error de configuración del servidor. Contacta al administrador.',
            statusCode: 500
        });
    }

    // Error por defecto - asegurarse de siempre devolver JSON
    res.status(err.status || 500).json({
        success: false,
        error: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Error interno del servidor',
        statusCode: err.status || 500
    });
}

module.exports = errorHandler;