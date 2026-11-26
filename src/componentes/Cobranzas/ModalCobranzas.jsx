import { useEffect, useMemo, useState } from 'react'
import { X, Search, AlertTriangle, Eye, RefreshCw, CalendarClock, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { avisar } from '../../lib/avisos'
import {
  cronogramaConVencimientos, TOLERANCIA_SALDO, configPunitorioPrestamo,
  periodosCobradosPorCuota, punitorioPendiente
} from '../../lib/finanzas'
import { usePunitorioGeneral } from '../../lib/usePunitorioGeneral'
import BotonWhatsApp from '../comunes/BotonWhatsApp'
import { CampoDias, describirPunitorio } from '../comunes/CalculadoraPunitorio'

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'vencidas', label: 'Vencidas' },
  { id: 'semana', label: 'Vencen en 7 días' }
]

/**
 * Listado de cobranzas: una fila por préstamo activo con su próxima cuota impaga.
 */
export default function ModalCobranzas({ isOpen, onClose, onVerFichaPrestamo, version = 0 }) {
  const [filas, setFilas] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')

  // Configuración general de punitorio (compartida, guardada en la base)
  const { config: general, error: errorGeneral, guardar: guardarGeneral } = usePunitorioGeneral(isOpen)
  const [editandoGeneral, setEditandoGeneral] = useState(false)
  const [formGeneral, setFormGeneral] = useState({ tasa: '', cadaDias: '' })
  const [guardandoGeneral, setGuardandoGeneral] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')

  const cargar = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: prestamos, error: errP } = await supabase
        .from('prestamos')
        .select('*, clientes(*)')
        .not('estado', 'in', '(finalizado,cancelado)')

      if (errP) throw errP
      const lista = prestamos || []
      const ids = lista.map((p) => p.id)

      let pagos = []
      if (ids.length > 0) {
        // select('*') trae punitorio_detalle: la mora ya cobrada no se vuelve a sumar
        const { data, error: errPagos } = await supabase.from('pagos').select('*').in('prestamo_id', ids)
        if (errPagos) throw errPagos
        pagos = data || []
      }

      const cobradoPorPrestamo = {}
      const pagosPorPrestamo = {}
      pagos.forEach((p) => {
        cobradoPorPrestamo[p.prestamo_id] = (cobradoPorPrestamo[p.prestamo_id] || 0) + Number(p.monto_cobrado || 0)
        ;(pagosPorPrestamo[p.prestamo_id] ||= []).push(p)
      })

      const resultado = lista
        .map((prestamo) => {
          const cobrado = cobradoPorPrestamo[prestamo.id] || 0
          const { cuotas, cuotaActual, saldoPendiente } = cronogramaConVencimientos(prestamo, cobrado)
          if (!cuotaActual || saldoPendiente <= TOLERANCIA_SALDO) return null
          const vencidas = cuotas.filter((c) => c.vencida)
          return {
            prestamo,
            cliente: prestamo.clientes || {},
            cuota: cuotaActual,
            cantidadCuotas: cuotas.length,
            vencidas,
            deudaVencida: vencidas.reduce((acc, c) => acc + c.restante, 0),
            saldoPendiente,
            periodosCobrados: periodosCobradosPorCuota(pagosPorPrestamo[prestamo.id])
          }
        })
        .filter(Boolean)
        .sort((a, b) => a.cuota.fechaVencimiento - b.cuota.fechaVencimiento)

      setFilas(resultado)
    } catch (err) {
      console.error('Error al cargar cobranzas:', err)
      setError(err.message || 'No se pudo cargar el listado.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    setBusqueda('')
    setFiltro('todos')
  }, [isOpen])

  // Recarga al abrir y cada vez que se registra un cobro desde la ficha
  useEffect(() => {
    if (isOpen) cargar()
  }, [isOpen, version])

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return filas.filter((f) => {
      if (filtro === 'vencidas' && f.vencidas.length === 0) return false
      if (filtro === 'semana' && (f.vencidas.length > 0 || f.cuota.diasAtraso > 0 || diasHasta(f.cuota.fechaVencimiento) > 7)) return false
      if (!texto) return true
      return (
        (f.cliente.nombre_completo || '').toLowerCase().includes(texto) ||
        (f.cliente.dni || '').toLowerCase().includes(texto) ||
        (f.cliente.telefono || '').toLowerCase().includes(texto)
      )
    })
  }, [filas, busqueda, filtro])

  // Punitorio obligatorio de cada préstamo (según su configuración o la general)
  const punitorioDe = (f) => {
    const config = configPunitorioPrestamo(f.prestamo, general)
    return { config, monto: punitorioPendiente(f.vencidas, config, f.periodosCobrados).total }
  }

  const totalVencidas = filas.filter((f) => f.vencidas.length > 0).length
  const montoVencido = filas.reduce((acc, f) => acc + f.deudaVencida, 0)
  const punitorioTotalCartera = filas.reduce((acc, f) => acc + punitorioDe(f).monto, 0)

  const abrirEdicionGeneral = () => {
    setFormGeneral({ tasa: String(general.tasa), cadaDias: String(general.cadaDias) })
    setErrorGuardado('')
    setEditandoGeneral(true)
  }

  const guardarConfigGeneral = async () => {
    setGuardandoGeneral(true)
    setErrorGuardado('')
    try {
      await guardarGeneral(formGeneral)
      avisar('Punitorio general actualizado: se aplica a todos los préstamos sin configuración propia')
      setEditandoGeneral(false)
    } catch (err) {
      setErrorGuardado(err.message || 'No se pudo guardar.')
    } finally {
      setGuardandoGeneral(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4 backdrop-blur-xs">
      <div className="modal-panel w-full max-w-6xl rounded-3xl bg-cream p-4 sm:p-8 shadow-2xl border border-line modal-panel-full h-[92vh] flex flex-col overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-line shrink-0">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#0d6b63]">COBRANZAS</span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#1d2939] mt-0.5">Listado de cuotas</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {filas.length} préstamos activos ·{' '}
              <span className={totalVencidas > 0 ? 'text-red-700 font-bold' : ''}>
                {totalVencidas} con cuotas vencidas (${fmt(montoVencido)})
              </span>
              {punitorioTotalCartera > 0 && (
                <span className="text-red-700 font-bold"> · Punitorios: ${fmt(punitorioTotalCartera)}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={cargar} disabled={loading} aria-label="Actualizar" className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer disabled:opacity-50">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} aria-label="Cerrar" className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 py-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente, DNI o teléfono"
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-line bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0d6b63]/20 focus:border-[#0d6b63]"
            />
          </div>
          <div className="grid grid-cols-3 lg:flex gap-1.5 bg-white/80 p-1 rounded-2xl border border-line">
            {FILTROS.map((f) => (
              <button key={f.id} onClick={() => setFiltro(f.id)}
                className={`px-2 lg:px-3 py-2 lg:py-1.5 rounded-xl text-xs font-bold leading-tight cursor-pointer ${filtro === f.id ? (f.id === 'vencidas' ? 'bg-red-600 text-white' : 'bg-[#0d6b63] text-white') : 'text-slate-600 hover:text-slate-900'}`}>
                {f.label}{f.id === 'vencidas' && totalVencidas > 0 ? ` (${totalVencidas})` : ''}
              </button>
            ))}
          </div>
          {/* Punitorio general (obligatorio para todos los préstamos salvo excepción) */}
          <div className="flex flex-wrap items-center gap-2 bg-white/80 px-3 py-1.5 rounded-2xl border border-red-200 text-xs font-bold text-slate-700">
            {editandoGeneral ? (
              <>
                <span className="text-red-700">Punitorio general:</span>
                <input type="number" min="0" step="0.01" value={formGeneral.tasa}
                  onChange={(e) => setFormGeneral((f) => ({ ...f, tasa: e.target.value }))}
                  className="w-16 rounded-lg border border-line px-2 py-1 text-xs" aria-label="Interés del punitorio general (%)" />
                <span>% cada</span>
                <CampoDias valor={formGeneral.cadaDias} onCambiar={(v) => setFormGeneral((f) => ({ ...f, cadaDias: v }))}
                  className="w-14 rounded-lg border border-line px-2 py-1 text-xs" aria-label="Cada cuántos días" />
                <span>días</span>
                <button type="button" onClick={guardarConfigGeneral} disabled={guardandoGeneral}
                  className="px-2.5 py-1 rounded-lg bg-[#0d6b63] text-white cursor-pointer disabled:opacity-50">
                  {guardandoGeneral ? '...' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setEditandoGeneral(false)}
                  className="px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <span>
                  Punitorio general: <span className="text-red-700">{describirPunitorio(general)}</span>
                </span>
                <button type="button" onClick={abrirEdicionGeneral}
                  className="px-2.5 py-1 rounded-lg border border-line bg-white text-slate-700 hover:bg-slate-50 cursor-pointer">
                  Cambiar
                </button>
              </>
            )}
          </div>
        </div>

        {(errorGuardado || errorGeneral) && (
          <p className="text-xs text-amber-800 font-semibold bg-amber-50 p-2.5 rounded-xl border border-amber-200 mb-2">⚠️ {errorGuardado || errorGeneral}</p>
        )}

        {error && <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-200 mb-2">⚠️ {error}</p>}

        {/* Listado */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading && filas.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">Cargando cuotas...</p>
          ) : filtradas.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">No hay cuotas para mostrar.</p>
          ) : (
            filtradas.map((f) => {
              const vencida = f.vencidas.length > 0
              const { config: configPun, monto: montoPunitorio } = punitorioDe(f)
              const dias = diasHasta(f.cuota.fechaVencimiento)
              const cuotaMostrar = vencida ? f.vencidas[0] : f.cuota

              return (
                <div key={f.prestamo.id}
                  className={`rounded-2xl border p-3.5 sm:p-4 grid grid-cols-2 md:grid-cols-[1.6fr_1fr_1fr_1.3fr_auto] gap-x-3 gap-y-2.5 items-center ${vencida ? 'bg-red-50 border-red-300' : 'bg-white border-line'}`}>
                  {/* En celular: cliente + acciones arriba, importe y vencimiento al medio, estado abajo */}
                  {/* Cliente */}
                  <div className="min-w-0 order-1 md:order-none">
                    <span className="block font-bold text-slate-900 truncate">{f.cliente.nombre_completo || 'Cliente'}</span>
                    <span className="block text-[11px] text-slate-500 font-medium truncate">
                      {[f.cliente.dni ? `${f.cliente.tipo_documento || 'DNI'} ${f.cliente.dni}` : null, f.cliente.telefono, f.cliente.localidad].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                    </span>
                  </div>

                  {/* Cuota */}
                  <div className="order-3 md:order-none">
                    <span className="block text-[10px] font-bold uppercase text-slate-400">Cuota {cuotaMostrar.numeroCuota} de {f.cantidadCuotas}</span>
                    <span className="block text-lg md:text-base font-bold text-slate-900">${fmt(cuotaMostrar.restante)}</span>
                  </div>

                  {/* Vencimiento */}
                  <div className="order-4 md:order-none text-right md:text-left">
                    <span className="block text-[10px] font-bold uppercase text-slate-400">Vencimiento</span>
                    <span className={`block text-base md:text-sm font-bold ${vencida ? 'text-red-700' : 'text-slate-800'}`}>{fmtFecha(cuotaMostrar.fechaVencimiento)}</span>
                  </div>

                  {/* Estado */}
                  <div className="order-5 md:order-none col-span-2 md:col-span-1">
                    {vencida ? (
                      <div className="rounded-xl bg-red-600 text-white px-3 py-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold uppercase">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          Vencida · {f.vencidas[0].diasAtraso} {f.vencidas[0].diasAtraso === 1 ? 'día' : 'días'}
                        </span>
                        <span className="block text-[11px] font-semibold text-red-100 mt-0.5">
                          {[
                            f.vencidas.length > 1 ? `${f.vencidas.length} cuotas · $${fmt(f.deudaVencida)}` : null,
                            !configPun.aplica
                              ? 'Exento de punitorio'
                              : montoPunitorio > 0
                                ? `Punitorio $${fmt(montoPunitorio)}${configPun.personalizada ? ' (propio)' : ''}`
                                : null
                          ].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    ) : dias === 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 border border-amber-200">
                        <CalendarClock className="w-4 h-4" /> Vence hoy
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4" /> Al día · vence en {dias} {dias === 1 ? 'día' : 'días'}
                      </span>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="order-2 md:order-none flex items-center gap-2 justify-end">
                    {vencida && (
                      <BotonWhatsApp
                        datos={{
                          nombre: f.cliente.nombre_completo,
                          telefono: f.cliente.telefono,
                          numeroCuota: f.vencidas.length > 1 ? f.vencidas.map((c) => c.numeroCuota).join(', ') : f.vencidas[0].numeroCuota,
                          cantidadCuotas: f.cantidadCuotas,
                          monto: f.deudaVencida,
                          vencimiento: f.vencidas[0].fechaVencimiento,
                          diasAtraso: f.vencidas[0].diasAtraso,
                          punitorio: montoPunitorio
                        }}
                      />
                    )}
                    {onVerFichaPrestamo && (
                      <button onClick={() => onVerFichaPrestamo(f.prestamo)} aria-label="Ver préstamo" title="Ver ficha del préstamo"
                        className="p-2.5 md:p-2 rounded-xl bg-[#0d6b63]/10 text-[#0d6b63] hover:bg-[#0d6b63] hover:text-white cursor-pointer">
                        <Eye className="w-5 h-5 md:w-4 md:h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function diasHasta(fecha) {
  const hoy = new Date()
  const a = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const b = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  return Math.round((b - a) / 86400000)
}
