import apiClient from './client'
import type { DashboardResumen, SnapBancos, SnapCartera, LogEnvio, Factura, CiudadAgregada, ProximoVencimiento, AnalisisIA, VendedorAgregado } from '../types'

export type FiltroFecha = { fecha?: string; fecha_desde?: string; fecha_hasta?: string }

export const getDashboardResumen = async (): Promise<DashboardResumen> => {
  const { data } = await apiClient.get('/dashboard/resumen/')
  return data
}

export const getBancos = async (fecha?: string): Promise<SnapBancos[]> => {
  const params = fecha ? { fecha } : {}
  const { data } = await apiClient.get('/bancos/', { params })
  return data.results ?? data
}

export const getCartera = async (filtro?: FiltroFecha): Promise<SnapCartera[]> => {
  const { data } = await apiClient.get('/cartera/', { params: filtro ?? {} })
  return data.results ?? data
}

export const syncCartera = async (): Promise<{
  success: boolean
  message: string
  total_clientes?: number
  fecha_corte?: string
  output?: string
}> => {
  const { data } = await apiClient.post('/cartera/sync/')
  return data
}

export const getFacturas = async (cliente_nit: string): Promise<{
  cliente_nit: string
  facturas: Factura[]
  total: number
}> => {
  const { data } = await apiClient.get('/cartera/facturas/', { params: { cliente_nit } })
  return data
}

export const getCiudades = async (filtro?: FiltroFecha): Promise<{
  fecha_corte: string
  ciudades: CiudadAgregada[]
  total_general: number
}> => {
  const { data } = await apiClient.get('/cartera/ciudades/', { params: filtro ?? {} })
  return data
}

export const getCarteraComerciales = async (filtro?: FiltroFecha): Promise<{
  fecha_corte: string
  comerciales: VendedorAgregado[]
  total_general: number
}> => {
  const { data } = await apiClient.get('/cartera/comerciales/', { params: filtro ?? {} })
  return data
}

export const getProximosVencimientos = async (): Promise<{
  fecha_consulta: string
  proximos_vencimientos: ProximoVencimiento[]
  total: number
}> => {
  const { data } = await apiClient.get('/cartera/proximos-vencimientos/')
  return data
}

export const generarAnalisisIA = async (): Promise<{
  success: boolean
  fecha_corte: string
  contenido_html: string
  tokens_usados: number
  tiempo_generacion: number
}> => {
  const { data } = await apiClient.post('/cartera/analisis-ia/')
  return data
}

export const getAnalisisIA = async (fecha?: string): Promise<AnalisisIA> => {
  const params = fecha ? { fecha } : {}
  const { data } = await apiClient.get('/cartera/analisis-ia/', { params })
  return data
}

export const getLogs = async (): Promise<LogEnvio[]> => {
  const { data } = await apiClient.get('/logs/')
  return data.results ?? data
}
