// src/controllers/note.controller.js

const noteService = require('../services/note.service');
const NoteDTO = require('../dto/note.dto');
const crypto = require('crypto');

class NoteController {
    /**
     * POST /api/notes
     */
    async create(req, res) {
        try {
            const sanitized = NoteDTO.sanitizeCreate(req.body);
            const validation = NoteDTO.validateCreate(sanitized);

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: 'VALIDATION_FAILED',
                    message: 'Validación de datos fallida',
                    details: validation.errors,
                    statusCode: 400
                });
            }

            const note = await noteService.createNote(
                sanitized,
                req.sessionId
            );

            res.status(201).json({
                success: true,
                data: note,
                statusCode: 201
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error interno del servidor',
                statusCode: 500
            });
        }
    }

    /**
     * GET /api/notes
     * Soporta paginación con query params: ?page=1&limit=20
     */
    async listActive(req, res) {
        try {
            // Obtener parámetros de paginación (valores por defecto: page=1, limit=20)
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20)); // Max 100 por seguridad
            const skip = (page - 1) * limit;

            // Ejecutar ambas queries en paralelo para eficiencia
            const [notes, total] = await Promise.all([
                noteService.listActiveNotes(req.sessionId, skip, limit),
                noteService.countActiveNotes(req.sessionId)
            ]);

            const pages = Math.ceil(total / limit);

            res.json({
                success: true,
                data: notes,
                pagination: {
                    page,
                    limit,
                    total,
                    pages
                },
                statusCode: 200
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error interno del servidor',
                statusCode: 500
            });
        }
    }

    /**
     * GET /api/notes/trash
     * Soporta paginación con query params: ?page=1&limit=20
     */
    async listTrash(req, res) {
        try {
            // Obtener parámetros de paginación (valores por defecto: page=1, limit=20)
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20)); // Max 100 por seguridad
            const skip = (page - 1) * limit;

            // Ejecutar ambas queries en paralelo para eficiencia
            const [notes, total] = await Promise.all([
                noteService.listTrash(req.sessionId, skip, limit),
                noteService.countTrash(req.sessionId)
            ]);

            const pages = Math.ceil(total / limit);

            res.json({
                success: true,
                data: notes,
                pagination: {
                    page,
                    limit,
                    total,
                    pages
                },
                statusCode: 200
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error interno del servidor',
                statusCode: 500
            });
        }
    }

    /**
     * PATCH /api/notes/:id
     * SECURITY: Regenerar sesión después de actualizar nota
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const sessionHash = req.sessionId
                ? crypto.createHash('sha256').update(req.sessionId).digest('hex').substring(0, 8)
                : 'anon';
            console.debug(`[NoteController.update] Received update request`, {
                id,
                sessionHash,
                bodyKeys: Object.keys(req.body)
            });

            const sanitized = NoteDTO.sanitizeUpdate(req.body);
            const validation = NoteDTO.validateUpdate(sanitized);

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: 'VALIDATION_FAILED',
                    message: 'Validación de datos fallida',
                    details: validation.errors,
                    statusCode: 400
                });
            }

            const note = await noteService.updateNote(
                id,
                sanitized,
                req.sessionId
            );

            res.json({
                success: true,
                data: note,
                statusCode: 200
            });
        } catch (error) {
            if (error.message === 'NOTE_NOT_FOUND') {
                return res.status(404).json({
                    success: false,
                    error: 'NOTE_NOT_FOUND',
                    message: 'La nota solicitada no existe o fue eliminada',
                    statusCode: 404
                });
            }
            if (error.code === 'CONFLICT') {
                return res.status(409).json({
                    success: false,
                    error: 'CONFLICT',
                    message: 'La nota fue modificada por otra sesión. Recarga la página.',
                    statusCode: 409
                });
            }
            res.status(500).json({
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error interno del servidor',
                statusCode: 500
            });
        }
    }

    /**
     * POST /api/notes/:id/undo
     */
    async undo(req, res) {
        try {
            const { id } = req.params;
            const note = await noteService.undoNote(
                id,
                req.sessionId
            );
            res.json({
                success: true,
                data: note,
                statusCode: 200
            });
        } catch (error) {
            if (error.message === 'NOTE_NOT_FOUND') {
                return res.status(404).json({
                    success: false,
                    error: 'NOTE_NOT_FOUND',
                    message: 'La nota solicitada no existe o fue eliminada',
                    statusCode: 404
                });
            }
            if (error.code === 'NO_HISTORY') {
                return res.status(400).json({
                    success: false,
                    error: 'NO_HISTORY',
                    message: error.message,
                    statusCode: 400
                });
            }
            res.status(500).json({
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error interno del servidor',
                statusCode: 500
            });
        }
    }

    /**
     * POST /api/notes/:id/redo
     */
    async redo(req, res) {
        try {
            const { id } = req.params;
            const note = await noteService.redoNote(
                id,
                req.sessionId
            );
            res.json({
                success: true,
                data: note,
                statusCode: 200
            });
        } catch (error) {
            if (error.message === 'NOTE_NOT_FOUND') {
                return res.status(404).json({
                    success: false,
                    error: 'NOTE_NOT_FOUND',
                    message: 'La nota solicitada no existe o fue eliminada',
                    statusCode: 404
                });
            }
            if (error.code === 'NO_HISTORY') {
                return res.status(400).json({
                    success: false,
                    error: 'NO_REDO',
                    message: error.message,
                    statusCode: 400
                });
            }
            res.status(500).json({
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error interno del servidor',
                statusCode: 500
            });
        }
    }

    async moveToTrash(req, res) {
        try {
            const { id } = req.params;
            console.debug(`[NoteController.moveToTrash] Received trash request`, {
                id,
                sessionId: req.sessionId?.substring(0, 8) + '...'
            });

            const note = await noteService.moveToTrash(
                id,
                req.sessionId
            );
            res.json({
                success: true,
                data: note,
                statusCode: 200
            });
        } catch (error) {
            if (error.message === 'NOTE_NOT_FOUND') {
                return res.status(404).json({
                    success: false,
                    error: 'NOTE_NOT_FOUND',
                    message: 'La nota solicitada no existe o fue eliminada',
                    statusCode: 404
                });
            }
            res.status(500).json({
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error interno del servidor',
                statusCode: 500
            });
        }
    }

    async restoreFromTrash(req, res) {
        try {
            const { id } = req.params;
            const note = await noteService.restoreFromTrash(
                id,
                req.sessionId
            );
            res.json({
                success: true,
                data: note,
                statusCode: 200
            });
        } catch (error) {
            if (error.message === 'NOTE_NOT_IN_TRASH') {
                return res.status(404).json({
                    success: false,
                    error: 'NOTE_NOT_IN_TRASH',
                    message: 'La nota no está en la papelera',
                    statusCode: 404
                });
            }
            res.status(500).json({
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error interno del servidor',
                statusCode: 500
            });
        }
    }

    async deletePermanently(req, res) {
        try {
            const { id } = req.params;
            
            await noteService.deletePermanently(
                id,
                req.sessionId
            );

            // 200 OK con confirmación
            res.status(200).json({
                success: true,
                message: 'Nota eliminada permanentemente',
                statusCode: 200
            });
        } catch (error) {
            if (error.message === 'NOTE_NOT_IN_TRASH') {
                return res.status(404).json({
                    success: false,
                    error: 'NOTE_NOT_IN_TRASH',
                    message: 'La nota no está en la papelera',
                    statusCode: 404
                });
            }
            res.status(500).json({
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error interno del servidor',
                statusCode: 500
            });
        }
    }

    /**
     * GET /api/notes/:id/history
     */
    async getHistory(req, res) {
        try {
            const { id } = req.params;
            const history = await noteService.getHistory(id, req.sessionId);
            return res.status(200).json({
                success: true,
                data: history,
                statusCode: 200
            });
        } catch (error) {
            if (error.message === 'NOTE_NOT_FOUND') {
                return res.status(404).json({
                    success: false,
                    error: 'NOTE_NOT_FOUND',
                    message: 'La nota solicitada no existe o fue eliminada',
                    statusCode: 404
                });
            }
            res.status(500).json({
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error interno del servidor',
                statusCode: 500
            });
        }
    }
}

module.exports = new NoteController();
