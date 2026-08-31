// src/services/note.service.js

const noteRepository = require('../repositories/note.repository');
const NoteHistory = require('../domain/noteHistory');

/**
 * Reglas de negocio de las notas.
 *
 * Sobre sanitización: el contenido se guarda literal, sin pasar por xss() ni
 * DOMPurify. Esas librerías escapan HTML para insertarlo en el DOM; acá el texto
 * nunca se inserta como HTML (el cliente lo pinta en un <textarea> y en nodos de
 * texto), así que lo único que hacían era corromper notas — `a < b` quedaba
 * guardado como `a &lt; b` y `<div>` desaparecía del texto del usuario.
 * La validación de entrada vive en NoteDTO.
 */
class NoteService {
    /**
     * Crear nueva nota
     */
    async createNote(data, sessionId) {
        return await noteRepository.create(data, sessionId);
    }

    /**
     * Listar notas activas de la sesión con paginación
     */
    async listActiveNotes(sessionId, skip = 0, limit = 20) {
        return await noteRepository.findAllActive(sessionId, skip, limit);
    }

    /**
     * Contar notas activas de la sesión
     */
    async countActiveNotes(sessionId) {
        return await noteRepository.countActive(sessionId);
    }

    /**
     * Listar papelera de la sesión con paginación
     */
    async listTrash(sessionId, skip = 0, limit = 20) {
        return await noteRepository.findAllDeleted(sessionId, skip, limit);
    }

    /**
     * Contar notas eliminadas de la sesión
     */
    async countTrash(sessionId) {
        return await noteRepository.countDeleted(sessionId);
    }

    /**
     * Actualizar nota.
     *
     * Cada actualización con cambios reales crea un punto de historial: el contrato
     * de la API es "un PATCH = un paso de undo", y agruparlo acá rompía el undo de
     * ediciones deliberadas y consecutivas. El problema de que el historial se
     * llenara de estados separados por un segundo se resuelve donde nace — en la
     * cadencia del auto-guardado del editor, no en el servidor.
     */
    async updateNote(id, updates, sessionId) {
        const note = await noteRepository.findActiveById(id, sessionId);

        if (!note) {
            throw new Error('NOTE_NOT_FOUND');
        }

        if (!NoteHistory.hasRealChanges(note, updates)) {
            return note;
        }

        // Control de concurrencia optimista, si el cliente lo pidió
        if (updates.lastKnownUpdate) {
            const lastKnown = new Date(updates.lastKnownUpdate).toISOString();
            const current = note.updatedAt ? new Date(note.updatedAt).toISOString() : null;
            if (lastKnown !== current) {
                const error = new Error('CONFLICT: Note was modified by another session');
                error.code = 'CONFLICT';
                throw error;
            }
        }

        NoteHistory.saveVersion(note);

        if (updates.title !== undefined) note.title = updates.title;
        if (updates.content !== undefined) note.content = updates.content;

        note.editedAt = new Date();
        note.redoStack = [];

        return await noteRepository.save(note);
    }

    /**
     * Deshacer cambios
     */
    async undoNote(id, sessionId) {
        const note = await noteRepository.findActiveById(id, sessionId);

        if (!note) {
            throw new Error('NOTE_NOT_FOUND');
        }

        NoteHistory.undoMutable(note);
        return await noteRepository.save(note);
    }

    /**
     * Rehacer cambios
     */
    async redoNote(id, sessionId) {
        const note = await noteRepository.findActiveById(id, sessionId);

        if (!note) {
            throw new Error('NOTE_NOT_FOUND');
        }

        NoteHistory.redoMutable(note);
        return await noteRepository.save(note);
    }

    /**
     * Mover a papelera (soft delete)
     */
    async moveToTrash(id, sessionId) {
        const note = await noteRepository.findActiveById(id, sessionId);

        if (!note) {
            throw new Error('NOTE_NOT_FOUND');
        }

        note.isDeleted = true;
        note.deletedAt = new Date();

        return await noteRepository.save(note);
    }

    /**
     * Restaurar de papelera
     */
    async restoreFromTrash(id, sessionId) {
        const note = await noteRepository.findDeletedById(id, sessionId);

        if (!note) {
            throw new Error('NOTE_NOT_IN_TRASH');
        }

        note.isDeleted = false;
        note.deletedAt = null;

        return await noteRepository.save(note);
    }

    /**
     * Eliminar permanentemente
     */
    async deletePermanently(id, sessionId) {
        const note = await noteRepository.findDeletedById(id, sessionId);

        if (!note) {
            throw new Error('NOTE_NOT_IN_TRASH');
        }

        await noteRepository.deletePermanently(id, sessionId);
    }

    /**
     * Obtener historial de cambios de una nota
     */
    async getHistory(id, sessionId) {
        const note = await noteRepository.findActiveById(id, sessionId);

        if (!note) {
            throw new Error('NOTE_NOT_FOUND');
        }

        return {
            versions: note.versions || [],
            redoStack: note.redoStack || []
        };
    }
}

module.exports = new NoteService();
