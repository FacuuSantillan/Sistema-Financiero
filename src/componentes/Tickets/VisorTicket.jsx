import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, FileSpreadsheet, Receipt, Landmark } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { escucharTickets } from '../../lib/tickets'
import {
  calcularCronograma, cronogramaConVencimientos, configPunitorioPrestamo,
  normalizarPunitorioGeneral, parseFechaLocal, redondear2
} from '../../lib/finanzas'
import { descargarExcel } from '../../lib/excel'
import { abrirWhatsApp, normalizarTelefonoAR, mensajeComprobante } from '../../lib/whatsapp'
import { avisar } from '../../lib/avisos'

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fFecha = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
const fFechaHora = (d) => (d ? new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
const nro = (id) => String(id || '').substring(0, 8).toUpperCase()
const FRECUENCIA = { diario: 'Diaria', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }
const documento = (c) => (c?.dni ? `${c.tipo_documento || 'DNI'} ${c.dni}` : c?.tipo_documento === 'SIN DOCUMENTO' ? 'Sin documento' : '')

// ----------------------------------------------------------
// Carga de datos
// ----------------------------------------------------------

async function nombreUsuario(id) {
  if (!id) return ''
  const { data } = await supabase.from('usuarios').select('nombre_completo').eq('id', id).maybeSingle()
  return data?.nombre_completo || ''
}

async function cargarProvincia(id) {
  if (!id) return ''
  const { data } = await supabase.from('provincias').select('nombre').eq('id', id).maybeSingle()
  return data?.nombre || ''
}

async function cargarTicketPrestamo(id) {
  const { data: prestamo, error } = await supabase.from('prestamos').select('*').eq('id', id).maybeSingle()
  if (error || !prestamo) throw new Error(error?.message || 'No se encontró el préstamo.')

  const [{ data: cliente }, { data: conf }, autor] = await Promise.all([
    supabase.from('clientes').select('*').eq('id', prestamo.cliente_id).maybeSingle(),
    supabase.from('configuracion').select('punitorio_tasa, punitorio_cada_dias').eq('id', 1).maybeSingle(),
    nombreUsuario(prestamo.creado_por)
  ])

  const { cuotas } = cronogramaConVencimientos(prestamo, 0)
  return {
    tipo: 'prestamo',
    prestamo,
    cliente: cliente || {},
    provincia: await cargarProvincia(cliente?.provincia_id),
    cuotas,
    punitorio: configPunitorioPrestamo(prestamo, normalizarPunitorioGeneral(conf)),
    autor
  }
}

async function cargarTicketCobro(id) {
  const { data: pago, error } = await supabase.from('pagos').select('*').eq('id', id).maybeSingle()
  if (error || !pago) throw new Error(error?.message || 'No se encontró el cobro.')

  const [{ data: prestamo }, { data: pagosPrestamo }, autor] = await Promise.all([
    supabase.from('prestamos').select('*').eq('id', pago.prestamo_id).maybeSingle(),
    supabase.from('pagos').select('id, monto_cobrado, created_at').eq('prestamo_id', pago.prestamo_id),
    nombreUsuario(pago.creado_por)
  ])
  const { data: cliente } = await supabase.from('clientes').select('*')
    .eq('id', pago.cliente_id || prestamo?.cliente_id).maybeSingle()

  // Lo cobrado ANTES de este pago (por orden de registro) para saber qué cuotas cubrió
  const ordenados = [...(pagosPrestamo || [])].sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at) || String(a.id).localeCompare(String(b.id)))
  const indice = ordenados.findIndex((p) => p.id === pago.id)
  const cobradoAntes = ordenados.slice(0, Math.max(0, indice)).reduce((a, p) => a + Number(p.monto_cobrado || 0), 0)
  const cobradoDespues = cobradoAntes + Number(pago.monto_cobrado || 0)

  const antes = calcularCronograma(prestamo || {}, cobradoAntes)
  const despues = cronogramaConVencimientos(prestamo || {}, cobradoDespues)
  const cuotasCubiertas = despues.cuotas
    .map((c, i) => ({ ...c, aplicado: redondear2(c.cubierto - (antes.cuotas[i]?.cubierto || 0)) }))
    .filter((c) => c.aplicado > 0)

  return {
    tipo: 'cobro',
    pago,
    prestamo: prestamo || {},
    cliente: cliente || {},
    provincia: await cargarProvincia(cliente?.provincia_id),
    saldoAnterior: antes.saldoPendiente,
    saldoRestante: despues.saldoPendiente,
    cuotasCubiertas,
    cuotasPendientes: despues.cuotas.filter((c) => c.estado !== 'total').length,
    totalCuotas: despues.cuotas.length,
    proxima: despues.cuotaActual,
    autor
  }
}

// ----------------------------------------------------------
// Contenido de los tickets
// ----------------------------------------------------------

function Fila({ label, valor, fuerte = false }) {
  if (valor === '' || valor === null || valor === undefined) return null
  return (
    <div className={`flex justify-between gap-3 ${fuerte ? 'font-bold text-[1.05em]' : ''}`}>
      <span className="text-slate-600 shrink-0">{label}</span>
      <span className="text-right text-slate-900 break-words">{valor}</span>
    </div>
  )
}

const Separador = () => <div className="border-t border-dashed border-slate-400 my-2.5" />

function Encabezado({ titulo, numero, fecha }) {
  return (
    <div className="text-center space-y-0.5">
      <div className="font-serif font-bold text-[1.6em] leading-none">Valora</div>
      <div className="text-[0.75em] tracking-[0.2em] uppercase text-slate-500">Sistema Financiero</div>
      <Separador />
      <div className="font-bold tracking-wide uppercase">{titulo}</div>
      <div className="text-slate-600">Nº {numero}</div>
      <div className="text-slate-600">{fecha}</div>
    </div>
  )
}

function BloqueCliente({ cliente, provincia }) {
  return (
    <div className="space-y-0.5">
      <div className="font-bold uppercase text-[0.8em] tracking-wide text-slate-500 mb-1">Cliente</div>
      <div className="font-bold">{cliente.nombre_completo || 'Cliente'}</div>
      <Fila label="Documento" valor={documento(cliente)} />
      <Fila label="Teléfono" valor={cliente.telefono} />
      <Fila label="Domicilio" valor={cliente.direccion} />
      <Fila label="Localidad" valor={[cliente.localidad, provincia].filter(Boolean).join(', ')} />
      <Fila label="Cond. fiscal" valor={cliente.condicion_fiscal} />
    </div>
  )
}

function TicketPrestamo({ datos }) {
  const { prestamo: p, cliente, provincia, cuotas, punitorio, autor } = datos
  const capital = Number(p.monto_capital || 0)
  const total = Number(p.monto_total_pagar || 0)
  const interes = Math.max(0, total - capital)
  const tasa = capital > 0 ? redondear2((total / capital - 1) * 100) : 0

  return (
    <>
      <Encabezado titulo="Comprobante de préstamo" numero={nro(p.id)} fecha={`Emitido: ${fFechaHora(p.created_at || new Date())}`} />
      <Separador />
      <BloqueCliente cliente={cliente} provincia={provincia} />
      <Separador />
      <div className="space-y-0.5">
        <div className="font-bold uppercase text-[0.8em] tracking-wide text-slate-500 mb-1">Préstamo</div>
        <Fila label="Fecha de inicio" valor={fFecha(parseFechaLocal(p.fecha_inicio))} />
        <Fila label="Capital entregado" valor={`$${fmt(capital)}`} />
        <Fila label={`Interés (${tasa.toLocaleString('es-AR')}%)`} valor={`$${fmt(interes)}`} />
        <Fila label="Total a devolver" valor={`$${fmt(total)}`} fuerte />
        <Fila label="Plan" valor={`${p.cantidad_cuotas} cuota${Number(p.cantidad_cuotas) === 1 ? '' : 's'} de $${fmt(p.monto_cuota)}`} />
        <Fila label="Frecuencia" valor={FRECUENCIA[p.frecuencia] || p.frecuencia} />
      </div>
      <Separador />
      <div className="font-bold uppercase text-[0.8em] tracking-wide text-slate-500 mb-1">Cronograma de pagos</div>
      <table className="w-full">
        <thead>
          <tr className="text-slate-500 text-left">
            <th className="font-semibold py-0.5">Cuota</th>
            <th className="font-semibold py-0.5">Vence</th>
            <th className="font-semibold py-0.5 text-right">Importe</th>
          </tr>
        </thead>
        <tbody>
          {cuotas.map((c) => (
            <tr key={c.numeroCuota} className="border-t border-slate-200">
              <td className="py-0.5">{c.numeroCuota}</td>
              <td className="py-0.5">{fFecha(c.fechaVencimiento)}</td>
              <td className="py-0.5 text-right">${fmt(c.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Separador />
      <p className="text-[0.85em] text-slate-600 leading-snug">
        {punitorio.aplica
          ? <>Las cuotas pagadas fuera de término generan un punitorio del <strong>{punitorio.tasa.toLocaleString('es-AR')}%</strong> sobre el saldo de la cuota cada <strong>{punitorio.cadaDias} {punitorio.cadaDias === 1 ? 'día' : 'días'}</strong> de atraso.</>
          : 'Este préstamo no genera punitorio por mora.'}
      </p>
      {autor && <p className="text-[0.85em] text-slate-600 mt-1.5">Otorgado por: {autor}</p>}

      <div className="grid grid-cols-2 gap-6 mt-10 text-center text-[0.8em] text-slate-600">
        <div className="border-t border-slate-500 pt-1">Firma del cliente<br />Aclaración y DNI</div>
        <div className="border-t border-slate-500 pt-1">Firma y sello<br />Valora</div>
      </div>
      <p className="text-center text-[0.8em] text-slate-500 mt-4">Conserve este comprobante</p>
    </>
  )
}

function TicketCobro({ datos }) {
  const { pago, prestamo, cliente, provincia, saldoAnterior, saldoRestante, cuotasCubiertas, cuotasPendientes, totalCuotas, proxima, autor } = datos
  const montoCuota = Number(pago.monto_cobrado || 0)
  const punitorio = Number(pago.punitorio || 0)
  const cancelado = saldoRestante <= 0.5

  return (
    <>
      <Encabezado titulo="Recibo de cobro" numero={nro(pago.id)} fecha={fFechaHora(pago.created_at || pago.fecha_pago)} />
      <Separador />
      <BloqueCliente cliente={cliente} provincia={provincia} />
      <Separador />
      <div className="space-y-0.5">
        <div className="font-bold uppercase text-[0.8em] tracking-wide text-slate-500 mb-1">Detalle del pago</div>
        <Fila label="Fecha de pago" valor={fFecha(pago.fecha_pago)} />
        <Fila label="Préstamo" valor={`Nº ${nro(prestamo.id)}`} />
        {cuotasCubiertas.map((c) => (
          <Fila key={c.numeroCuota}
            label={`Cuota ${c.numeroCuota} de ${totalCuotas}${c.estado === 'total' ? '' : ' (parcial)'}`}
            valor={`$${fmt(c.aplicado)}`} />
        ))}
        {cuotasCubiertas.length === 0 && <Fila label="Pago de cuotas" valor={`$${fmt(montoCuota)}`} />}
        {punitorio > 0 && <Fila label="Punitorio por mora" valor={`$${fmt(punitorio)}`} />}
        <Fila label="TOTAL ABONADO" valor={`$${fmt(montoCuota + punitorio)}`} fuerte />
        <Fila label="Medio de pago" valor={pago.metodo_pago ? pago.metodo_pago.charAt(0).toUpperCase() + pago.metodo_pago.slice(1) : ''} />
        <Fila label="Observaciones" valor={pago.observaciones} />
      </div>
      <Separador />
      <div className="space-y-0.5">
        <div className="font-bold uppercase text-[0.8em] tracking-wide text-slate-500 mb-1">Estado del préstamo</div>
        <Fila label="Saldo anterior" valor={`$${fmt(saldoAnterior)}`} />
        <Fila label="Saldo restante" valor={cancelado ? 'CANCELADO' : `$${fmt(saldoRestante)}`} fuerte />
        {!cancelado && <Fila label="Cuotas pendientes" valor={`${cuotasPendientes} de ${totalCuotas}`} />}
        {!cancelado && proxima && <Fila label="Próximo vencimiento" valor={`${fFecha(proxima.fechaVencimiento)} · $${fmt(proxima.restante)}`} />}
      </div>
      {autor && <p className="text-[0.85em] text-slate-600 mt-2">Cobrado por: {autor}</p>}
      <div className="grid grid-cols-1 mt-10 text-center text-[0.8em] text-slate-600">
        <div className="border-t border-slate-500 pt-1 mx-auto w-2/3">Firma y sello · Valora</div>
      </div>
      <p className="text-center text-[0.8em] text-slate-500 mt-4">{cancelado ? '¡Préstamo cancelado! Gracias por su pago.' : 'Gracias por su pago'}</p>
    </>
  )
}

// ----------------------------------------------------------
// Exportaciones del ticket (Excel / WhatsApp)
// ----------------------------------------------------------

function filasExcel(datos) {
  const c = datos.cliente
  const cliente = [
    ['CLIENTE'],
    ['Nombre', c.nombre_completo || ''],
    ['Documento', documento(c)],
    ['Teléfono', c.telefono || ''],
    ['Email', c.email || ''],
    ['Domicilio', c.direccion || ''],
    ['Localidad', [c.localidad, datos.provincia].filter(Boolean).join(', ')],
    ['Condición fiscal', c.condicion_fiscal || ''],
    ['Ocupación', c.ocupacion || '']
  ]

  if (datos.tipo === 'prestamo') {
    const p = datos.prestamo
    const capital = Number(p.monto_capital || 0)
    const total = Number(p.monto_total_pagar || 0)
    return {
      nombre: `Valora-prestamo-${nro(p.id)}`,
      hojas: [
        {
          nombre: 'Préstamo',
          anchos: [24, 34],
          filas: [
            ['COMPROBANTE DE PRÉSTAMO', `Nº ${nro(p.id)}`],
            ['Emitido', fFechaHora(p.created_at)],
            [],
            ...cliente,
            [],
            ['PRÉSTAMO'],
            ['Fecha de inicio', fFecha(parseFechaLocal(p.fecha_inicio))],
            ['Capital entregado', capital],
            ['Interés %', capital > 0 ? redondear2((total / capital - 1) * 100) : 0],
            ['Interés $', redondear2(total - capital)],
            ['Total a devolver', total],
            ['Cantidad de cuotas', Number(p.cantidad_cuotas || 1)],
            ['Valor de cuota', Number(p.monto_cuota || 0)],
            ['Frecuencia', FRECUENCIA[p.frecuencia] || p.frecuencia],
            ['Punitorio', datos.punitorio.aplica ? `${datos.punitorio.tasa}% cada ${datos.punitorio.cadaDias} día(s)` : 'Exento'],
            ['Otorgado por', datos.autor || '']
          ]
        },
        {
          nombre: 'Cronograma',
          anchos: [10, 14, 16],
          filas: [['Cuota', 'Vencimiento', 'Importe'], ...datos.cuotas.map((q) => [q.numeroCuota, fFecha(q.fechaVencimiento), q.monto])]
        }
      ]
    }
  }

  const { pago, prestamo } = datos
  return {
    nombre: `Valora-recibo-${nro(pago.id)}`,
    hojas: [{
      nombre: 'Recibo',
      anchos: [26, 34],
      filas: [
        ['RECIBO DE COBRO', `Nº ${nro(pago.id)}`],
        ['Registrado', fFechaHora(pago.created_at)],
        [],
        ...cliente,
        [],
        ['DETALLE DEL PAGO'],
        ['Fecha de pago', fFecha(pago.fecha_pago)],
        ['Préstamo', `Nº ${nro(prestamo.id)}`],
        ...datos.cuotasCubiertas.map((c) => [`Cuota ${c.numeroCuota} de ${datos.totalCuotas}${c.estado === 'total' ? '' : ' (parcial)'}`, c.aplicado]),
        ['Pago de cuotas', Number(pago.monto_cobrado || 0)],
        ['Punitorio', Number(pago.punitorio || 0)],
        ['Total abonado', redondear2(Number(pago.monto_cobrado || 0) + Number(pago.punitorio || 0))],
        ['Medio de pago', pago.metodo_pago || ''],
        ['Observaciones', pago.observaciones || ''],
        [],
        ['ESTADO DEL PRÉSTAMO'],
        ['Saldo anterior', datos.saldoAnterior],
        ['Saldo restante', datos.saldoRestante],
        ['Cuotas pendientes', `${datos.cuotasPendientes} de ${datos.totalCuotas}`],
        ['Próximo vencimiento', datos.proxima ? fFecha(datos.proxima.fechaVencimiento) : '-'],
        ['Cobrado por', datos.autor || '']
      ]
    }]
  }
}

function mensajeWhatsApp(datos) {
  if (datos.tipo === 'cobro') {
    return mensajeComprobante({
      nombre: datos.cliente.nombre_completo,
      monto: datos.pago.monto_cobrado,
      punitorio: datos.pago.punitorio,
      metodo: datos.pago.metodo_pago,
      fecha: parseFechaLocal(datos.pago.fecha_pago),
      saldoRestante: datos.saldoRestante,
      prestamoId: datos.prestamo.id
    })
  }
  const p = datos.prestamo
  const lineas = [
    `Hola ${datos.cliente.nombre_completo || ''}, te enviamos el detalle de tu préstamo Nº ${nro(p.id)}:`,
    '',
    `Capital: $${fmt(p.monto_capital)}`,
    `Total a devolver: $${fmt(p.monto_total_pagar)}`,
    `Plan: ${p.cantidad_cuotas} cuota(s) de $${fmt(p.monto_cuota)} (${(FRECUENCIA[p.frecuencia] || p.frecuencia || '').toLowerCase()})`,
    '',
    'Vencimientos:',
    ...datos.cuotas.map((c) => `• Cuota ${c.numeroCuota}: ${fFecha(c.fechaVencimiento)} - $${fmt(c.monto)}`)
  ]
  if (datos.punitorio.aplica) {
    lineas.push('', `Pagos fuera de término: punitorio del ${datos.punitorio.tasa}% cada ${datos.punitorio.cadaDias} día(s) de atraso.`)
  }
  lineas.push('', '¡Gracias!')
  return lineas.join('\n')
}

// ----------------------------------------------------------
// Visor
// ----------------------------------------------------------

/** Muestra el ticket pedido con abrirTicket(). Va montado una sola vez en App. */
export default function VisorTicket() {
  const [pedido, setPedido] = useState(null)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [formato, setFormato] = useState(() => {
    try { return localStorage.getItem('valora.formatoTicket') || 'ticket' } catch { return 'ticket' }
  })

  useEffect(() => escucharTickets((p) => setPedido({ ...p, vez: Date.now() })), [])

  useEffect(() => {
    if (!pedido) return
    let activo = true
    setCargando(true)
    setError('')
    setDatos(null)
    ;(pedido.tipo === 'prestamo' ? cargarTicketPrestamo(pedido.id) : cargarTicketCobro(pedido.id))
      .then((d) => { if (activo) setDatos(d) })
      .catch((e) => { if (activo) setError(e.message) })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [pedido])

  if (!pedido) return null

  const cerrar = () => { setPedido(null); setDatos(null) }
  const cambiarFormato = (f) => {
    setFormato(f)
    try { localStorage.setItem('valora.formatoTicket', f) } catch { /* sin almacenamiento */ }
  }

  const exportarExcel = async () => {
    try {
      const { nombre, hojas } = filasExcel(datos)
      await descargarExcel(nombre, hojas)
      avisar('Excel descargado')
    } catch (e) {
      avisar(`No se pudo generar el Excel: ${e.message}`, 'error')
    }
  }

  const enviarWhatsApp = async () => {
    const ok = await abrirWhatsApp(datos.cliente.telefono, mensajeWhatsApp(datos))
    if (!ok) avisar('El cliente no tiene un celular válido cargado', 'error')
  }

  const esPrestamo = pedido.tipo === 'prestamo'
  const contenido = datos && (esPrestamo ? <TicketPrestamo datos={datos} /> : <TicketCobro datos={datos} />)
  const claseDocumento = formato === 'a4'
    ? 'ticket-doc ticket-a4 text-[13px]'
    : 'ticket-doc ticket-80 text-[12px]'

  return (
    <>
      <div className="modal-overlay fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
        <div className="modal-panel w-full max-w-lg rounded-3xl bg-cream p-5 sm:p-6 shadow-2xl border border-line max-h-[94vh] modal-panel-full flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-line shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {esPrestamo ? <Landmark className="w-5 h-5 text-[#0d6b63] shrink-0" /> : <Receipt className="w-5 h-5 text-[#0d6b63] shrink-0" />}
              <h2 className="text-lg font-serif font-bold text-[#1d2939] truncate">
                {esPrestamo ? 'Ticket del préstamo' : 'Recibo de cobro'}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex bg-white p-0.5 rounded-xl border border-line text-[11px] font-bold">
                {[['ticket', '80 mm'], ['a4', 'A4']].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => cambiarFormato(id)}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer ${formato === id ? 'bg-[#0d6b63] text-white' : 'text-slate-600'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={cerrar} aria-label="Cerrar" className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Vista previa */}
          <div className="flex-1 overflow-y-auto py-4 bg-slate-100/70 -mx-5 sm:-mx-6 px-3">
            {cargando && <p className="text-sm text-slate-400 text-center py-10">Armando el ticket...</p>}
            {error && <p className="text-sm text-red-600 font-semibold text-center py-10">⚠️ {error}</p>}
            {contenido && (
              <div className={`${claseDocumento} bg-white shadow-md mx-auto p-4 text-slate-900`}>
                {contenido}
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-line shrink-0">
            <button type="button" disabled={!datos} onClick={() => window.print()}
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-[#0d6b63] text-white text-xs font-bold hover:bg-[#0b5a52] disabled:opacity-50 cursor-pointer">
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </button>
            <button type="button" disabled={!datos} onClick={exportarExcel}
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-line bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" /> Excel
            </button>
            <button type="button" disabled={!datos} onClick={enviarWhatsApp}
              title={normalizarTelefonoAR(datos?.cliente?.telefono) ? 'Enviar por WhatsApp' : 'El cliente no tiene celular válido'}
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-[#25D366] text-white text-xs font-bold hover:bg-[#1ebe5a] disabled:opacity-50 cursor-pointer">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true"><path d="M12.05 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.93.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.91.99 6.7 2.78a9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.47 9.46m8.06-17.53A11.33 11.33 0 0 0 12.05.63C5.77.63.66 5.74.66 12.02c0 2.01.52 3.97 1.52 5.7L.56 23.63l6.04-1.58a11.37 11.37 0 0 0 5.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.33-8.05" /></svg>
              WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* Copia que se imprime: va directo en <body> para que no la corte ningún contenedor */}
      {contenido && createPortal(
        <div className={`area-impresion ${claseDocumento} text-black`}>{contenido}</div>,
        document.body
      )}
    </>
  )
}
