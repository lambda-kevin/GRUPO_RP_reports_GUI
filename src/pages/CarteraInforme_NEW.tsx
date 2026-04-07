import { useState } from 'react'
import { AlertTriangle, TrendingDown, Clock, DollarSign, ChevronDown, ChevronRight } from 'lucide-react'

// DATOS DUMMY HARDCODEADOS (basados en el HTML de referencia)
const CLIENTES_DUMMY = [
  { cliente: "INVERSIONES MÉDICAS DE ANTIOQUIA S.A.", nit: "800.112.784-2", ciudad: "Medellín", vendedor: "Juan Pérez", linea: "Ortopedia", vigente: 75000000, d130: 38000000, d3160: 62000000, d6190: 185000000, mas90: 127000000 },
  { cliente: "ESE HOSPITAL LA MARÍA", nit: "890.905.177-3", ciudad: "Medellín", vendedor: "María González", linea: "Trauma", vigente: 80000000, d130: 45000000, d3160: 68000000, d6190: 113000000, mas90: 72000000 },
  { cliente: "FUNDACIÓN HOSPITALARIA SAN VICENTE DE PAUL", nit: "890.902.922-6", ciudad: "Medellín", vendedor: "Carlos Ruiz", linea: "Columna", vigente: 126000000, d130: 51000000, d3160: 75000000, d6190: 62000000, mas90: 28000000 },
  { cliente: "CLÍNICA MEDELLÍN S.A.", nit: "890.904.996-1", ciudad: "Medellín", vendedor: "Ana López", linea: "Articulaciones", vigente: 100000000, d130: 60000000, d3160: 75000000, d6190: 45000000, mas90: 18000000 },
  { cliente: "ALIANZA MEDELLÍN ANTIOQUIA EPS S.A.S.", nit: "901.097.473-5", ciudad: "Medellín", vendedor: "Pedro Martínez", linea: "Ortopedia", vigente: 32000000, d130: 21000000, d3160: 27000000, d6190: 66000000, mas90: 119000000 },
  { cliente: "HOSPITAL SAN RAFAEL ITAGÜÍ", nit: "890.980.066-7", ciudad: "Itagüí", vendedor: "Laura Sánchez", linea: "Trauma", vigente: 45000000, d130: 34000000, d3160: 53000000, d6190: 41000000, mas90: 15000000 },
  { cliente: "ESE METROSALUD", nit: "800.058.016-1", ciudad: "Medellín", vendedor: "Diego Torres", linea: "Ortopedia", vigente: 38000000, d130: 34000000, d3160: 31000000, d6190: 38000000, mas90: 16000000 },
  { cliente: "SOCIEDAD MÉDICA RIONEGRO SOMER S.A.", nit: "890.939.936-5", ciudad: "Rionegro", vendedor: "Sofía Ramírez", linea: "Columna", vigente: 25000000, d130: 19000000, d3160: 17000000, d6190: 12000000, mas90: 4000000 },
  { cliente: "FUNDACIÓN CLÍNICA NOEL", nit: "890.901.826-5", ciudad: "Medellín", vendedor: "Juan Pérez", linea: "Articulaciones", vigente: 16000000, d130: 10000000, d3160: 10000000, d6190: 8000000, mas90: 4000000 },
  { cliente: "HOSPITAL GENERAL DE MEDELLÍN", nit: "890.904.646-8", ciudad: "Medellín", vendedor: "María González", linea: "Trauma", vigente: 27000000, d130: 8000000, d3160: 4000000, d6190: 4000000, mas90: 2000000 },
  { cliente: "COOPERATIVA DE HOSPITALES DE ANTIOQUIA", nit: "890.901.825-5", ciudad: "Medellín", vendedor: "Carlos Ruiz", linea: "Ortopedia", vigente: 24000000, d130: 6000000, d3160: 4000000, d6190: 3000000, mas90: 1000000 },
  { cliente: "CLÍNICA LAS AMÉRICAS", nit: "811.016.192-3", ciudad: "Medellín", vendedor: "Ana López", linea: "Columna", vigente: 13000000, d130: 8000000, d3160: 6000000, d6190: 5000000, mas90: 3000000 },
  { cliente: "ESE HOSPITAL MARCO FIDEL SUÁREZ", nit: "890.981.137-4", ciudad: "Bello", vendedor: "Pedro Martínez", linea: "Trauma", vigente: 15000000, d130: 6000000, d3160: 5000000, d6190: 3000000, mas90: 2000000 },
  { cliente: "CLÍNICA CARDIOVASCULAR SANTA MARÍA", nit: "800.065.396-2", ciudad: "Medellín", vendedor: "Laura Sánchez", linea: "Articulaciones", vigente: 20000000, d130: 5000000, d3160: 2000000, d6190: 800000, mas90: 400000 },
  { cliente: "CLÍNICA EL ROSARIO S.A.", nit: "890.902.768-4", ciudad: "Medellín", vendedor: "Diego Torres", linea: "Ortopedia", vigente: 19000000, d130: 3000000, d3160: 1500000, d6190: 800000, mas90: 300000 },
  { cliente: "HOSPITAL PABLO TOBÓN URIBE", nit: "890.901.826-3", ciudad: "Medellín", vendedor: "Sofía Ramírez", linea: "Trauma", vigente: 19000000, d130: 2000000, d3160: 800000, d6190: 300000, mas90: 100000 },
  { cliente: "IPS UNIVERSITARIA CLÍNICA LEÓN XIII", nit: "890.933.123-7", ciudad: "Medellín", vendedor: "Juan Pérez", linea: "Columna", vigente: 13000000, d130: 3000000, d3160: 2000000, d6190: 900000, mas90: 200000 },
  { cliente: "ESE HOSPITAL SAN JUAN DE DIOS RIONEGRO", nit: "890.907.215-2", ciudad: "Rionegro", vendedor: "María González", linea: "Ortopedia", vigente: 13000000, d130: 2500000, d3160: 1200000, d6190: 700000, mas90: 100000 },
  { cliente: "CLÍNICA CES", nit: "890.907.254-1", ciudad: "Medellín", vendedor: "Carlos Ruiz", linea: "Articulaciones", vigente: 14000000, d130: 1500000, d3160: 700000, d6190: 400000, mas90: 200000 },
  { cliente: "HOSPITAL INFANTIL CONCEJO DE MEDELLÍN", nit: "890.905.166-2", ciudad: "Medellín", vendedor: "Ana López", linea: "Trauma", vigente: 14000000, d130: 0, d3160: 0, d6190: 0, mas90: 0 },
]

const PROXIMOS_DUMMY = [
  { fecha: "2026-04-05", dias: 2, cliente: "FUNDACIÓN CLÍNICA NOEL", factura: "FV-00946", monto: 18750000, alerta: "⚠️ URGENTE" },
  { fecha: "2026-04-08", dias: 5, cliente: "ESE METROSALUD", factura: "FV-00948", monto: 38300000, alerta: "⚠️ Cliente con deuda alta" },
  { fecha: "2026-04-10", dias: 7, cliente: "HOSPITAL SAN RAFAEL ITAGÜÍ", factura: "FV-00952", monto: 45570000, alerta: "⚠️ Cliente con deuda alta" },
  { fecha: "2026-04-12", dias: 9, cliente: "ESE HOSPITAL LA MARÍA", factura: "FV-00949", monto: 80340000, alerta: "🔴 CRÍTICO — Deuda >$300M" },
  { fecha: "2026-04-15", dias: 12, cliente: "FUNDACIÓN SAN VICENTE", factura: "FV-00951", monto: 126580000, alerta: "🔴 MONTO MUY ALTO" },
]

// Utilidades
const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
const fmtCorto = (n: number) => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

const getRiesgo = (mas90: number, d6190: number, d3160: number) => {
  if (mas90 > 0) return 'CRÍTICO'
  if (d6190 > 0) return 'ALTO'
  if (d3160 > 0) return 'MEDIO'
  return 'OK'
}

const badgeClass = (riesgo: string) => {
  const map: Record<string, string> = {
    CRÍTICO: 'bg-red-600',
    ALTO: 'bg-orange-500',
    MEDIO: 'bg-yellow-500',
    OK: 'bg-green-500',
  }
  return `${map[riesgo] || map.OK} text-white px-3 py-1 rounded-full text-xs font-bold`
}

export const CarteraInforme = () => {
  const [activeTab, setActiveTab] = useState<'resumen' | 'edades' | 'ciudades'>('resumen')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [filtros, setFiltros] = useState({ buscar: '', ciudad: '', linea: '', vendedor: '', riesgo: '' })

  // Calcular datos
  const clientes = CLIENTES_DUMMY.map(c => ({
    ...c,
    total: c.vigente + c.d130 + c.d3160 + c.d6190 + c.mas90,
    vencida: c.d130 + c.d3160 + c.d6190 + c.mas90,
    riesgo: getRiesgo(c.mas90, c.d6190, c.d3160)
  })).sort((a, b) => b.total - a.total)

  const totalCartera = clientes.reduce((s, c) => s + c.total, 0)
  const totalVencida = clientes.reduce((s, c) => s + c.vencida, 0)
  const totalVigente = clientes.reduce((s, c) => s + c.vigente, 0)
  const criticos90 = clientes.reduce((s, c) => s + c.mas90, 0)
  const nCriticos = clientes.filter(c => c.mas90 > 0).length

  // Filtrar clientes
  const clientesFiltrados = clientes.filter(c => {
    if (filtros.buscar && !c.cliente.toLowerCase().includes(filtros.buscar.toLowerCase()) && !c.nit.includes(filtros.buscar)) return false
    if (filtros.ciudad && c.ciudad !== filtros.ciudad) return false
    if (filtros.linea && c.linea !== filtros.linea) return false
    if (filtros.vendedor && c.vendedor !== filtros.vendedor) return false
    if (filtros.riesgo && c.riesgo !== filtros.riesgo) return false
    return true
  })

  // Opciones para filtros
  const ciudades = Array.from(new Set(clientes.map(c => c.ciudad))).sort()
  const lineas = Array.from(new Set(clientes.map(c => c.linea))).sort()
  const vendedores = Array.from(new Set(clientes.map(c => c.vendedor))).sort()

  // Agregación por ciudad
  const ciudadesAgregadas = ciudades.map(ciudad => {
    const clientesCiudad = clientes.filter(c => c.ciudad === ciudad)
    return {
      ciudad,
      clientes: clientesCiudad.length,
      vigente: clientesCiudad.reduce((s, c) => s + c.vigente, 0),
      d130: clientesCiudad.reduce((s, c) => s + c.d130, 0),
      d3160: clientesCiudad.reduce((s, c) => s + c.d3160, 0),
      d6190: clientesCiudad.reduce((s, c) => s + c.d6190, 0),
      mas90: clientesCiudad.reduce((s, c) => s + c.mas90, 0),
      total: clientesCiudad.reduce((s, c) => s + c.total, 0),
      clientesList: clientesCiudad
    }
  }).sort((a, b) => b.total - a.total)

  const toggleRow = (nit: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(nit) ? next.delete(nit) : next.add(nit)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-[#f4f6fa]">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] text-white px-10 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-extrabold mb-2">📊 Informe de Cartera</h1>
            <p className="text-sm opacity-70">Grupo RP — Implantes Ortopédicos & Osteosíntesis · Medellín</p>
          </div>
          <div className="bg-white/10 px-6 py-2 rounded-xl">
            📅 Corte: 3 de Abril de 2026
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 px-10 py-8">
        <div className="bg-gradient-to-br from-[#0f3460] to-[#16213e] text-white rounded-2xl p-6 shadow-lg hover:scale-105 transition">
          <p className="text-xs uppercase opacity-90 mb-2">Cartera Total</p>
          <p className="text-4xl font-black mb-1">{fmtCorto(totalCartera)}</p>
          <p className="text-xs opacity-80">{clientes.length} clientes activos</p>
          <DollarSign className="absolute right-5 top-1/2 -translate-y-1/2 h-16 w-16 opacity-10" />
        </div>

        <div className="bg-gradient-to-br from-[#c0392b] to-[#e74c3c] text-white rounded-2xl p-6 shadow-lg hover:scale-105 transition relative">
          <p className="text-xs uppercase opacity-90 mb-2">Cartera Vencida</p>
          <p className="text-4xl font-black mb-1">{fmtCorto(totalVencida)}</p>
          <p className="text-xs opacity-80">{((totalVencida / totalCartera) * 100).toFixed(1)}% del total</p>
          <AlertTriangle className="absolute right-5 top-1/2 -translate-y-1/2 h-16 w-16 opacity-10" />
        </div>

        <div className="bg-gradient-to-br from-[#e67e22] to-[#f39c12] text-white rounded-2xl p-6 shadow-lg hover:scale-105 transition relative">
          <p className="text-xs uppercase opacity-90 mb-2">Por Vencer</p>
          <p className="text-4xl font-black mb-1">{fmtCorto(totalVigente)}</p>
          <p className="text-xs opacity-80">{((totalVigente / totalCartera) * 100).toFixed(1)}% del total</p>
          <Clock className="absolute right-5 top-1/2 -translate-y-1/2 h-16 w-16 opacity-10" />
        </div>

        <div className="bg-gradient-to-br from-[#8e44ad] to-[#9b59b6] text-white rounded-2xl p-6 shadow-lg hover:scale-105 transition relative">
          <p className="text-xs uppercase opacity-90 mb-2">Crítica +90 días</p>
          <p className="text-4xl font-black mb-1">{fmtCorto(criticos90)}</p>
          <p className="text-xs opacity-80">{nCriticos} clientes en riesgo</p>
          <TrendingDown className="absolute right-5 top-1/2 -translate-y-1/2 h-16 w-16 opacity-10" />
        </div>
      </div>

      {/* ALERT BANNER */}
      {nCriticos > 0 && (
        <div className="mx-10 mb-6">
          <div className="bg-gradient-to-r from-[#c0392b] to-[#e74c3c] text-white rounded-2xl px-8 py-5 flex items-center gap-4 shadow-lg">
            <div className="w-5 h-5 bg-white rounded-full animate-pulse" />
            <span className="text-lg font-bold">
              🚨 {nCriticos} CLIENTE{nCriticos > 1 ? 'S' : ''} CON DEUDA MAYOR A 90 DÍAS — MONTO TOTAL: {fmtCorto(criticos90)}
            </span>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="px-10">
        <div className="flex gap-2 border-b-2 border-gray-200">
          {[
            { key: 'resumen' as const, label: '📊 Resumen General' },
            { key: 'edades' as const, label: '📅 Cartera por Edades' },
            { key: 'ciudades' as const, label: '🏙️ Por Ciudades' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 rounded-t-lg font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-white text-[#0f3460] border-b-4 border-[#0f3460]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-b-2xl shadow-lg p-8 min-h-[600px]">
          {/* TAB RESUMEN */}
          {activeTab === 'resumen' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-[#1a1a2e] mb-4">🔴 Top 20 Deudores</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#1a1a2e] text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs uppercase">Cliente</th>
                        <th className="px-4 py-3 text-left text-xs uppercase">NIT</th>
                        <th className="px-4 py-3 text-right text-xs uppercase">Total Deuda</th>
                        <th className="px-4 py-3 text-right text-xs uppercase">Vencida</th>
                        <th className="px-4 py-3 text-center text-xs uppercase">Riesgo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.slice(0, 20).map((c, i) => (
                        <tr key={c.nit} className={`border-b hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-4 py-3 text-sm font-medium">{c.cliente}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{c.nit}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-red-600">{fmt(c.total)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-orange-600">{fmt(c.vencida)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={badgeClass(c.riesgo)}>{c.riesgo}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-[#1a1a2e] mb-4">⏰ Próximos Vencimientos (≤ 20 días)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-orange-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs uppercase">Fecha</th>
                        <th className="px-4 py-3 text-center text-xs uppercase">Días</th>
                        <th className="px-4 py-3 text-left text-xs uppercase">Cliente</th>
                        <th className="px-4 py-3 text-left text-xs uppercase">Factura</th>
                        <th className="px-4 py-3 text-right text-xs uppercase">Monto</th>
                        <th className="px-4 py-3 text-left text-xs uppercase">Alerta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PROXIMOS_DUMMY.map((p, i) => (
                        <tr key={i} className="border-b bg-yellow-50 hover:bg-yellow-100">
                          <td className="px-4 py-3 text-sm font-semibold">{p.fecha}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${p.dias <= 7 ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                              {p.dias} DÍAS
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{p.cliente}</td>
                          <td className="px-4 py-3 text-sm font-mono">{p.factura}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-red-600">{fmt(p.monto)}</td>
                          <td className="px-4 py-3 text-sm">{p.alerta}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB EDADES */}
          {activeTab === 'edades' && (
            <div>
              <div className="flex gap-4 mb-6 flex-wrap">
                <input
                  type="text"
                  placeholder="Buscar cliente o NIT..."
                  className="px-4 py-2 border rounded-lg flex-1 min-w-[200px]"
                  value={filtros.buscar}
                  onChange={e => setFiltros(prev => ({ ...prev, buscar: e.target.value }))}
                />
                <select
                  className="px-4 py-2 border rounded-lg"
                  value={filtros.ciudad}
                  onChange={e => setFiltros(prev => ({ ...prev, ciudad: e.target.value }))}
                >
                  <option value="">Todas las ciudades</option>
                  {ciudades.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  className="px-4 py-2 border rounded-lg"
                  value={filtros.linea}
                  onChange={e => setFiltros(prev => ({ ...prev, linea: e.target.value }))}
                >
                  <option value="">Todas las líneas</option>
                  {lineas.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select
                  className="px-4 py-2 border rounded-lg"
                  value={filtros.riesgo}
                  onChange={e => setFiltros(prev => ({ ...prev, riesgo: e.target.value }))}
                >
                  <option value="">Todos los riesgos</option>
                  <option value="CRÍTICO">CRÍTICO</option>
                  <option value="ALTO">ALTO</option>
                  <option value="MEDIO">MEDIO</option>
                  <option value="OK">OK</option>
                </select>
              </div>

              <p className="text-sm text-gray-600 mb-4">Mostrando {clientesFiltrados.length} de {clientes.length} clientes</p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#1a1a2e] text-white">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs">Cliente</th>
                      <th className="px-3 py-2 text-left text-xs">Ciudad</th>
                      <th className="px-3 py-2 text-center text-xs">Riesgo</th>
                      <th className="px-3 py-2 text-right text-xs">Por Vencer</th>
                      <th className="px-3 py-2 text-right text-xs">1-30d</th>
                      <th className="px-3 py-2 text-right text-xs">31-60d</th>
                      <th className="px-3 py-2 text-right text-xs">61-90d</th>
                      <th className="px-3 py-2 text-right text-xs">+90d</th>
                      <th className="px-3 py-2 text-right text-xs font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map((c, i) => (
                      <tr key={c.nit} className={`border-b hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-3 py-2 font-medium">{c.cliente}</td>
                        <td className="px-3 py-2 text-gray-600">{c.ciudad}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={badgeClass(c.riesgo)}>{c.riesgo}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-green-600 font-semibold">{fmtCorto(c.vigente)}</td>
                        <td className="px-3 py-2 text-right text-yellow-600 font-semibold">{fmtCorto(c.d130)}</td>
                        <td className="px-3 py-2 text-right text-orange-600 font-semibold">{fmtCorto(c.d3160)}</td>
                        <td className="px-3 py-2 text-right text-red-600 font-semibold">{fmtCorto(c.d6190)}</td>
                        <td className="px-3 py-2 text-right text-red-900 font-bold">{fmtCorto(c.mas90)}</td>
                        <td className="px-3 py-2 text-right font-bold">{fmt(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td colSpan={3} className="px-3 py-3">TOTALES</td>
                      <td className="px-3 py-3 text-right text-green-600">{fmtCorto(clientesFiltrados.reduce((s, c) => s + c.vigente, 0))}</td>
                      <td className="px-3 py-3 text-right text-yellow-600">{fmtCorto(clientesFiltrados.reduce((s, c) => s + c.d130, 0))}</td>
                      <td className="px-3 py-3 text-right text-orange-600">{fmtCorto(clientesFiltrados.reduce((s, c) => s + c.d3160, 0))}</td>
                      <td className="px-3 py-3 text-right text-red-600">{fmtCorto(clientesFiltrados.reduce((s, c) => s + c.d6190, 0))}</td>
                      <td className="px-3 py-3 text-right text-red-900">{fmtCorto(clientesFiltrados.reduce((s, c) => s + c.mas90, 0))}</td>
                      <td className="px-3 py-3 text-right">{fmt(clientesFiltrados.reduce((s, c) => s + c.total, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB CIUDADES */}
          {activeTab === 'ciudades' && (
            <div>
              <h2 className="text-2xl font-bold text-[#1a1a2e] mb-6">🏙️ Cartera Agregada por Ciudad</h2>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#1a1a2e] text-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs uppercase">Ciudad</th>
                      <th className="px-4 py-3 text-center text-xs uppercase">Clientes</th>
                      <th className="px-4 py-3 text-right text-xs uppercase">Por Vencer</th>
                      <th className="px-4 py-3 text-right text-xs uppercase">1-30d</th>
                      <th className="px-4 py-3 text-right text-xs uppercase">31-60d</th>
                      <th className="px-4 py-3 text-right text-xs uppercase">61-90d</th>
                      <th className="px-4 py-3 text-right text-xs uppercase">+90d</th>
                      <th className="px-4 py-3 text-right text-xs uppercase font-bold">Total</th>
                      <th className="px-4 py-3 text-center text-xs uppercase">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ciudadesAgregadas.map(cd => {
                      const isExpanded = expandedRows.has(cd.ciudad)
                      return (
                        <>
                          <tr
                            key={cd.ciudad}
                            className="border-b hover:bg-blue-50 cursor-pointer bg-gray-50 font-semibold"
                            onClick={() => toggleRow(cd.ciudad)}
                          >
                            <td className="px-4 py-3 flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {cd.ciudad}
                            </td>
                            <td className="px-4 py-3 text-center">{cd.clientes}</td>
                            <td className="px-4 py-3 text-right text-green-600">{fmtCorto(cd.vigente)}</td>
                            <td className="px-4 py-3 text-right text-yellow-600">{fmtCorto(cd.d130)}</td>
                            <td className="px-4 py-3 text-right text-orange-600">{fmtCorto(cd.d3160)}</td>
                            <td className="px-4 py-3 text-right text-red-600">{fmtCorto(cd.d6190)}</td>
                            <td className="px-4 py-3 text-right text-red-900 font-bold">{fmtCorto(cd.mas90)}</td>
                            <td className="px-4 py-3 text-right font-bold text-lg">{fmt(cd.total)}</td>
                            <td className="px-4 py-3 text-center text-gray-600">{((cd.total / totalCartera) * 100).toFixed(1)}%</td>
                          </tr>
                          {isExpanded && cd.clientesList.map(c => (
                            <tr key={c.nit} className="border-b bg-blue-50/50 hover:bg-blue-100 text-xs">
                              <td className="px-4 py-2 pl-12">{c.cliente}</td>
                              <td className="px-4 py-2 text-center text-gray-500">{c.nit}</td>
                              <td className="px-4 py-2 text-right text-green-600">{fmtCorto(c.vigente)}</td>
                              <td className="px-4 py-2 text-right text-yellow-600">{fmtCorto(c.d130)}</td>
                              <td className="px-4 py-2 text-right text-orange-600">{fmtCorto(c.d3160)}</td>
                              <td className="px-4 py-2 text-right text-red-600">{fmtCorto(c.d6190)}</td>
                              <td className="px-4 py-2 text-right text-red-900 font-bold">{fmtCorto(c.mas90)}</td>
                              <td className="px-4 py-2 text-right font-semibold">{fmt(c.total)}</td>
                              <td className="px-4 py-2 text-center">
                                <span className={badgeClass(c.riesgo)}>{c.riesgo}</span>
                              </td>
                            </tr>
                          ))}
                        </>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-200 font-bold">
                    <tr>
                      <td colSpan={2} className="px-4 py-3">TOTAL GENERAL</td>
                      <td className="px-4 py-3 text-right text-green-600">{fmtCorto(totalVigente)}</td>
                      <td className="px-4 py-3 text-right text-yellow-600">{fmtCorto(ciudadesAgregadas.reduce((s, c) => s + c.d130, 0))}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{fmtCorto(ciudadesAgregadas.reduce((s, c) => s + c.d3160, 0))}</td>
                      <td className="px-4 py-3 text-right text-red-600">{fmtCorto(ciudadesAgregadas.reduce((s, c) => s + c.d6190, 0))}</td>
                      <td className="px-4 py-3 text-right text-red-900">{fmtCorto(criticos90)}</td>
                      <td className="px-4 py-3 text-right text-xl">{fmt(totalCartera)}</td>
                      <td className="px-4 py-3 text-center">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="bg-[#1a1a2e] text-white/50 text-center py-6 mt-12 text-xs">
        Informe de Cartera - Grupo RP · Datos de ejemplo (DUMMY) · Abril 2026
      </div>
    </div>
  )
}
