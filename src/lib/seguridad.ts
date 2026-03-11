import { Request, Response, NextFunction } from 'express'

export function validarApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key']
  const secretEsperado = process.env.API_SECRET

  if (!secretEsperado) {
    console.error('API_SECRET no configurado')
    return res.status(500).json({ error: 'Configuración incompleta del servidor' })
  }

  if (!apiKey || apiKey !== secretEsperado) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  next()
}