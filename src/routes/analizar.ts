import { Router, Request, Response } from 'express'
import fetch from 'node-fetch'
import { extraerTextoPDF } from '../procesadores/pdf'
import { extraerTextoWord } from '../procesadores/word'
import { extraerTextoExcel } from '../procesadores/excel'
import { describirImagen } from '../procesadores/imagen'
import { procesarZip } from '../procesadores/zip'
import { analizarConGroq } from '../ia/groq'

const router = Router()

interface BodyAnalizar {
  url: string
  tipo: string
  nombre: string
  legajoId: string
  archivoId: string
}

router.post('/', async (req: Request, res: Response) => {
  const { url, tipo, nombre, legajoId, archivoId } = req.body as BodyAnalizar

  // Validar campos requeridos
  if (!url || !tipo || !nombre || !legajoId || !archivoId) {
    return res.status(400).json({ error: 'Faltan campos requeridos: url, tipo, nombre, legajoId, archivoId' })
  }

  console.log(`[${new Date().toISOString()}] Analizando: ${nombre} (legajo: ${legajoId})`)

  try {
    // 1. Descargar el archivo desde Cloudinary
    const respuestaDescarga = await fetch(url)
    if (!respuestaDescarga.ok) {
      return res.status(400).json({ error: 'No se pudo descargar el archivo desde Cloudinary' })
    }
    const arrayBuffer = await respuestaDescarga.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 2. Extraer contenido según el tipo de archivo
    let contenidoExtraido = ''
    const ext = nombre.split('.').pop()?.toLowerCase() ?? ''

    if (tipo === 'application/pdf') {
      contenidoExtraido = await extraerTextoPDF(buffer)

    } else if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(tipo)) {
      contenidoExtraido = await describirImagen(buffer, tipo)

    } else if (['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(tipo) || ['doc', 'docx'].includes(ext)) {
      contenidoExtraido = await extraerTextoWord(buffer)

    } else if (['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(tipo) || ['xls', 'xlsx'].includes(ext)) {
      contenidoExtraido = await extraerTextoExcel(buffer)

    } else if (tipo === 'application/zip' || tipo === 'application/x-zip-compressed' || ext === 'zip') {
      contenidoExtraido = await procesarZip(buffer)

    } else if (ext === 'rar') {
      contenidoExtraido = '[Archivos RAR no son procesables directamente. Convertí a ZIP para análisis.]'

    } else {
      contenidoExtraido = `[Tipo de archivo no soportado: ${tipo}]`
    }

    // 3. Analizar con Groq
    const informe = await analizarConGroq(contenidoExtraido, nombre)

    // 4. Devolver resultado
    console.log(`[${new Date().toISOString()}] ✓ Análisis completado: ${nombre}`)
    return res.json({
      ok: true,
      archivoId,
      legajoId,
      informe,
      procesadoEn: new Date().toISOString()
    })

  } catch (error) {
    console.error(`[ERROR] ${nombre}:`, error)
    return res.status(500).json({
      error: 'Error interno al analizar el archivo',
      detalle: error instanceof Error ? error.message : 'desconocido'
    })
  }
})

export default router