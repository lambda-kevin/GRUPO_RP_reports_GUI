import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Plus } from 'lucide-react'
import { getPedidos } from '../api/pedidos'
import { Header } from '../components/layout/Header'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const estadoNivel: Record<string, 'ok' | 'warn' | 'error' | 'info'> = {
  borrador: 'info',
  en_planeacion: 'warn',
  confirmado: 'ok',
  remisionado: 'ok',
  facturado: 'ok',
  cancelado: 'error',
  negado: 'error',
}

const estadoLabel: Record<string, string> = {
  borrador: 'Borrador',
  en_planeacion: 'En planeacion',
  confirmado: 'Confirmado',
  remisionado: 'Remisionado',
  facturado: 'Facturado',
  cancelado: 'Cancelado',
  negado: 'Negado',
}

export const Pedidos = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['pedidos'],
    queryFn: getPedidos,
  })

  return (
    <div>
      <Header title="Pedidos" subtitle="Gestion de ordenes quirurgicas" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">
            {data?.length ?? 0} pedidos
          </p>
          <button className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" />
            Nuevo pedido
          </button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !data?.length ? (
          <Card><EmptyState icon={ClipboardList} title="Sin pedidos" description="No hay pedidos registrados aun" /></Card>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Paciente</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha cirugia</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Canal</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Creado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-gray-500 text-xs">{p.consecutivo}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{p.paciente_nombre}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {format(new Date(p.fecha_cirugia), 'dd MMM yyyy HH:mm', { locale: es })}
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{p.canal_entrada}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge nivel={estadoNivel[p.estado] ?? 'info'}>
                          {estadoLabel[p.estado] ?? p.estado}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {format(new Date(p.created_at), 'dd/MM/yy', { locale: es })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
