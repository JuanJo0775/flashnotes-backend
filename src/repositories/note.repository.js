// src/repositories/note.repository.js

const Note = require('../models/Note');

class NoteRepository {
    /**
     * Crear nueva nota asociada a la sesión
     */
    async create(noteData, sessionId) {
        const note = new Note({
            ...noteData,
            sessionId
        });
        return await note.save();
    }

    /**
     * Listar notas activas de la sesión
     */
    async findAllActive(sessionId) {
        return await Note.find({
            isDeleted: false,
            sessionId
        }).sort({ createdAt: -1 });
    }

    /**
     * Listar notas eliminadas (papelera) de la sesión
     */
    async findAllDeleted(sessionId) {
        return await Note.find({
            isDeleted: true,
            sessionId
        }).sort({ deletedAt: -1 });
    }

    /**
     * Buscar nota activa por ID y sesión
     */
    async findActiveById(id, sessionId) {
        return await Note.findOne({
            _id: id,
            isDeleted: false,
            sessionId
        });
    }

    /**
     * Buscar nota eliminada por ID y sesión
     */
    async findDeletedById(id, sessionId) {
        return await Note.findOne({
            _id: id,
            isDeleted: true,
            sessionId
        });
    }

    /**
     * Guardar cambios en una nota
     */
    async save(note) {
        return await note.save();
    }

    /**
     * Eliminar nota permanentemente (solo si pertenece a la sesión)
     */
    async deletePermanently(id, sessionId) {
        const result = await Note.deleteOne({
            _id: id,
            sessionId
        });
        return result.deletedCount > 0;
    }
}

module.exports = new NoteRepository();