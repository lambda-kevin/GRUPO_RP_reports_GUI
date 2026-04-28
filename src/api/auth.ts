import apiClient from './client'
import type { User } from '../types'

export const login = async (username: string, password: string): Promise<{ access: string; user: User }> => {
  const { data } = await apiClient.post('/auth/login/', { username, password })
  return data
}

export const refreshToken = async (): Promise<{ access: string }> => {
  const { data } = await apiClient.post('/auth/refresh/')
  return data
}

export const logout = async (): Promise<void> => {
  await apiClient.post('/auth/logout/')
}

export const getMe = async (): Promise<User> => {
  const { data } = await apiClient.get('/auth/me/')
  return data
}
