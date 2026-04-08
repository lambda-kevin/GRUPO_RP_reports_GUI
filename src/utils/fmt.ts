/**
 * Utilidades de formato para pesos colombianos (COP).
 *
 * Convenciones colombianas:
 *   Separador de miles  : punto  (.)   ej. 1.234.567
 *   Separador decimal   : coma   (,)   ej. 1,5
 *   Símbolo de moneda   : $  (pegado al número, sin espacio)
 */

const _intlCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

/**
 * Formato completo COP.
 * Ejemplos: 1234567 → "$1.234.567"
 */
export const fmtCOP = (n: number): string =>
  _intlCOP.format(n).replace(/\u00A0|\s/, '')   // elimina el espacio no-breaking entre $ y número

/**
 * Formato abreviado COP usando convenciones colombianas.
 * Ejemplos:
 *   1.200.000       → "$1,2M"
 *   234.000         → "$234K"
 *   1.500.000.000   → "$1,5MM"   (miles de millones, no "B" que en Colombia = billón = 10^12)
 *   2.000.000.000.000 → "$2B"    (billón colombiano)
 */
export const fmtCOPShort = (n: number): string => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const loc = (val: number, maxDec = 1) =>
    val.toLocaleString('es-CO', { maximumFractionDigits: maxDec })

  if (abs >= 1_000_000_000_000) return `${sign}$${loc(abs / 1_000_000_000_000)}B`
  if (abs >= 1_000_000_000)     return `${sign}$${loc(abs / 1_000_000_000)}MM`
  if (abs >= 1_000_000)         return `${sign}$${loc(abs / 1_000_000)}M`
  if (abs >= 1_000)             return `${sign}$${loc(abs / 1_000, 0)}K`
  return fmtCOP(n)
}

/**
 * Formato de porcentaje con 1 decimal colombiano.
 * Ejemplo: 12.456 → "12,5%"
 */
export const fmtPct = (n: number, decimals = 1): string =>
  `${n.toLocaleString('es-CO', { maximumFractionDigits: decimals })}%`
