import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export const AppLayout = () => (
  <div className="flex h-screen bg-gray-50">
    <Sidebar />
    <div className="flex-1 ml-64 flex flex-col min-h-screen overflow-hidden">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  </div>
)
