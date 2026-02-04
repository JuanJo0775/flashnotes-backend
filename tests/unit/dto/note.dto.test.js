// tests/unit/dto/note.dto.test.js
const NoteDTO = require('../../../src/dto/note.dto');

describe('NoteDTO - Unit Tests', () => {
    describe('validateCreate', () => {
        test('debe validar nota correcta', () => {
            const data = {
                title: 'Test Note',
                content: 'Some content'
            };
            const result = NoteDTO.validateCreate(data);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('debe rechazar título vacío', () => {
            const data = {
                title: '   ',
                content: 'content'
            };
            const result = NoteDTO.validateCreate(data);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('title cannot be empty');
        });

        test('debe rechazar título demasiado largo', () => {
            const data = {
                title: 'a'.repeat(101),
                content: 'content'
            };
            const result = NoteDTO.validateCreate(data);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('title cannot exceed 100 characters');
        });

        test('debe rechazar contenido demasiado largo', () => {
            const data = {
                title: 'Test',
                content: 'a'.repeat(10001)
            };
            const result = NoteDTO.validateCreate(data);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('content cannot exceed 10000 characters');
        });

        // SECURITY TESTS: Validación de caracteres especiales
        test('debe rechazar título con tags HTML', () => {
            const data = {
                title: '<script>alert("xss")</script>',
                content: 'test'
            };
            const result = NoteDTO.validateCreate(data);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('title contains invalid characters');
        });

        test('debe rechazar título con caracteres de control', () => {
            const data = {
                title: 'test\x00null',
                content: 'test'
            };
            const result = NoteDTO.validateCreate(data);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('title contains invalid characters');
        });

        test('debe aceptar entidades HTML escapadas (sanitización XSS se hace después)', () => {
            const data = {
                title: '&lt;script&gt;evil&lt;/script&gt;',
                content: 'test'
            };
            const result = NoteDTO.validateCreate(data);
            // El DTO hace validación básica de caracteres permitidos
            // Los caracteres &, ;, letras SÍ están permitidos
            // La sanitización XSS completa se realiza después con xss library en el service
            expect(result.valid).toBe(true);
        });

        test('debe aceptar título con caracteres Unicode válidos', () => {
            const data = {
                title: 'Café résumé 日本語 email',
                content: 'test'
            };
            const result = NoteDTO.validateCreate(data);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('debe aceptar título con puntuación permitida', () => {
            const data = {
                title: 'Test: (valid) [title] - okay! @mention #hashtag',
                content: 'test'
            };
            const result = NoteDTO.validateCreate(data);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('debe aceptar título con símbolos matemáticos y monedas', () => {
            const data = {
                title: 'Price: $100 + 50% = $150',
                content: 'test'
            };
            const result = NoteDTO.validateCreate(data);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('debe rechazar título con newlines', () => {
            const data = {
                title: 'line1\nline2',
                content: 'test'
            };
            const result = NoteDTO.validateCreate(data);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('title contains invalid characters');
        });

        test('debe rechazar título con tabs', () => {
            const data = {
                title: 'test\ttab',
                content: 'test'
            };
            const result = NoteDTO.validateCreate(data);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('title contains invalid characters');
        });
    });

    describe('validateUpdate', () => {
        test('debe validar actualización correcta', () => {
            const data = {
                title: 'Updated Title'
            };
            const result = NoteDTO.validateUpdate(data);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('debe permitir solo actualizar contenido', () => {
            const data = {
                content: 'New content'
            };
            const result = NoteDTO.validateUpdate(data);
            expect(result.valid).toBe(true);
        });

        test('debe rechazar actualización sin campos', () => {
            const data = {};
            const result = NoteDTO.validateUpdate(data);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('at least title or content must be provided');
        });

        test('debe rechazar título con caracteres inválidos en update', () => {
            const data = {
                title: '<img src=x onerror=alert(1)>'
            };
            const result = NoteDTO.validateUpdate(data);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('title contains invalid characters');
        });

        test('debe aceptar título válido con Unicode en update', () => {
            const data = {
                title: 'Updated Cafe'
            };
            const result = NoteDTO.validateUpdate(data);
            expect(result.valid).toBe(true);
        });
    });

    describe('sanitizeCreate', () => {
        test('debe sanitizar y recortar espacios', () => {
            const data = {
                title: '  Test Title  ',
                content: '  Content  '
            };
            const result = NoteDTO.sanitizeCreate(data);
            expect(result.title).toBe('Test Title');
            expect(result.content).toBe('Content');
        });

        test('debe usar título por defecto si está vacío', () => {
            const data = {
                title: '',
                content: 'content'
            };
            const result = NoteDTO.sanitizeCreate(data);
            expect(result.title).toBe('Nueva nota');
        });

        test('debe manejar contenido undefined', () => {
            const data = {
                title: 'Test'
            };
            const result = NoteDTO.sanitizeCreate(data);
            expect(result.content).toBe('');
        });
    });

    describe('sanitizeUpdate', () => {
        test('debe sanitizar solo campos presentes', () => {
            const data = {
                title: '  Updated  '
            };
            const result = NoteDTO.sanitizeUpdate(data);
            expect(result.title).toBe('Updated');
            expect(result.content).toBeUndefined();
        });

        test('debe mantener lastKnownUpdate si existe', () => {
            const timestamp = new Date().toISOString();
            const data = {
                title: 'Test',
                lastKnownUpdate: timestamp
            };
            const result = NoteDTO.sanitizeUpdate(data);
            expect(result.lastKnownUpdate).toBe(timestamp);
        });
    });
});
