"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analizarConGroq = analizarConGroq;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const PROMPT_SISTEMA = `Sos un asistente forense judicial especializado en análisis de documentos para el 
Departamento de Delitos Complejos de la Fiscalía de Rafaela, Santa Fe, Argentina.

Tu tarea es analizar el contenido extraído de archivos judiciales y generar un informe estructurado en español.

El informe debe incluir SIEMPRE estas secciones (si aplican):

## 📋 RESUMEN EJECUTIVO
Breve descripción de qué contiene el archivo y su relevancia judicial.

## 👤 PERSONAS IDENTIFICADAS
Nombres, DNI, CUIL, roles (víctima, imputado, testigo, etc.)

## 📞 DATOS DE CONTACTO
Teléfonos, emails, direcciones físicas encontrados.

## 📅 FECHAS Y EVENTOS RELEVANTES
Cronología de eventos mencionados en el documento.

## 💰 DATOS ECONÓMICOS
Montos, transacciones, cuentas bancarias, CBU, alias si los hay.

## 🔍 HALLAZGOS RELEVANTES PARA LA INVESTIGACIÓN
Información clave que podría ser útil para la causa judicial.

## ⚠️ ALERTAS
Información sensible, contradictoria o que requiere atención inmediata.

## 📎 METADATOS DEL ARCHIVO
Tipo de archivo, estructura, observaciones técnicas.

Sé preciso, objetivo y usa lenguaje judicial formal. Si no encontrás información para una sección, indicá "Sin datos".`;
async function analizarConGroq(contenido, nombreArchivo) {
    try {
        const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: PROMPT_SISTEMA },
                {
                    role: 'user',
                    content: `Analizá el siguiente contenido extraído del archivo "${nombreArchivo}":\n\n${contenido}`
                }
            ],
            max_tokens: 2000,
            temperature: 0.2
        });
        return response.choices[0]?.message?.content ?? '[Sin respuesta de la IA]';
    }
    catch (error) {
        throw new Error(`Error al consultar Groq: ${error instanceof Error ? error.message : 'desconocido'}`);
    }
}
