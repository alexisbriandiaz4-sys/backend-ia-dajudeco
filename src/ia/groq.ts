import Groq from 'groq-sdk'
import FormData from 'form-data'
import fetch from 'node-fetch'
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

Sé preciso, objetivo y usa lenguaje judicial formal. Si no encontrás información para una sección, indicá "Sin datos".`

export async function analizarConGroq(contenido: string, nombreArchivo: string, limite: number = 12000): Promise<string> {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

    const contenidoTruncado = contenido.length > limite
      ? contenido.substring(0, limite) + `\n\n...[CONTENIDO TRUNCADO — el archivo tenía ${contenido.length} caracteres en total]`
      : contenido

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: PROMPT_SISTEMA },
        {
          role: 'user',
          content: `Analizá el siguiente contenido extraído del archivo "${nombreArchivo}":\n\n${contenidoTruncado}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    })

    return response.choices[0]?.message?.content ?? '[Sin respuesta de la IA]'
  } catch (error) {
    throw new Error(`Error al consultar Groq: ${error instanceof Error ? error.message : 'desconocido'}`)
  }
}

const PROMPT_GRAFOS = `Eres un sistema experto en Inteligencia Criminal y Procesamiento de Lenguaje Natural.
Tu tarea es analizar el texto extraído de documentos judiciales e identificar todas las ENTIDADES y sus RELACIONES explícitas o implícitas.
Las categorías permitidas de Entidades son: PERSONA, DNI, TELEFONO, EMAIL, UBICACION, CBU, ORGANIZACION, VEHICULO, ALIAS.

Debes devolver ÚNICAMENTE un objeto JSON válido con la siguiente estructura:
{
  "conexiones": [
    {
      "entidad1": "Valor de entidad",
      "tipoEntidad1": "CATEGORIA",
      "relacion": "DESCRIPCION DE RELACION",
      "entidad2": "Valor de entidad",
      "tipoEntidad2": "CATEGORIA",
      "confianza": 80
    }
  ]
}
No devuelvas texto, markdown, explicaciones ni saludos. ESTRICTAMENTE JSON. Si no hay conexiones, devuelve {"conexiones": []}.`

export async function extraerGrafosConGroq(contenido: string, limite: number = 24000): Promise<{ conexiones: any[] }> {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

    const contenidoTruncado = contenido.length > limite
      ? contenido.substring(0, limite) + `...[TRUNCADO]`
      : contenido

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: PROMPT_GRAFOS },
        { role: 'user', content: `Texto a analizar:\n${contenidoTruncado}` }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000,
      temperature: 0.1
    })

    const textoJSON = response.choices[0]?.message?.content || '{"conexiones": []}'
    return JSON.parse(textoJSON)
  } catch (error) {
    console.error("Error extrayendo grafos:", error)
    return { conexiones: [] }
  }
}

export async function transcribirAudioConGroq(buffer: Buffer, nombreArchivo: string): Promise<string> {
  try {
    const formData = new FormData()
    formData.append('file', buffer, { filename: nombreArchivo })
    formData.append('model', 'whisper-large-v3-turbo')
    formData.append('language', 'es') // Opcional pero recomendado para optimizar

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Error de Groq Whisper: ${errorText}`)
    }

    const json = await response.json() as { text: string };
    return json.text || '[Audio vacío o ininteligible]';
  } catch (error) {
    console.error("Error transcribiendo audio:", error)
    return "[Error en la transcripción del audio por formato o límite de tamaño]"
  }
}