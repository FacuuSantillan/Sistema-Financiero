import { supabase } from './supabaseClient'
import {
  cronogramaConVencimientos, configPunitorioPrestamo, normalizarPunitorioGeneral,
  fechaLocalISO, parseFechaLocal, redondear2, TOLERANCIA_SALDO
} from './finanzas'
import { descargarExcel, FORMATO_MONEDA, FORMATO_FECHA, FORMATO_PORCENTAJE, sufijoFecha } from './excel'

const nro = (id) => String(id || '').substring(0, 8)
const fechaDe = (v) => (v ? parseFechaLocal(v) : null)
const estadoTexto = { activo: 'Activo', finalizado: 'Finalizado', cancelado: 'Cancelado', pendiente: 'Pendiente', cobrado: 'Cobrado' }

/** Trae todo lo necesario para los reportes (una sola vez). */
async function cargarDatos() {
  const [cli, pre, pag, prov, conf] = await Promise.all([
    supabase.from('clientes').select('*').order('nombre_completo', { ascending: true }),
    supabase.from('prestamos').select('*').order('fecha_inicio', { ascending: true }),
    supabase.from('pagos').select('*').order('fecha_pago', { ascending: true }),
    supabase.from('provincias').select('id, nombre'),
    supabase.from('configuracion').select('punitorio_tasa, punitorio_cada_dias').eq('id', 1).maybeSingle()
  ])
  for (const r of [cli, pre, pag]) if (r.error) throw new Error(r.error.message)

  return {
    clientes: cli.data || [],
    prestamos: pre.data || [],
    pagos: pag.data || [],
    provincias: Object.fromEntries((prov.data || []).map((p) => [p.id, p.nombre])),
    general: normalizarPunitorioGeneral(conf.error ? null : conf.data)
  }
}

/**
 * Genera y descarga el Excel con las hojas elegidas.
 * @param {{ desde?: string, hasta?: string, hojas: { resumen, clientes, prestamos, cobros, punitorios, intereses } }} opciones
 *   desde/hasta (YYYY-MM-DD) filtran cobros, punitorios e intereses cobrados.
 */
export async function exportarReporteGeneral({ desde = '', hasta = '', hojas }) {
  const { clientes, prestamos, pagos, provincias, general } = await cargarDatos()

  const clientePorId = Object.fromEntries(clientes.map((c) => [c.id, c]))
  const prestamoPorId = Object.fromEntries(prestamos.map((p) => [p.id, p]))
  const pagosPorPrestamo = {}
  pagos.forEach((p) => { (pagosPorPrestamo[p.prestamo_id] ||= []).push(p) })

  const enRango = (valor) => {
    const f = fechaLocalISO(valor)
    return (!desde || f >= desde) && (!hasta || f <= hasta)
  }
  const pagosPeriodo = pagos.filter((p) => enRango(p.fecha_pago || p.created_at))
  const textoPeriodo = desde || hasta
    ? `${desde ? desde.split('-').reverse().join('/') : 'el inicio'} al ${hasta ? hasta.split('-').reverse().join('/') : 'hoy'}`
    : 'Todo el historial'

  // Estado calculado de cada préstamo
  const analisis = {}
  for (const p of prestamos) {
    const cobrado = (pagosPorPrestamo[p.id] || []).reduce((a, x) => a + Number(x.monto_cobrado || 0), 0)
    const crono = cronogramaConVencimientos(p, cobrado)
    const vencidas = crono.cuotas.filter((c) => c.vencida)
    const capital = Number(p.monto_capital || 0)
    const total = Number(p.monto_total_pagar || 0)
    analisis[p.id] = {
      cobrado,
      saldo: crono.saldoPendiente,
      cuotasPagadas: crono.cuotas.filter((c) => c.estado === 'total').length,
      proxima: crono.cuotaActual,
      vencidas,
      deudaVencida: redondear2(vencidas.reduce((a, c) => a + c.restante, 0)),
      ratioInteres: total > 0 ? Math.max(0, total - capital) / total : 0,
      activo: !['finalizado', 'cancelado'].includes(p.estado) && crono.saldoPendiente > TOLERANCIA_SALDO
    }
  }

  const libro = []

  // ---------- RESUMEN ----------
  if (hojas.resumen) {
    const validos = prestamos.filter((p) => p.estado !== 'cancelado')
    const idsValidos = new Set(validos.map((p) => p.id))
    const cobrosValidos = pagosPeriodo.filter((p) => idsValidos.has(p.prestamo_id))
    const cuotasCobradas = cobrosValidos.reduce((a, p) => a + Number(p.monto_cobrado || 0), 0)
    const punitorios = cobrosValidos.reduce((a, p) => a + Number(p.punitorio || 0), 0)
    const interesCobrado = cobrosValidos.reduce((a, p) => a + Number(p.monto_cobrado || 0) * (analisis[p.prestamo_id]?.ratioInteres || 0), 0)
    const otorgados = validos.filter((p) => enRango(p.fecha_inicio || p.created_at))
    const activos = validos.filter((p) => analisis[p.id].activo)

    libro.push({
      nombre: 'Resumen',
      anchos: [38, 22],
      filas: [
        ['VALORA · SISTEMA FINANCIERO'],
        ['Reporte generado', new Date().toLocaleString('es-AR')],
        ['Período', textoPeriodo],
        [],
        ['COBRANZA DEL PERÍODO'],
        ['Total cobrado (cuotas + punitorios)', redondear2(cuotasCobradas + punitorios)],
        ['Cobrado en cuotas', redondear2(cuotasCobradas)],
        ['Punitorios cobrados', redondear2(punitorios)],
        ['Interés cobrado (incluido en cuotas)', redondear2(interesCobrado)],
        ['Ganancia cobrada (interés + punitorios)', redondear2(interesCobrado + punitorios)],
        ['Cantidad de cobros', cobrosValidos.length],
        [],
        ['PRÉSTAMOS OTORGADOS EN EL PERÍODO'],
        ['Cantidad', otorgados.length],
        ['Capital prestado', redondear2(otorgados.reduce((a, p) => a + Number(p.monto_capital || 0), 0))],
        ['Interés pactado', redondear2(otorgados.reduce((a, p) => a + Math.max(0, Number(p.monto_total_pagar || 0) - Number(p.monto_capital || 0)), 0))],
        [],
        ['CARTERA ACTUAL'],
        ['Préstamos activos', activos.length],
        ['Saldo pendiente de cobro', redondear2(activos.reduce((a, p) => a + analisis[p.id].saldo, 0))],
        ['Préstamos con cuotas vencidas', activos.filter((p) => analisis[p.id].vencidas.length > 0).length],
        ['Deuda vencida', redondear2(activos.reduce((a, p) => a + analisis[p.id].deudaVencida, 0))],
        ['Clientes registrados', clientes.length]
      ]
    })
  }

  // ---------- CLIENTES ----------
  if (hojas.clientes) {
    libro.push({
      nombre: 'Clientes',
      formatos: { 'Saldo pendiente': FORMATO_MONEDA, 'Fecha de alta': FORMATO_FECHA },
      filas: clientes.map((c) => {
        const suyos = prestamos.filter((p) => p.cliente_id === c.id && analisis[p.id]?.activo)
        return {
          Nombre: c.nombre_completo,
          'Tipo doc.': c.tipo_documento || (c.dni ? 'DNI' : ''),
          Documento: c.dni || '',
          Teléfono: c.telefono || '',
          Email: c.email || '',
          'Condición fiscal': c.condicion_fiscal || '',
          Ocupación: c.ocupacion || '',
          Domicilio: c.direccion || '',
          Localidad: c.localidad || '',
          Provincia: provincias[c.provincia_id] || '',
          Estado: c.activo === false ? 'Inactivo' : 'Activo',
          'Préstamos activos': suyos.length,
          'Saldo pendiente': redondear2(suyos.reduce((a, p) => a + analisis[p.id].saldo, 0)),
          'Fecha de alta': fechaDe(c.created_at)
        }
      })
    })
  }

  // ---------- PRÉSTAMOS ACTIVOS ----------
  if (hojas.prestamos) {
    libro.push({
      nombre: 'Préstamos activos',
      formatos: {
        'Fecha inicio': FORMATO_FECHA, Capital: FORMATO_MONEDA, 'Interés %': FORMATO_PORCENTAJE,
        'Total a devolver': FORMATO_MONEDA, 'Valor cuota': FORMATO_MONEDA, Cobrado: FORMATO_MONEDA,
        Saldo: FORMATO_MONEDA, 'Próximo vencimiento': FORMATO_FECHA, 'Deuda vencida': FORMATO_MONEDA
      },
      filas: prestamos.filter((p) => analisis[p.id].activo).map((p) => {
        const a = analisis[p.id]
        const c = clientePorId[p.cliente_id] || {}
        const capital = Number(p.monto_capital || 0)
        const total = Number(p.monto_total_pagar || 0)
        const pun = configPunitorioPrestamo(p, general)
        return {
          Préstamo: nro(p.id),
          Cliente: c.nombre_completo || '',
          Documento: c.dni || '',
          Teléfono: c.telefono || '',
          'Fecha inicio': fechaDe(p.fecha_inicio),
          Capital: capital,
          'Interés %': capital > 0 ? redondear2((total / capital - 1) * 100) : 0,
          'Total a devolver': total,
          Cuotas: Number(p.cantidad_cuotas || 1),
          'Valor cuota': Number(p.monto_cuota || 0),
          Frecuencia: p.frecuencia || 'mensual',
          'Cuotas pagadas': a.cuotasPagadas,
          Cobrado: redondear2(a.cobrado),
          Saldo: a.saldo,
          'Próximo vencimiento': a.proxima?.fechaVencimiento || null,
          'Cuotas vencidas': a.vencidas.length,
          'Días de atraso': a.vencidas[0]?.diasAtraso || 0,
          'Deuda vencida': a.deudaVencida,
          Punitorio: pun.aplica ? `${pun.tasa}% cada ${pun.cadaDias} día(s)${pun.personalizada ? ' (propio)' : ''}` : 'Exento'
        }
      })
    })
  }

  // ---------- COBROS REALIZADOS ----------
  if (hojas.cobros) {
    libro.push({
      nombre: 'Cobros',
      formatos: { Fecha: FORMATO_FECHA, 'Pago de cuota': FORMATO_MONEDA, Punitorio: FORMATO_MONEDA, 'Total cobrado': FORMATO_MONEDA },
      filas: pagosPeriodo.map((p) => {
        const c = clientePorId[p.cliente_id] || clientePorId[prestamoPorId[p.prestamo_id]?.cliente_id] || {}
        return {
          Fecha: fechaDe(p.fecha_pago || p.created_at),
          Recibo: nro(p.id),
          Cliente: c.nombre_completo || '',
          Documento: c.dni || '',
          Préstamo: nro(p.prestamo_id),
          'Pago de cuota': Number(p.monto_cobrado || 0),
          Punitorio: Number(p.punitorio || 0),
          'Total cobrado': redondear2(Number(p.monto_cobrado || 0) + Number(p.punitorio || 0)),
          'Medio de pago': p.metodo_pago || '',
          Observaciones: p.observaciones || ''
        }
      })
    })
  }

  // ---------- PUNITORIOS COBRADOS ----------
  if (hojas.punitorios) {
    libro.push({
      nombre: 'Punitorios',
      formatos: { Fecha: FORMATO_FECHA, Punitorio: FORMATO_MONEDA, 'Tasa %': FORMATO_PORCENTAJE },
      filas: pagosPeriodo.filter((p) => Number(p.punitorio) > 0).map((p) => {
        const c = clientePorId[p.cliente_id] || {}
        const d = p.punitorio_detalle || {}
        const cuotas = Array.isArray(d.cuotas) ? d.cuotas : []
        return {
          Fecha: fechaDe(p.fecha_pago || p.created_at),
          Recibo: nro(p.id),
          Cliente: c.nombre_completo || '',
          Préstamo: nro(p.prestamo_id),
          Punitorio: Number(p.punitorio || 0),
          'Tasa %': d.tasa ?? '',
          'Cada (días)': d.cada_dias ?? '',
          'Cuotas en mora': cuotas.map((x) => x.numero).join(', '),
          'Días de atraso': cuotas.map((x) => x.dias_atraso).join(', ')
        }
      })
    })
  }

  // ---------- INTERESES ----------
  if (hojas.intereses) {
    libro.push({
      nombre: 'Intereses',
      formatos: {
        'Fecha inicio': FORMATO_FECHA, Capital: FORMATO_MONEDA, 'Total a devolver': FORMATO_MONEDA,
        'Interés pactado': FORMATO_MONEDA, 'Cobrado en el período': FORMATO_MONEDA,
        'Interés cobrado': FORMATO_MONEDA, 'Punitorios cobrados': FORMATO_MONEDA, 'Ganancia cobrada': FORMATO_MONEDA,
        'Interés pendiente': FORMATO_MONEDA
      },
      filas: prestamos.filter((p) => p.estado !== 'cancelado').map((p) => {
        const a = analisis[p.id]
        const capital = Number(p.monto_capital || 0)
        const total = Number(p.monto_total_pagar || 0)
        const pagosDelPeriodo = (pagosPorPrestamo[p.id] || []).filter((x) => enRango(x.fecha_pago || x.created_at))
        const cobrado = pagosDelPeriodo.reduce((s, x) => s + Number(x.monto_cobrado || 0), 0)
        const punitorios = pagosDelPeriodo.reduce((s, x) => s + Number(x.punitorio || 0), 0)
        const interesCobrado = redondear2(cobrado * a.ratioInteres)
        return {
          Préstamo: nro(p.id),
          Cliente: clientePorId[p.cliente_id]?.nombre_completo || '',
          'Fecha inicio': fechaDe(p.fecha_inicio),
          Estado: a.activo ? 'Activo' : (estadoTexto[p.estado] || 'Finalizado'),
          Capital: capital,
          'Total a devolver': total,
          'Interés pactado': redondear2(Math.max(0, total - capital)),
          'Cobrado en el período': redondear2(cobrado),
          'Interés cobrado': interesCobrado,
          'Punitorios cobrados': redondear2(punitorios),
          'Ganancia cobrada': redondear2(interesCobrado + punitorios),
          'Interés pendiente': redondear2(a.saldo * a.ratioInteres)
        }
      })
    })
  }

  if (libro.length === 0) throw new Error('Elegí al menos una hoja para exportar.')
  await descargarExcel(`Valora-reporte-${sufijoFecha()}`, libro)
}
