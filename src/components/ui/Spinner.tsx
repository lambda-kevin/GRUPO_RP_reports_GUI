import { clsx } from 'clsx'

export const Spinner = ({ className }: { className?: string }) => (
  <svg
    className={clsx('animate-spin', className ?? 'h-5 w-5 text-primary-600')}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

/** Full-area centered loading screen — use for page-level skeletons */
export const PageLoader = ({ label = 'Cargando...' }: { label?: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
    <svg
      className="animate-spin h-14 w-14 text-green-600"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <p className="text-base font-medium text-gray-700 tracking-wide">{label}</p>
  </div>
)
