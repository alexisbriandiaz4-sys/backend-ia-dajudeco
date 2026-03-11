"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extraerTextoPDF = extraerTextoPDF;
async function extraerTextoPDF(buffer) {
    try {
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        const data = await pdfParse(buffer);
        return data.text || 'PDF sin texto extraíble';
    }
    catch (error) {
        return `Error al procesar PDF: ${error}`;
    }
}
