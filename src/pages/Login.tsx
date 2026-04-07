import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import axios from 'axios'
import { Activity, Eye, EyeOff, Loader2 } from 'lucide-react'
import { login, getMe } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { clsx } from 'clsx'

const schema = z.object({
  username: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contrasena requerida'),
})

type FormData = z.infer<typeof schema>

export const Login = () => {
  const navigate = useNavigate()
  const { setAccessToken, setUser } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setServerError(null)
    try {
      const result = await login(data.username, data.password)
      setAccessToken(result.access)
      try {
        const user = await getMe()
        setUser(user)
      } catch {
        // User fetch is best-effort
      }
      navigate('/dashboard')
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail
        const nonField = err.response?.data?.non_field_errors?.[0]
        setServerError(detail ?? nonField ?? 'Credenciales incorrectas.')
      } else {
        setServerError('Error de conexión. Verifica tu red.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <Activity className="h-8 w-8 text-primary-300" />
          </div>
          <h1 className="text-2xl font-bold text-white">Grupo RP</h1>
          <p className="text-primary-400 text-sm mt-1">Sistema Operativo</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Iniciar sesion</h2>

          {serverError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
              <input
                {...register('username')}
                className={clsx('input', errors.username && 'border-red-300 focus:ring-red-400')}
                placeholder="Tu usuario"
                autoComplete="username"
                autoFocus
              />
              {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className={clsx('input pr-10', errors.password && 'border-red-300 focus:ring-red-400')}
                  placeholder="Tu contrasena"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-primary-500 text-xs mt-6">
          RP Dental S.A.S. &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
