const mongoose = require('mongoose');

const MAX_HISTORY = 20;

/* ============================================================
   SNAPSHOT (INMUTABLE Y VALIDADO)
============================================================ */
const snapshotSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            trim: true,
            maxlength: 100,
        },

        content: {
            type: String,
            trim: true,
        },

        editedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        _id: false,
        versionKey: false,
    }
);

/* ============================================================
   NOTA PRINCIPAL
============================================================ */
const noteSchema = new mongoose.Schema(
    {
        /* ========== IDENTIFICACIÓN / CONTEXTO ========== */

        sessionId: {
            type: String,
            required: true,
            index: true,
        },

        /* ========== CONTENIDO PRINCIPAL ========== */

        title: {
            type: String,
            required: [true, 'El título es obligatorio'],
            trim: true,
            minlength: [1, 'El título debe tener al menos 1 carácter'],
            maxlength: [100, 'El título no puede superar los 100 caracteres'],
            index: true,
        },

        content: {
            type: String,
            required: false,
            trim: true,
            default: '' // Permitir contenido vacío al crear notas
        },

        /* ========== TIMESTAMP DE EDICIÓN (PARA CONCURRENCIA) ========== */

        editedAt: {
            type: Date,
            default: Date.now,
            index: true,
        },

        /* ========== SOFT DELETE ========== */

        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },

        deletedAt: {
            type: Date,
            default: null,
        },

        /* ========== HISTORIAL UNDO / REDO ========== */

        versions: {
            type: [snapshotSchema],
            default: [],
            validate: {
                validator: v => v.length <= MAX_HISTORY,
                message: `El historial no puede superar ${MAX_HISTORY}`,
            },
        },

        redoStack: {
            type: [snapshotSchema],
            default: [],
            validate: {
                validator: v => v.length <= MAX_HISTORY,
                message: `El redo no puede superar ${MAX_HISTORY}`,
            },
        },
    },
    {
        timestamps: true, // createdAt + updatedAt automáticos
        versionKey: false,
    }
);


/* ============================================================
   ÍNDICES OPTIMIZADOS
============================================================ */

// Índice para filtrar por sesión y estado de eliminación (query común)
noteSchema.index({ sessionId: 1, isDeleted: 1 });

// Índice para ordenar notas activas por fecha de edición (listActive, listTrash)
noteSchema.index({ editedAt: -1 });

// Índice compuesto para listado de papelera
noteSchema.index({ isDeleted: 1, deletedAt: -1 });

// Índice para consultas por sesión y createdAt
noteSchema.index({ sessionId: 1, createdAt: -1 });

// Índice compuesto para consultas frecuentes: filtrar por sesión, estado y ordenar por edición
noteSchema.index({ sessionId: 1, isDeleted: 1, editedAt: -1 });

module.exports = mongoose.model('Note', noteSchema);

