"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.procesarRar = procesarRar;
const node_unrar_js_1 = require("node-unrar-js");
const pdf_1 = require("./pdf");
const word_1 = require("./word");
const excel_1 = require("./excel");
async function procesarRar(buffer) {
    const archivos = [];
    try {
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        const extractor = await (0, node_unrar_js_1.createExtractorFromData)({ data: arrayBuffer });
        const { files } = extractor.extract();
        for (const file of files) {
            // Ignorar directorios
            if (file.fileHeader.flags.directory)
                continue;
            const nombre = file.fileHeader.name;
            // Ignorar archivos ocultos y carpetas del sistema
            if (nombre.startsWith('__MACOSX') || nombre.startsWith('.'))
                continue;
            const archivoBuffer = Buffer.from(file.extraction);
            // Limitar tamaño por archivo dentro del RAR
            if (archivoBuffer.length > 5 * 1024 * 1024) {
                archivos.push({ nombre, contenido: '[Archivo muy grande, omitido]' });
                continue;
            }
            const ext = nombre.split('.').pop()?.toLowerCase() ?? '';
            let contenido = '';
            if (ext === 'pdf') {
                contenido = await (0, pdf_1.extraerTextoPDF)(archivoBuffer);
            }
            else if (['doc', 'docx'].includes(ext)) {
                contenido = await (0, word_1.extraerTextoWord)(archivoBuffer);
            }
            else if (['xls', 'xlsx'].includes(ext)) {
                contenido = await (0, excel_1.extraerTextoExcel)(archivoBuffer);
            }
            else if (['txt', 'csv', 'log'].includes(ext)) {
                contenido = archivoBuffer.toString('utf-8').substring(0, 3000);
            }
            else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
                contenido = `[Imagen: ${nombre} — se procesará por separado si es necesario]`;
            }
            else {
                contenido = `[Tipo de archivo no procesable: .${ext}]`;
            }
            archivos.push({ nombre, contenido });
            // Máximo 10 archivos por RAR
            if (archivos.length >= 10) {
                archivos.push({ nombre: '...', contenido: '[Se omitieron archivos adicionales]' });
                break;
            }
        }
        if (archivos.length === 0)
            return '[RAR vacío o sin archivos procesables]';
        return archivos
            .map(a => `\n--- Archivo: ${a.nombre} ---\n${a.contenido}`)
            .join('\n');
    }
    catch (error) {
        return `[Error al procesar RAR: ${error instanceof Error ? error.message : 'desconocido'}]`;
    }
}
