"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const node_fetch_1 = __importDefault(require("node-fetch"));
const pdf_1 = require("../procesadores/pdf");
const word_1 = require("../procesadores/word");
const excel_1 = require("../procesadores/excel");
const imagen_1 = require("../procesadores/imagen");
const zip_1 = require("../procesadores/zip");
const rar_1 = require("../procesadores/rar");
const groq_1 = require("../ia/groq");
const router = (0, express_1.Router)();
router.post('/', async (req, res) => {
    const { url, tipo, nombre, legajoId, archivoId } = req.body;
    // Validar campos requeridos
    if (!url || !tipo || !nombre || !legajoId || !archivoId) {
        return res.status(400).json({ error: 'Faltan campos requeridos: url, tipo, nombre, legajoId, archivoId' });
    }
    console.log(`[${new Date().toISOString()}] Analizando: ${nombre} (legajo: ${legajoId})`);
    try {
        // 1. Descargar el archivo desde Cloudinary
        const respuestaDescarga = await (0, node_fetch_1.default)(url);
        if (!respuestaDescarga.ok) {
            return res.status(400).json({ error: 'No se pudo descargar el archivo desde Cloudinary' });
        }
        const arrayBuffer = await respuestaDescarga.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // 2. Extraer contenido según el tipo de archivo
        let contenidoExtraido = '';
        const ext = nombre.split('.').pop()?.toLowerCase() ?? '';
        if (tipo === 'application/pdf') {
            contenidoExtraido = await (0, pdf_1.extraerTextoPDF)(buffer);
        }
        else if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(tipo)) {
            contenidoExtraido = await (0, imagen_1.describirImagen)(buffer, tipo);
        }
        else if (['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(tipo) || ['doc', 'docx'].includes(ext)) {
            contenidoExtraido = await (0, word_1.extraerTextoWord)(buffer);
        }
        else if (['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(tipo) || ['xls', 'xlsx'].includes(ext)) {
            contenidoExtraido = await (0, excel_1.extraerTextoExcel)(buffer);
        }
        else if (tipo === 'application/zip' || tipo === 'application/x-zip-compressed' || ext === 'zip') {
            contenidoExtraido = await (0, zip_1.procesarZip)(buffer);
        }
        else if (tipo === 'application/x-rar-compressed' || tipo === 'application/vnd.rar' || ext === 'rar') {
            contenidoExtraido = await (0, rar_1.procesarRar)(buffer);
        }
        else {
            contenidoExtraido = `[Tipo de archivo no soportado: ${tipo}]`;
        }
        // 3. Analizar con Groq (límite diferenciado por tipo)
        const esComprimido = tipo === 'application/zip' || tipo === 'application/x-zip-compressed' || ext === 'zip' ||
            tipo === 'application/x-rar-compressed' || tipo === 'application/vnd.rar' || ext === 'rar';
        const informe = await (0, groq_1.analizarConGroq)(contenidoExtraido, nombre, esComprimido ? 3500 : 12000);
        // 4. Devolver resultado
        console.log(`[${new Date().toISOString()}] ✓ Análisis completado: ${nombre}`);
        return res.json({
            ok: true,
            archivoId,
            legajoId,
            informe,
            procesadoEn: new Date().toISOString()
        });
    }
    catch (error) {
        console.error(`[ERROR] ${nombre}:`, error);
        return res.status(500).json({
            error: 'Error interno al analizar el archivo',
            detalle: error instanceof Error ? error.message : 'desconocido'
        });
    }
});
exports.default = router;
