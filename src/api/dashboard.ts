import apiClient from './client'
import type { DashboardResumen, SnapBancos, SnapCartera, LogEnvio, Factura, CiudadAgregada, ProximoVencimiento, AnalisisIA, LineaAgregada, GrupoAgregado, ParetoClienteItem, RegionAgregada, DashboardBancosRespuesta, DashboardTesoreriaRespuesta, SaldoFavorRespuesta, AsesorRespuesta, ConsolidacionBancos } from '../types'

export type FiltroFecha = { fecha?: string; fecha_desde?: string; fecha_hasta?: string }

export const getDashboardResumen = async (fecha?: string): Promise<DashboardResumen> => {
  const { data } = await apiClient.get('/dashboard/resumen/', { params: fecha ? { fecha } : {} })
  return data
}

export const getDashboardBancos = async (params?: {
  año?: number
  mes?: number
  ciudad?: string
  vendedor?: string
}): Promise<DashboardBancosRespuesta> => {
  const { data } = await apiClient.get('/dashboard/bancos/', { params: params ?? {} })
  return data
}

export const getDashboardTesoreria = async (params?: {
  año?: number
  mes?: number
  tipo_proveedor?: 'todos' | 'bancario' | 'proveedores'
}): Promise<DashboardTesoreriaRespuesta> => {
  const { data } = await apiClient.get('/dashboard/tesoreria/', { params: params ?? {} })
  return data
}

export const enviarReporteCartera = async (): Promise<{ ok: boolean; mensaje: string }> => {
  const { data } = await apiClient.post('/cartera/enviar-reporte/')
  return data
}

export type Destinatario = {
  id: string
  destinatario: string
  rol: string
  activo: boolean
}

export const getDestinatariosCartera = async (): Promise<Destinatario[]> => {
  const { data } = await apiClient.get('/cartera/destinatarios/')
  return data
}

export const crearDestinatarioCartera = async (payload: { destinatario: string; rol?: string }): Promise<Destinatario> => {
  const { data } = await apiClient.post('/cartera/destinatarios/', payload)
  return data
}

export const toggleDestinatarioCartera = async (id: string): Promise<Destinatario> => {
  const { data } = await apiClient.patch(`/cartera/destinatarios/${id}/`)
  return data
}

export const eliminarDestinatarioCartera = async (id: string): Promise<void> => {
  await apiClient.delete(`/cartera/destinatarios/${id}/`)
}

// ── Grupos empresariales ─────────────────────────────────────────────────────

export type MiembroGrupo = {
  id: string
  nombre_cliente: string
  activo: boolean
}

export type GrupoEmpresarial = {
  id: string
  nombre: string
  peso: number
  activo: boolean
  miembros: MiembroGrupo[]
}

export const getGruposEmpresariales = async (): Promise<GrupoEmpresarial[]> => {
  const { data } = await apiClient.get('/grupos-empresariales/')
  return data
}

export const crearGrupoEmpresarial = async (payload: { nombre: string; peso?: number }): Promise<GrupoEmpresarial> => {
  const { data } = await apiClient.post('/grupos-empresariales/', payload)
  return data
}

export const actualizarGrupoEmpresarial = async (
  id: string,
  payload: { nombre?: string; peso?: number; activo?: boolean }
): Promise<GrupoEmpresarial> => {
  const { data } = await apiClient.patch(`/grupos-empresariales/${id}/`, payload)
  return data
}

export const eliminarGrupoEmpresarial = async (id: string): Promise<void> => {
  await apiClient.delete(`/grupos-empresariales/${id}/`)
}

export const agregarMiembroGrupo = async (grupoId: string, nombre_cliente: string): Promise<MiembroGrupo> => {
  const { data } = await apiClient.post(`/grupos-empresariales/${grupoId}/miembros/`, { nombre_cliente })
  return data
}

export const eliminarMiembroGrupo = async (grupoId: string, miembroId: string): Promise<void> => {
  await apiClient.delete(`/grupos-empresariales/${grupoId}/miembros/${miembroId}/`)
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

export const getFacturas = async (cliente_nit: string, filtro?: FiltroFecha): Promise<{
  cliente_nit: string
  facturas: Factura[]
  total: number
}> => {
  const { data } = await apiClient.get('/cartera/facturas/', { params: { cliente_nit, ...filtro } })
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

export const getCarteraLineas = async (filtro?: FiltroFecha): Promise<{
  fecha_corte: string
  lineas: LineaAgregada[]
  /** @deprecated usar lineas */
  comerciales: LineaAgregada[]
  total_general: number
}> => {
  const { data } = await apiClient.get('/cartera/comerciales/', { params: filtro ?? {} })
  return data
}

/** @deprecated Usar getCarteraLineas */
export const getCarteraComerciales = getCarteraLineas

export const getCarteraGrupos = async (
  filtro?: FiltroFecha & { anio_ventas?: number },
): Promise<{
  fecha_corte: string
  anio_ventas: number
  grupos: GrupoAgregado[]           // ordenados por deuda desc (Pareto)
  total_general: number
  total_ventas: number
  pareto_clientes: ParetoClienteItem[]
}> => {
  const { data } = await apiClient.get('/cartera/grupos/', { params: filtro ?? {} })
  return data
}

export const getCarteraRegiones = async (filtro?: FiltroFecha): Promise<{
  fecha_corte: string
  regiones: RegionAgregada[]
  total_general: number
}> => {
  const { data } = await apiClient.get('/cartera/regiones/', { params: filtro ?? {} })
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

export const getSaldoFavor = async (filtro?: FiltroFecha): Promise<SaldoFavorRespuesta> => {
  const { data } = await apiClient.get('/cartera/saldo-favor/', { params: filtro ?? {} })
  return data
}

export const getCarteraAsesores = async (filtro?: FiltroFecha): Promise<AsesorRespuesta> => {
  const { data } = await apiClient.get('/cartera/asesores/', { params: filtro ?? {} })
  return data
}

// ── Bancos (consolidaciones diarias) ─────────────────────────────────────────

export const getConsolidaciones = async (): Promise<ConsolidacionBancos[]> => {
  const { data } = await apiClient.get('/bancos/consolidaciones/')
  return data
}

export const getConsolidacionReciente = async (): Promise<ConsolidacionBancos> => {
  const { data } = await apiClient.get('/bancos/consolidaciones/reciente/')
  return data
}

export const getConsolidacionDetalle = async (id: number): Promise<ConsolidacionBancos> => {
  const { data } = await apiClient.get(`/bancos/consolidaciones/${id}/`)
  return data
}
