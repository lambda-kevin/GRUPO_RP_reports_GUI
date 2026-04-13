import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send, Plus, Trash2, MessageSquare, Bot, User, Loader2,
  Sparkles, TrendingUp, AlertTriangle, BarChart2, Users,
  DollarSign, ShieldAlert, Calendar, FileText, Clock,
  Zap, ClipboardList,
} from 'lucide-react'
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

// ─── Catálogo de análisis ─────────────────────────────────────────────────────

interface Analisis {
  titulo: string
  descripcion: string
  decision: string
  prompt: string
  icono: React.ReactNode
  categoria: 'cartera' | 'bancos' | 'ejecutivo' | 'riesgo'
}

const CATEGORIAS: Record<string, { label: string; color: string }> = {
  ejecutivo: { label: 'Ejecutivo',  color: 'bg-slate-700 text-white' },
  cartera:   { label: 'Cartera',    color: 'bg-green-800 text-white'  },
  bancos:    { label: 'Recaudo',    color: 'bg-emerald-700 text-white'},
  riesgo:    { label: 'Riesgo',     color: 'bg-red-700 text-white'   },
}

const ANALISIS_DISPONIBLES: Analisis[] = [
  {
    categoria: 'ejecutivo',
    titulo: 'Resumen Ejecutivo CEO',
    descripcion: 'Panorama completo del estado financiero: cartera, recaudo y alertas críticas.',
    decision: 'Las 5 decisiones más urgentes para esta semana.',
    prompt: 'Genera un resumen ejecutivo CEO completo con estado de cartera, recaudo, alertas críticas y las 5 decisiones más urgentes para esta semana.',
    icono: <TrendingUp className="h-5 w-5" />,
  },
  {
    categoria: 'cartera',
    titulo: 'Diagnóstico de Cartera',
    descripcion: 'Análisis de antigüedad, concentración y clientes en mora crítica.',
    decision: 'Priorizar gestión sobre clientes con mayor concentración de deuda y mora +90 días.',
    prompt: 'Genera un diagnóstico detallado de cartera: antigüedad por tramos, clientes críticos con mora >90 días, concentración (Pareto) y acciones de cobro priorizadas.',
    icono: <BarChart2 className="h-5 w-5" />,
  },
  {
    categoria: 'bancos',
    titulo: 'Análisis de Recaudo',
    descripcion: 'Ingresos identificados vs sin identificar, por banco y tendencia.',
    decision: 'Definir meta semanal de recaudo y responsables por ciudad y comercial.',
    prompt: 'Analiza el recaudo del último corte: total ingresado, identificado vs sin identificar, bancos con diferencias y recomendaciones para mejorar la tasa de identificación.',
    icono: <DollarSign className="h-5 w-5" />,
  },
  {
    categoria: 'riesgo',
    titulo: 'Monitor de Riesgos',
    descripcion: 'Clientes con mora >90 días, deuda concentrada y alertas tempranas.',
    decision: 'Escalar comité de cobro para top clientes críticos con fecha de compromiso.',
    prompt: 'Identifica todos los riesgos activos: clientes con mora >90 días, deuda concentrada en pocos clientes, ingresos sin identificar y cualquier otra señal de alerta. Sugiere acciones concretas.',
    icono: <ShieldAlert className="h-5 w-5" />,
  },
  {
    categoria: 'cartera',
    titulo: 'Clientes Prioritarios',
    descripcion: 'Los clientes que concentran el 80% de la deuda vencida.',
    decision: 'Agendar llamada de cobro con los 5 clientes de mayor impacto esta semana.',
    prompt: 'Identifica los clientes que concentran el 80% de la cartera vencida, muestra su antigüedad, comercial responsable y sugiere el guión de gestión de cobro para cada uno.',
    icono: <Users className="h-5 w-5" />,
  },
  {
    categoria: 'ejecutivo',
    titulo: 'Plan Táctico Semanal',
    descripcion: 'Acciones concretas por frentes: cartera, recaudo y dirección.',
    decision: 'Activar tablero semanal de cumplimiento y seguimiento de compromisos.',
    prompt: 'Genera un plan táctico semanal con acciones específicas por rol (gerencia, cartera, comercial) y criterios de seguimiento para esta semana.',
    icono: <Calendar className="h-5 w-5" />,
  },
  {
    categoria: 'bancos',
    titulo: 'Liquidez y Flujo de Caja',
    descripcion: 'Estimación de presión de caja con base en recaudo y vencimientos.',
    decision: 'Definir si se requiere línea de crédito o acelerar cobros prioritarios.',
    prompt: 'Analiza la situación de liquidez: recaudo reciente, facturas próximas a vencer, cartera vigente convertible y estima la presión de caja de los próximos 30 días.',
    icono: <TrendingUp className="h-5 w-5" />,
  },
  {
    categoria: 'riesgo',
    titulo: 'Clientes Sin Movimiento',
    descripcion: 'Instituciones con deuda activa sin pagos recientes.',
    decision: 'Contactar clientes inactivos y evaluar provisión contable.',
    prompt: 'Identifica clientes con deuda activa y mora >180 días o sin pago en los últimos 3 meses. Sugiere si deben ir a cobro jurídico o provisión.',
    icono: <AlertTriangle className="h-5 w-5" />,
  },
]

// ─── Paginación ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 6
const totalPages = (n: number) => Math.max(1, Math.ceil(n / PAGE_SIZE))
const paginate = <T,>(items: T[], page: number) =>
  items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

// ─── Componente principal ─────────────────────────────────────────────────────

export const AgenteChat = () => {
  const queryClient = useQueryClient()
  const [convActiva, setConvActiva] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [pageConvs, setPageConvs] = useState(1)
  const [tabActivo, setTabActivo] = useState<'disponibles' | 'historial'>('disponibles')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos')
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

  const [errorChat, setErrorChat] = useState<string | null>(null)

  const enviarMutation = useMutation({
    mutationFn: ({ convId, pregunta }: { convId: string; pregunta: string }) =>
      enviarMensaje(convId, pregunta),
    onMutate: async ({ convId, pregunta }) => {
      setErrorChat(null)
      await queryClient.cancelQueries({ queryKey: ['mensajes', convId] })
      const prevMensajes = queryClient.getQueryData<Mensaje[]>(['mensajes', convId])

      const mensajeOptimista: Mensaje = {
        id: `optimistic-${Date.now()}`,
        role: 'user',
        contenido: pregunta,
        dominio_detectado: '',
        tokens_usados: null,
        latencia_ms: null,
        created_at: new Date().toISOString(),
      }
      queryClient.setQueryData<Mensaje[]>(
        ['mensajes', convId],
        (prev) => [...(prev ?? []), mensajeOptimista],
      )
      return { prevMensajes, convId }
    },
    onError: (err: any, _vars, context) => {
      // Mantener el mensaje del usuario visible — solo mostrar el error debajo
      const mensaje =
        err?.response?.data?.error ??
        'No se pudo procesar la consulta. Intenta de nuevo.'
      setErrorChat(mensaje)
    },
    onSuccess: (_data, { convId }) => {
      setErrorChat(null)
      queryClient.invalidateQueries({ queryKey: ['mensajes', convId] })
      queryClient.invalidateQueries({ queryKey: ['conversaciones'] })
    },
  })

  // Scroll al fondo cuando llegan mensajes o se activa el spinner de carga
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes?.length, enviarMutation.isPending])

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

  const iniciarAnalisis = (analisis: Analisis) => {
    crearMutation.mutate(undefined, {
      onSuccess: (conv) => {
        // Pre-poblar cache con lista vacía para que el query no pise el optimistic update
        queryClient.setQueryData<Mensaje[]>(['mensajes', conv.id], [])
        setConvActiva(conv.id)
        setTabActivo('historial')
        handleEnviar(analisis.prompt, conv.id)
      },
    })
  }

  const conversacionesList = conversaciones ?? []
  const convPages = totalPages(conversacionesList.length)
  const convPageItems = paginate(conversacionesList, Math.min(pageConvs, convPages))

  const analisisFiltrados = filtroCategoria === 'todos'
    ? ANALISIS_DISPONIBLES
    : ANALISIS_DISPONIBLES.filter(a => a.categoria === filtroCategoria)

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col bg-[#f4f6fa]">
      <Header
        title="CENTRO DE MANDO IA"
        subtitle="Análisis ejecutivos y decisiones financieras impulsadas por Claude"
      />
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200 space-y-2">
            <button
              onClick={() => { setConvActiva(null); setTabActivo('disponibles') }}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Nuevo análisis
            </button>
            <button
              onClick={() => crearMutation.mutate()}
              disabled={crearMutation.isPending}
              className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {crearMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-4 w-4" />}
              Consulta libre
            </button>
          </div>

          {/* Lista de conversaciones */}
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Conversaciones</p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {loadingConvs && (
              <div className="flex justify-center py-4"><Spinner className="h-4 w-4 text-gray-400" /></div>
            )}
            {convPageItems.map((c: Conversacion) => (
              <div
                key={c.id}
                className={clsx(
                  'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                  convActiva === c.id
                    ? 'bg-green-700 text-white'
                    : 'hover:bg-gray-50 text-gray-700'
                )}
                onClick={() => { setConvActiva(c.id); setTabActivo('historial') }}
              >
                <MessageSquare className={clsx('h-4 w-4 flex-shrink-0', convActiva === c.id ? 'text-green-200' : 'text-gray-400')} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {c.nombre || format(new Date(c.created_at), 'dd MMM · HH:mm', { locale: es })}
                  </p>
                  {c.ultimo_mensaje && (
                    <p className={clsx('text-[11px] truncate', convActiva === c.id ? 'text-green-200' : 'text-gray-400')}>
                      {c.ultimo_mensaje.contenido}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); eliminarMutation.mutate(c.id) }}
                  className={clsx(
                    'opacity-0 group-hover:opacity-100 p-1 rounded transition-all',
                    convActiva === c.id ? 'text-green-200 hover:text-white' : 'text-gray-400 hover:text-red-500'
                  )}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {!loadingConvs && !conversacionesList.length && (
              <p className="text-xs text-gray-400 text-center py-6">Sin conversaciones aún</p>
            )}
            {convPages > 1 && (
              <div className="pt-2 flex items-center justify-between text-xs text-gray-600">
                <button
                  onClick={() => setPageConvs(Math.max(1, pageConvs - 1))}
                  disabled={pageConvs <= 1}
                  className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40"
                >Ant.</button>
                <span>{Math.min(pageConvs, convPages)} / {convPages}</span>
                <button
                  onClick={() => setPageConvs(Math.min(convPages, pageConvs + 1))}
                  disabled={pageConvs >= convPages}
                  className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40"
                >Sig.</button>
              </div>
            )}
          </div>

          {/* Modelo activo */}
          <div className="p-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
              <span>Claude Sonnet 4.6 · Activo</span>
            </div>
          </div>
        </aside>

        {/* ── Área principal ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Tabs */}
          {!convActiva && (
            <div className="bg-white border-b border-gray-200 px-6 flex gap-1 pt-3">
              {([
              { key: 'disponibles', label: 'Análisis Disponibles', icon: <Zap className="h-4 w-4" /> },
              { key: 'historial',   label: 'Informes Generados',   icon: <ClipboardList className="h-4 w-4" /> },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setTabActivo(tab.key)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors',
                  tabActivo === tab.key
                    ? 'border-green-600 text-green-700 bg-green-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
            </div>
          )}

          {/* ── Vista: Análisis disponibles ────────────────────────────────── */}
          {!convActiva && tabActivo === 'disponibles' && (
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <div className="max-w-6xl mx-auto space-y-6">

                {/* Filtros por categoría */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFiltroCategoria('todos')}
                    className={clsx(
                      'px-4 py-1.5 rounded-full text-sm font-semibold transition-all',
                      filtroCategoria === 'todos'
                        ? 'bg-green-700 text-white'
                        : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400'
                    )}
                  >
                    Todos
                  </button>
                  {Object.entries(CATEGORIAS).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      onClick={() => setFiltroCategoria(key)}
                      className={clsx(
                        'px-4 py-1.5 rounded-full text-sm font-semibold transition-all',
                        filtroCategoria === key
                          ? color
                          : 'bg-white border border-gray-300 text-gray-600 hover:border-gray-400'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Grid de análisis */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {analisisFiltrados.map((item) => {
                    const cat = CATEGORIAS[item.categoria]
                    return (
                      <button
                        key={item.titulo}
                        onClick={() => iniciarAnalisis(item)}
                        disabled={crearMutation.isPending}
                        className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-green-600 hover:shadow-md transition-all group disabled:opacity-60"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-700 group-hover:bg-green-700 group-hover:text-white transition-colors">
                            {item.icono}
                          </div>
                          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide', cat.color)}>
                            {cat.label}
                          </span>
                        </div>
                        <p className="text-base font-bold text-gray-900 mb-1">{item.titulo}</p>
                        <p className="text-sm text-gray-500 leading-snug mb-3">{item.descripcion}</p>
                        <div className="border-t border-gray-100 pt-2">
                          <p className="text-[11px] font-bold text-green-700 uppercase tracking-wide mb-0.5">Decisión objetivo</p>
                          <p className="text-xs text-gray-600 leading-snug">{item.decision}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Consulta libre */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <p className="text-sm font-bold text-gray-800">Consulta Libre</p>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Haz cualquier pregunta sobre cartera, recaudo o el estado del negocio y Claude generará un informe personalizado.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && input.trim()) {
                          crearMutation.mutate(undefined, {
                            onSuccess: (c) => {
                              setConvActiva(c.id)
                              setTabActivo('historial')
                              handleEnviar(input, c.id)
                            },
                          })
                        }
                      }}
                      placeholder="Ej. ¿Cuál es la tendencia de recaudo de los últimos 3 meses?"
                      className="input flex-1"
                    />
                    <button
                      onClick={() => {
                        crearMutation.mutate(undefined, {
                          onSuccess: (c) => {
                            setConvActiva(c.id)
                            setTabActivo('historial')
                            handleEnviar(input, c.id)
                          },
                        })
                      }}
                      disabled={!input.trim() || crearMutation.isPending}
                      className="flex items-center gap-2 bg-green-700 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-green-800 transition-colors disabled:opacity-50"
                    >
                      {crearMutation.isPending
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</>
                        : <><Sparkles className="h-4 w-4" /> Generar</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Vista: Historial / Informes generados ──────────────────────── */}
          {!convActiva && tabActivo === 'historial' && (
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <div className="max-w-4xl mx-auto">
                {!conversacionesList.length ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Clock className="h-10 w-10 mb-3" />
                    <p className="font-semibold text-gray-600">Sin informes generados aún</p>
                    <p className="text-sm mt-1">Ve a "Análisis Disponibles" y ejecuta tu primer análisis.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conversacionesList.map((c: Conversacion) => (
                      <button
                        key={c.id}
                        onClick={() => { setConvActiva(c.id) }}
                        className="w-full text-left bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-600 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                              <Bot className="h-4 w-4 text-green-700" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 text-sm truncate">
                                {c.nombre || 'Análisis sin título'}
                              </p>
                              {c.ultimo_mensaje && (
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                  {c.ultimo_mensaje.contenido}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {format(new Date(c.created_at), 'dd MMM · HH:mm', { locale: es })}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Vista: Conversación activa ─────────────────────────────────── */}
          {convActiva && (
            <>
              {/* Barra de conversación activa */}
              <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConvActiva(null)}
                    className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    ← Volver
                  </button>
                  <span className="text-gray-300">|</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-sm font-semibold text-gray-700">Claude Sonnet 4.6</span>
                  </div>
                </div>
                <button
                  onClick={() => { eliminarMutation.mutate(convActiva); setConvActiva(null) }}
                  className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </button>
              </div>

              {/* Mensajes */}
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
                    <div className="w-8 h-8 bg-green-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3">
                      <div className="flex gap-1 items-center">
                        <span className="w-2 h-2 bg-green-700 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-green-700 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-green-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        <span className="text-xs text-gray-400 ml-2">Claude está analizando...</span>
                      </div>
                    </div>
                  </div>
                )}
                {errorChat && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="max-w-[78%] bg-red-50 border border-red-200 rounded-2xl rounded-tl-none px-4 py-3">
                      <p className="text-sm font-semibold text-red-700 mb-0.5">Error al consultar el asistente</p>
                      <p className="text-sm text-red-600">{errorChat}</p>
                      <button
                        onClick={() => setErrorChat(null)}
                        className="text-xs text-red-400 hover:text-red-600 mt-1 underline"
                      >
                        Cerrar
                      </button>
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
                    placeholder="Escribe tu pregunta... (Enter para enviar)"
                    className="input flex-1 resize-none min-h-[44px] max-h-32 leading-relaxed py-2.5"
                    rows={1}
                    disabled={enviarMutation.isPending}
                  />
                  <button
                    onClick={() => handleEnviar()}
                    disabled={!input.trim() || enviarMutation.isPending}
                    className="bg-green-700 hover:bg-green-800 text-white p-2.5 rounded-xl flex-shrink-0 disabled:opacity-50 transition-colors"
                  >
                    {enviarMutation.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Enter para enviar · Shift+Enter para nueva línea</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Burbuja de mensaje ───────────────────────────────────────────────────────

const ChatMessage = ({ mensaje }: { mensaje: Mensaje }) => {
  const isUser = mensaje.role === 'user'

  return (
    <div className={clsx('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      <div className={clsx(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        isUser ? 'bg-gray-200' : 'bg-green-700'
      )}>
        {isUser
          ? <User className="h-4 w-4 text-gray-600" />
          : <Bot className="h-4 w-4 text-white" />}
      </div>
      <div className={clsx(
        'max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
        isUser
          ? 'bg-green-700 text-white rounded-tr-none'
          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
      )}>
        {isUser ? (
          <div className="whitespace-pre-wrap">{mensaje.contenido}</div>
        ) : (
          <div className="max-w-none text-[14px] leading-relaxed
            [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
            [&_p]:my-2 [&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-2
            [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5
            [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5
            [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-green-200 [&_blockquote]:pl-3 [&_blockquote]:italic
            [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5
            [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-gray-900 [&_pre]:p-3 [&_pre]:text-gray-100
            [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse
            [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left
            [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {mensaje.contenido}
            </ReactMarkdown>
          </div>
        )}
        <div className={clsx('text-[11px] mt-2 flex items-center gap-2', isUser ? 'text-green-200' : 'text-gray-400')}>
          <span>{format(new Date(mensaje.created_at), 'HH:mm', { locale: es })}</span>
          {!isUser && (mensaje.tokens_usados ?? 0) > 0 && (
            <span>· {mensaje.tokens_usados?.toLocaleString('es-CO')} tokens</span>
          )}
          {!isUser && mensaje.latencia_ms && (
            <span>· {(mensaje.latencia_ms / 1000).toFixed(1)}s</span>
          )}
        </div>
      </div>
    </div>
  )
}
