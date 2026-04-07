import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { getMe } from '../api/auth'

export const useAuth = () => {
  const { accessToken, user, setUser, logout } = useAuthStore()

  const { data, error } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: !!accessToken,
    retry: false,
  })

  useEffect(() => {
    if (data) setUser(data)
  }, [data, setUser])

  useEffect(() => {
    if (error) logout()
  }, [error, logout])

  return {
    user: user ?? data,
    isAuthenticated: !!accessToken,
    logout,
  }
}
