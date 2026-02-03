// src/middleware/errorHandler.js

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
    console.error('Error:', err);

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

    // Error por defecto
    res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Error interno del servidor',
        statusCode: 500
    });
}

module.exports = errorHandler;