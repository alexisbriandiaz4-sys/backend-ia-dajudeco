import { Request, Response, NextFunction } from 'express'
import logger from './logger'

export function validarApiKey(req: Request, res: Response, next: NextFunction) {
  logger.info(`🔐 Headers recibidos: ${JSON.stringify(req.headers)}`)
  const apiKey = req.headers['x-api-key']
  const secretEsperado = process.env.API_SECRET

  logger.info(`🔑 apiKey recibida: ${apiKey}`)
  logger.info(`🔑 secret esperado: ${secretEsperado}`)

  if (!secretEsperado) {
    logger.error('API_SECRET no configurado')
    return res.status(500).json({ error: 'Configuración incompleta del servidor' })
  }

  if (!apiKey || apiKey !== secretEsperado) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  next()
}