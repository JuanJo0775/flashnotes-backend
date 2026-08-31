// src/dto/note.dto.js

const {
    LIMITS,
    FORBIDDEN_TITLE_CONTROL,
    FORBIDDEN_TITLE_MARKUP
} = require('../config/limits');

/**
 * DTO para validar y sanitizar la entrada de notas.
 *
 * Regla de oro: el contenido de una nota se guarda TAL CUAL lo escribió el usuario.
 * No se recorta, no se escapa, no se filtra. La defensa contra XSS es no renderizar
 * nunca ese texto como HTML (el cliente lo pinta en un <textarea> y en nodos de texto).
 * Sanitizar al guardar sólo destruye datos: un `<` se convertía en `&lt;` y un
 * `<div>` desaparecía de la nota.
 */
class NoteDTO {
    /**
     * Valida un título. Devuelve un array de errores (vacío si es válido).
     */
    static _validateTitle(title) {
        const errors = [];

        if (typeof title !== 'string') {
            errors.push('title must be a string');
            return errors;
        }

        const trimmed = title.trim();

        if (trimmed.length === 0) {
            errors.push('title cannot be empty');
        } else if (trimmed.length > LIMITS.TITLE_MAX) {
            errors.push(`title cannot exceed ${LIMITS.TITLE_MAX} characters`);
        } else if (
            FORBIDDEN_TITLE_CONTROL.test(trimmed) ||
            FORBIDDEN_TITLE_MARKUP.test(trimmed)
        ) {
            errors.push('title contains invalid characters');
        }

        return errors;
    }

    /**
     * Valida un contenido. Devuelve un array de errores (vacío si es válido).
     */
    static _validateContent(content) {
        const errors = [];

        if (typeof content !== 'string') {
            errors.push('content must be a string');
            return errors;
        }

        if (content.length > LIMITS.CONTENT_MAX) {
            errors.push(`content cannot exceed ${LIMITS.CONTENT_MAX} characters`);
        }

        return errors;
    }

    /**
     * Valida datos para crear nota
     */
    static validateCreate(data) {
        const errors = [];

        if (data.title === undefined || data.title === null) {
            errors.push('title is required and must be a string');
        } else {
            errors.push(...NoteDTO._validateTitle(data.title));
        }

        if (typeof data.content !== 'string') {
            errors.push('content is required and must be a string');
        } else {
            errors.push(...NoteDTO._validateContent(data.content));
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Valida datos para actualizar nota
     */
    static validateUpdate(data) {
        const errors = [];

        if (data.title !== undefined) {
            errors.push(...NoteDTO._validateTitle(data.title));
        }

        if (data.content !== undefined) {
            // En update se permite contenido vacío: el usuario puede borrar todo.
            errors.push(...NoteDTO._validateContent(data.content));
        }

        if (data.title === undefined && data.content === undefined) {
            errors.push('at least title or content must be provided');
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Sanitiza entrada de creación (whitelist de campos).
     *
     * Acá sí se recorta el contenido: la creación es una operación única, con el
     * texto completo ya escrito. Distinto del update, que llega mientras el usuario
     * todavía está tecleando (ver sanitizeUpdate).
     */
    static sanitizeCreate(data) {
        const rawTitle = typeof data.title === 'string' ? data.title.trim() : '';
        const title = rawTitle.length ? rawTitle : 'Nueva nota';
        const content = typeof data.content === 'string' ? data.content.trim() : '';

        return { title, content };
    }

    /**
     * Sanitiza entrada de actualización (whitelist de campos).
     *
     * IMPORTANTE: el contenido NO se recorta. El editor guarda mientras escribís,
     * así que un trim() acá borraba el salto de línea o el espacio que el usuario
     * acababa de teclear, un segundo después de teclearlo.
     */
    static sanitizeUpdate(data) {
        const sanitized = {};

        if (data.title !== undefined) {
            sanitized.title = typeof data.title === 'string' ? data.title.trim() : data.title;
        }

        if (data.content !== undefined) {
            sanitized.content = data.content;
        }

        if (data.lastKnownUpdate !== undefined) {
            sanitized.lastKnownUpdate = data.lastKnownUpdate;
        }

        return sanitized;
    }
}

module.exports = NoteDTO;
