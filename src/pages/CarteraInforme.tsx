import { useState, Fragment, type ReactNode } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine, ResponsiveContainer, Cell, Area,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import {
  Wallet,
  AlertTriangle, Clock, DollarSign, ChevronDown, ChevronRight,
  Calendar, MapPin, UserCheck, Search, ShieldAlert, CheckCircle,
} from 'lucide-react'
import {
  getCartera, getProximosVencimientos,
  getCarteraComerciales, getCarteraRegiones, getFacturas,
  type FiltroFecha,
} from '../api/dashboard'
import { Spinner } from '../components/ui/Spinner'
import { fmtCOP, fmtCOPShort, fmtPct } from '../utils/fmt'
import type {
  SnapCartera, Factura, ProximoVencimiento,
  CiudadAgregada, VendedorAgregado, RegionAgregada,
} from '../types'

// Aliases locales para uso conciso en este módulo
const fmt   = fmtCOP       // formato completo: $1.234.567
const fmtM  = fmtCOPShort  // abreviado: $1,2M / $234K

const PAGE_SIZE = 6
const totalPages = (items: number) => Math.max(1, Math.ceil(items / PAGE_SIZE))
const paginate = <T,>(items: T[], page: number) =>
  items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

const hoy = () => new Date().toISOString().slice(0, 10)

// ─── Pareto ───────────────────────────────────────────────────────────────────

interface ParetoItem {
  nombre: string
  deuda: number
  pct: number
  acumulado: number
  color: string
  esOtros: boolean
}

const NIVEL_COLOR: Record<string, string> = {
  critico: '#b91c1c', alto: '#ea580c', medio: '#ca8a04', ok: '#16a34a',
}

const buildPareto = (cartera: SnapCartera[]): ParetoItem[] => {
  const total = cartera.reduce((s, c) => s + c.total_deuda, 0)
  if (total === 0) return []

  // Ordenar de mayor a menor deuda
  const sorted = [...cartera].sort((a, b) => b.total_deuda - a.total_deuda)

  let acum = 0
  const items: ParetoItem[] = []
  let otrosTotal = 0
  let umbralAlcanzado = false

  for (const c of sorted) {
    const pct = (c.total_deuda / total) * 100

    if (!umbralAlcanzado) {
      acum += pct
      const nivel = (c.dias_91_180 + c.mas_180_dias) > 0 ? 'critico'
        : c.dias_61_90 > 0 ? 'alto'
        : c.dias_31_60 > 0 ? 'medio' : 'ok'
      const palabras = c.cliente_nombre.split(' ')
      const corto = palabras.slice(0, 2).join(' ')
      items.push({
        nombre: corto.length > 18 ? corto.slice(0, 17) + '…' : corto,
        deuda: c.total_deuda,
        pct: Math.round(pct),
        acumulado: Math.round(acum),
        color: NIVEL_COLOR[nivel],
        esOtros: false,
      })
      if (acum >= 80) umbralAlcanzado = true
    } else {
      otrosTotal += c.total_deuda
    }
  }

  // Barra "Otros" con el 20% restante
  if (otrosTotal > 0) {
    const pctOtros = (otrosTotal / total) * 100
    items.push({
      nombre: 'Otros',
      deuda: otrosTotal,
      pct: Math.round(pctOtros),
      acumulado: 100,
      color: '#94a3b8',
      esOtros: true,
    })
  }

  return items
}

// Tooltip personalizado del Pareto
const ParetoTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as ParetoItem
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm min-w-[200px]">
      <p className="font-bold text-gray-800 mb-1">{label}</p>
      <p className="text-slate-700">Deuda: <strong>{fmtCOPShort(d.deuda)}</strong></p>
      <p className="text-blue-600">% del total: <strong>{Math.round(d.pct)}%</strong></p>
      <p className="text-purple-700">Acumulado: <strong>{Math.round(d.acumulado)}%</strong></p>
    </div>
  )
}

const SeccionPareto = ({ cartera, totalCartera }: {
  cartera: SnapCartera[]
  totalCartera: number
}) => {
  const datos = buildPareto(cartera)
  const clientesOrdenados = [...cartera].sort((a, b) => b.total_deuda - a.total_deuda)
  const [pageParetoClientes, setPageParetoClientes] = useState(1)
  const paretoPages = totalPages(clientesOrdenados.length)
  const paretoItems = paginate(clientesOrdenados, Math.min(pageParetoClientes, paretoPages))
  if (datos.length === 0) return null

  // Clientes individuales que suman el 80% (excluye la barra "Otros")
  const clientesEn80 = datos.filter(d => !d.esOtros).length

  return (
    <section className="bg-white rounded-2xl shadow-sm p-7">
      <div className="flex items-start justify-between gap-4 mb-5">
        <h2 className="text-2xl font-extrabold text-gray-800">CONCENTRACIÓN DE CARTERA</h2>
        <div className="shrink-0 bg-[#eef2ff] border border-[#c7d2fe] rounded-xl px-4 py-2 text-center">
          <p className="text-xs text-[#1a1a2e] font-semibold uppercase tracking-wide">Regla 80/20</p>
          <p className="text-2xl font-extrabold text-[#1a1a2e]">{clientesEn80} clientes</p>
          <p className="text-sm text-[#1a1a2e]">concentran el <strong>80%</strong> de la deuda</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={datos} margin={{ top: 10, right: 50, left: 10, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />

          <XAxis
            dataKey="nombre"
            tick={{ fontSize: 16, fill: '#111827', fontWeight: 700 }}
            angle={-35}
            textAnchor="end"
            height={70}
            interval={0}
          />

          {/* Eje izquierdo: montos */}
          <YAxis
            yAxisId="left"
            tickFormatter={v => fmtCOPShort(v)}
            tick={{ fontSize: 16, fill: '#111827', fontWeight: 700 }}
            width={88}
          />

          {/* Eje derecho: porcentaje acumulado */}
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fontSize: 16, fill: '#111827', fontWeight: 700 }}
            width={62}
          />

          <RTooltip content={<ParetoTooltip />} />

          {/* Línea de referencia 80% */}
          <ReferenceLine
            yAxisId="right"
            y={80}
            stroke="#1a1a2e"
            strokeDasharray="6 3"
            strokeWidth={2.5}
            label={{ value: '80%', position: 'insideRight', fontSize: 14, fill: '#111827', fontWeight: 700 }}
          />

          {/* Barras coloreadas por nivel de riesgo */}
          <Bar yAxisId="left" dataKey="deuda" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {datos.map((d, i) => (
              <Cell key={i} fill={d.color} opacity={d.esOtros ? 0.6 : 1} />
            ))}
          </Bar>

          {/* Línea acumulada */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="acumulado"
            stroke="#1a1a2e"
            strokeWidth={3}
            dot={{ r: 4, fill: '#1a1a2e', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-5 mt-3 text-sm text-gray-900 font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm inline-block bg-[#b91c1c]" /> Crítico (+90d)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm inline-block bg-[#ea580c]" /> Alto (61-90d)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm inline-block bg-[#ca8a04]" /> Medio (31-60d)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm inline-block bg-[#16a34a]" /> Al día
        </span>
        <span className="flex items-center gap-1.5 ml-4 border-l border-gray-200 pl-4">
          <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="#1a1a2e" strokeWidth="2.5" /></svg>
          % acumulado (eje derecho)
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="24" height="6"><line x1="0" y1="3" x2="24" y2="3" stroke="#1a1a2e" strokeWidth="2" strokeDasharray="6 3" /></svg>
          Umbral 80%
        </span>
      </div>

      <div className="mt-7 border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-[#1a1a2e] text-white">
          <h3 className="text-lg font-extrabold">CLIENTES — DE MAYOR A MENOR DEUDA</h3>
          <p className="text-sm text-white/80">{clientesOrdenados.length} clientes ordenados por saldo total</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead className="bg-slate-100 text-slate-700 text-sm">
              <tr>
                <th className="px-4 py-3 text-left w-10">#</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Ciudad</th>
                <th className="px-4 py-3 text-left">Comercial</th>
                <th className="px-4 py-3 text-right">Total deuda</th>
                <th className="px-4 py-3 text-right">+90d</th>
                <th className="px-4 py-3 text-center">% participación</th>
              </tr>
            </thead>
            <tbody>
              {paretoItems.map((c, idx) => {
                const deudaCritica = c.dias_91_180 + c.mas_180_dias
                const participacion = totalCartera > 0 ? (c.total_deuda / totalCartera) * 100 : 0
                return (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-gray-400 font-mono text-sm">{(Math.min(pageParetoClientes, paretoPages) - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-900">{c.cliente_nombre}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">NIT {c.cliente_nit}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.ciudad || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{c.vendedor || '—'}</td>
                    <td className="px-4 py-3 text-right font-extrabold text-[#0f3460]">{fmtM(c.total_deuda)}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-800">{fmtM(deudaCritica)}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-700">{fmtPct(participacion, 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3">
          <PaginationControls
            page={Math.min(pageParetoClientes, paretoPages)}
            pages={paretoPages}
            onChange={setPageParetoClientes}
          />
        </div>
      </div>
    </section>
  )
}

// ─── Datos de muestra ─────────────────────────────────────────────────────────

const DEMO_DATE = '2026-04-06'

const MOCK_CARTERA: SnapCartera[] = [
  { id:'d1', fecha_corte:DEMO_DATE, cliente_nit:'890.905.177-3', cliente_nombre:'ESE HOSPITAL LA MARÍA', vigente:80_340_000, dias_1_30:48_500_000, dias_31_60:54_200_000, dias_61_90:71_400_000, dias_91_180:78_600_000, mas_180_dias:45_500_000, total_deuda:378_540_000, ciudad:'Medellín', vendedor:'Carlos Restrepo', linea:'Trauma', responsable_cobro:'Cartera', dias_mora_max:105, ultima_factura:'FV-00949', proxima_fecha_vencimiento:'2026-04-12', convenio:'P001', perfil_cliente:'Cliente Institucional' },
  { id:'d2', fecha_corte:DEMO_DATE, cliente_nit:'890.902.922-6', cliente_nombre:'FUNDACIÓN HOSPITALARIA SAN VICENTE DE PAUL', vigente:126_580_000, dias_1_30:50_800_000, dias_31_60:52_400_000, dias_61_90:45_800_000, dias_91_180:42_800_000, mas_180_dias:23_820_000, total_deuda:342_200_000, ciudad:'Medellín', vendedor:'Carlos Restrepo', linea:'Columna', responsable_cobro:'Cartera', dias_mora_max:97, ultima_factura:'FV-00951', proxima_fecha_vencimiento:'2026-04-15', convenio:'P001', perfil_cliente:'Cliente Institucional' },
  { id:'d3', fecha_corte:DEMO_DATE, cliente_nit:'899.999.031-2', cliente_nombre:'HOSPITAL SAN JUAN DE DIOS BOGOTÁ', vigente:75_400_000, dias_1_30:62_300_000, dias_31_60:58_100_000, dias_61_90:52_900_000, dias_91_180:63_400_000, mas_180_dias:0, total_deuda:312_100_000, ciudad:'Bogotá', vendedor:'Andrés Morales', linea:'Trauma', responsable_cobro:'Cartera', dias_mora_max:89, ultima_factura:'FV-00938', proxima_fecha_vencimiento:null, convenio:'P001', perfil_cliente:'Cliente Institucional' },
  { id:'d4', fecha_corte:DEMO_DATE, cliente_nit:'890.904.996-1', cliente_nombre:'CLÍNICA MEDELLÍN S.A.', vigente:100_330_000, dias_1_30:59_700_000, dias_31_60:74_600_000, dias_61_90:44_900_000, dias_91_180:19_300_000, mas_180_dias:0, total_deuda:298_830_000, ciudad:'Medellín', vendedor:'María González', linea:'Reemplazos', responsable_cobro:'Cartera', dias_mora_max:73, ultima_factura:'FV-00955', proxima_fecha_vencimiento:'2026-04-22', convenio:'', perfil_cliente:'Cliente General' },
  { id:'d5', fecha_corte:DEMO_DATE, cliente_nit:'891.480.027-9', cliente_nombre:'HOSPITAL UNIVERSITARIO DEL VALLE HUV', vigente:54_300_000, dias_1_30:38_200_000, dias_31_60:45_100_000, dias_61_90:47_300_000, dias_91_180:49_800_000, mas_180_dias:0, total_deuda:234_700_000, ciudad:'Cali', vendedor:'Laura Sánchez', linea:'Trauma', responsable_cobro:'Cartera', dias_mora_max:91, ultima_factura:'FV-00927', proxima_fecha_vencimiento:null, convenio:'P001', perfil_cliente:'Cliente Institucional' },
  { id:'d6', fecha_corte:DEMO_DATE, cliente_nit:'901.097.473-5', cliente_nombre:'ALIANZA MEDELLÍN ANTIOQUIA EPS S.A.S.', vigente:32_600_000, dias_1_30:21_200_000, dias_31_60:26_500_000, dias_61_90:66_300_000, dias_91_180:83_400_000, mas_180_dias:35_400_000, total_deuda:265_400_000, ciudad:'Medellín', vendedor:'María González', linea:'Columna', responsable_cobro:'Cartera', dias_mora_max:138, ultima_factura:'FV-00803', proxima_fecha_vencimiento:null, convenio:'P001', perfil_cliente:'Cliente Institucional' },
  { id:'d7', fecha_corte:DEMO_DATE, cliente_nit:'890.903.887-3', cliente_nombre:'CLÍNICA COUNTRY S.A.', vigente:62_400_000, dias_1_30:48_700_000, dias_31_60:67_800_000, dias_61_90:0, dias_91_180:0, mas_180_dias:0, total_deuda:178_900_000, ciudad:'Bogotá', vendedor:'Andrés Morales', linea:'Reemplazos', responsable_cobro:'Cartera', dias_mora_max:47, ultima_factura:'FV-00961', proxima_fecha_vencimiento:'2026-04-19', convenio:'', perfil_cliente:'Cliente General' },
  { id:'d8', fecha_corte:DEMO_DATE, cliente_nit:'890.100.979-0', cliente_nombre:'CLÍNICA GENERAL DEL NORTE', vigente:45_700_000, dias_1_30:42_300_000, dias_31_60:68_200_000, dias_61_90:0, dias_91_180:0, mas_180_dias:0, total_deuda:156_200_000, ciudad:'Barranquilla', vendedor:'María González', linea:'Trauma', responsable_cobro:'Cartera', dias_mora_max:52, ultima_factura:'FV-00943', proxima_fecha_vencimiento:'2026-04-24', convenio:'', perfil_cliente:'Cliente General' },
  { id:'d9', fecha_corte:DEMO_DATE, cliente_nit:'890.903.407-2', cliente_nombre:'HOSPITAL PABLO TOBÓN URIBE', vigente:54_800_000, dias_1_30:38_900_000, dias_31_60:47_200_000, dias_61_90:46_400_000, dias_91_180:0, mas_180_dias:0, total_deuda:187_300_000, ciudad:'Medellín', vendedor:'Carlos Restrepo', linea:'Columna', responsable_cobro:'Cartera', dias_mora_max:68, ultima_factura:'FV-00958', proxima_fecha_vencimiento:null, convenio:'IN05', perfil_cliente:'Distribuidor' },
  { id:'d10', fecha_corte:DEMO_DATE, cliente_nit:'891.180.893-8', cliente_nombre:'ESE HOSPITAL HERNANDO MONCALEANO PERDOMO', vigente:38_600_000, dias_1_30:28_400_000, dias_31_60:22_400_000, dias_61_90:0, dias_91_180:0, mas_180_dias:0, total_deuda:89_400_000, ciudad:'Neiva', vendedor:'Andrés Morales', linea:'Trauma', responsable_cobro:'Cartera', dias_mora_max:43, ultima_factura:'FV-00948', proxima_fecha_vencimiento:'2026-04-17', convenio:'', perfil_cliente:'Cliente General' },
  { id:'d11', fecha_corte:DEMO_DATE, cliente_nit:'900.141.071-8', cliente_nombre:'CLÍNICA SOMA S.A.S.', vigente:82_300_000, dias_1_30:43_100_000, dias_31_60:20_200_000, dias_61_90:0, dias_91_180:0, mas_180_dias:0, total_deuda:145_600_000, ciudad:'Medellín', vendedor:'Laura Sánchez', linea:'Reemplazos', responsable_cobro:'Cartera', dias_mora_max:38, ultima_factura:'FV-00963', proxima_fecha_vencimiento:null, convenio:'', perfil_cliente:'Cliente General' },
  { id:'d12', fecha_corte:DEMO_DATE, cliente_nit:'890.981.137-1', cliente_nombre:'CLÍNICA UNIVERSITARIA BOLIVARIANA', vigente:98_700_000, dias_1_30:24_700_000, dias_31_60:0, dias_61_90:0, dias_91_180:0, mas_180_dias:0, total_deuda:123_400_000, ciudad:'Medellín', vendedor:'Laura Sánchez', linea:'Trauma', responsable_cobro:'Cartera', dias_mora_max:24, ultima_factura:'FV-00965', proxima_fecha_vencimiento:null, convenio:'', perfil_cliente:'Cliente General' },
]

const MOCK_PROXIMOS: ProximoVencimiento[] = [
  { cliente:'ESE HOSPITAL LA MARÍA',                   cliente_nit:'890.905.177-3', num_doc:'FV-00949', fecha_vencimiento:'2026-04-12', saldo:80_340_000,  dias_para_vencer:6,  vendedor:'Carlos Restrepo' },
  { cliente:'ESE HOSPITAL HERNANDO MONCALEANO PERDOMO', cliente_nit:'891.180.893-8', num_doc:'FV-00948', fecha_vencimiento:'2026-04-17', saldo:28_400_000,  dias_para_vencer:11, vendedor:'Andrés Morales' },
  { cliente:'CLÍNICA COUNTRY S.A.',                    cliente_nit:'890.903.887-3', num_doc:'FV-00961', fecha_vencimiento:'2026-04-19', saldo:48_700_000,  dias_para_vencer:13, vendedor:'Andrés Morales' },
  { cliente:'FUNDACIÓN HOSP. SAN VICENTE DE PAUL',     cliente_nit:'890.902.922-6', num_doc:'FV-00951', fecha_vencimiento:'2026-04-22', saldo:50_800_000,  dias_para_vencer:16, vendedor:'Carlos Restrepo' },
  { cliente:'CLÍNICA MEDELLÍN S.A.',                   cliente_nit:'890.904.996-1', num_doc:'FV-00955', fecha_vencimiento:'2026-04-24', saldo:59_700_000,  dias_para_vencer:18, vendedor:'María González' },
  { cliente:'CLÍNICA GENERAL DEL NORTE',               cliente_nit:'890.100.979-0', num_doc:'FV-00943', fecha_vencimiento:'2026-04-24', saldo:42_300_000,  dias_para_vencer:18, vendedor:'María González' },
]

const _CIU_MED: CiudadAgregada = { ciudad:'Medellín', clientes_count:7, total_deuda:1_741_270_000, vigente:575_650_000, dias_1_30:287_000_000, dias_31_60:275_100_000, dias_61_90:274_800_000, dias_91_mas:328_820_000, total_vencida:1_165_720_000, porcentaje:64.2, clientes:[
  { cliente_nit:'890.905.177-3', cliente_nombre:'ESE HOSPITAL LA MARÍA',             total_deuda:378_540_000, vigente:80_340_000,  dias_91_180:78_600_000, mas_180_dias:45_500_000, dias_mora_max:105 },
  { cliente_nit:'890.902.922-6', cliente_nombre:'FUND. HOSP. SAN VICENTE DE PAUL',   total_deuda:342_200_000, vigente:126_580_000, dias_91_180:42_800_000, mas_180_dias:23_820_000, dias_mora_max:97  },
  { cliente_nit:'901.097.473-5', cliente_nombre:'ALIANZA MEDELLÍN ANTIOQUIA EPS',    total_deuda:265_400_000, vigente:32_600_000,  dias_91_180:83_400_000, mas_180_dias:35_400_000, dias_mora_max:138 },
  { cliente_nit:'890.904.996-1', cliente_nombre:'CLÍNICA MEDELLÍN S.A.',             total_deuda:298_830_000, vigente:100_330_000, dias_91_180:19_300_000, mas_180_dias:0,          dias_mora_max:73  },
  { cliente_nit:'890.903.407-2', cliente_nombre:'HOSPITAL PABLO TOBÓN URIBE',        total_deuda:187_300_000, vigente:54_800_000,  dias_91_180:0,          mas_180_dias:0,          dias_mora_max:68  },
  { cliente_nit:'900.141.071-8', cliente_nombre:'CLÍNICA SOMA S.A.S.',               total_deuda:145_600_000, vigente:82_300_000,  dias_91_180:0,          mas_180_dias:0,          dias_mora_max:38  },
  { cliente_nit:'890.981.137-1', cliente_nombre:'CLÍNICA UNIVERSITARIA BOLIVARIANA', total_deuda:123_400_000, vigente:98_700_000,  dias_91_180:0,          mas_180_dias:0,          dias_mora_max:24  },
]}

const MOCK_REGIONES_DATA = {
  fecha_corte: DEMO_DATE,
  total_general: 2_712_570_000,
  regiones: [
    { ranking:1, departamento:'Antioquia',        clientes_count:7, ciudades_count:1, total_deuda:1_741_270_000, vigente:575_650_000, dias_1_30:287_000_000, dias_31_60:275_100_000, dias_61_90:274_800_000, dias_91_mas:328_820_000, total_vencida:1_165_720_000, mora_90:328_820_000, porcentaje:64.2,
      ciudades:[_CIU_MED] },
    { ranking:2, departamento:'Bogotá D.C.',      clientes_count:2, ciudades_count:1, total_deuda:491_000_000,   vigente:137_800_000, dias_1_30:111_000_000, dias_31_60:125_900_000, dias_61_90:52_900_000,  dias_91_mas:63_400_000,  total_vencida:353_200_000,   mora_90:63_400_000,  porcentaje:18.1,
      ciudades:[{ ciudad:'Bogotá', clientes_count:2, total_deuda:491_000_000, vigente:137_800_000, dias_1_30:111_000_000, dias_31_60:125_900_000, dias_61_90:52_900_000, dias_91_mas:63_400_000, total_vencida:353_200_000, porcentaje:18.1, clientes:[
        { cliente_nit:'899.999.031-2', cliente_nombre:'HOSPITAL SAN JUAN DE DIOS BOGOTÁ', total_deuda:312_100_000, vigente:75_400_000, dias_91_180:63_400_000, mas_180_dias:0, dias_mora_max:89 },
        { cliente_nit:'890.903.887-3', cliente_nombre:'CLÍNICA COUNTRY S.A.',             total_deuda:178_900_000, vigente:62_400_000, dias_91_180:0,          mas_180_dias:0, dias_mora_max:47 },
      ]}] },
    { ranking:3, departamento:'Valle del Cauca',  clientes_count:1, ciudades_count:1, total_deuda:234_700_000,   vigente:54_300_000,  dias_1_30:38_200_000,  dias_31_60:45_100_000,  dias_61_90:47_300_000,  dias_91_mas:49_800_000,  total_vencida:180_400_000,   mora_90:49_800_000,  porcentaje:8.7,
      ciudades:[{ ciudad:'Cali', clientes_count:1, total_deuda:234_700_000, vigente:54_300_000, dias_1_30:38_200_000, dias_31_60:45_100_000, dias_61_90:47_300_000, dias_91_mas:49_800_000, total_vencida:180_400_000, porcentaje:8.7, clientes:[
        { cliente_nit:'891.480.027-9', cliente_nombre:'HOSPITAL UNIVERSITARIO DEL VALLE HUV', total_deuda:234_700_000, vigente:54_300_000, dias_91_180:49_800_000, mas_180_dias:0, dias_mora_max:91 },
      ]}] },
    { ranking:4, departamento:'Atlántico',        clientes_count:1, ciudades_count:1, total_deuda:156_200_000,   vigente:45_700_000,  dias_1_30:42_300_000,  dias_31_60:68_200_000,  dias_61_90:0,           dias_91_mas:0,           total_vencida:110_500_000,   mora_90:0,           porcentaje:5.8,
      ciudades:[{ ciudad:'Barranquilla', clientes_count:1, total_deuda:156_200_000, vigente:45_700_000, dias_1_30:42_300_000, dias_31_60:68_200_000, dias_61_90:0, dias_91_mas:0, total_vencida:110_500_000, porcentaje:5.8, clientes:[
        { cliente_nit:'890.100.979-0', cliente_nombre:'CLÍNICA GENERAL DEL NORTE', total_deuda:156_200_000, vigente:45_700_000, dias_91_180:0, mas_180_dias:0, dias_mora_max:52 },
      ]}] },
    { ranking:5, departamento:'Huila',            clientes_count:1, ciudades_count:1, total_deuda:89_400_000,    vigente:38_600_000,  dias_1_30:28_400_000,  dias_31_60:22_400_000,  dias_61_90:0,           dias_91_mas:0,           total_vencida:50_800_000,    mora_90:0,           porcentaje:3.3,
      ciudades:[{ ciudad:'Neiva', clientes_count:1, total_deuda:89_400_000, vigente:38_600_000, dias_1_30:28_400_000, dias_31_60:22_400_000, dias_61_90:0, dias_91_mas:0, total_vencida:50_800_000, porcentaje:3.3, clientes:[
        { cliente_nit:'891.180.893-8', cliente_nombre:'ESE HOSPITAL HERNANDO MONCALEANO PERDOMO', total_deuda:89_400_000, vigente:38_600_000, dias_91_180:0, mas_180_dias:0, dias_mora_max:43 },
      ]}] },
  ] as RegionAgregada[],
}

const MOCK_COMERCIALES_DATA = {
  fecha_corte: DEMO_DATE,
  total_general: 2_712_570_000,
  comerciales: [
    { vendedor:'Carlos Restrepo', clientes_count:3, total_deuda:908_040_000, vigente:261_520_000, dias_1_30:138_200_000, dias_31_60:163_800_000, dias_61_90:163_600_000, dias_91_mas:180_920_000, total_vencida:646_520_000, porcentaje:33.5, clientes:[
      { cliente_nit:'890.905.177-3', cliente_nombre:'ESE HOSPITAL LA MARÍA',           total_deuda:378_540_000, vigente:80_340_000,  dias_91_180:78_600_000, mas_180_dias:45_500_000, dias_mora_max:105, ciudad:'Medellín' },
      { cliente_nit:'890.902.922-6', cliente_nombre:'FUND. HOSP. SAN VICENTE DE PAUL', total_deuda:342_200_000, vigente:126_580_000, dias_91_180:42_800_000, mas_180_dias:23_820_000, dias_mora_max:97,  ciudad:'Medellín' },
      { cliente_nit:'890.903.407-2', cliente_nombre:'HOSPITAL PABLO TOBÓN URIBE',      total_deuda:187_300_000, vigente:54_800_000,  dias_91_180:0,          mas_180_dias:0,          dias_mora_max:68,  ciudad:'Medellín' },
    ]},
    { vendedor:'María González', clientes_count:3, total_deuda:720_430_000, vigente:178_630_000, dias_1_30:123_200_000, dias_31_60:169_300_000, dias_61_90:111_200_000, dias_91_mas:138_100_000, total_vencida:541_800_000, porcentaje:26.6, clientes:[
      { cliente_nit:'890.904.996-1', cliente_nombre:'CLÍNICA MEDELLÍN S.A.',      total_deuda:298_830_000, vigente:100_330_000, dias_91_180:19_300_000, mas_180_dias:0,          dias_mora_max:73,  ciudad:'Medellín'     },
      { cliente_nit:'901.097.473-5', cliente_nombre:'ALIANZA MEDELLÍN ANTIOQUIA', total_deuda:265_400_000, vigente:32_600_000,  dias_91_180:83_400_000, mas_180_dias:35_400_000, dias_mora_max:138, ciudad:'Medellín'     },
      { cliente_nit:'890.100.979-0', cliente_nombre:'CLÍNICA GENERAL DEL NORTE',  total_deuda:156_200_000, vigente:45_700_000,  dias_91_180:0,          mas_180_dias:0,          dias_mora_max:52,  ciudad:'Barranquilla' },
    ]},
    { vendedor:'Andrés Morales', clientes_count:3, total_deuda:580_400_000, vigente:152_600_000, dias_1_30:119_100_000, dias_31_60:108_900_000, dias_61_90:52_900_000, dias_91_mas:63_400_000, total_vencida:344_300_000, porcentaje:21.4, clientes:[
      { cliente_nit:'899.999.031-2', cliente_nombre:'HOSPITAL SAN JUAN DE DIOS BOGOTÁ',        total_deuda:312_100_000, vigente:75_400_000, dias_91_180:63_400_000, mas_180_dias:0, dias_mora_max:89, ciudad:'Bogotá' },
      { cliente_nit:'890.903.887-3', cliente_nombre:'CLÍNICA COUNTRY S.A.',                     total_deuda:178_900_000, vigente:62_400_000, dias_91_180:0,          mas_180_dias:0, dias_mora_max:47, ciudad:'Bogotá' },
      { cliente_nit:'891.180.893-8', cliente_nombre:'ESE HOSPITAL HERNANDO MONCALEANO PERDOMO', total_deuda:89_400_000,  vigente:38_600_000, dias_91_180:0,          mas_180_dias:0, dias_mora_max:43, ciudad:'Neiva'  },
    ]},
    { vendedor:'Laura Sánchez', clientes_count:3, total_deuda:503_700_000, vigente:235_300_000, dias_1_30:110_200_000, dias_31_60:67_300_000, dias_61_90:47_300_000, dias_91_mas:49_800_000, total_vencida:274_600_000, porcentaje:18.6, clientes:[
      { cliente_nit:'891.480.027-9', cliente_nombre:'HOSPITAL UNIVERSITARIO DEL VALLE HUV', total_deuda:234_700_000, vigente:54_300_000,  dias_91_180:49_800_000, mas_180_dias:0, dias_mora_max:91, ciudad:'Cali'     },
      { cliente_nit:'900.141.071-8', cliente_nombre:'CLÍNICA SOMA S.A.S.',                  total_deuda:145_600_000, vigente:82_300_000,  dias_91_180:0,          mas_180_dias:0, dias_mora_max:38, ciudad:'Medellín' },
      { cliente_nit:'890.981.137-1', cliente_nombre:'CLÍNICA UNIVERSITARIA BOLIVARIANA',    total_deuda:123_400_000, vigente:98_700_000,  dias_91_180:0,          mas_180_dias:0, dias_mora_max:24, ciudad:'Medellín' },
    ]},
  ] as VendedorAgregado[],
}

const MOCK_FACTURAS: Record<string, Factura[]> = {
  '890.905.177-3': [
    { num_doc:'FV-00782', fecha_emision:'2025-08-24', fecha_vencimiento:'2025-10-23', dias_vencida:165, saldo:45_500_000 },
    { num_doc:'FV-00836', fecha_emision:'2025-10-07', fecha_vencimiento:'2025-12-06', dias_vencida:121, saldo:78_600_000 },
    { num_doc:'FV-00856', fecha_emision:'2025-11-22', fecha_vencimiento:'2026-01-21', dias_vencida:75,  saldo:71_400_000 },
    { num_doc:'FV-00889', fecha_emision:'2025-12-21', fecha_vencimiento:'2026-02-19', dias_vencida:46,  saldo:54_200_000 },
    { num_doc:'FV-00921', fecha_emision:'2026-01-08', fecha_vencimiento:'2026-03-09', dias_vencida:28,  saldo:48_500_000 },
    { num_doc:'FV-00949', fecha_emision:'2026-02-11', fecha_vencimiento:'2026-04-12', dias_vencida:-6,  saldo:80_340_000 },
  ],
  '890.902.922-6': [
    { num_doc:'FV-00798', fecha_emision:'2025-08-14', fecha_vencimiento:'2025-10-13', dias_vencida:175, saldo:23_820_000 },
    { num_doc:'FV-00829', fecha_emision:'2025-10-28', fecha_vencimiento:'2025-12-27', dias_vencida:100, saldo:42_800_000 },
    { num_doc:'FV-00878', fecha_emision:'2025-11-22', fecha_vencimiento:'2026-01-21', dias_vencida:75,  saldo:45_800_000 },
    { num_doc:'FV-00902', fecha_emision:'2025-12-21', fecha_vencimiento:'2026-02-19', dias_vencida:46,  saldo:52_400_000 },
    { num_doc:'FV-00925', fecha_emision:'2026-01-12', fecha_vencimiento:'2026-03-13', dias_vencida:24,  saldo:50_800_000 },
    { num_doc:'FV-00951', fecha_emision:'2026-02-14', fecha_vencimiento:'2026-04-15', dias_vencida:-9,  saldo:126_580_000 },
  ],
  '899.999.031-2': [
    { num_doc:'FV-00831', fecha_emision:'2025-10-07', fecha_vencimiento:'2025-12-06', dias_vencida:121, saldo:63_400_000 },
    { num_doc:'FV-00872', fecha_emision:'2025-11-22', fecha_vencimiento:'2026-01-21', dias_vencida:75,  saldo:52_900_000 },
    { num_doc:'FV-00899', fecha_emision:'2025-12-22', fecha_vencimiento:'2026-02-20', dias_vencida:45,  saldo:58_100_000 },
    { num_doc:'FV-00938', fecha_emision:'2026-01-15', fecha_vencimiento:'2026-03-16', dias_vencida:21,  saldo:62_300_000 },
    { num_doc:'FV-00962', fecha_emision:'2026-02-19', fecha_vencimiento:'2026-04-20', dias_vencida:-14, saldo:75_400_000 },
  ],
  '890.904.996-1': [
    { num_doc:'FV-00848', fecha_emision:'2025-10-28', fecha_vencimiento:'2025-12-27', dias_vencida:100, saldo:19_300_000 },
    { num_doc:'FV-00885', fecha_emision:'2025-12-02', fecha_vencimiento:'2026-01-31', dias_vencida:65,  saldo:44_900_000 },
    { num_doc:'FV-00910', fecha_emision:'2025-12-27', fecha_vencimiento:'2026-02-25', dias_vencida:40,  saldo:74_600_000 },
    { num_doc:'FV-00929', fecha_emision:'2026-01-20', fecha_vencimiento:'2026-03-21', dias_vencida:16,  saldo:59_700_000 },
    { num_doc:'FV-00955', fecha_emision:'2026-02-21', fecha_vencimiento:'2026-04-22', dias_vencida:-16, saldo:100_330_000 },
  ],
  '891.480.027-9': [
    { num_doc:'FV-00839', fecha_emision:'2025-10-21', fecha_vencimiento:'2025-12-20', dias_vencida:107, saldo:49_800_000 },
    { num_doc:'FV-00876', fecha_emision:'2025-11-22', fecha_vencimiento:'2026-01-21', dias_vencida:75,  saldo:47_300_000 },
    { num_doc:'FV-00903', fecha_emision:'2025-12-22', fecha_vencimiento:'2026-02-20', dias_vencida:45,  saldo:45_100_000 },
    { num_doc:'FV-00927', fecha_emision:'2026-01-19', fecha_vencimiento:'2026-03-20', dias_vencida:17,  saldo:38_200_000 },
    { num_doc:'FV-00957', fecha_emision:'2026-02-22', fecha_vencimiento:'2026-04-23', dias_vencida:-17, saldo:54_300_000 },
  ],
  '901.097.473-5': [
    { num_doc:'FV-00762', fecha_emision:'2025-08-07', fecha_vencimiento:'2025-10-06', dias_vencida:182, saldo:35_400_000 },
    { num_doc:'FV-00793', fecha_emision:'2025-10-14', fecha_vencimiento:'2025-12-13', dias_vencida:114, saldo:83_400_000 },
    { num_doc:'FV-00821', fecha_emision:'2025-12-02', fecha_vencimiento:'2026-01-31', dias_vencida:65,  saldo:66_300_000 },
    { num_doc:'FV-00854', fecha_emision:'2025-12-27', fecha_vencimiento:'2026-02-25', dias_vencida:40,  saldo:26_500_000 },
    { num_doc:'FV-00897', fecha_emision:'2026-01-20', fecha_vencimiento:'2026-03-21', dias_vencida:16,  saldo:21_200_000 },
    { num_doc:'FV-00930', fecha_emision:'2026-02-15', fecha_vencimiento:'2026-04-16', dias_vencida:-10, saldo:32_600_000 },
  ],
  '890.903.887-3': [
    { num_doc:'FV-00897', fecha_emision:'2025-12-22', fecha_vencimiento:'2026-02-20', dias_vencida:45,  saldo:67_800_000 },
    { num_doc:'FV-00924', fecha_emision:'2026-01-19', fecha_vencimiento:'2026-03-20', dias_vencida:17,  saldo:48_700_000 },
    { num_doc:'FV-00961', fecha_emision:'2026-02-18', fecha_vencimiento:'2026-04-19', dias_vencida:-13, saldo:62_400_000 },
  ],
  '890.100.979-0': [
    { num_doc:'FV-00906', fecha_emision:'2025-12-21', fecha_vencimiento:'2026-02-19', dias_vencida:46,  saldo:68_200_000 },
    { num_doc:'FV-00943', fecha_emision:'2026-01-25', fecha_vencimiento:'2026-03-26', dias_vencida:11,  saldo:42_300_000 },
    { num_doc:'FV-00964', fecha_emision:'2026-02-23', fecha_vencimiento:'2026-04-24', dias_vencida:-18, saldo:45_700_000 },
  ],
  '890.903.407-2': [
    { num_doc:'FV-00879', fecha_emision:'2025-12-02', fecha_vencimiento:'2026-01-31', dias_vencida:65,  saldo:46_400_000 },
    { num_doc:'FV-00908', fecha_emision:'2025-12-27', fecha_vencimiento:'2026-02-25', dias_vencida:40,  saldo:47_200_000 },
    { num_doc:'FV-00933', fecha_emision:'2026-01-25', fecha_vencimiento:'2026-03-26', dias_vencida:11,  saldo:38_900_000 },
    { num_doc:'FV-00958', fecha_emision:'2026-02-22', fecha_vencimiento:'2026-04-23', dias_vencida:-17, saldo:54_800_000 },
  ],
  '891.180.893-8': [
    { num_doc:'FV-00916', fecha_emision:'2025-12-22', fecha_vencimiento:'2026-02-20', dias_vencida:45,  saldo:22_400_000 },
    { num_doc:'FV-00948', fecha_emision:'2026-01-26', fecha_vencimiento:'2026-03-27', dias_vencida:10,  saldo:28_400_000 },
    { num_doc:'FV-00966', fecha_emision:'2026-02-17', fecha_vencimiento:'2026-04-18', dias_vencida:-12, saldo:38_600_000 },
  ],
  '900.141.071-8': [
    { num_doc:'FV-00918', fecha_emision:'2025-12-22', fecha_vencimiento:'2026-02-20', dias_vencida:45,  saldo:20_200_000 },
    { num_doc:'FV-00946', fecha_emision:'2026-01-25', fecha_vencimiento:'2026-03-26', dias_vencida:11,  saldo:43_100_000 },
    { num_doc:'FV-00963', fecha_emision:'2026-02-26', fecha_vencimiento:'2026-04-27', dias_vencida:-21, saldo:82_300_000 },
  ],
  '890.981.137-1': [
    { num_doc:'FV-00952', fecha_emision:'2026-01-21', fecha_vencimiento:'2026-03-22', dias_vencida:15,  saldo:24_700_000 },
    { num_doc:'FV-00965', fecha_emision:'2026-02-28', fecha_vencimiento:'2026-04-29', dias_vencida:-23, saldo:98_700_000 },
  ],
}

// ─── Facturas de muestra (modo demo) ─────────────────────────────────────────

const FilaFacturasMock = ({ nit, cols }: { nit: string; cols: number }) => {
  const facturas = MOCK_FACTURAS[nit] ?? []
  const totalSaldo = facturas.reduce((s, f) => s + f.saldo, 0)
  const vencidas   = facturas.filter(f => f.dias_vencida > 0)
  const porVencer  = facturas.filter(f => f.dias_vencida <= 0)

  return (
    <tr>
      <td colSpan={cols} className="px-4 py-2">
        <div className="bg-slate-50 border border-slate-200 rounded-xl mx-8 mb-3 overflow-hidden">
          <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
            <span className="font-bold text-slate-700 text-sm">FACTURAS PENDIENTES — DE LA MÁS ANTIGUA A LA MÁS RECIENTE</span>
            <span className="text-xs text-slate-500">{facturas.length} facturas · Total: <strong className="text-slate-700">{fmt(totalSaldo)}</strong></span>
          </div>
          {facturas.length === 0 && <p className="px-5 py-4 text-sm text-gray-400">Sin facturas pendientes.</p>}
          {vencidas.length > 0 && (<>
            <div className="px-5 py-1.5 bg-red-50 border-b border-red-100">
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">Facturas vencidas ({vencidas.length})</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-200 text-slate-700">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Documento</th>
                  <th className="px-4 py-2 text-left font-semibold">Emisión</th>
                  <th className="px-4 py-2 text-left font-semibold">Vencimiento</th>
                  <th className="px-4 py-2 text-left font-semibold">Antigüedad</th>
                  <th className="px-4 py-2 text-right font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {vencidas.map((f, i) => {
                  const cls = f.dias_vencida > 120 ? 'text-red-900 font-extrabold' : f.dias_vencida > 90 ? 'text-red-800 font-bold' : f.dias_vencida > 60 ? 'text-red-600 font-semibold' : f.dias_vencida > 30 ? 'text-orange-600 font-semibold' : 'text-yellow-700'
                  const bgCls = f.dias_vencida > 90 ? 'bg-red-50' : f.dias_vencida > 60 ? 'bg-orange-50' : f.dias_vencida > 30 ? 'bg-yellow-50' : 'bg-white'
                  return (
                    <tr key={i} className={`border-t border-slate-200 hover:brightness-95 ${bgCls}`}>
                      <td className="px-4 py-2.5 font-mono text-sm font-semibold text-slate-700">{f.num_doc}</td>
                      <td className="px-4 py-2.5 text-slate-500">{f.fecha_emision}</td>
                      <td className="px-4 py-2.5 text-slate-500">{f.fecha_vencimiento}</td>
                      <td className={`px-4 py-2.5 ${cls}`}>Vencida hace {f.dias_vencida} día{f.dias_vencida !== 1 ? 's' : ''}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-800">{fmt(f.saldo)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>)}
          {porVencer.length > 0 && (<>
            <div className="px-5 py-1.5 bg-amber-50 border-t border-b border-amber-200">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Próximas a vencer ({porVencer.length})</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-amber-100 text-amber-800">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Documento</th>
                  <th className="px-4 py-2 text-left font-semibold">Emisión</th>
                  <th className="px-4 py-2 text-left font-semibold">Vencimiento</th>
                  <th className="px-4 py-2 text-left font-semibold">Tiempo restante</th>
                  <th className="px-4 py-2 text-right font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {porVencer.map((f, i) => {
                  const dias = Math.abs(f.dias_vencida)
                  return (
                    <tr key={i} className="border-t border-amber-200 bg-amber-50 hover:bg-amber-100">
                      <td className="px-4 py-2.5 font-mono text-sm font-semibold text-amber-900">{f.num_doc}</td>
                      <td className="px-4 py-2.5 text-amber-700">{f.fecha_emision}</td>
                      <td className="px-4 py-2.5 text-amber-700">{f.fecha_vencimiento}</td>
                      <td className="px-4 py-2.5 text-amber-800 font-semibold">Vence en {dias} día{dias !== 1 ? 's' : ''}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-amber-900">{fmt(f.saldo)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>)}
          <div className="bg-slate-100 border-t-2 border-slate-300 px-5 py-2 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-600">Total vencido: <span className="text-red-700">{fmt(vencidas.reduce((s,f)=>s+f.saldo,0))}</span></span>
            <span className="text-sm font-bold text-slate-700">Total: {fmt(totalSaldo)}</span>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─── Riesgo ────────────────────────────────────────────────────────────────────

const nivelRiesgo = (c: Pick<SnapCartera, 'dias_91_180' | 'mas_180_dias' | 'dias_61_90' | 'dias_31_60'>) => {
  if (c.dias_91_180 + c.mas_180_dias > 0) return 'critico'
  if (c.dias_61_90 > 0)                   return 'alto'
  if (c.dias_31_60 > 0)                   return 'medio'
  return 'ok'
}

const badgeCls = (nivel: string) => ({
  critico: 'bg-red-100 text-red-800 border border-red-300',
  alto:    'bg-orange-100 text-orange-800 border border-orange-300',
  medio:   'bg-yellow-100 text-yellow-800 border border-yellow-300',
  ok:      'bg-green-100 text-green-800 border border-green-300',
}[nivel] ?? 'bg-gray-100 text-gray-600 border border-gray-300')

const rowBgCls = (nivel: string) => ({
  critico: 'bg-red-50',
  alto:    'bg-orange-50',
  medio:   'bg-yellow-50',
  ok:      'bg-white',
}[nivel] ?? 'bg-white')

// ─── Facturas expandidas de un cliente ────────────────────────────────────────

const FilaFacturas = ({ nit, cols, filtro }: { nit: string; cols: number; filtro?: FiltroFecha }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['facturas', nit, filtro],
    queryFn: () => getFacturas(nit, filtro),
    staleTime: 5 * 60 * 1000,
  })
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-2">
        <div className="bg-slate-50 border border-slate-200 rounded-xl mx-8 mb-3 overflow-hidden">
          {isLoading && (
            <div className="flex items-center gap-2 px-5 py-4 text-base text-gray-500">
              <Spinner className="h-5 w-5" /> Cargando facturas…
            </div>
          )}
          {error && <p className="px-5 py-4 text-base text-red-500">Error al cargar facturas.</p>}
          {data?.facturas.length === 0 && (
            <p className="px-5 py-4 text-base text-gray-400">Sin facturas en el período consultado.</p>
          )}
          {data && data.facturas.length > 0 && (
            <>
            <div className="px-5 py-3 bg-slate-100 font-bold text-slate-700 text-base border-b border-slate-200">
              FACTURAS PENDIENTES — DE LA MÁS ANTIGUA A LA MÁS RECIENTE
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-200 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Documento</th>
                  <th className="px-4 py-3 text-left font-semibold">Emisión</th>
                  <th className="px-4 py-3 text-left font-semibold">Vencimiento</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {data.facturas.map((f: Factura, i: number) => {
                  const dv = f.dias_vencida
                  const cls =
                    dv > 90 ? 'text-red-900 font-bold' :
                    dv > 60 ? 'text-red-600' :
                    dv > 30 ? 'text-orange-600' :
                    dv > 0  ? 'text-yellow-700' : 'text-green-600'
                  const lbl =
                    dv > 0  ? `Vencida hace ${dv}d` :
                    dv === 0 ? 'Vence hoy' : `Vence en ${-dv}d`
                  return (
                    <tr key={i} className="border-t border-slate-200 hover:bg-white">
                      <td className="px-4 py-2 font-mono text-sm">{f.num_doc}</td>
                      <td className="px-4 py-2 text-gray-600">{f.fecha_emision}</td>
                      <td className="px-4 py-2 text-gray-600">{f.fecha_vencimiento}</td>
                      <td className={`px-4 py-2 font-semibold ${cls}`}>{lbl}</td>
                      <td className="px-4 py-2 text-right font-bold text-[#0f3460]">{fmt(f.saldo)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="px-4 py-2 font-bold text-slate-700">
                    {data.facturas.length} facturas
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-slate-700">
                    {fmt(data.facturas.reduce((s, f) => s + f.saldo, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Facturas de muestra (modo demo) ─────────────────────────────────────────

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KPICard = ({
  label, value, sub, gradient, icon,
}: { label: string; value: string; sub: string; gradient: string; icon: ReactNode }) => (
  <div className={`bg-gradient-to-br ${gradient} text-white rounded-2xl p-6 shadow-lg`}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-base font-medium opacity-90 mb-2 uppercase tracking-wide">{label}</p>
        <p className="text-4xl font-extrabold mb-1 leading-tight">{value}</p>
        <p className="text-sm opacity-80">{sub}</p>
      </div>
      <div className="opacity-15 ml-3">{icon}</div>
    </div>
  </div>
)

// ─── Encabezado de sección ────────────────────────────────────────────────────

type SectionColor = 'blue' | 'orange' | 'purple' | 'teal' | 'indigo'

const SECTION_COLORS: Record<SectionColor, { border: string; bg: string; text: string }> = {
  blue:   { border: 'border-blue-400',   bg: 'bg-blue-100',   text: 'text-blue-700'   },
  orange: { border: 'border-orange-400', bg: 'bg-orange-100', text: 'text-orange-700' },
  purple: { border: 'border-purple-400', bg: 'bg-purple-100', text: 'text-purple-700' },
  teal:   { border: 'border-teal-400',   bg: 'bg-teal-100',   text: 'text-teal-700'   },
  indigo: { border: 'border-indigo-400', bg: 'bg-indigo-100', text: 'text-indigo-700' },
}

const SectionHeader = ({ icon, title, count, color }: {
  icon: ReactNode; title: string; count?: string | number; color: SectionColor
}) => {
  const c = SECTION_COLORS[color]
  return (
    <div className={`flex items-center gap-3 mb-5 pb-3 border-b-4 ${c.border}`}>
      <div className={`p-2 ${c.bg} rounded-xl ${c.text}`}>{icon}</div>
      <h2 className="text-2xl font-extrabold text-gray-800">{title}</h2>
      {count !== undefined && (
        <span className={`ml-auto text-sm font-bold ${c.text} ${c.bg} px-3 py-1 rounded-full`}>
          {count}
        </span>
      )}
    </div>
  )
}

const PaginationControls = ({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (page: number) => void
}) => {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2 mt-4">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 disabled:opacity-40"
      >
        Anterior
      </button>
      <span className="text-sm font-semibold text-gray-600">
        Página {page} de {pages}
      </span>
      <button
        onClick={() => onChange(Math.min(pages, page + 1))}
        disabled={page >= pages}
        className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 disabled:opacity-40"
      >
        Siguiente
      </button>
    </div>
  )
}

// ─── Indicador de días para vencer ───────────────────────────────────────────

const PillDias = ({ dias }: { dias: number }) => {
  const cls =
    dias <= 5  ? 'bg-red-100 text-red-900 font-extrabold border border-red-400' :
    dias <= 10 ? 'bg-orange-100 text-orange-900 font-bold border border-orange-300' :
    dias <= 15 ? 'bg-yellow-100 text-yellow-900 font-semibold border border-yellow-300' :
                 'bg-gray-100 text-gray-700 border border-gray-300'
  return <span className={`px-3 py-1 rounded-full text-sm ${cls}`}>{dias}d</span>
}

// ─── Búsqueda helper ─────────────────────────────────────────────────────────

const BuscarInput = ({ value, onChange, placeholder = 'Buscar por nombre o NIT...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) => (
  <div className="relative mb-4 max-w-sm">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
      >×</button>
    )}
  </div>
)

const filtrarPorBusqueda = <T extends { cliente_nit?: string; cliente_nombre?: string; nombre?: string; nit?: string }>(
  items: T[], q: string
): T[] => {
  if (!q.trim()) return items
  const lq = q.toLowerCase()
  return items.filter(x =>
    (x.cliente_nombre ?? x.nombre ?? '').toLowerCase().includes(lq) ||
    (x.cliente_nit   ?? x.nit   ?? '').toLowerCase().includes(lq)
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export const CarteraInforme = () => {
  const [hastaInput, setHastaInput] = useState(hoy())
  const [filtro, setFiltro] = useState<FiltroFecha>({})

  const [expClientes,        setExpClientes]        = useState<Set<string>>(new Set())
  const [expRegiones,        setExpRegiones]        = useState<Set<string>>(new Set())
  const [expRegionesCiudades,setExpRegionesCiudades]= useState<Set<string>>(new Set())
  const [expComerciales,     setExpComerciales]     = useState<Set<string>>(new Set())
  const [filtroRiesgo,       setFiltroRiesgo]       = useState<string>('todos')
  const [pageCarteraEdades,  setPageCarteraEdades]  = useState(1)
  const [pageProximos,       setPageProximos]       = useState(1)
  const [pageRegiones,       setPageRegiones]       = useState(1)
  const [pageComerciales,    setPageComerciales]    = useState(1)
  // Búsqueda por sección
  const [busEdades,      setBusEdades]      = useState('')
  const [busRegiones,    setBusRegiones]    = useState('')
  const [busComerciales, setBusComerciales] = useState('')

  const carteraQ  = useQuery({ queryKey: ['cartera', filtro],     queryFn: () => getCartera(filtro) })
  const proximosQ = useQuery({ queryKey: ['proximos'],             queryFn: getProximosVencimientos })
  const regionesQ = useQuery({ queryKey: ['regiones', filtro],    queryFn: () => getCarteraRegiones(filtro) })
  const comercQ   = useQuery({ queryKey: ['comerciales', filtro], queryFn: () => getCarteraComerciales(filtro) })

  const toggleSet = (set: Set<string>, key: string) => {
    const s = new Set(set)
    s.has(key) ? s.delete(key) : s.add(key)
    return s
  }

  const aplicarFiltro = () => {
    const f: FiltroFecha = {}
    if (hastaInput) f.fecha_hasta = hastaInput
    setFiltro(f)
    setExpClientes(new Set())
    setExpRegiones(new Set())
    setExpRegionesCiudades(new Set())
    setExpComerciales(new Set())
    setPageCarteraEdades(1)
    setPageProximos(1)
    setPageRegiones(1)
    setPageComerciales(1)
    setBusEdades(''); setBusRegiones(''); setBusComerciales('')
  }

  // Solo datos reales
  const cartera    = carteraQ.data ?? []
  const proximos   = proximosQ.data?.proximos_vencimientos ?? []
  const regiones   = regionesQ.data?.regiones ?? []
  const comerciales= comercQ.data?.comerciales ?? []

  // KPIs
  const totalCartera = cartera.reduce((s, c) => s + c.total_deuda, 0)
  const totalVencida = cartera.reduce((s, c) => s + c.dias_1_30 + c.dias_31_60 + c.dias_61_90 + c.dias_91_180 + c.mas_180_dias, 0)
  const totalVigente = cartera.reduce((s, c) => s + c.vigente, 0)
  const criticos90   = cartera.reduce((s, c) => s + c.dias_91_180 + c.mas_180_dias, 0)
  const nCriticos    = cartera.filter(c => c.dias_91_180 + c.mas_180_dias > 0).length
  const fechaCorte = cartera[0]?.fecha_corte ?? null

  // Cartera por edades — con búsqueda y filtro riesgo
  const carteraFiltradaRiesgo = cartera.filter(c => filtroRiesgo === 'todos' || nivelRiesgo(c) === filtroRiesgo)
  const carteraFiltrada = filtrarPorBusqueda(carteraFiltradaRiesgo, busEdades)
  const carteraEdadesPages = totalPages(carteraFiltrada.length)
  const carteraEdadesPageItems = paginate(carteraFiltrada, Math.min(pageCarteraEdades, carteraEdadesPages))

  // Proximos
  const proximosPages = totalPages(proximos.length)
  const proximosPageItems = paginate(proximos, Math.min(pageProximos, proximosPages))

  // Regiones — con búsqueda por departamento
  const regionesFiltradas = busRegiones.trim()
    ? regiones.filter(r => r.departamento.toLowerCase().includes(busRegiones.toLowerCase()))
    : regiones
  const regionesPages = totalPages(regionesFiltradas.length)
  const regionesPageItems = paginate(regionesFiltradas, Math.min(pageRegiones, regionesPages))

  // Comerciales — con búsqueda por nombre
  const comercialesFiltrados = busComerciales.trim()
    ? comerciales.filter(c => c.vendedor.toLowerCase().includes(busComerciales.toLowerCase()))
    : comerciales
  const comercialesPages = totalPages(comercialesFiltrados.length)
  const comercialesPageItems = paginate(comercialesFiltrados, Math.min(pageComerciales, comercialesPages))

  const cargando = carteraQ.isLoading || proximosQ.isLoading || regionesQ.isLoading || comercQ.isLoading
  const dataError =
    (carteraQ.error as AxiosError<{ message?: string; error?: string }>) ||
    (proximosQ.error as AxiosError<{ message?: string; error?: string }>) ||
    (regionesQ.error as AxiosError<{ message?: string; error?: string }>) ||
    (comercQ.error as AxiosError<{ message?: string; error?: string }>)
  const errorMsg =
    dataError?.response?.data?.message ||
    dataError?.response?.data?.error ||
    (dataError ? 'No se pudo consultar la data real de Saint.' : null)

  return (
    <div className="min-h-screen bg-[#f4f6fa]">

      {/* ── HEADER PEGAJOSO ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-primary-950 text-white shadow-lg border-b border-primary-800">
        <div className="px-6 lg:px-10 py-4 flex flex-wrap items-center gap-4">

          {/* Título */}
          <div className="min-w-[200px]">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
              Informe de Cartera — Grupo RP
            </h1>
            {fechaCorte && (
                <span className="text-xs text-white/60 mt-0.5 block">
                  Corte: {fechaCorte}
                </span>
              )}
          </div>

          {/* Filtro de fecha de corte */}
          <div className="flex flex-wrap items-center gap-2 bg-white/8 border border-white/15 px-4 py-2 rounded-xl ml-auto">
            <Calendar className="h-4 w-4 opacity-60 shrink-0" />
            <label className="text-sm opacity-80">Fecha de corte</label>
            <input
              type="date" value={hastaInput}
              onChange={e => setHastaInput(e.target.value)}
              className="bg-white/15 text-white text-sm px-2.5 py-1.5 rounded-lg border border-white/25 focus:outline-none focus:ring-1 focus:ring-white/40 w-36"
            />
            <button
              onClick={aplicarFiltro}
              className="flex items-center gap-1.5 bg-white text-slate-800 font-bold px-4 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              <Search className="h-4 w-4" /> Buscar
            </button>
          </div>

          <div className="text-xs text-white/70 ml-2">
            Datos en línea
          </div>
        </div>
      </div>

      {cargando && (
        <div className="px-6 lg:px-10 pt-6">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 flex items-center gap-2">
            <Spinner className="h-4 w-4" /> Consultando datos...
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="px-6 lg:px-10 pt-6">
          <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 text-sm text-red-800">
            <p className="font-bold">Error consultando cartera</p>
            <p className="mt-1">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 px-6 lg:px-10 py-6">
        <KPICard label="Cartera Total"
          value={fmtM(totalCartera)}
          sub={`${cartera.length} clientes activos`}
          gradient="from-slate-700 to-slate-900"
          icon={<DollarSign className="h-20 w-20" />} />
        <KPICard label="Cartera Vencida"
          value={fmtM(totalVencida)}
          sub={`${totalCartera > 0 ? fmtPct((totalVencida/totalCartera)*100) : '0%'} del total`}
          gradient="from-red-700 to-red-900"
          icon={<AlertTriangle className="h-20 w-20" />} />
        <KPICard label="Mora +90 Días"
          value={fmtM(criticos90)}
          sub={`${nCriticos} cliente${nCriticos !== 1 ? 's' : ''} en mora crítica`}
          gradient="from-rose-800 to-rose-950"
          icon={<ShieldAlert className="h-20 w-20" />} />
      </div>



      {/* Alerta crítica — oculta por ahora */}

      {cartera.length > 0 && (
        <div className="space-y-10 px-6 lg:px-10 pb-16">

          {/* ══════════════════════════════════════════════════════════════
              PARETO
          ══════════════════════════════════════════════════════════════ */}
          <SeccionPareto cartera={cartera} totalCartera={totalCartera} />

          {/* ══════════════════════════════════════════════════════════════
              SECCIÓN 1 — CARTERA POR EDADES
          ══════════════════════════════════════════════════════════════ */}
          <section className="bg-white rounded-2xl shadow-sm p-7">
            <SectionHeader
              icon={<Wallet className="h-7 w-7" />}
              title="CARTERA POR EDADES"
              count={`${cartera.length} clientes`}
              color="blue"
            />

            <BuscarInput value={busEdades} onChange={v => { setBusEdades(v); setPageCarteraEdades(1) }} />

            {/* Pills de filtro rápido */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: 'todos',   label: 'Todos',    cls: 'bg-slate-700 text-white',          act: 'bg-slate-700 text-white ring-2 ring-slate-400' },
                { key: 'critico', label: 'Críticos', cls: 'bg-red-100 text-red-800 border border-red-300',        act: 'bg-red-600 text-white ring-2 ring-red-400' },
                { key: 'alto',    label: 'Altos',    cls: 'bg-orange-100 text-orange-800 border border-orange-300',act: 'bg-orange-500 text-white ring-2 ring-orange-400' },
                { key: 'medio',   label: 'Medios',   cls: 'bg-yellow-100 text-yellow-800 border border-yellow-300',act: 'bg-yellow-500 text-white ring-2 ring-yellow-400' },
                { key: 'ok',      label: 'Al día',   cls: 'bg-green-100 text-green-800 border border-green-300',  act: 'bg-green-600 text-white ring-2 ring-green-400' },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setFiltroRiesgo(p.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${filtroRiesgo === p.key ? p.act : p.cls + ' hover:opacity-80'}`}
                >
                  {p.label}
                  {p.key !== 'todos' && (
                    <span className="ml-1.5 opacity-75">
                      ({cartera.filter(c => nivelRiesgo(c) === p.key).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead className="bg-[#1a1a2e] text-white text-sm">
                  <tr>
                    <th className="px-4 py-3 text-left w-8">#</th>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-left">Ciudad</th>
                    <th className="px-4 py-3 text-left">Comercial</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Vigente</th>
                    <th className="px-4 py-3 text-right">1–30d</th>
                    <th className="px-4 py-3 text-right">31–60d</th>
                    <th className="px-4 py-3 text-right">61–90d</th>
                    <th className="px-4 py-3 text-right">+90d</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {carteraEdadesPageItems.map((c, idx) => {
                    const nivel  = nivelRiesgo(c)
                    const isOpen = expClientes.has(c.cliente_nit)
                    const mas90  = c.dias_91_180 + c.mas_180_dias
                    return (
                      <Fragment key={c.id}>
                        <tr
                          onClick={() => setExpClientes(prev => toggleSet(prev, c.cliente_nit))}
                          className={`${rowBgCls(nivel)} hover:bg-blue-50 cursor-pointer border-b border-gray-100 transition-colors`}
                        >
                           <td className="px-4 py-4 text-gray-400 font-mono text-sm">{(Math.min(pageCarteraEdades, carteraEdadesPages) - 1) * PAGE_SIZE + idx + 1}</td>
                          <td className="px-4 py-4 font-semibold">
                            <div className="flex items-center gap-2">
                              {isOpen
                                ? <ChevronDown className="h-5 w-5 text-[#0f3460] shrink-0" />
                                : <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />}
                              <span className="max-w-[220px] truncate text-lg font-bold" title={c.cliente_nombre}>
                                {c.cliente_nombre}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 mt-1 ml-7 font-mono tracking-wide"><span className="font-bold text-gray-400 not-italic mr-1">NIT</span>{c.cliente_nit}</div>
                          </td>
                          <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{c.ciudad || '—'}</td>
                          <td className="px-4 py-4 text-gray-600 whitespace-nowrap text-sm">{c.vendedor || '—'}</td>
                          <td className="px-4 py-4 text-right font-extrabold text-[#0f3460] whitespace-nowrap">{fmtM(c.total_deuda)}</td>
                          <td className="px-4 py-4 text-right text-green-700 font-semibold whitespace-nowrap">{fmtM(c.vigente)}</td>
                          <td className="px-4 py-4 text-right text-yellow-700 whitespace-nowrap">{fmtM(c.dias_1_30)}</td>
                          <td className="px-4 py-4 text-right text-orange-600 whitespace-nowrap">{fmtM(c.dias_31_60)}</td>
                          <td className="px-4 py-4 text-right text-red-600 whitespace-nowrap">{fmtM(c.dias_61_90)}</td>
                          <td className="px-4 py-4 text-right text-red-900 font-bold whitespace-nowrap">{fmtM(mas90)}</td>
                          <td className="px-4 py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeCls(nivel)}`}>
                              {nivel.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                        {isOpen && <FilaFacturas nit={c.cliente_nit} cols={11} filtro={filtro} />}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                   {(() => {
                     const fil = carteraFiltradaRiesgo
                     return (
                      <tr>
                        <td colSpan={4} className="px-4 py-3 font-bold text-gray-700">
                          TOTALES {filtroRiesgo !== 'todos' && `(${fil.length} clientes filtrados)`}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-slate-800">{fmtM(fil.reduce((s,c)=>s+c.total_deuda,0))}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">{fmtM(fil.reduce((s,c)=>s+c.vigente,0))}</td>
                        <td className="px-4 py-3 text-right font-bold text-yellow-700">{fmtM(fil.reduce((s,c)=>s+c.dias_1_30,0))}</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-600">{fmtM(fil.reduce((s,c)=>s+c.dias_31_60,0))}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">{fmtM(fil.reduce((s,c)=>s+c.dias_61_90,0))}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-900">{fmtM(fil.reduce((s,c)=>s+c.dias_91_180+c.mas_180_dias,0))}</td>
                        <td colSpan={1} />
                      </tr>
                    )
                  })()}
                </tfoot>
              </table>
            </div>
            <PaginationControls
              page={Math.min(pageCarteraEdades, carteraEdadesPages)}
              pages={carteraEdadesPages}
              onChange={setPageCarteraEdades}
            />
          </section>

          {/* ══════════════════════════════════════════════════════════════
              SECCIÓN 2 — FACTURAS PRÓXIMAS A VENCER
          ══════════════════════════════════════════════════════════════ */}
          <section className="bg-white rounded-2xl shadow-sm p-7">
            <SectionHeader
              icon={<Clock className="h-7 w-7" />}
              title="FACTURAS PRÓXIMAS A VENCER"
              count={`${proximos.length} facturas · días para su vencimiento ≤ 20 días`}
              color="orange"
            />
            {proximosQ.isLoading && (
              <div className="flex justify-center py-8"><Spinner className="h-10 w-10" /></div>
            )}
            {!proximosQ.isLoading && proximos.length === 0 && (
              <div className="flex items-center justify-center gap-3 text-green-600 py-8">
                <CheckCircle className="h-8 w-8" />
                <p className="text-lg font-semibold">No hay facturas próximas a vencer en los próximos 20 días</p>
              </div>
            )}
            {proximos.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead className="bg-[#e67e22] text-white text-sm">
                    <tr>
                      <th className="px-4 py-3 text-left w-8">#</th>
                      <th className="px-4 py-3 text-left">Cliente</th>
                      <th className="px-4 py-3 text-left">Documento</th>
                      <th className="px-4 py-3 text-left">Vencimiento</th>
                      <th className="px-4 py-3 text-center">Días</th>
                      <th className="px-4 py-3 text-left">Comercial</th>
                      <th className="px-4 py-3 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proximosPageItems.map((pv: ProximoVencimiento, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-orange-50 transition-colors">
                        <td className="px-4 py-4 text-gray-400 font-mono text-sm">{(Math.min(pageProximos, proximosPages) - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="px-4 py-4 font-semibold">{pv.cliente}</td>
                        <td className="px-4 py-4 text-gray-500 font-mono text-sm">{pv.num_doc}</td>
                        <td className="px-4 py-4 text-gray-700">{pv.fecha_vencimiento}</td>
                        <td className="px-4 py-4 text-center"><PillDias dias={pv.dias_para_vencer} /></td>
                        <td className="px-4 py-4 text-gray-500">{pv.vendedor}</td>
                        <td className="px-4 py-4 text-right font-extrabold text-[#0f3460]">{fmt(pv.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-orange-50 border-t-2 border-orange-200">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 font-bold text-orange-800">
                        Total por vencer ({proximos.length} facturas)
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-orange-900">
                        {fmt(proximos.reduce((s,p)=>s+p.saldo,0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <PaginationControls
              page={Math.min(pageProximos, proximosPages)}
              pages={proximosPages}
              onChange={setPageProximos}
            />
          </section>

          {/* ══════════════════════════════════════════════════════════════
              SECCIÓN 3 — CARTERA POR REGIÓN
          ══════════════════════════════════════════════════════════════ */}
          <section className="bg-white rounded-2xl shadow-sm p-7">
            <SectionHeader
              icon={<MapPin className="h-7 w-7" />}
              title="CARTERA POR REGIÓN"
              count={`${regiones.length} departamentos`}
              color="purple"
            />

            <BuscarInput value={busRegiones} onChange={v => { setBusRegiones(v); setPageRegiones(1) }} placeholder="Buscar por departamento..." />

            {regionesQ.isLoading && (
              <div className="flex justify-center py-8"><Spinner className="h-10 w-10" /></div>
            )}
            {regionesQ.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
                <p className="font-bold mb-1">Error al consultar regiones</p>
                <p className="font-mono text-xs">{(regionesQ.error as any)?.response?.data?.message || (regionesQ.error as any)?.response?.data?.error || (regionesQ.error as any)?.message || 'Sin respuesta del servidor'}</p>
                <p className="text-xs mt-1 text-red-500">URL: /api/cartera/regiones/ · HTTP {(regionesQ.error as any)?.response?.status ?? 'N/A'}</p>
              </div>
            )}
            {!regionesQ.isLoading && !regionesQ.error && regiones.length === 0 && (
              <p className="text-gray-400 text-lg py-6 text-center">Sin datos de regiones para la fecha seleccionada</p>
            )}
            {regionesFiltradas.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead className="bg-[#1a1a2e] text-white text-sm">
                    <tr>
                      <th className="px-4 py-3 text-center w-14">Pos.</th>
                      <th className="px-4 py-3 text-left">Departamento</th>
                      <th className="px-4 py-3 text-center">Clientes</th>
                      <th className="px-4 py-3 text-center">Ciudades</th>
                      <th className="px-4 py-3 text-right">Total Cartera</th>
                      <th className="px-4 py-3 text-right">Vencida</th>
                      <th className="px-4 py-3 text-right">Mora +90d</th>
                      <th className="px-4 py-3 text-center">% Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionesPageItems.map((reg: RegionAgregada, idx) => {
                      const regKey = reg.departamento
                      const isOpen = expRegiones.has(regKey)
                      const rankColors = [
                        'bg-yellow-400 text-yellow-900',   // 1st — gold
                        'bg-slate-300 text-slate-800',     // 2nd — silver
                        'bg-amber-600 text-amber-100',     // 3rd — bronze
                      ]
                      const rankCls = reg.ranking <= 3
                        ? rankColors[reg.ranking - 1]
                        : 'bg-gray-100 text-gray-600'
                      return (
                        <Fragment key={regKey}>
                          <tr
                            onClick={() => setExpRegiones(prev => toggleSet(prev, regKey))}
                            className="bg-white hover:bg-purple-50 cursor-pointer border-b border-gray-100 transition-colors"
                          >
                            <td className="px-4 py-4 text-center">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-extrabold ${rankCls}`}>
                                {(Math.min(pageRegiones, regionesPages) - 1) * PAGE_SIZE + idx + 1}
                              </span>
                            </td>
                            <td className="px-4 py-4 font-bold text-lg">
                              <div className="flex items-center gap-2">
                                {isOpen
                                  ? <ChevronDown className="h-5 w-5 text-purple-600 shrink-0" />
                                  : <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />}
                                {reg.departamento}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="bg-purple-100 text-purple-800 font-bold px-3 py-1 rounded-full text-sm">
                                {reg.clientes_count}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center text-gray-500 font-semibold text-sm">
                              {reg.ciudades_count} {reg.ciudades_count === 1 ? 'ciudad' : 'ciudades'}
                            </td>
                            <td className="px-4 py-4 text-right font-extrabold text-[#0f3460]">{fmtM(reg.total_deuda)}</td>
                            <td className="px-4 py-4 text-right font-semibold text-red-600">{fmtM(reg.total_vencida)}</td>
                            <td className="px-4 py-4 text-right font-bold text-red-800">
                              {reg.mora_90 > 0 ? fmtM(reg.mora_90) : <span className="text-green-600 text-sm font-semibold">Al día</span>}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="font-extrabold text-gray-800">{reg.porcentaje}%</span>
                            </td>
                          </tr>

                          {/* Detalle: ciudades en la región */}
                          {isOpen && (
                            <tr>
                              <td colSpan={8} className="px-4 py-2">
                                <div className="bg-purple-50 border border-purple-200 rounded-xl mx-4 mb-3 overflow-hidden">
                                  <div className="px-5 py-3 bg-purple-100 font-bold text-purple-800 text-sm uppercase tracking-wide flex items-center justify-between">
                                    <span>CIUDADES EN {reg.departamento.toUpperCase()}</span>
                                    <span className="text-xs font-semibold text-purple-600">{reg.ciudades.length} {reg.ciudades.length === 1 ? 'ciudad' : 'ciudades'}</span>
                                  </div>
                                  {reg.ciudades.map((ciu: CiudadAgregada, ci) => {
                                    const ciuKey = `${regKey}::${ciu.ciudad}`
                                    const ciuOpen = expRegionesCiudades.has(ciuKey)
                                    return (
                                      <div key={ciu.ciudad} className="border-t border-purple-200">
                                        {/* Ciudad header */}
                                        <button
                                          onClick={e => { e.stopPropagation(); setExpRegionesCiudades(prev => toggleSet(prev, ciuKey)) }}
                                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-purple-100 transition-colors text-left"
                                        >
                                          {ciuOpen
                                            ? <ChevronDown className="h-4 w-4 text-purple-500 shrink-0" />
                                            : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                                          <span className="font-bold text-purple-900">{ciu.ciudad}</span>
                                          <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-semibold ml-1">
                                            {ciu.clientes_count} cliente{ciu.clientes_count !== 1 ? 's' : ''}
                                          </span>
                                          <span className="ml-auto font-extrabold text-[#0f3460] text-sm">{fmtM(ciu.total_deuda)}</span>
                                          <span className="text-xs text-gray-500 font-semibold w-10 text-right">{ciu.porcentaje}%</span>
                                        </button>
                                        {/* Clients inside city */}
                                        {ciuOpen && (
                                          <table className="w-full text-sm border-t border-purple-100">
                                            <thead className="bg-purple-200 text-purple-900">
                                              <tr>
                                                <th className="px-6 py-2 text-left w-8">#</th>
                                                <th className="px-4 py-2 text-left">Institución</th>
                                                <th className="px-4 py-2 text-left">NIT</th>
                                                <th className="px-4 py-2 text-right">Total</th>
                                                <th className="px-4 py-2 text-right">Vigente</th>
                                                <th className="px-4 py-2 text-right">+90d</th>
                                                <th className="px-4 py-2 text-center">Mora máx.</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {ciu.clientes.map((cl, cli) => (
                                                <tr key={cl.cliente_nit} className="border-t border-purple-100 hover:bg-purple-50">
                                                  <td className="px-6 py-2 text-gray-400">{cli + 1}</td>
                                                  <td className="px-4 py-2 font-semibold text-gray-900">{cl.cliente_nombre}</td>
                                                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{cl.cliente_nit}</td>
                                                  <td className="px-4 py-2 text-right font-bold text-[#0f3460]">{fmtM(cl.total_deuda)}</td>
                                                  <td className="px-4 py-2 text-right text-green-700">{fmtM(cl.vigente)}</td>
                                                  <td className="px-4 py-2 text-right text-red-900 font-bold">{fmtM(cl.dias_91_180 + cl.mas_180_dias)}</td>
                                                  <td className="px-4 py-2 text-center">
                                                    {cl.dias_mora_max > 0
                                                      ? <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold">{cl.dias_mora_max}d</span>
                                                      : <span className="text-green-600 text-xs">Al día</span>
                                                    }
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                            <tfoot className="bg-purple-100 border-t border-purple-200">
                                              <tr>
                                                <td colSpan={3} className="px-6 py-1.5 font-bold text-purple-800 text-xs uppercase">
                                                  Total {ciu.ciudad}
                                                </td>
                                                <td className="px-4 py-1.5 text-right font-bold text-[#0f3460] text-sm">{fmtM(ciu.total_deuda)}</td>
                                                <td className="px-4 py-1.5 text-right text-green-700 font-bold text-sm">{fmtM(ciu.vigente)}</td>
                                                <td className="px-4 py-1.5 text-right text-red-900 font-bold text-sm">{fmtM(ciu.dias_91_mas)}</td>
                                                <td />
                                              </tr>
                                            </tfoot>
                                          </table>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {/* Region footer */}
                                  <div className="bg-purple-200 border-t-2 border-purple-300 px-5 py-2 flex items-center justify-between text-sm font-bold text-purple-900">
                                    <span>TOTAL {reg.departamento.toUpperCase()} · {reg.clientes_count} clientes</span>
                                    <div className="flex gap-6">
                                      <span>Total: {fmtM(reg.total_deuda)}</span>
                                      <span className="text-red-700">Vencida: {fmtM(reg.total_vencida)}</span>
                                      {reg.mora_90 > 0 && <span className="text-red-900">+90d: {fmtM(reg.mora_90)}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 font-bold text-gray-700">
                        TOTALES ({regionesFiltradas.length} departamentos)
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-800">
                        {fmtM(regionesFiltradas.reduce((s, r) => s + r.total_deuda, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">
                        {fmtM(regionesFiltradas.reduce((s, r) => s + r.total_vencida, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-800">
                        {fmtM(regionesFiltradas.reduce((s, r) => s + r.mora_90, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <PaginationControls
              page={Math.min(pageRegiones, regionesPages)}
              pages={regionesPages}
              onChange={setPageRegiones}
            />
          </section>

          {/* ══════════════════════════════════════════════════════════════
              SECCIÓN 4 — CARTERA POR COMERCIAL
          ══════════════════════════════════════════════════════════════ */}
          <section className="bg-white rounded-2xl shadow-sm p-7">
            <SectionHeader
              icon={<UserCheck className="h-7 w-7" />}
              title="CARTERA POR COMERCIAL"
              count={`${comerciales.length} comerciales`}
              color="teal"
            />
            <BuscarInput value={busComerciales} onChange={v => { setBusComerciales(v); setPageComerciales(1) }} placeholder="Buscar por comercial..." />

            {comercQ.isLoading && (
              <div className="flex justify-center py-8"><Spinner className="h-10 w-10" /></div>
            )}
            {!comercQ.isLoading && comerciales.length === 0 && (
              <p className="text-gray-400 text-lg py-6 text-center">Sin datos de comerciales</p>
            )}
            {comercialesFiltrados.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead className="bg-[#1a1a2e] text-white text-sm">
                    <tr>
                      <th className="px-4 py-3 text-left w-8">#</th>
                      <th className="px-4 py-3 text-left">Comercial</th>
                      <th className="px-4 py-3 text-center">Clientes</th>
                      <th className="px-4 py-3 text-right">Total Cartera</th>
                      <th className="px-4 py-3 text-right">Vencida</th>
                      <th className="px-4 py-3 text-center">% Vencida</th>
                      <th className="px-4 py-3 text-center">% Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comercialesPageItems.map((com: VendedorAgregado, idx) => {
                      const isOpen = expComerciales.has(com.vendedor)
                      const pctVenc = com.total_deuda > 0
                        ? fmtPct((com.total_vencida / com.total_deuda) * 100)
                        : '0%'
                      return (
                        <Fragment key={com.vendedor}>
                          <tr
                            onClick={() => setExpComerciales(prev => toggleSet(prev, com.vendedor))}
                            className="bg-white hover:bg-teal-50 cursor-pointer border-b border-gray-100 transition-colors"
                          >
                             <td className="px-4 py-4 text-gray-400 font-mono text-sm">{(Math.min(pageComerciales, comercialesPages) - 1) * PAGE_SIZE + idx + 1}</td>
                            <td className="px-4 py-4 font-bold text-lg flex items-center gap-2">
                              {isOpen
                                ? <ChevronDown className="h-5 w-5 text-teal-600 shrink-0" />
                                : <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />}
                              {com.vendedor}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="bg-teal-100 text-teal-800 font-bold px-3 py-1 rounded-full text-sm">
                                {com.clientes_count}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right font-extrabold text-[#0f3460]">{fmtM(com.total_deuda)}</td>
                            <td className="px-4 py-4 text-right font-bold text-red-600">{fmtM(com.total_vencida)}</td>
                            <td className="px-4 py-4 text-center">
                              <span className={`px-2 py-1 rounded text-sm font-bold ${
                                parseFloat(pctVenc) > 60 ? 'bg-red-100 text-red-800' :
                                parseFloat(pctVenc) > 30 ? 'bg-orange-100 text-orange-800' :
                                'bg-green-100 text-green-800'
                              }`}>{pctVenc}</span>
                            </td>
                            <td className="px-4 py-4 text-center text-gray-600 font-semibold">{com.porcentaje}%</td>
                          </tr>

                          {/* Detalle de instituciones por comercial */}
                          {isOpen && (
                            <tr>
                              <td colSpan={7} className="px-4 py-2">
                                <div className="bg-teal-50 border border-teal-200 rounded-xl mx-6 mb-3 overflow-hidden">
                                  <div className="px-5 py-3 bg-teal-100 font-bold text-teal-800 text-base">
                                    INSTITUCIONES DE {com.vendedor.toUpperCase()} — DE MAYOR A MENOR DEUDA
                                  </div>
                                  <table className="w-full text-sm">
                                    <thead className="bg-teal-200 text-teal-900">
                                      <tr>
                                        <th className="px-4 py-2 text-left">#</th>
                                        <th className="px-4 py-2 text-left">Institución</th>
                                        <th className="px-4 py-2 text-left">NIT</th>
                                        <th className="px-4 py-2 text-left">Ciudad</th>
                                        <th className="px-4 py-2 text-right">Total</th>
                                        <th className="px-4 py-2 text-right">Vigente</th>
                                        <th className="px-4 py-2 text-right">+90d</th>
                                        <th className="px-4 py-2 text-center">Mora máx.</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {com.clientes.map((cl, ci) => (
                                        <tr key={cl.cliente_nit} className="border-t border-teal-200 hover:bg-teal-100">
                                          <td className="px-4 py-2 text-gray-400">{ci + 1}</td>
                                          <td className="px-4 py-2 font-semibold">{cl.cliente_nombre}</td>
                                          <td className="px-4 py-2 font-mono text-xs text-gray-500">{cl.cliente_nit}</td>
                                          <td className="px-4 py-2 text-gray-600">{cl.ciudad || '—'}</td>
                                          <td className="px-4 py-2 text-right font-bold text-[#0f3460]">{fmtM(cl.total_deuda)}</td>
                                          <td className="px-4 py-2 text-right text-green-700">{fmtM(cl.vigente)}</td>
                                          <td className="px-4 py-2 text-right text-red-900 font-bold">
                                            {fmtM(cl.dias_91_180 + cl.mas_180_dias)}
                                          </td>
                                          <td className="px-4 py-2 text-center">
                                            {cl.dias_mora_max > 0
                                              ? <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-bold">
                                                  {cl.dias_mora_max}d
                                                </span>
                                              : <span className="text-green-600 text-xs">Al día</span>
                                            }
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <PaginationControls
              page={Math.min(pageComerciales, comercialesPages)}
              pages={comercialesPages}
              onChange={setPageComerciales}
            />
          </section>



        </div>
      )}
    </div>
  )
}
