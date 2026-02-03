// src/services/note.service.js

const noteRepository = require('../repositories/note.repository');
const NoteHistory = require('../domain/noteHistory');

class NoteService {
    /**
     * Crear nueva nota
     * NOTA: La validación ya se hizo en el controller con DTO
     */
    async createNote(data, sessionId) {
        return await noteRepository.create(data, sessionId);
    }

    /**
     * Listar notas activas de la sesión
     */
    async listActiveNotes(sessionId) {
        return await noteRepository.findAllActive(sessionId);
    }

    /**
     * Listar papelera de la sesión
     */
    async listTrash(sessionId) {
        return await noteRepository.findAllDeleted(sessionId);
    }

    /**
     * Actualizar nota
     */
    async updateNote(id, updates, sessionId) {
        const note = await noteRepository.findActiveById(id, sessionId);

        if (!note) {
            throw new Error('NOTE_NOT_FOUND');
        }

        // Verificar si hay cambios reales usando la lógica del dominio
        const hasChanges = NoteHistory.hasRealChanges(note, updates);

        // Si no hay cambios reales, retornar la nota sin crear versión ni guardar
        if (!hasChanges) {
            return note;
        }

        // Si se envió lastKnownUpdate, validar concurrencia
        if (updates.lastKnownUpdate) {
            const lastKnown = new Date(updates.lastKnownUpdate).toISOString();
            const current = note.editedAt ? new Date(note.editedAt).toISOString() : null;
            if (lastKnown !== current) {
                const error = new Error('CONFLICT: Note was modified by another session');
                error.code = 'CONFLICT';
                throw error;
            }
        }

        // Guardar versión actual antes de editar
        NoteHistory.saveVersion(note);

        // Aplicar cambios
        if (updates.title !== undefined) note.title = updates.title;
        if (updates.content !== undefined) note.content = updates.content;

        note.editedAt = new Date();

        // Limpiar redo al editar
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

        // Usar la versión mutable del dominio que lanza errores legibles
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
}

module.exports = new NoteService();
