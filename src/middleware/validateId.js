// src/middleware/validateId.js

const mongoose = require('mongoose');

/**
 * Valida que el :id de la ruta sea un ObjectId de MongoDB.
 */
function validateMongoId(req, res, next) {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_ID_FORMAT',
            message: 'El ID proporcionado no es válido',
            statusCode: 400
        });
    }

    next();
}

module.exports = validateMongoId;
