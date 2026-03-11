import unzipper from 'unzipper'
import { Readable } from 'stream'
import { extraerTextoPDF } from './pdf'
import { extraerTextoWord } from './word'
import { extraerTextoExcel } from './excel'

interface ArchivoDescomprimido {
  nombre: string
  contenido: string
}

const MAX_ARCHIVOS = 20
const MAX_BYTES_POR_ARCHIVO = 5 * 1024 * 1024 // 5MB

async function procesarArchivo(buffer: Buffer, nombre: string): Promise<string> {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'pdf') {
    return await extraerTextoPDF(buffer)
  } else if (['doc', 'docx'].includes(ext)) {
    return await extraerTextoWord(buffer)
  } else if (['xls', 'xlsx'].includes(ext)) {
    return await extraerTextoExcel(buffer)
  } else if (['txt', 'csv', 'log'].includes(ext)) {
    return buffer.toString('utf-8').substring(0, 3000)
  } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return `[Imagen: ${nombre} — se procesará por separado si es necesario]`
  } else {
    return `[Tipo de archivo no procesable: .${ext}]`
  }
}

async function procesarZipBuffer(
  buffer: Buffer,
  nombreZip: string,
  acumulados: ArchivoDescomprimido[]
): Promise<void> {
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

      if (
        nombre.startsWith('__MACOSX') ||
        nombre.startsWith('.') ||
        nombre.includes('/__MACOSX/') ||
        nombre.includes('/.')
      ) {
        entry.autodrain()
        continue
      }

      if (acumulados.length >= MAX_ARCHIVOS) {
        entry.autodrain()
        continue
      }

      const chunks: Buffer[] = []
      for await (const chunk of entry) {
        chunks.push(chunk)
      }
      const archivoBuffer = Buffer.concat(chunks)

      if (archivoBuffer.length > MAX_BYTES_POR_ARCHIVO) {
        acumulados.push({ nombre, contenido: '[Archivo muy grande, omitido]' })
        continue
      }

      const ext = nombre.split('.').pop()?.toLowerCase() ?? ''

      if (ext === 'zip') {
        // ZIP anidado — entrar recursivamente
        await procesarZipBuffer(archivoBuffer, nombre, acumulados)
        continue
      }

      const contenido = await procesarArchivo(archivoBuffer, nombre)
      acumulados.push({ nombre, contenido })
    }
  } catch (error) {
    acumulados.push({
      nombre: nombreZip,
      contenido: `[Error al procesar ZIP "${nombreZip}": ${error instanceof Error ? error.message : 'desconocido'}]`
    })
  }
}

export async function procesarZip(buffer: Buffer): Promise<string> {
  const acumulados: ArchivoDescomprimido[] = []
  await procesarZipBuffer(buffer, 'archivo.zip', acumulados)

  if (acumulados.length === 0) return '[ZIP vacío o sin archivos procesables]'

  return acumulados
    .map(a => `\n--- Archivo: ${a.nombre} ---\n${a.contenido}`)
    .join('\n')
}