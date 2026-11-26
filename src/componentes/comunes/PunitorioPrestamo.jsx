import { useEffect, useState } from 'react'
import { Gavel, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { avisar } from '../../lib/avisos'
import { configPunitorioPrestamo } from '../../lib/finanzas'
import { CampoDias, describirPunitorio } from './CalculadoraPunitorio'

/**
 * Punitorio de UN préstamo: muestra qué se le aplica y permite
 *   - eximirlo (no se cobra punitorio)
 *   - usar la configuración general (por defecto)
 *   - ponerle un % y un intervalo de días propios
 */
export default function PunitorioPrestamo({ prestamo, general, puedeEditar = true, usuarioLogueado = null, nombreCliente = '', onGuardado }) {
  const efectiva = configPunitorioPrestamo(prestamo, general)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ aplica: true, modo: 'general', tasa: '', cadaDias: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!editando) return
    setForm({
      aplica: efectiva.aplica,
      modo: efectiva.personalizada ? 'propio' : 'general',
      tasa: String(efectiva.tasa),
      cadaDias: String(efectiva.cadaDias)
    })
    setError('')
    // Solo al abrir el editor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando])

  const guardar = async () => {
    setGuardando(true)
    setError('')
    const propio = form.aplica && form.modo === 'propio'
    const cambios = {
      punitorio_aplica: form.aplica,
      punitorio_tasa: propio ? Math.max(0, Number(form.tasa) || 0) : null,
      punitorio_cada_dias: propio ? Math.max(1, Math.floor(Number(form.cadaDias) || 1)) : null
    }

    try {
      const { data, error: err } = await supabase.from('prestamos').update(cambios).eq('id', prestamo.id).select().single()
      if (err) {
        throw new Error(err.code === 'PGRST204' || /column/i.test(err.message)
          ? 'Falta actualizar la base: ejecutá db/schema.sql en Supabase.'
          : err.message)
      }

      const nueva = configPunitorioPrestamo(data, general)
      const { error: errAudit } = await supabase.from('auditoria_actividades').insert([{
        tipo: 'PRÉSTAMO',
        accion: 'EDITADO',
        titulo: `Punitorio del préstamo #${String(prestamo.id).substring(0, 8)}`,
        subtitulo: nombreCliente ? `Cliente: ${nombreCliente}` : 'Configuración de punitorio',
        detalles: `Antes: ${efectiva.aplica ? describirPunitorio(efectiva) : 'exento'} ➔ Ahora: ${nueva.aplica ? describirPunitorio(nueva) + (nueva.personalizada ? ' (propio)' : ' (general)') : 'exento'}`,
        persona: nombreCliente || null,
        autor_id: usuarioLogueado?.id || null,
        autor_nombre: usuarioLogueado?.nombre || 'Administración',
        autor_rol: usuarioLogueado?.rol || 'admin',
        estado: 'Datos Actualizados',
        metadata: data
      }])
      if (errAudit) console.warn('Aviso al registrar auditoría de punitorio:', errAudit.message)

      avisar(nueva.aplica ? `Punitorio del préstamo: ${describirPunitorio(nueva)}` : 'Préstamo marcado como exento de punitorio')
      onGuardado?.(data)
      setEditando(false)
    } catch (e) {
      setError(e.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const claseInput = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 disabled:bg-slate-100 disabled:text-slate-400'

  return (
    <div className="p-4 rounded-2xl bg-white border border-line space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-2 rounded-xl shrink-0 ${efectiva.aplica ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
            <Gavel className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">PUNITORIO POR MORA</span>
            <span className="text-sm font-bold text-slate-900">
              {efectiva.aplica ? describirPunitorio(efectiva) : 'Exento — no se cobra punitorio'}
            </span>
            {efectiva.aplica && (
              <span className={`ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${efectiva.personalizada ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                {efectiva.personalizada ? 'Propio' : 'General'}
              </span>
            )}
          </div>
        </div>
        {puedeEditar && !editando && (
          <button type="button" onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Pencil className="w-3.5 h-3.5" /> Cambiar
          </button>
        )}
      </div>

      {editando && (
        <div className="space-y-3 pt-1 border-t border-line">
          <label className="flex items-center gap-2 pt-3 text-sm font-bold text-slate-800 cursor-pointer select-none">
            <input type="checkbox" checked={form.aplica} onChange={(e) => setForm((f) => ({ ...f, aplica: e.target.checked }))}
              className="w-5 h-5 accent-[#0d6b63] cursor-pointer" />
            Aplicar punitorio a este préstamo
          </label>

          {form.aplica && (
            <div className="space-y-2.5">
              <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input type="radio" name={`modo-${prestamo.id}`} checked={form.modo === 'general'}
                  onChange={() => setForm((f) => ({ ...f, modo: 'general' }))} className="w-4 h-4 mt-0.5 accent-[#0d6b63]" />
                <span>Usar la configuración general <strong>({describirPunitorio(general)})</strong></span>
              </label>
              <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input type="radio" name={`modo-${prestamo.id}`} checked={form.modo === 'propio'}
                  onChange={() => setForm((f) => ({ ...f, modo: 'propio' }))} className="w-4 h-4 mt-0.5 accent-[#0d6b63]" />
                <span>Usar un punitorio propio para este préstamo</span>
              </label>

              {form.modo === 'propio' && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Interés (%)</label>
                    <input type="number" min="0" step="0.01" value={form.tasa}
                      onChange={(e) => setForm((f) => ({ ...f, tasa: e.target.value }))} className={claseInput} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Cada (días)</label>
                    <CampoDias valor={form.cadaDias} onCambiar={(v) => setForm((f) => ({ ...f, cadaDias: v }))} className={claseInput} />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-lg border border-red-200">⚠️ {error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(false)} disabled={guardando}
              className="px-4 py-2 rounded-xl border border-line bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={guardando}
              className="px-4 py-2 rounded-xl bg-[#0d6b63] text-white text-xs font-bold hover:bg-[#0b5a52] disabled:opacity-50 cursor-pointer">
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
