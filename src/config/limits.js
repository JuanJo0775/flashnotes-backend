// src/config/limits.js

/**
 * Fuente única de verdad para los límites de validación.
 *
 * El frontend replica estos valores en src/config/limits.ts.
 * Si cambiás uno, cambiá el otro: son un contrato entre las dos apps.
 */

const LIMITS = {
    TITLE_MAX: 100,
    CONTENT_MAX: 10000,

    /** Máximo de versiones guardadas en el historial de undo/redo. */
    HISTORY_MAX: 20,

    /**
     * Tamaño máximo del cuerpo de una petición.
     * Tiene que quedar holgadamente por encima de CONTENT_MAX + overhead de JSON:
     * con el límite anterior de 10kb, una nota con el contenido máximo permitido
     * se rechazaba con 413 en vez de guardarse.
     */
    BODY_LIMIT: '16kb',
};

/**
 * Reglas de título, como lista NEGRA.
 *
 * La versión anterior era una lista blanca de puntuación permitida, y por eso
 * rechazaba `¿Qué tal?`, `Gastos 100€` y cualquier emoji: escribir una lista
 * blanca de puntuación siempre termina excluyendo texto legítimo de algún idioma.
 *
 * Ahora sólo se prohíben dos cosas:
 *  1. Controles y caracteres de formato invisibles (incluye \n, \t y \x00): un
 *     título es una etiqueta de una sola línea.
 *  2. `<` y `>`: no aportan nada a un nombre de nota y mantener el título libre
 *     de marcado es una capa barata de defensa en profundidad. El CONTENIDO sí
 *     los acepta, porque ahí sí hacen falta.
 */
const FORBIDDEN_TITLE_CONTROL = /[\p{Cc}\p{Cf}]/u;
const FORBIDDEN_TITLE_MARKUP = /[<>]/;

module.exports = { LIMITS, FORBIDDEN_TITLE_CONTROL, FORBIDDEN_TITLE_MARKUP };
