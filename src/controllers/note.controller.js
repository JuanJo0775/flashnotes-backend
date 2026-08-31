// src/controllers/note.controller.js

const noteService = require('../services/note.service');
const NoteDTO = require('../dto/note.dto');

/** Respuesta de error uniforme. */
const fail = (res, status, error, message) =>
    res.status(status).json({ success: false, error, message, statusCode: status });

/** Lee ?page y ?limit acotando a valores seguros. */
const readPagination = (query) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 50));
    return { page, limit, skip: (page - 1) * limit };
};

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
            return fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
        }
    }

    /**
     * GET /api/notes
     * Soporta paginación con query params: ?page=1&limit=20
     */
    async listActive(req, res) {
        try {
            const { page, limit, skip } = readPagination(req.query);

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
            return fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
        }
    }

    /**
     * GET /api/notes/trash
     * Soporta paginación con query params: ?page=1&limit=20
     */
    async listTrash(req, res) {
        try {
            const { page, limit, skip } = readPagination(req.query);

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
            return fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
        }
    }

    /**
     * PATCH /api/notes/:id
     * SECURITY: Regenerar sesión después de actualizar nota
     */
    async update(req, res) {
        try {
            const { id } = req.params;

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
                return fail(res, 404, 'NOTE_NOT_FOUND', 'La nota solicitada no existe o fue eliminada');
            }
            if (error.code === 'CONFLICT') {
                return fail(res, 409, 'CONFLICT', 'La nota fue modificada por otra sesión. Recarga la página.');
            }
            return fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
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
                return fail(res, 404, 'NOTE_NOT_FOUND', 'La nota solicitada no existe o fue eliminada');
            }
            if (error.code === 'NO_HISTORY') {
                return fail(res, 400, 'NO_HISTORY', error.message);
            }
            return fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
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
                return fail(res, 404, 'NOTE_NOT_FOUND', 'La nota solicitada no existe o fue eliminada');
            }
            if (error.code === 'NO_HISTORY') {
                return fail(res, 400, 'NO_REDO', error.message);
            }
            return fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
        }
    }

    async moveToTrash(req, res) {
        try {
            const { id } = req.params;

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
                return fail(res, 404, 'NOTE_NOT_FOUND', 'La nota solicitada no existe o fue eliminada');
            }
            return fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
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
                return fail(res, 404, 'NOTE_NOT_IN_TRASH', 'La nota no está en la papelera');
            }
            return fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
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
                return fail(res, 404, 'NOTE_NOT_IN_TRASH', 'La nota no está en la papelera');
            }
            return fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
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
                return fail(res, 404, 'NOTE_NOT_FOUND', 'La nota solicitada no existe o fue eliminada');
            }
            return fail(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
        }
    }
}

module.exports = new NoteController();
