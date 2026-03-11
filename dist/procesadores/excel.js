"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extraerTextoExcel = extraerTextoExcel;
const XLSX = __importStar(require("xlsx"));
async function extraerTextoExcel(buffer) {
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const lineas = [];
        for (const nombreHoja of workbook.SheetNames) {
            const hoja = workbook.Sheets[nombreHoja];
            const datos = XLSX.utils.sheet_to_json(hoja, { header: 1 });
            lineas.push(`\n=== Hoja: ${nombreHoja} ===`);
            for (const fila of datos.slice(0, 100)) { // máximo 100 filas por hoja
                const celdas = fila.filter(c => c !== null && c !== undefined && c !== '');
                if (celdas.length > 0) {
                    lineas.push(celdas.join(' | '));
                }
            }
        }
        const texto = lineas.join('\n').trim();
        if (!texto)
            return '[Excel vacío o sin datos]';
        return texto.length > 8000 ? texto.substring(0, 8000) + '...[truncado]' : texto;
    }
    catch (error) {
        return `[Error al procesar Excel: ${error instanceof Error ? error.message : 'desconocido'}]`;
    }
}
