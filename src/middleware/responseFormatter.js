// src/middleware/responseFormatter.js
/**
 * Middleware para envolver respuestas exitosas en formato estándar
 * Esto NO intercepta errores (esos usan el errorHandler)
 */
function responseFormatter(req, res, next) {
    // Guardar el método original res.json antes de sobrescribirlo
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    // Sobrescribir res.json() para envolver automáticamente
    res.json = function(data) {
        // Si ya tiene la estructura de respuesta estándar, pasar tal cual
        if (data && data.success !== undefined && data.statusCode !== undefined) {
            return originalJson(data);
        }
        // Si es un error (llegó aquí por accidente), no envolver
        if (data && data.error && !data.success) {
            return originalJson(data);
        }
        // Envolver respuesta exitosa
        const statusCode = res.statusCode || 200;
        const wrappedResponse = {
            success: true,
            data: data,
            statusCode: statusCode
        };
        return originalJson(wrappedResponse);
    };
    // Sobrescribir res.send() para respuestas 204 sin contenido
    res.send = function(data) {
        // 204 No Content no debe tener cuerpo
        if (res.statusCode === 204) {
            return originalSend();
        }
        return originalSend(data);
    };
    next();
}
module.exports = responseFormatter;
