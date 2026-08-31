// tests/integration/csrf.integration.test.js

// Se fija ANTES de requerir la app: app.js lee DISABLE_CSRF al cargarse.
// Cada archivo de test tiene su propio registro de módulos, así que requerir la
// app acá no colisiona con las otras suites (y jest.resetModules() sí lo hacía:
// volvía a registrar el modelo de mongoose y todo devolvía 500).
process.env.DISABLE_CSRF = 'false';

const request = require('supertest');
const app = require('../../src/app');

/**
 * La protección CSRF se apagaba en NODE_ENV=test, es decir, justo en el entorno
 * donde se verifica: la suite en verde no decía nada sobre si funcionaba.
 *
 * Estos tests levantan la app con CSRF ENCENDIDO y comprueban el ciclo completo.
 */
describe('Protección CSRF (activa)', () => {
    test('GET /api/csrf-token entrega un token', async () => {
        const res = await request(app).get('/api/csrf-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.data.csrfToken).toBe('string');
        expect(res.body.data.csrfToken.length).toBeGreaterThan(0);
    });

    test('rechaza un POST sin token con 403', async () => {
        const res = await request(app)
            .post('/api/notes')
            .send({ title: 'Sin token', content: '' });

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error', 'INVALID_CSRF_TOKEN');
    });

    test('rechaza un POST con token inválido con 403', async () => {
        const agent = request.agent(app);
        await agent.get('/api/csrf-token');

        const res = await agent
            .post('/api/notes')
            .set('X-CSRF-Token', 'token-falso')
            .send({ title: 'Token falso', content: '' });

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error', 'INVALID_CSRF_TOKEN');
    });

    test('acepta un POST con el token y la cookie correctos', async () => {
        const agent = request.agent(app);
        const tokenRes = await agent.get('/api/csrf-token');
        const token = tokenRes.body.data.csrfToken;

        const res = await agent
            .post('/api/notes')
            .set('X-CSRF-Token', token)
            .send({ title: 'Con token válido', content: 'ok' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.title).toBe('Con token válido');
    });

    test('no exige token en peticiones de lectura', async () => {
        const res = await request(app).get('/api/notes');
        expect(res.status).toBe(200);
    });
});
