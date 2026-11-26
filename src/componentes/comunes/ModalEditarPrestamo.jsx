import { useEffect, useState } from 'react'
import { X, Pencil, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { redondear2, fechaLocalISO, TOLERANCIA_SALDO } from '../../lib/finanzas'
import { avisar } from '../../lib/avisos'

const FRECUENCIAS = [
  { id: 'diario', label: 'Diaria' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'quincenal', label: 'Quincenal' },
  { id: 'mensual', label: 'Mensual' }
]

const ESTADOS = [
  { id: 'activo', label: 'Activo' },
  { id: 'finalizado', label: 'Finalizado (cobrado)' },
  { id: 'cancelado', label: 'Cancelado / anulado' }
]

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Interés % implícito de un préstamo: (total / capital - 1) × 100 */
const interesDe = (p) => {
  const capital = Number(p?.monto_capital || 0)
  const total = Number(p?.monto_total_pagar || 0)
  return capital > 0 ? redondear2((total / capital - 1) * 100) : 0
}

/**
 * Edición de TODOS los datos de un préstamo ya otorgado:
 * cliente, fecha de inicio, capital, interés, cuotas, frecuencia y estado.
 * El total a devolver y el valor de cuota se recalculan solos.
 */
export default function ModalEditarPrestamo({ isOpen, onClose, prestamo, totalCobrado = 0, usuarioLogueado = null, onGuardado }) {
  const [clientes, setClientes] = useState([])
  const [form, setForm] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !prestamo) return
    setError('')
    setForm({
      cliente_id: prestamo.cliente_id || '',
      fecha_inicio: fechaLocalISO(prestamo.fecha_inicio || prestamo.created_at),
      monto_capital: String(Number(prestamo.monto_capital || 0)),
      interes: String(interesDe(prestamo)),
      cantidad_cuotas: String(Number(prestamo.cantidad_cuotas || 1)),
      frecuencia: prestamo.frecuencia || 'mensual',
      estado: prestamo.estado || 'activo'
    })
    supabase
      .from('clientes')
      .select('id, nombre_completo, activo')
      .order('nombre_completo', { ascending: true })
      .then(({ data }) => setClientes(data || []))
  }, [isOpen, prestamo])

  if (!isOpen || !prestamo || !form) return null

  // Cálculos en vivo
  const capital = Math.max(0, Number(form.monto_capital) || 0)
  const interes = Math.max(0, Number(form.interes) || 0)
  const cuotas = Math.max(1, Math.floor(Number(form.cantidad_cuotas) || 1))
  // Si no se tocaron capital ni interés se conservan los montos originales
  // (el % mostrado está redondeado y recalcular podría mover centavos)
  const sinCambioMontos = Number(form.monto_capital) === Number(prestamo.monto_capital) &&
    Number(form.interes) === interesDe(prestamo)
  const total = sinCambioMontos ? Number(prestamo.monto_total_pagar) : redondear2(capital * (1 + interes / 100))
  const valorCuota = sinCambioMontos && cuotas === Number(prestamo.cantidad_cuotas) && Number(prestamo.monto_cuota) > 0
    ? Number(prestamo.monto_cuota)
    : redondear2(total / cuotas)
  const cobradoDeMas = totalCobrado > total + TOLERANCIA_SALDO

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.cliente_id) return setError('Elegí el cliente del préstamo.')
    if (!form.fecha_inicio) return setError('Indicá la fecha de inicio.')
    if (!(capital > 0)) return setError('El capital debe ser mayor a 0.')
    if (cobradoDeMas) {
      return setError(`Ya se cobraron $${fmt(totalCobrado)}: el nuevo total a devolver ($${fmt(total)}) no puede ser menor.`)
    }

    // Si con los nuevos montos ya está todo pagado, se finaliza solo
    let estado = form.estado
    if (estado === 'activo' && totalCobrado >= total - TOLERANCIA_SALDO && totalCobrado > 0) estado = 'finalizado'
    if (estado === 'finalizado' && totalCobrado < total - TOLERANCIA_SALDO &&
      !window.confirm(`El préstamo todavía tiene un saldo de $${fmt(total - totalCobrado)}.\n¿Marcarlo como finalizado igual?`)) {
      return
    }

    const cambios = {
      cliente_id: form.cliente_id,
      fecha_inicio: form.fecha_inicio,
      monto_capital: capital,
      monto_total_pagar: total,
      cantidad_cuotas: cuotas,
      monto_cuota: valorCuota,
      frecuencia: form.frecuencia,
      estado
    }

    // Lista de cambios para la auditoría
    const etiquetas = {
      cliente_id: 'Cliente', fecha_inicio: 'Fecha de inicio', monto_capital: 'Capital',
      monto_total_pagar: 'Total a devolver', cantidad_cuotas: 'Cuotas', monto_cuota: 'Valor de cuota',
      frecuencia: 'Frecuencia', estado: 'Estado'
    }
    const nombreCliente = (id) => clientes.find((c) => c.id === id)?.nombre_completo || 's/d'
    const mostrar = (campo, v) => campo === 'cliente_id' ? nombreCliente(v)
      : ['monto_capital', 'monto_total_pagar', 'monto_cuota'].includes(campo) ? `$${fmt(v)}`
        : campo === 'fecha_inicio' ? fechaLocalISO(v).split('-').reverse().join('/') : String(v ?? 's/d')
    const anterior = { ...prestamo, fecha_inicio: fechaLocalISO(prestamo.fecha_inicio) }
    const lista = Object.keys(etiquetas)
      .filter((k) => String(anterior[k] ?? '') !== String(cambios[k] ?? '') &&
        !(typeof cambios[k] === 'number' && Number(anterior[k]) === cambios[k]))
      .map((k) => ({ campo: etiquetas[k], anterior: mostrar(k, anterior[k]), nuevo: mostrar(k, cambios[k]) }))

    if (lista.length === 0) {
      onClose()
      return
    }

    setGuardando(true)
    try {
      const { data, error: err } = await supabase.from('prestamos').update(cambios).eq('id', prestamo.id).select().single()
      if (err) throw err

      const { error: errAudit } = await supabase.from('auditoria_actividades').insert([{
        tipo: 'PRÉSTAMO',
        accion: 'EDITADO',
        titulo: `Préstamo #${String(prestamo.id).substring(0, 8)}`,
        subtitulo: `Modificación de préstamo (${lista.length} ${lista.length === 1 ? 'campo' : 'campos'})`,
        detalles: lista.map((c) => `${c.campo}: "${c.anterior}" ➔ "${c.nuevo}"`).join(' · '),
        persona: nombreCliente(cambios.cliente_id),
        autor_id: usuarioLogueado?.id || null,
        autor_nombre: usuarioLogueado?.nombre || 'Administración',
        autor_rol: usuarioLogueado?.rol || 'admin',
        estado: 'Datos Actualizados',
        metadata: { ...data, cambios_realizados: lista }
      }])
      if (errAudit) console.warn('Aviso al registrar auditoría:', errAudit.message)

      avisar('Préstamo actualizado')
      onGuardado?.(data)
      onClose()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el préstamo.')
    } finally {
      setGuardando(false)
    }
  }

  const claseInput = 'w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]'
  const claseLabel = 'block text-xs font-bold text-slate-700 mb-1'

  return (
    <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="modal-panel w-full max-w-xl rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63] flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> EDITAR PRÉSTAMO
            </span>
            <h2 className="text-2xl font-serif font-bold text-[#1d2939] mt-0.5">Préstamo #{String(prestamo.id).substring(0, 8)}</h2>
          </div>
          <button onClick={onClose} type="button" aria-label="Cerrar" className="rounded-xl p-2 text-slate-400 hover:bg-black/5 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className={claseLabel}>Cliente</label>
            <select value={form.cliente_id} onChange={set('cliente_id')} className={`${claseInput} cursor-pointer`}>
              <option value="">-- Seleccioná un cliente --</option>
              {clientes
                .filter((c) => c.activo !== false || c.id === prestamo.cliente_id)
                .map((c) => <option key={c.id} value={c.id}>{c.nombre_completo}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={claseLabel}>Fecha de inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} className={claseInput} />
            </div>
            <div>
              <label className={claseLabel}>Frecuencia de pago</label>
              <select value={form.frecuencia} onChange={set('frecuencia')} className={`${claseInput} cursor-pointer`}>
                {FRECUENCIAS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={claseLabel}>Capital ($)</label>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={form.monto_capital} onChange={set('monto_capital')} className={claseInput} />
            </div>
            <div>
              <label className={claseLabel}>Interés (%)</label>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={form.interes} onChange={set('interes')} className={claseInput} />
            </div>
            <div>
              <label className={claseLabel}>Cuotas</label>
              <input type="number" min="1" step="1" inputMode="numeric" value={form.cantidad_cuotas} onChange={set('cantidad_cuotas')} className={claseInput} />
            </div>
          </div>

          <div>
            <label className={claseLabel}>Estado</label>
            <select value={form.estado} onChange={set('estado')} className={`${claseInput} cursor-pointer`}>
              {ESTADOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            {form.estado === 'cancelado' && (
              <p className="text-[11px] text-slate-500 mt-1">Un préstamo cancelado deja de aparecer en cobranzas y no cuenta en las estadísticas.</p>
            )}
          </div>

          {/* Resumen recalculado */}
          <div className="p-4 rounded-2xl bg-[#0d6b63]/10 border border-[#0d6b63]/20 grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[10px] font-bold uppercase text-[#0d6b63]">Total a devolver</span>
              <span className="text-lg font-bold text-slate-900">${fmt(total)}</span>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-bold uppercase text-[#0d6b63]">{cuotas} {cuotas === 1 ? 'cuota' : 'cuotas'} de</span>
              <span className="text-lg font-bold text-slate-900">${fmt(valorCuota)}</span>
            </div>
            {totalCobrado > 0 && (
              <div className="col-span-2 text-xs text-slate-600 border-t border-[#0d6b63]/20 pt-2">
                Ya cobrado: <strong>${fmt(totalCobrado)}</strong> · Saldo con los nuevos datos: <strong>${fmt(Math.max(0, total - totalCobrado))}</strong>
              </div>
            )}
          </div>

          {(totalCobrado > 0) && (
            <p className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Los cobros ya registrados se mantienen: el cronograma de cuotas se recalcula con los nuevos datos.
            </p>
          )}

          {error && <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-200">⚠️ {error}</p>}

          <div className="form-acciones flex justify-end items-center gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-line bg-white font-bold text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={guardando || cobradoDeMas}
              className="px-5 py-2.5 rounded-2xl bg-[#0d6b63] text-white font-bold text-sm shadow-sm hover:bg-[#0b5a52] disabled:opacity-50 cursor-pointer">
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
