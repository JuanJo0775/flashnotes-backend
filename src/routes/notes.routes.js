// src/routes/notes.routes.js

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const noteController = require('../controllers/note.controller');
const validateMongoId = require('../middleware/validateId');

// SECURITY: Rate limiting estricto para operaciones sensibles (delete)
const deleteRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // 10 deletes máximo por IP en 15 min
    message: {
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: 'Demasiadas solicitudes de eliminación. Intente más tarde.',
        statusCode: 429
    },
    standardHeaders: true,
    legacyHeaders: false
});


// ======================================================
//  CREACIÓN Y LISTADOS (no requieren validación de ID)
// ======================================================

// Crear una nueva nota
router.post('/', (req, res) =>
    noteController.create(req, res)
);

// Obtener todas las notas activas
router.get('/', (req, res) =>
    noteController.listActive(req, res)
);

// Obtener notas que están en la papelera
router.get('/trash', (req, res) =>
    noteController.listTrash(req, res)
);


// ======================================================
//  OPERACIONES SOBRE UNA NOTA ESPECÍFICA (:id)
//  → Todas pasan por validateMongoId
// ======================================================

// Actualizar contenido de una nota
router.patch('/:id',
    validateMongoId,
    (req, res) => noteController.update(req, res)
);

// Deshacer último cambio (undo)
router.patch('/:id/undo',
    validateMongoId,
    (req, res) => noteController.undo(req, res)
);

// Rehacer cambio deshecho (redo)
router.patch('/:id/redo',
    validateMongoId,
    (req, res) => noteController.redo(req, res)
);

// Obtener historial de cambios
router.get('/:id/history',
    validateMongoId,
    (req, res) => noteController.getHistory(req, res)
);

// Enviar nota a la papelera
router.patch('/:id/trash',
    validateMongoId,
    (req, res) => noteController.moveToTrash(req, res)
);

// Restaurar nota desde la papelera
router.patch('/:id/restore',
    validateMongoId,
    (req, res) => noteController.restoreFromTrash(req, res)
);

// Eliminar nota de forma permanente
router.delete('/:id/permanent',
    validateMongoId,
    deleteRateLimiter, // Rate limiting estricto para operaciones destructivas
    (req, res) => noteController.deletePermanently(req, res)
);


module.exports = router;
