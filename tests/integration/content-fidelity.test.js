// tests/integration/content-fidelity.test.js

const request = require('supertest');
const app = require('../../src/app');
const Note = require('../../src/models/Note');

/**
 * El contenido de una nota tiene que guardarse EXACTAMENTE como lo escribió el
 * usuario. Había tres capas recortándolo o escapándolo a la vez —el DTO, el
 * esquema de Mongoose y xss()— y entre las tres:
 *
 *   · `linea1\nlinea2\n`  se guardaba como `linea1\nlinea2`  (se comía el Enter)
 *   · `a < b`             se guardaba como `a &lt; b`
 *   · `usa <div>hola`     se guardaba como `usa hola`        (texto borrado)
 *
 * Estos tests fijan el contrato para que no vuelva a colarse.
 */
const withSession = (req) => req.set('Cookie', ['sessionId=fidelity-session']);

async function createNote() {
    const res = await withSession(request(app).post('/api/notes'))
        .send({ title: 'Fidelidad', content: '' });
    return res.body.data._id;
}

async function saveContent(id, content) {
    const res = await withSession(request(app).patch(`/api/notes/${id}`))
        .send({ content });
    expect(res.status).toBe(200);
    return res.body.data.content;
}

describe('Fidelidad del contenido', () => {
    test.each([
        ['salto de línea final', 'linea1\nlinea2\n'],
        ['líneas en blanco y espacios finales', 'linea1\n\nlinea2\n\n   '],
        ['sangría con espacios', '  const x = 1;\n    return x;'],
        ['signo menor que', 'si a < b entonces c'],
        ['etiquetas HTML', 'usa <div>hola</div> acá'],
        ['algo que parece un script', 'ejemplo: <script>alert(1)</script>'],
        ['ampersands y entidades', 'a & b, y también &lt; literal'],
        ['comillas y barras', 'ruta "C:\Users" y \'otra\''],
        ['acentos, ñ y emojis', 'Café, ñandú, 日本語 y 🚀'],
        ['tabuladores', 'col1\tcol2\tcol3'],
    ])('conserva %s tal cual', async (_nombre, contenido) => {
        const id = await createNote();
        expect(await saveContent(id, contenido)).toBe(contenido);

        // Y lo que quedó realmente en la base de datos, no sólo la respuesta.
        const guardada = await Note.findById(id).lean();
        expect(guardada.content).toBe(contenido);
    });

    test('el título sí se recorta: es una etiqueta de una línea', async () => {
        const res = await withSession(request(app).post('/api/notes'))
            .send({ title: '   Con espacios   ', content: '' });

        expect(res.status).toBe(201);
        expect(res.body.data.title).toBe('Con espacios');
    });

    test.each([
        ['signos de interrogación en español', '¿Qué compro?'],
        ['símbolo de euro', 'Gastos 100€'],
        ['emojis', 'Ideas 🚀'],
        ['acentos y ñ', 'Diseño gráfico — versión 2'],
    ])('acepta %s en el título', async (_nombre, title) => {
        const res = await withSession(request(app).post('/api/notes'))
            .send({ title, content: '' });

        expect(res.status).toBe(201);
        expect(res.body.data.title).toBe(title);
    });

    test('rechaza un título con salto de línea', async () => {
        const res = await withSession(request(app).post('/api/notes'))
            .send({ title: 'dos\nlineas', content: '' });

        expect(res.status).toBe(400);
        expect(res.body.details).toContain('title contains invalid characters');
    });

    test('acepta contenido justo en el límite de tamaño', async () => {
        // Regresión: el techo del cuerpo de la petición era 10kb y el límite de
        // contenido 10 000 caracteres, así que una nota del tamaño máximo
        // permitido se rechazaba con 413 en vez de guardarse.
        const id = await createNote();
        const alLimite = 'x'.repeat(10000);

        expect(await saveContent(id, alLimite)).toBe(alLimite);
    });
});
