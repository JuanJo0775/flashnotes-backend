// tests/integration/note.integration.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Note = require('../../src/models/Note');
// Helper para incluir la cookie de sesión en las requests
const sendWithSession = req => req.set('Cookie', `sessionId=${global.mockSessionId}`);
// Helper para extraer datos de respuesta (compatible con nuevo formato)
const getData = (response) => {
    // Si la respuesta ya está en formato estándar { success, data }
    if (response.body && response.body.success !== undefined) {
        return response.body.data || response.body;
    }
    // Si no, devolver el body directamente (formato antiguo)
    return response.body;
};
describe('Notes API - Integration Tests', () => {
    // ============================================
    // TESTS: POST /api/notes (Crear)
    // ============================================
    describe('POST /api/notes', () => {
        test('debe crear nota con 201', async () => {
            const response = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: 'Test Note',
                    content: 'Test Content'
                });
            const data = getData(response);
            expect(response.status).toBe(201);
            expect(data).toHaveProperty('_id');
            expect(data.title).toBe('Test Note');
            expect(data.content).toBe('Test Content');
            expect(data.versionHistory || data.versions || []).toEqual([]);
            expect(data.isDeleted).toBe(false);
        });
        test('debe retornar 400 sin title', async () => {
            const response = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({ content: 'Content only' });
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
        test('debe retornar 400 sin content', async () => {
            const response = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({ title: 'Title only' });
            expect(response.status).toBe(400);
        });
        test('debe retornar 400 con title vacío', async () => {
            const response = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({ title: '   ', content: 'Content' });
            expect(response.status).toBe(400);
        });
        test('debe retornar 400 con content vacío', async () => {
            const response = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({ title: 'Title', content: '   ' });
            expect(response.status).toBe(400);
        });
        test('debe hacer trim de espacios', async () => {
            const response = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: '  Trimmed  ',
                    content: '  Content  '
                });
            const data = getData(response);
            expect(response.status).toBe(201);
            expect(data.title).toBe('Trimmed');
            expect(data.content).toBe('Content');
        });
    });
    // ============================================
    // TESTS: GET /api/notes (Listar)
    // ============================================
    describe('GET /api/notes', () => {
        test('debe listar notas activas', async () => {
            // Crear notas de prueba
            await Note.create({ title: 'Note 1', content: 'Content 1', sessionId: global.mockSessionId });
            await Note.create({ title: 'Note 2', content: 'Content 2', sessionId: global.mockSessionId });
            const response = await sendWithSession(request(app)
                .get('/api/notes'));
            const data = getData(response);
            expect(response.status).toBe(200);
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBe(2);
            expect(data[0]).toHaveProperty('title');
        });
        test('debe retornar array vacío si no hay notas', async () => {
            const response = await sendWithSession(request(app)
                .get('/api/notes'));
            const data = getData(response);
            expect(response.status).toBe(200);
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBe(0);
        });
        test('debe ignorar notas de otras sesiones', async () => {
            await Note.create({ title: 'Other Session', content: 'Content', sessionId: 'other-session' });
            await Note.create({ title: 'My Note', content: 'Content', sessionId: global.mockSessionId });
            const response = await sendWithSession(request(app)
                .get('/api/notes'));
            const data = getData(response);
            expect(response.status).toBe(200);
            expect(data.length).toBe(1);
            expect(data[0].title).toBe('My Note');
        });
    });
    // ============================================
    // TESTS: PATCH /api/notes/:id (Actualizar)
    // ============================================
    describe('PATCH /api/notes/:id', () => {
        test('debe actualizar nota con status 200', async () => {
            const note = await Note.create({
                title: 'Original Title',
                content: 'Original Content',
                sessionId: global.mockSessionId
            });
            const response = await sendWithSession(request(app)
                .patch(`/api/notes/${note._id}`))
                .send({ title: 'Updated' });
            const data = getData(response);
            expect(response.status).toBe(200);
            expect(data.title).toBe('Updated');
            expect(data.content).toBe('Original Content');
        });
        test('debe retornar 404 con ID inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await sendWithSession(request(app)
                .patch(`/api/notes/${fakeId}`))
                .send({ title: 'Updated' });
            expect(response.status).toBe(404);
        });
        test('debe retornar 400 con ID inválido', async () => {
            const response = await sendWithSession(request(app)
                .patch('/api/notes/invalid-id'))
                .send({ title: 'Updated' });
            expect(response.status).toBe(400);
        });
        test('debe retornar 409 en conflicto de concurrencia', async () => {
            const note = await Note.create({
                title: 'Original Title',
                content: 'Original Content',
                sessionId: global.mockSessionId
            });
            const firstResponse = await sendWithSession(request(app)
                .patch(`/api/notes/${note._id}`))
                .send({ title: 'Update 1' });
            const firstData = getData(firstResponse);
            const oldEditedAt = note.editedAt;
            const secondResponse = await sendWithSession(request(app)
                .patch(`/api/notes/${note._id}`))
                .send({
                    title: 'Update 2',
                    lastKnownUpdate: oldEditedAt
                });
            expect(secondResponse.status).toBe(409);
        });
    });
    // ============================================
    // TESTS: GET /api/notes/trash (Papelera)
    // ============================================
    describe('GET /api/notes/trash', () => {
        test('debe listar notas eliminadas', async () => {
            const note = await Note.create({
                title: 'To Delete',
                content: 'Content',
                sessionId: global.mockSessionId
            });
            await sendWithSession(request(app).patch(`/api/notes/${note._id}/trash`));
            const response = await sendWithSession(request(app).get('/api/notes/trash'));
            const data = getData(response);
            expect(response.status).toBe(200);
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
        });
    });
    // ============================================
    // TESTS: POST /api/notes/:id/undo
    // ============================================
    describe('POST /api/notes/:id/undo', () => {
        test('debe deshacer cambios correctamente', async () => {
            const note = await Note.create({
                title: 'Version 1',
                content: 'Content 1',
                sessionId: global.mockSessionId
            });
            await sendWithSession(request(app).patch(`/api/notes/${note._id}`))
                .send({ title: 'Version 2' });
            const response = await sendWithSession(request(app).post(`/api/notes/${note._id}/undo`));
            const data = getData(response);
            expect(response.status).toBe(200);
            expect(data.title).toBe('Version 1');
        });
        test('debe retornar 400 sin historial', async () => {
            const note = await Note.create({
                title: 'New',
                content: 'Content',
                sessionId: global.mockSessionId
            });
            const response = await sendWithSession(request(app)
                .post(`/api/notes/${note._id}/undo`));
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('NO_HISTORY');
        });
        test('debe retornar 404 con ID inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await sendWithSession(request(app)
                .post(`/api/notes/${fakeId}/undo`));
            expect(response.status).toBe(404);
        });
    });
    // ============================================
    // TESTS: POST /api/notes/:id/redo
    // ============================================
    describe('POST /api/notes/:id/redo', () => {
        test('debe rehacer cambios correctamente', async () => {
            const note = await Note.create({
                title: 'Version 1',
                content: 'Content 1',
                sessionId: global.mockSessionId
            });
            await sendWithSession(request(app).patch(`/api/notes/${note._id}`))
                .send({ title: 'Version 2' });
            await sendWithSession(request(app).post(`/api/notes/${note._id}/undo`));
            const response = await sendWithSession(request(app).post(`/api/notes/${note._id}/redo`));
            const data = getData(response);
            expect(response.status).toBe(200);
            expect(data.title).toBe('Version 2');
        });
        test('debe retornar 400 sin historial de redo', async () => {
            const note = await Note.create({
                title: 'Version 1',
                content: 'Content 1',
                sessionId: global.mockSessionId
            });
            const response = await sendWithSession(request(app)
                .post(`/api/notes/${note._id}/redo`));
            expect(response.status).toBe(400);
        });
        test('debe retornar 404 con ID inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await sendWithSession(request(app)
                .post(`/api/notes/${fakeId}/redo`));
            expect(response.status).toBe(404);
        });
    });
    // ============================================
    // TESTS: PATCH /api/notes/:id/trash
    // ============================================
    describe('PATCH /api/notes/:id/trash', () => {
        test('debe mover nota a papelera', async () => {
            const note = await Note.create({
                title: 'To Trash',
                content: 'Content',
                sessionId: global.mockSessionId
            });
            const response = await sendWithSession(request(app)
                .patch(`/api/notes/${note._id}/trash`));
            const data = getData(response);
            expect(response.status).toBe(200);
            expect(data.isDeleted).toBe(true);
            const activeResponse = await sendWithSession(request(app).get('/api/notes'));
            const activeData = getData(activeResponse);
            expect(activeData.length).toBe(0);
        });
        test('debe retornar 404 con ID inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await sendWithSession(request(app)
                .patch(`/api/notes/${fakeId}/trash`));
            expect(response.status).toBe(404);
        });
    });
    // ============================================
    // TESTS: PATCH /api/notes/:id/restore
    // ============================================
    describe('PATCH /api/notes/:id/restore', () => {
        test('debe restaurar nota desde papelera', async () => {
            const note = await Note.create({
                title: 'Restored',
                content: 'Content',
                isDeleted: true,
                sessionId: global.mockSessionId
            });
            const response = await sendWithSession(request(app)
                .patch(`/api/notes/${note._id}/restore`));
            const data = getData(response);
            expect(response.status).toBe(200);
            expect(data.isDeleted).toBe(false);
            const activeResponse = await sendWithSession(request(app).get('/api/notes'));
            const activeData = getData(activeResponse);
            expect(activeData.length).toBeGreaterThan(0);
        });
        test('debe retornar 404 si nota no está en papelera', async () => {
            const note = await Note.create({
                title: 'Active',
                content: 'Content',
                isDeleted: false,
                sessionId: global.mockSessionId
            });
            const response = await sendWithSession(request(app)
                .patch(`/api/notes/${note._id}/restore`));
            expect(response.status).toBe(404);
        });
        test('debe retornar 404 con ID inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await sendWithSession(request(app)
                .patch(`/api/notes/${fakeId}/restore`));
            expect(response.status).toBe(404);
        });
    });
    // ============================================
    // TESTS: DELETE /api/notes/:id/permanent
    // ============================================
    describe('DELETE /api/notes/:id/permanent', () => {
        test('debe eliminar nota permanentemente', async () => {
            const note = await Note.create({
                title: 'To Delete',
                content: 'Content',
                isDeleted: true,
                sessionId: global.mockSessionId
            });
            const response = await sendWithSession(request(app)
                .delete(`/api/notes/${note._id}/permanent`));
            expect(response.status).toBe(204);
            const existsInDb = await Note.findById(note._id);
            expect(existsInDb).toBeNull();
        });
        test('debe retornar 404 si nota no está en papelera', async () => {
            const note = await Note.create({
                title: 'Active',
                content: 'Content',
                isDeleted: false,
                sessionId: global.mockSessionId
            });
            const response = await sendWithSession(request(app)
                .delete(`/api/notes/${note._id}/permanent`));
            expect(response.status).toBe(404);
        });
        test('debe retornar 404 con ID inexistente', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await sendWithSession(request(app)
                .delete(`/api/notes/${fakeId}/permanent`));
            expect(response.status).toBe(404);
        });
    });
    // ============================================
    // Tests de Seguridad
    // ============================================
    describe('Tests de Seguridad', () => {
        test('debe sanitizar entrada con espacios', async () => {
            const response = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: 'Spaces',
                    content: 'Content',
                    extraField: 'Should be removed'
                });
            const data = getData(response);
            expect(response.status).toBe(201);
            expect(data.title).toBe('Spaces');
            expect(data.content).toBe('Content');
            expect(data.extraField).toBeUndefined();
        });
        test('debe manejar caracteres especiales correctamente', async () => {
            const response = await sendWithSession(request(app)
                .post('/api/notes'))
                .send({
                    title: '<script>alert("xss")</script>',
                    content: 'Content'
                });
            const data = getData(response);
            expect(response.status).toBe(201);
            expect(data.title).toBe('<script>alert("xss")</script>');
        });
    });
});
