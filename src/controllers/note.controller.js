// src/controllers/note.controller.js

const noteService = require('../services/note.service');
const NoteDTO = require('../dto/note.dto');

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
                    error: 'Validation failed',
                    details: validation.errors
                });
            }

            const note = await noteService.createNote(
                sanitized,
                req.sessionId
            );

            res.status(201).json(note);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * GET /api/notes
     */
    async listActive(req, res) {
        try {
            const notes = await noteService.listActiveNotes(
                req.sessionId
            );
            res.json(notes);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * GET /api/notes/trash
     */
    async listTrash(req, res) {
        try {
            const notes = await noteService.listTrash(
                req.sessionId
            );
            res.json(notes);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * PATCH /api/notes/:id
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const sanitized = NoteDTO.sanitizeUpdate(req.body);
            const validation = NoteDTO.validateUpdate(sanitized);

            if (!validation.valid) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validation.errors
                });
            }

            const note = await noteService.updateNote(
                id,
                sanitized,
                req.sessionId
            );

            res.json(note);
        } catch (error) {
            if (error.message === 'NOTE_NOT_FOUND') {
                return res.status(404).json({ error: 'Note not found' });
            }
            if (error.code === 'CONFLICT') {
                return res.status(409).json({
                    error: 'Conflict detected',
                    message: error.message
                });
            }
            res.status(500).json({ error: 'Internal server error' });
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
            res.json(note);
        } catch (error) {
            if (error.message === 'NOTE_NOT_FOUND') {
                return res.status(404).json({ error: 'Note not found' });
            }
            if (error.code === 'NO_HISTORY') {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Internal server error' });
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
            res.json(note);
        } catch (error) {
            if (error.message === 'NOTE_NOT_FOUND') {
                return res.status(404).json({ error: 'Note not found' });
            }
            if (error.code === 'NO_HISTORY') {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * POST /api/notes/:id/trash
     */
    async moveToTrash(req, res) {
        try {
            const { id } = req.params;
            const note = await noteService.moveToTrash(
                id,
                req.sessionId
            );
            res.json(note);
        } catch (error) {
            if (error.message === 'NOTE_NOT_FOUND') {
                return res.status(404).json({ error: 'Note not found' });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * POST /api/notes/:id/restore
     */
    async restoreFromTrash(req, res) {
        try {
            const { id } = req.params;
            const note = await noteService.restoreFromTrash(
                id,
                req.sessionId
            );
            res.json(note);
        } catch (error) {
            if (error.message === 'NOTE_NOT_IN_TRASH') {
                return res.status(404).json({ error: 'Note not in trash' });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * DELETE /api/notes/:id
     */
    async deletePermanently(req, res) {
        try {
            const { id } = req.params;
            await noteService.deletePermanently(
                id,
                req.sessionId
            );
            res.status(204).send();
        } catch (error) {
            if (error.message === 'NOTE_NOT_IN_TRASH') {
                return res.status(404).json({ error: 'Note not in trash' });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new NoteController();
