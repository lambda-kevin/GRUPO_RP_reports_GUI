import apiClient from './client'
import type { Pedido } from '../types'

export const getPedidos = async (): Promise<Pedido[]> => {
  const { data } = await apiClient.get('/v1/')
  return data.results ?? data
}

export const getPedido = async (id: string): Promise<Pedido> => {
  const { data } = await apiClient.get(`/v1/${id}/`)
  return data
}

export const crearPedido = async (payload: Partial<Pedido>): Promise<Pedido> => {
  const { data } = await apiClient.post('/v1/', payload)
  return data
}

export const actualizarPedido = async (id: string, payload: Partial<Pedido>): Promise<Pedido> => {
  const { data } = await apiClient.patch(`/v1/${id}/`, payload)
  return data
}

export const transicionPedido = async (id: string, accion: string, payload?: object): Promise<Pedido> => {
  const { data } = await apiClient.post(`/v1/${id}/${accion}/`, payload ?? {})
  return data
}
