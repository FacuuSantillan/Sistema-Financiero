import { useState } from 'react'
import { Gavel, Pencil } from 'lucide-react'
import { usePunitorioGeneral } from '../../lib/usePunitorioGeneral'
import { avisar } from '../../lib/avisos'
import { CampoDias, describirPunitorio } from './CalculadoraPunitorio'

/**
 * Configuración GENERAL del punitorio por mora (tabla `configuracion`).
 * Se aplica obligatoriamente a todos los préstamos que no estén exentos
 * ni tengan un punitorio propio.
 */
export default function ConfigPunitorioGeneral({ activo = true }) {
  const { config, error: errorCarga, guardar } = usePunitorioGeneral(activo)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ tasa: '', cadaDias: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const abrir = () => {
    setForm({ tasa: String(config.tasa), cadaDias: String(config.cadaDias) })
    setError('')
    setEditando(true)
  }

  const confirmar = async () => {
    setGuardando(true)
    setError('')
    try {
      await guardar(form)
      avisar('Punitorio general actualizado: se aplica a todos los préstamos sin configuración propia')
      setEditando(false)
    } catch (e) {
      setError(e.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const claseInput = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20'

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-3.5 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-white text-red-700 border border-red-100 shrink-0">
            <Gavel className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-red-800/80">Punitorio por mora · general</span>
            <span className="block text-sm font-bold text-slate-900">{describirPunitorio(config)}</span>
          </div>
        </div>
        {!editando && (
          <button type="button" onClick={abrir}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Pencil className="w-3.5 h-3.5" /> Cambiar
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-600 leading-snug">
        Se aplica a todos los préstamos sobre el saldo de cada cuota vencida. Cada préstamo puede eximirse o
        tener un punitorio propio desde su ficha.
      </p>

      {editando && (
        <div className="space-y-2.5 pt-2 border-t border-red-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Interés (%)</label>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={form.tasa}
                onChange={(e) => setForm((f) => ({ ...f, tasa: e.target.value }))} className={claseInput} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Se aplica cada (días)</label>
              <CampoDias valor={form.cadaDias} onCambiar={(v) => setForm((f) => ({ ...f, cadaDias: v }))} className={claseInput} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(false)} disabled={guardando}
              className="px-4 py-2 rounded-xl border border-line bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
              Cancelar
            </button>
            <button type="button" onClick={confirmar} disabled={guardando}
              className="px-4 py-2 rounded-xl bg-[#0d6b63] text-white text-xs font-bold hover:bg-[#0b5a52] disabled:opacity-50 cursor-pointer">
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {(error || errorCarga) && (
        <p className="text-xs text-amber-800 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">⚠️ {error || errorCarga}</p>
      )}
    </div>
  )
}
