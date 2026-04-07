import apiClient from './client'
import type { Conversacion, Mensaje } from '../types'

export const getConversaciones = async (): Promise<Conversacion[]> => {
  const { data } = await apiClient.get('/agente/conversaciones/')
  return data
}

export const crearConversacion = async (): Promise<Conversacion> => {
  const { data } = await apiClient.post('/agente/conversaciones/')
  return data
}

export const getConversacion = async (id: string): Promise<Conversacion> => {
  const { data } = await apiClient.get(`/agente/conversaciones/${id}/`)
  return data
}

export const renombrarConversacion = async (id: string, nombre: string): Promise<Conversacion> => {
  const { data } = await apiClient.patch(`/agente/conversaciones/${id}/`, { nombre })
  return data
}

export const eliminarConversacion = async (id: string): Promise<void> => {
  await apiClient.delete(`/agente/conversaciones/${id}/`)
}

export const getMensajes = async (convId: string): Promise<Mensaje[]> => {
  const { data } = await apiClient.get(`/agente/conversaciones/${convId}/mensajes/`)
  return data
}

export const enviarMensaje = async (convId: string, pregunta: string): Promise<{ respuesta: string; mensajes: Mensaje[] }> => {
  const { data } = await apiClient.post(`/agente/conversaciones/${convId}/mensajes/`, { pregunta })
  return data
}
