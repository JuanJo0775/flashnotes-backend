// tests/integration/api.contract.test.js
/**
 * Tests de contrato API
 * Validan que el backend devuelve respuestas en el formato esperado
 * según API.md
 * 
 * Nota: setup.js maneja la conexión a MongoDB automáticamente
 */
const request = require('supertest');
const app = require('../../src/app');
const Note = require('../../src/models/Note');
// Helper para incluir la cookie de sesión
const sendWithSession = req => req.set('Cookie', `sessionId=${global.mockSessionId}`);
describe('API Contract - Response Format', () => {
    beforeEach(async () => {
        await Note.deleteMany({});
    });
    describe('Respuesta Exitosa (2xx)', () => {
        test('POST /api/notes devuelve formato correcto', async () => {
            const res = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: 'Test Note',
                    content: 'Test content'
                });
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('statusCode', 201);
            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data).toHaveProperty('title', 'Test Note');
            expect(res.body.data).toHaveProperty('content');
            expect(res.body.data).toHaveProperty('createdAt');
            expect(res.body.data).toHaveProperty('isDeleted', false);
        });
        test('GET /api/notes devuelve array en data', async () => {
            await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: 'Test Note 1',
                    content: 'Content 1'
                });
            const res = await sendWithSession(request(app)
                .get('/api/notes'));
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('data');
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
            expect(res.body.data[0]).toHaveProperty('title');
        });
        test('PATCH /api/notes/:id devuelve nota actualizada', async () => {
            const createRes = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: 'Original',
                    content: 'Original content'
                });
            const noteId = createRes.body.data._id;
            const updateRes = await sendWithSession(request(app)
                .patch(`/api/notes/${noteId}`))
                .send({
                    title: 'Updated'
                });
            expect(updateRes.status).toBe(200);
            expect(updateRes.body).toHaveProperty('success', true);
            expect(updateRes.body.data.title).toBe('Updated');
        });
        test('DELETE /api/notes/:id/permanent devuelve 204', async () => {
            const createRes = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: 'To delete',
                    content: 'Will be deleted'
                });
            const noteId = createRes.body.data._id;
            await sendWithSession(request(app)
                .patch(`/api/notes/${noteId}/trash`));
            const deleteRes = await sendWithSession(request(app)
                .delete(`/api/notes/${noteId}/permanent`));
            expect(deleteRes.status).toBe(204);
        });
    });
    describe('Respuesta de Error (4xx, 5xx)', () => {
        test('Validación fallida devuelve 400 con error code', async () => {
            const res = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: '',
                    content: 'Content'
                });
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('success', false);
            expect(res.body).toHaveProperty('error');
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('statusCode', 400);
            expect(res.body.error).toBe('VALIDATION_FAILED');
        });
        test('Nota no encontrada devuelve 404', async () => {
            const res = await sendWithSession(request(app)
                .patch('/api/notes/507f1f77bcf86cd799439011'))
                .send({ title: 'Updated' });
            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('success', false);
            expect(res.body.error).toBe('NOTE_NOT_FOUND');
            expect(res.body.statusCode).toBe(404);
        });
        test('ID inválido devuelve 400', async () => {
            const res = await sendWithSession(request(app)
                .patch('/api/notes/invalid-id'))
                .send({ title: 'Updated' });
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('success', false);
        });
        test('Undo sin historial devuelve 400 con NO_HISTORY', async () => {
            const createRes = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: 'New note',
                    content: 'No history yet'
                });
            const noteId = createRes.body.data._id;
            const res = await sendWithSession(request(app)
                .post(`/api/notes/${noteId}/undo`));
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('NO_HISTORY');
        });
        test('Restaurar nota que no está en papelera devuelve 404', async () => {
            const createRes = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: 'Active note',
                    content: 'Not in trash'
                });
            const noteId = createRes.body.data._id;
            const res = await sendWithSession(request(app)
                .patch(`/api/notes/${noteId}/restore`));
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('NOTE_NOT_IN_TRASH');
        });
    });
    describe('Health Check', () => {
        test('GET /api/health devuelve estado', async () => {
            const res = await request(app)
                .get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body.data).toHaveProperty('status', 'OK');
            expect(res.body.data).toHaveProperty('timestamp');
        });
    });
    describe('Conflicto de Concurrencia', () => {
        test('PATCH con lastKnownUpdate diferente devuelve 409', async () => {
            const createRes = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: 'Original',
                    content: 'Content'
                });
            const noteId = createRes.body.data._id;
            const originalEditedAt = createRes.body.data.editedAt;
            await sendWithSession(request(app)
                .patch(`/api/notes/${noteId}`))
                .send({ title: 'Update 1' });
            const res = await sendWithSession(request(app)
                .patch(`/api/notes/${noteId}`))
                .send({
                    title: 'Update 2',
                    lastKnownUpdate: originalEditedAt
                });
            expect(res.status).toBe(409);
            expect(res.body.error).toBe('CONFLICT');
        });
    });
    describe('Undo/Redo Workflow', () => {
        test('Undo después de múltiples cambios restaura versión anterior', async () => {
            const createRes = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: 'Original',
                    content: 'Original content'
                });
            const noteId = createRes.body.data._id;
            await sendWithSession(request(app)
                .patch(`/api/notes/${noteId}`))
                .send({ title: 'Change 1' });
            await sendWithSession(request(app)
                .patch(`/api/notes/${noteId}`))
                .send({ title: 'Change 2' });
            const undoRes = await sendWithSession(request(app)
                .post(`/api/notes/${noteId}/undo`));
            expect(undoRes.body.data.title).toBe('Change 1');
            const redoRes = await sendWithSession(request(app)
                .post(`/api/notes/${noteId}/redo`));
            expect(redoRes.body.data.title).toBe('Change 2');
        });
    });
});
