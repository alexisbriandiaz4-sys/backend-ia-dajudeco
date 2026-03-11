import * as XLSX from 'xlsx'

export async function extraerTextoExcel(buffer: Buffer): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const lineas: string[] = []

    for (const nombreHoja of workbook.SheetNames) {
      const hoja = workbook.Sheets[nombreHoja]
      const datos = XLSX.utils.sheet_to_json(hoja, { header: 1 }) as any[][]

      lineas.push(`\n=== Hoja: ${nombreHoja} ===`)
      for (const fila of datos.slice(0, 100)) { // máximo 100 filas por hoja
        const celdas = fila.filter(c => c !== null && c !== undefined && c !== '')
        if (celdas.length > 0) {
          lineas.push(celdas.join(' | '))
        }
      }
    }

    const texto = lineas.join('\n').trim()
    if (!texto) return '[Excel vacío o sin datos]'
    return texto.length > 8000 ? texto.substring(0, 8000) + '...[truncado]' : texto
  } catch (error) {
    return `[Error al procesar Excel: ${error instanceof Error ? error.message : 'desconocido'}]`
  }
}