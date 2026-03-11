import unzipper from 'unzipper'
import { Readable } from 'stream'
import { extraerTextoPDF } from './pdf'
import { extraerTextoWord } from './word'
import { extraerTextoExcel } from './excel'

interface ArchivoDescomprimido {
  nombre: string
  contenido: string
}

export async function procesarZip(buffer: Buffer): Promise<string> {
  const archivos: ArchivoDescomprimido[] = []

  try {
    const stream = Readable.from(buffer)
    const zip = stream.pipe(unzipper.Parse({ forceStream: true }))

    for await (const entry of zip) {
      const nombre: string = entry.path
      const tipo = entry.type

      if (tipo === 'Directory') {
        entry.autodrain()
        continue
      }

      // Ignorar archivos ocultos y carpetas del sistema
      if (nombre.startsWith('__MACOSX') || nombre.startsWith('.')) {
        entry.autodrain()
        continue
      }

      const chunks: Buffer[] = []
      for await (const chunk of entry) {
        chunks.push(chunk)
      }
      const archivoBuffer = Buffer.concat(chunks)

      // Limitar tamaño por archivo dentro del ZIP
      if (archivoBuffer.length > 5 * 1024 * 1024) {
        archivos.push({ nombre, contenido: '[Archivo muy grande, omitido]' })
        continue
      }

      const ext = nombre.split('.').pop()?.toLowerCase() ?? ''
      let contenido = ''

      if (ext === 'pdf') {
        contenido = await extraerTextoPDF(archivoBuffer)
      } else if (['doc', 'docx'].includes(ext)) {
        contenido = await extraerTextoWord(archivoBuffer)
      } else if (['xls', 'xlsx'].includes(ext)) {
        contenido = await extraerTextoExcel(archivoBuffer)
      } else if (['txt', 'csv', 'log'].includes(ext)) {
        contenido = archivoBuffer.toString('utf-8').substring(0, 3000)
      } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        contenido = `[Imagen: ${nombre} — se procesará por separado si es necesario]`
      } else {
        contenido = `[Tipo de archivo no procesable: .${ext}]`
      }

      archivos.push({ nombre, contenido })

      // Máximo 10 archivos por ZIP
      if (archivos.length >= 10) {
        archivos.push({ nombre: '...', contenido: '[Se omitieron archivos adicionales]' })
        break
      }
    }

    if (archivos.length === 0) return '[ZIP vacío o sin archivos procesables]'

    return archivos
      .map(a => `\n--- Archivo: ${a.nombre} ---\n${a.contenido}`)
      .join('\n')

  } catch (error) {
    return `[Error al procesar ZIP: ${error instanceof Error ? error.message : 'desconocido'}]`
  }
}