// tests/integration/security.integration.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Note = require('../../src/models/Note');

// Helper para incluir la cookie de sesión en las requests
const sendWithSession = req => req.set('Cookie', `sessionId=${global.mockSessionId}`);

async function createTrashedNote() {
    const note = await Note.create({
        title: 'Note to trash',
        content: 'Content',
        sessionId: global.mockSessionId
    });
    await sendWithSession(request(app).patch(`/api/notes/${note._id}/trash`));
    return note;
}

describe('Security & Validation - Integration Tests', () => {
    describe('Validación de ObjectId (400)', () => {
        test('debe retornar 400 con ID inválido en /trash', async () => {
            const res = await sendWithSession(request(app)
                .patch('/api/notes/invalid-id/trash'));
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'INVALID_ID_FORMAT');
        });

        test('debe retornar 400 con ID inválido en /restore', async () => {
            const res = await sendWithSession(request(app)
                .patch('/api/notes/invalid-id/restore'));
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'INVALID_ID_FORMAT');
        });

        test('debe retornar 400 con ID inválido en /history', async () => {
            const res = await sendWithSession(request(app)
                .get('/api/notes/invalid-id/history'));
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'INVALID_ID_FORMAT');
        });

        test('debe retornar 400 con ID inválido en /undo', async () => {
            const res = await sendWithSession(request(app)
                .patch('/api/notes/invalid-id/undo'));
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'INVALID_ID_FORMAT');
        });

        test('debe retornar 400 con ID inválido en /redo', async () => {
            const res = await sendWithSession(request(app)
                .patch('/api/notes/invalid-id/redo'));
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'INVALID_ID_FORMAT');
        });

        test('debe retornar 400 con ID inválido en /permanent', async () => {
            const res = await sendWithSession(request(app)
                .delete('/api/notes/invalid-id/permanent'));
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'INVALID_ID_FORMAT');
        });
    });

    describe('Errores 404 (ID válido pero inexistente o estado inválido)', () => {
        test('debe retornar 404 cuando no existe la nota en /trash', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await sendWithSession(request(app)
                .patch(`/api/notes/${fakeId}/trash`));
            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'NOTE_NOT_FOUND');
        });

        test('debe retornar 404 al restaurar nota que no está en papelera', async () => {
            const note = await Note.create({
                title: 'Active note',
                content: 'Content',
                sessionId: global.mockSessionId
            });
            const res = await sendWithSession(request(app)
                .patch(`/api/notes/${note._id}/restore`));
            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'NOTE_NOT_IN_TRASH');
        });

        test('debe retornar 404 al eliminar permanentemente nota que no está en papelera', async () => {
            const note = await Note.create({
                title: 'Active note',
                content: 'Content',
                sessionId: global.mockSessionId
            });
            const res = await sendWithSession(request(app)
                .delete(`/api/notes/${note._id}/permanent`));
            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'NOTE_NOT_IN_TRASH');
        });

        test('debe retornar 404 en /history con nota inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const res = await sendWithSession(request(app)
                .get(`/api/notes/${fakeId}/history`));
            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'NOTE_NOT_FOUND');
        });
    });

    describe('Límites de seguridad (rate limiting, payload limit)', () => {
        test('debe aplicar rate limiting en delete permanente', async () => {
            const statuses = [];
            for (let i = 0; i < 12; i += 1) {
                const note = await createTrashedNote();
                const res = await sendWithSession(request(app)
                    .delete(`/api/notes/${note._id}/permanent`));
                statuses.push(res.status);
            }

            expect(statuses).toContain(429);
        });

        test('debe rechazar payloads demasiado grandes con 413', async () => {
            const bigContent = 'a'.repeat(11000);
            const res = await sendWithSession(request(app)
                .post('/api/notes')
                .send({
                    title: 'Big payload',
                    content: bigContent
                }));

            expect(res.status).toBe(413);
            expect(res.body).toHaveProperty('error', 'PAYLOAD_TOO_LARGE');
        });

        test('debe rechazar Content-Type inválido con 415', async () => {
            const res = await sendWithSession(request(app)
                .post('/api/notes')
                .set('Content-Type', 'text/plain')
                .send('invalid payload'));

            expect(res.status).toBe(415);
            expect(res.body).toHaveProperty('error', 'UNSUPPORTED_MEDIA_TYPE');
        });
    });

    describe('Validación de caracteres especiales en títulos', () => {
        test('debe rechazar títulos con tags HTML', async () => {
            const res = await sendWithSession(request(app)
                .post('/api/notes')
                .send({
                    title: '<script>alert("xss")</script>',
                    content: 'test'
                }));

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'VALIDATION_FAILED');
            expect(res.body.details).toContain('title contains invalid characters');
        });

        test('debe rechazar títulos con caracteres de control', async () => {
            const res = await sendWithSession(request(app)
                .post('/api/notes')
                .send({
                    title: 'test\x00null',
                    content: 'test'
                }));

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'VALIDATION_FAILED');
        });

        test('debe aceptar títulos con caracteres Unicode válidos', async () => {
            const res = await sendWithSession(request(app)
                .post('/api/notes')
                .send({
                    title: 'Café résumé 日本語 емаил',
                    content: 'test'
                }));

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });

        test('debe aceptar títulos con puntuación permitida', async () => {
            const res = await sendWithSession(request(app)
                .post('/api/notes')
                .send({
                    title: 'Test: (valid) [title] - okay!',
                    content: 'test'
                }));

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });
});
