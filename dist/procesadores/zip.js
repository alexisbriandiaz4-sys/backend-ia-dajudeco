"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.procesarZip = procesarZip;
const unzipper_1 = __importDefault(require("unzipper"));
const stream_1 = require("stream");
const pdf_1 = require("./pdf");
const word_1 = require("./word");
const excel_1 = require("./excel");
async function procesarZip(buffer) {
    const archivos = [];
    try {
        const stream = stream_1.Readable.from(buffer);
        const zip = stream.pipe(unzipper_1.default.Parse({ forceStream: true }));
        for await (const entry of zip) {
            const nombre = entry.path;
            const tipo = entry.type;
            if (tipo === 'Directory') {
                entry.autodrain();
                continue;
            }
            // Ignorar archivos ocultos y carpetas del sistema
            if (nombre.startsWith('__MACOSX') || nombre.startsWith('.')) {
                entry.autodrain();
                continue;
            }
            const chunks = [];
            for await (const chunk of entry) {
                chunks.push(chunk);
            }
            const archivoBuffer = Buffer.concat(chunks);
            // Limitar tamaño por archivo dentro del ZIP
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
            // Máximo 10 archivos por ZIP
            if (archivos.length >= 10) {
                archivos.push({ nombre: '...', contenido: '[Se omitieron archivos adicionales]' });
                break;
            }
        }
        if (archivos.length === 0)
            return '[ZIP vacío o sin archivos procesables]';
        return archivos
            .map(a => `\n--- Archivo: ${a.nombre} ---\n${a.contenido}`)
            .join('\n');
    }
    catch (error) {
        return `[Error al procesar ZIP: ${error instanceof Error ? error.message : 'desconocido'}]`;
    }
}
