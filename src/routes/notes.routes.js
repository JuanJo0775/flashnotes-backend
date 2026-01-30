const express = require('express');
const Note = require('../models/Note');

const router = express.Router();

/**
 * GET /api/notes
 * Obtener todas las notas
 */
router.get('/', async (req, res) => {
    try {
        const notes = await Note.find().sort({ createdAt: -1 });
        res.json(notes);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener las notas' });
    }
});

/**
 * POST /api/notes
 * Crear una nueva nota
 */
router.post('/', async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                message: 'Título y contenido son obligatorios',
            });
        }

        const newNote = await Note.create({ title, content });
        res.status(201).json(newNote);
    } catch (error) {
        res.status(500).json({ message: 'Error al crear la nota' });
    }
});

/**
 * DELETE /api/notes/:id
 * Eliminar una nota
 */
router.delete('/:id', async (req, res) => {
    try {
        const note = await Note.findByIdAndDelete(req.params.id);

        if (!note) {
            return res.status(404).json({ message: 'Nota no encontrada' });
        }

        res.json({ message: 'Nota eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar la nota' });
    }
});

/**
 * PUT /api/notes/:id
 * Editar una nota
 */
router.put('/:id', async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                message: 'Título y contenido son obligatorios',
            });
        }

        const updatedNote = await Note.findByIdAndUpdate(
            req.params.id,
            { title, content },
            { new: true, runValidators: true }
        );

        if (!updatedNote) {
            return res.status(404).json({ message: 'Nota no encontrada' });
        }

        res.json(updatedNote);
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar la nota' });
    }
});

/**
 * PATCH /api/notes/:id
 * Actualizar parcialmente una nota
 */
router.patch('/:id', async (req, res) => {
    try {
        const updates = {};
        const { title, content } = req.body;

        if (title !== undefined) updates.title = title;
        if (content !== undefined) updates.content = content;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                message: 'No se enviaron campos para actualizar',
            });
        }

        const updatedNote = await Note.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        if (!updatedNote) {
            return res.status(404).json({ message: 'Nota no encontrada' });
        }

        res.json(updatedNote);
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar la nota' });
    }
});

module.exports = router;
