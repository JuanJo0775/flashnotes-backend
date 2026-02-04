// src/services/note.service.js

const xss = require('xss');
const noteRepository = require('../repositories/note.repository');
const NoteHistory = require('../domain/noteHistory');

class NoteService {
    /**
     * Crear nueva nota
     * NOTA: La validación ya se hizo en el controller con DTO
     * SECURITY: Se sanitiza el contenido para prevenir XSS
     */
    async createNote(data, sessionId) {
        // SECURITY: Sanitizar contenido antes de guardar
        const sanitizedData = {
            ...data,
            content: data.content ? xss(data.content, { whiteList: {}, stripIgnoredTag: true }) : ''
        };
        return await noteRepository.create(sanitizedData, sessionId);
    }

    /**
     * Listar notas activas de la sesión con paginación
     * @param {string} sessionId - ID de la sesión
     * @param {number} skip - Número de registros a saltar
     * @param {number} limit - Número máximo de registros a retornar
     */
    async listActiveNotes(sessionId, skip = 0, limit = 20) {
        return await noteRepository.findAllActive(sessionId, skip, limit);
    }

    /**
     * Contar notas activas de la sesión
     * @param {string} sessionId - ID de la sesión
     */
    async countActiveNotes(sessionId) {
        return await noteRepository.countActive(sessionId);
    }

    /**
     * Listar papelera de la sesión con paginación
     * @param {string} sessionId - ID de la sesión
     * @param {number} skip - Número de registros a saltar
     * @param {number} limit - Número máximo de registros a retornar
     */
    async listTrash(sessionId, skip = 0, limit = 20) {
        return await noteRepository.findAllDeleted(sessionId, skip, limit);
    }

    /**
     * Contar notas eliminadas de la sesión
     * @param {string} sessionId - ID de la sesión
     */
    async countTrash(sessionId) {
        return await noteRepository.countDeleted(sessionId);
    }

    /**
     * Actualizar nota
     * SECURITY: Se sanitiza el contenido para prevenir XSS
     */
    async updateNote(id, updates, sessionId) {
        console.debug(`[NoteService.updateNote] Looking for note`, {
            id,
            sessionId: sessionId?.substring(0, 8) + '...'
        });

        const note = await noteRepository.findActiveById(id, sessionId);

        if (!note) {
            console.warn(`[NoteService.updateNote] Note NOT FOUND`, {
                id,
                sessionId: sessionId?.substring(0, 8) + '...'
            });
            throw new Error('NOTE_NOT_FOUND');
        }

        console.debug(`[NoteService.updateNote] Note found`, {
            id: note._id,
            title: note.title?.substring(0, 20)
        });

        // SECURITY: Sanitizar contenido antes de guardar
        const sanitizedUpdates = { ...updates };
        if (sanitizedUpdates.content !== undefined) {
            sanitizedUpdates.content = xss(sanitizedUpdates.content, { whiteList: {}, stripIgnoredTag: true });
        }

        // Verificar si hay cambios reales usando la lógica del dominio
        const hasChanges = NoteHistory.hasRealChanges(note, sanitizedUpdates);

        // Si no hay cambios reales, retornar la nota sin crear versión ni guardar
        if (!hasChanges) {
            return note;
        }

        // Si se envió lastKnownUpdate, validar concurrencia
        if (sanitizedUpdates.lastKnownUpdate) {
            const lastKnown = new Date(sanitizedUpdates.lastKnownUpdate).toISOString();
            const current = note.updatedAt ? new Date(note.updatedAt).toISOString() : null;
            if (lastKnown !== current) {
                const error = new Error('CONFLICT: Note was modified by another session');
                error.code = 'CONFLICT';
                throw error;
            }
        }

        // Guardar versión actual antes de editar
        NoteHistory.saveVersion(note);

        // Aplicar cambios
        if (sanitizedUpdates.title !== undefined) note.title = sanitizedUpdates.title;
        if (sanitizedUpdates.content !== undefined) note.content = sanitizedUpdates.content;


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
        console.debug(`[NoteService.moveToTrash] Looking for active note`, {
            id,
            sessionId: sessionId?.substring(0, 8) + '...'
        });

        const note = await noteRepository.findActiveById(id, sessionId);

        if (!note) {
            console.warn(`[NoteService.moveToTrash] Note NOT FOUND`, {
                id,
                sessionId: sessionId?.substring(0, 8) + '...'
            });
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
