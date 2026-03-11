import Groq from 'groq-sdk'

export async function describirImagen(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64}`

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: dataUrl }
            },
            {
              type: 'text',
              text: `Sos un asistente forense judicial argentino. Describí detalladamente esta imagen en español.
Incluí:
- Qué tipo de documento o imagen es
- Texto visible (si hay)
- Elementos relevantes para una investigación judicial
- Fechas, nombres, números o datos identificatorios visibles
Sé preciso y objetivo.`
            }
          ]
        }
      ],
      max_tokens: 1000
    })

    return response.choices[0]?.message?.content ?? '[Sin descripción disponible]'
  } catch (error) {
    return `[Error al analizar imagen: ${error instanceof Error ? error.message : 'desconocido'}]`
  }
}