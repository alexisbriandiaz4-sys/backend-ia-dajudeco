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
    console.log(`[${new Date().toISOString()}] Analizando de forma asíncrona: ${nombre} (legajo: ${legajoId})`);
    // Se retorna inmediatamente el Accepted/202 para que el host originador (como Vercel)
    // no aborte el request por Timeout si esto toma más de 60 segundos.
    res.status(202).json({ ok: true, msg: 'Procesamiento en background iniciado', archivoId, legajoId });
    (async () => {
        try {
            // 1. Descargar el archivo desde Cloudinary
            const respuestaDescarga = await (0, node_fetch_1.default)(url);
            if (!respuestaDescarga.ok) {
                console.error(`[ERROR ASYNC] ${nombre}: No se pudo descargar archivo`);
                return;
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
            else if (['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/mp4', 'video/mp4'].includes(tipo) || ['mp3', 'wav', 'ogg', 'm4a', 'mp4'].includes(ext)) {
                // Enviar Buffer como audio a Whisper - Groq permite máx 25MB
                console.log(`[AUDIO] Enviando ${nombre} a Whisper IA...`);
                contenidoExtraido = await (0, groq_1.transcribirAudioConGroq)(buffer, nombre);
            }
            else {
                contenidoExtraido = `[Tipo de archivo no soportado: ${tipo}]`;
            }
            // 3. Analizar con Groq (límite diferenciado por tipo) - en PARALELO (Resumen Textual + Grafo JSON)
            const esComprimido = tipo === 'application/zip' || tipo === 'application/x-zip-compressed' || ext === 'zip' ||
                tipo === 'application/x-rar-compressed' || tipo === 'application/vnd.rar' || ext === 'rar';
            const limiteTexto = esComprimido ? 3500 : 12000;
            const [informe, grafos] = await Promise.all([
                (0, groq_1.analizarConGroq)(contenidoExtraido, nombre, limiteTexto),
                (0, groq_1.extraerGrafosConGroq)(contenidoExtraido, limiteTexto)
            ]);
            console.log(`[${new Date().toISOString()}] ✓ Análisis de Worker completado: ${nombre}. Enviando reporte Webhook.`);
            // 4. Devolver resultado usando Webhook al servidor primario
            const SAP_URL = process.env.SAP_WEBHOOK_URL || 'http://localhost:3000';
            const SAP_SECRET = process.env.API_SECRET || '';
            try {
                await (0, node_fetch_1.default)(`${SAP_URL}/api/ia/callback`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': SAP_SECRET
                    },
                    body: JSON.stringify({
                        ok: true,
                        archivoId,
                        legajoId,
                        informe,
                        grafos: grafos.conexiones,
                        procesadoEn: new Date().toISOString()
                    })
                });
            }
            catch (webhookErr) {
                console.error(`[ERROR WEBHOOK] Falló la comunicación hacia Next.js: ${webhookErr}`);
            }
        }
        catch (error) {
            console.error(`[CRÍTICO ASYNC] Worker colapsó procesando ${nombre}:`, error);
            // Idealmente, se debe avisar a backend de NextJS del fracaso, pero omitimos por ahora la res.
            const SAP_URL = process.env.SAP_WEBHOOK_URL || 'http://localhost:3000';
            const SAP_SECRET = process.env.API_SECRET || '';
            try {
                await (0, node_fetch_1.default)(`${SAP_URL}/api/ia/callback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': SAP_SECRET },
                    body: JSON.stringify({
                        ok: false,
                        archivoId,
                        legajoId,
                        error: 'Fracaso catastrófico en Worker de IA o extrayendo texto.'
                    })
                });
            }
            catch (webhookErr) { }
        }
    })(); // Inicia inmediatamente sin "await" en la promesa general.
});
exports.default = router;
