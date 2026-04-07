import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Plus, Trash2, MessageSquare, Bot, User, Loader2, Sparkles } from 'lucide-react'
import {
  getConversaciones,
  crearConversacion,
  getMensajes,
  enviarMensaje,
  eliminarConversacion,
} from '../api/agente'
import { Header } from '../components/layout/Header'
import { Spinner } from '../components/ui/Spinner'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Conversacion, Mensaje } from '../types'

const PROMPTS_SUGERIDOS = [
  'Resumen de bancos del ultimo corte y riesgos principales.',
  'Que bancos tienen mas pagos sin identificar?',
  'Cuales clientes tienen deuda critica (mas de 180 dias)?',
  'Cuanto de la cartera esta en riesgo?',
  'Dame un resumen ejecutivo de cartera y bancos.',
]

export const AgenteChat = () => {
  const queryClient = useQueryClient()
  const [convActiva, setConvActiva] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: conversaciones, isLoading: loadingConvs } = useQuery({
    queryKey: ['conversaciones'],
    queryFn: getConversaciones,
  })

  const { data: mensajes, isLoading: loadingMsgs } = useQuery({
    queryKey: ['mensajes', convActiva],
    queryFn: () => getMensajes(convActiva!),
    enabled: !!convActiva,
  })

  const crearMutation = useMutation({
    mutationFn: crearConversacion,
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ['conversaciones'] })
      setConvActiva(conv.id)
    },
  })

  const eliminarMutation = useMutation({
    mutationFn: eliminarConversacion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversaciones'] })
      setConvActiva(null)
    },
  })

  const enviarMutation = useMutation({
    mutationFn: ({ convId, pregunta }: { convId: string; pregunta: string }) =>
      enviarMensaje(convId, pregunta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mensajes', convActiva] })
      queryClient.invalidateQueries({ queryKey: ['conversaciones'] })
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, enviarMutation.isPending])

  // convId opcional: permite enviar directamente con el id recién creado
  // sin depender del estado convActiva que podría ser stale
  const handleEnviar = (texto?: string, convId?: string) => {
    const pregunta = (texto ?? input).trim()
    const id = convId ?? convActiva
    if (!pregunta || !id || enviarMutation.isPending) return
    enviarMutation.mutate({ convId: id, pregunta })
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col">
      <Header title="Asistente IA" subtitle="Consulta datos del negocio en lenguaje natural" />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar conversaciones */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <button
              onClick={() => crearMutation.mutate()}
              disabled={crearMutation.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              {crearMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-4 w-4" />}
              Nueva conversacion
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingConvs && (
              <div className="flex justify-center py-4"><Spinner className="h-4 w-4 text-gray-400" /></div>
            )}
            {conversaciones?.map((c: Conversacion) => (
              <div
                key={c.id}
                className={clsx(
                  'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                  convActiva === c.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'
                )}
                onClick={() => setConvActiva(c.id)}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {c.nombre || format(new Date(c.created_at), 'dd/MM HH:mm', { locale: es })}
                  </p>
                  {c.ultimo_mensaje && (
                    <p className="text-[11px] text-gray-400 truncate">{c.ultimo_mensaje.contenido}</p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); eliminarMutation.mutate(c.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {!loadingConvs && !conversaciones?.length && (
              <p className="text-xs text-gray-400 text-center py-4">Sin conversaciones</p>
            )}
          </div>
        </aside>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {!convActiva ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Asistente Ejecutivo RP</h3>
              <p className="text-sm text-gray-500 text-center max-w-sm mb-8">
                Consulta el estado de bancos, cartera, cirugias y el sistema en lenguaje natural.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-md">
                {PROMPTS_SUGERIDOS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      crearMutation.mutate(undefined, {
                        onSuccess: (c) => {
                          setConvActiva(c.id)
                          // Pasamos c.id directamente para evitar closure sobre estado stale
                          handleEnviar(p, c.id)
                        },
                      })
                    }}
                    className="text-left p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button onClick={() => crearMutation.mutate()} className="btn-primary mt-6 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nueva conversacion
              </button>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMsgs && <div className="flex justify-center py-8"><Spinner /></div>}
                {!loadingMsgs && !mensajes?.length && (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Bot className="h-8 w-8 mb-2" />
                    <p className="text-sm">Haz tu primera pregunta...</p>
                  </div>
                )}
                {mensajes?.map((m: Mensaje) => <ChatMessage key={m.id} mensaje={m} />)}
                {enviarMutation.isPending && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="flex gap-3 items-end">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu pregunta..."
                    className="input flex-1 resize-none min-h-[42px] max-h-32 leading-relaxed py-2.5"
                    rows={1}
                    disabled={enviarMutation.isPending}
                  />
                  <button
                    onClick={() => handleEnviar()}
                    disabled={!input.trim() || enviarMutation.isPending}
                    className="btn-primary p-2.5 flex-shrink-0"
                  >
                    {enviarMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">Enter para enviar · Shift+Enter para nueva linea</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const ChatMessage = ({ mensaje }: { mensaje: Mensaje }) => {
  const isUser = mensaje.role === 'user'
  return (
    <div className={clsx('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        isUser ? 'bg-gray-200' : 'bg-primary-600'
      )}>
        {isUser ? <User className="h-4 w-4 text-gray-600" /> : <Bot className="h-4 w-4 text-white" />}
      </div>
      <div className={clsx(
        'max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
        isUser
          ? 'bg-primary-600 text-white rounded-tr-none'
          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
      )}>
        {mensaje.contenido}
        <div className={clsx('text-[11px] mt-1.5', isUser ? 'text-primary-200' : 'text-gray-400')}>
          {format(new Date(mensaje.created_at), 'HH:mm', { locale: es })}
          {!isUser && (mensaje.tokens_usados ?? 0) > 0 && (
            <span className="ml-2">· {mensaje.tokens_usados} tokens</span>
          )}
        </div>
      </div>
    </div>
  )
}
