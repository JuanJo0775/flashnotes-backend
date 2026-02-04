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
     * Listar notas activas de la sesión con paginación
     * @param {string} sessionId - ID de la sesión
     * @param {number} skip - Número de registros a saltar
     * @param {number} limit - Número máximo de registros a retornar
     */
    async findAllActive(sessionId, skip = 0, limit = 20) {
        return await Note.find({
            isDeleted: false,
            sessionId
        })
        .sort({ editedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(); // Optimización: no hidratar modelos completos para listados
    }

    /**
     * Contar notas activas de la sesión
     */
    async countActive(sessionId) {
        return await Note.countDocuments({
            isDeleted: false,
            sessionId
        });
    }

    /**
     * Listar notas eliminadas (papelera) de la sesión con paginación
     * @param {string} sessionId - ID de la sesión
     * @param {number} skip - Número de registros a saltar
     * @param {number} limit - Número máximo de registros a retornar
     */
    async findAllDeleted(sessionId, skip = 0, limit = 20) {
        return await Note.find({
            isDeleted: true,
            sessionId
        })
        .select('_id title content deletedAt createdAt updatedAt')
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    }

    /**
     * Contar notas eliminadas de la sesión
     */
    async countDeleted(sessionId) {
        return await Note.countDocuments({
            isDeleted: true,
            sessionId
        });
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