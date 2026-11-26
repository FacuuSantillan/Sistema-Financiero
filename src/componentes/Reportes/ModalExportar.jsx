import { useState } from 'react'
import { X, FileSpreadsheet, Download } from 'lucide-react'
import { exportarReporteGeneral } from '../../lib/reportes'
import { avisar } from '../../lib/avisos'

const HOJAS = [
  { id: 'resumen', label: 'Resumen', detalle: 'Totales del período y estado de la cartera' },
  { id: 'clientes', label: 'Clientes', detalle: 'Datos completos, préstamos activos y saldo' },
  { id: 'prestamos', label: 'Préstamos activos', detalle: 'Cuotas, cobrado, saldo, vencimientos y mora' },
  { id: 'cobros', label: 'Cobros realizados', detalle: 'Cada pago con cuota, punitorio y medio de pago' },
  { id: 'punitorios', label: 'Punitorios cobrados', detalle: 'Mora cobrada con tasa y días de atraso' },
  { id: 'intereses', label: 'Intereses', detalle: 'Interés pactado, cobrado y pendiente por préstamo' }
]

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function rangoRapido(id) {
  const hoy = new Date()
  if (id === 'mes') return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) }
  if (id === 'mesAnterior') {
    return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)) }
  }
  if (id === 'anio') return { desde: iso(new Date(hoy.getFullYear(), 0, 1)), hasta: iso(hoy) }
  return { desde: '', hasta: '' }
}

/** Exportación a Excel de clientes, préstamos, cobros, punitorios e intereses. */
export default function ModalExportar({ isOpen, onClose }) {
  const [seleccion, setSeleccion] = useState(() => Object.fromEntries(HOJAS.map((h) => [h.id, true])))
  const [rango, setRango] = useState({ desde: '', hasta: '' })
  const [atajo, setAtajo] = useState('todo')
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const elegirAtajo = (id) => {
    setAtajo(id)
    setRango(rangoRapido(id))
  }

  const exportar = async () => {
    setError('')
    if (rango.desde && rango.hasta && rango.desde > rango.hasta) {
      setError('La fecha "desde" es posterior a la fecha "hasta".')
      return
    }
    setExportando(true)
    try {
      await exportarReporteGeneral({ ...rango, hojas: seleccion })
      avisar('Excel descargado')
      onClose()
    } catch (err) {
      console.error('Error al exportar:', err)
      setError(err.message || 'No se pudo generar el archivo.')
    } finally {
      setExportando(false)
    }
  }

  const ninguna = !Object.values(seleccion).some(Boolean)
  const claseInput = 'w-full rounded-2xl border border-line bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20'

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="modal-panel w-full max-w-lg rounded-3xl bg-cream p-6 sm:p-8 shadow-2xl border border-line max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63] flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> REPORTES
            </span>
            <h2 className="text-2xl font-serif font-bold text-[#1d2939] mt-0.5">Exportar a Excel</h2>
          </div>
          <button onClick={onClose} type="button" aria-label="Cerrar" className="rounded-xl p-2 text-slate-400 hover:bg-black/5 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <span className="block text-xs font-bold text-slate-700 mb-2">Hojas del archivo</span>
            <div className="space-y-1.5">
              {HOJAS.map((h) => (
                <label key={h.id} className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-line cursor-pointer hover:border-[#0d6b63]/40">
                  <input type="checkbox" checked={seleccion[h.id]} onChange={(e) => setSeleccion((s) => ({ ...s, [h.id]: e.target.checked }))}
                    className="w-5 h-5 mt-0.5 accent-[#0d6b63] cursor-pointer shrink-0" />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">{h.label}</span>
                    <span className="block text-[11px] text-slate-500">{h.detalle}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold text-slate-700 mb-2">Período (cobros, punitorios e intereses)</span>
            <div className="grid grid-cols-4 gap-1.5 bg-white p-1 rounded-2xl border border-line mb-2">
              {[['todo', 'Todo'], ['mes', 'Este mes'], ['mesAnterior', 'Mes ant.'], ['anio', 'Este año']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => elegirAtajo(id)}
                  className={`py-2 rounded-xl text-xs font-bold cursor-pointer ${atajo === id ? 'bg-[#0d6b63] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Desde</label>
                <input type="date" value={rango.desde} onChange={(e) => { setAtajo(''); setRango((r) => ({ ...r, desde: e.target.value })) }} className={claseInput} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Hasta</label>
                <input type="date" value={rango.hasta} onChange={(e) => { setAtajo(''); setRango((r) => ({ ...r, hasta: e.target.value })) }} className={claseInput} />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">Clientes y préstamos activos siempre muestran el estado actual.</p>
          </div>

          {error && <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-200">⚠️ {error}</p>}

          <div className="form-acciones flex justify-end items-center gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-line bg-white font-bold text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
              Cancelar
            </button>
            <button type="button" onClick={exportar} disabled={exportando || ninguna}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#0d6b63] text-white font-bold text-sm shadow-sm hover:bg-[#0b5a52] disabled:opacity-50 cursor-pointer">
              <Download className="w-4 h-4" /> {exportando ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
