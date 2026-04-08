import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthStore {
  accessToken: string | null
  user: User | null
  /** true once the initial silent-refresh attempt has completed */
  initialized: boolean
  setAccessToken: (token: string | null) => void
  setUser: (user: User | null) => void
  setInitialized: (v: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      initialized: false,
      setAccessToken: (token) => set({ accessToken: token }),
      setUser: (user) => set({ user }),
      setInitialized: (v) => set({ initialized: v }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'rp-auth',
      // persist user for display; accessToken stays in-memory (refresh cookie handles re-auth)
      partialize: (state) => ({ user: state.user }),
    }
  )
)
