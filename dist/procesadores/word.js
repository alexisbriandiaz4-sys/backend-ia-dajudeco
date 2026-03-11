"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extraerTextoWord = extraerTextoWord;
const mammoth_1 = __importDefault(require("mammoth"));
async function extraerTextoWord(buffer) {
    try {
        const result = await mammoth_1.default.extractRawText({ buffer });
        const texto = result.value.trim();
        if (!texto)
            return '[Documento Word vacío o sin texto]';
        return texto.length > 8000 ? texto.substring(0, 8000) + '...[truncado]' : texto;
    }
    catch (error) {
        return `[Error al procesar Word: ${error instanceof Error ? error.message : 'desconocido'}]`;
    }
}
