import { AlertTriangle, ShieldOff } from 'lucide-react'

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const tasaTexto = (t) => Number(t || 0).toLocaleString('es-AR', { maximumFractionDigits: 3 })

/** Texto corto de una configuración: "0,5% cada 1 día" */
export function describirPunitorio(config) {
  if (!config) return ''
  const dias = Number(config.cadaDias) || 1
  return `${tasaTexto(config.tasa)}% cada ${dias} ${dias === 1 ? 'día' : 'días'}`
}

/**
 * Campo numérico libre para "cada cuántos días" se aplica el punitorio.
 * Mientras se escribe se permite el campo vacío; al salir se corrige a un
 * entero ≥ 1 para que el cálculo nunca divida por cero.
 */
export function CampoDias({ valor, onCambiar, className = '', ...resto }) {
  return (
    <input
      type="number"
      min="1"
      step="1"
      inputMode="numeric"
      value={valor}
      onChange={(e) => onCambiar(e.target.value)}
      onBlur={(e) => onCambiar(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
      className={className || 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-200'}
      {...resto}
    />
  )
}

/**
 * Resumen del punitorio OBLIGATORIO que se suma al cobro de cuotas vencidas.
 * No se puede desactivar acá: se configura en la ficha del préstamo
 * (exención o valores propios) o en la configuración general.
 *
 * config:    configuración efectiva del préstamo ({ aplica, tasa, cadaDias, personalizada })
 * pendiente: resultado de punitorioPendiente() ({ total, cuotas })
 * vencidas:  cuotas vencidas (para mostrar el aviso aunque esté exento)
 */
export default function CalculadoraPunitorio({ config, pendiente, vencidas = [] }) {
  if (!vencidas.length) return null

  if (!config?.aplica) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 flex items-start gap-2 text-xs text-slate-600">
        <ShieldOff className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Préstamo exento de punitorio.</strong> Las cuotas vencidas no generan recargo
          (se cambia desde la ficha del préstamo).
        </span>
      </div>
    )
  }

  const filas = (pendiente?.cuotas || []).filter((c) => c.periodosTotales > 0)

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/70 p-3.5 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-bold text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {vencidas.length === 1
            ? `Cuota ${vencidas[0].numeroCuota} vencida hace ${vencidas[0].diasAtraso} ${vencidas[0].diasAtraso === 1 ? 'día' : 'días'}`
            : `${vencidas.length} cuotas vencidas`}
        </span>
        <span className="text-[11px] font-bold text-red-800 bg-white/70 border border-red-200 rounded-lg px-2 py-0.5">
          Punitorio {describirPunitorio(config)}{config.personalizada ? ' (propio)' : ''}
        </span>
      </div>

      {filas.length > 0 && (
        <div className="space-y-1 text-[11px] text-slate-600">
          {filas.map((c) => (
            <div key={c.numeroCuota} className="flex justify-between gap-2">
              <span>
                Cuota {c.numeroCuota}: ${fmt(c.restante)} × {tasaTexto(config.tasa)}% × {c.periodosNuevos}{' '}
                {c.periodosNuevos === 1 ? 'período' : 'períodos'}
                {c.periodosNuevos < c.periodosTotales ? ` (${c.periodosTotales - c.periodosNuevos} ya cobrados)` : ''}
              </span>
              <span className="font-bold text-slate-800 shrink-0">${fmt(c.monto)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center pt-2 border-t border-red-200">
        <span className="text-xs font-bold text-red-800">Punitorio que se suma al cobro</span>
        <span className="text-base font-bold text-red-700">${fmt(pendiente?.total)}</span>
      </div>
    </div>
  )
}
