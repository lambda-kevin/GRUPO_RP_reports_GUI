import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const DEMO_TOKEN_KEY = 'rp_demo_access_token'

export const getDemoAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null
  const urlToken = new URLSearchParams(window.location.search).get('token')?.trim()
  if (urlToken) {
    localStorage.setItem(DEMO_TOKEN_KEY, urlToken)
    return urlToken
  }
  const saved = localStorage.getItem(DEMO_TOKEN_KEY)?.trim()
  return saved || null
}

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

// Request interceptor - add Authorization header
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  const demoToken = getDemoAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (demoToken) {
    config.headers['X-Access-Token'] = demoToken
  }
  return config
})

// Response interceptor - handle 401 with token refresh
let isRefreshing = false
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token)
    }
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const demoToken = getDemoAccessToken()
        const { data } = await axios.post(
          '/api/auth/refresh/',
          {},
          {
            withCredentials: true,
            headers: demoToken ? { 'X-Access-Token': demoToken } : {},
          }
        )
        const newToken = data.access
        useAuthStore.getState().setAccessToken(newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
