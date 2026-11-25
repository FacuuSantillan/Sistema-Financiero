// Utilidades compartidas de fechas y montos.
//
// Fechas: `new Date().toISOString()` devuelve la fecha en UTC, así que en
// Argentina (UTC-3) después de las 21:00 ya marca el día siguiente. Y
// `new Date('2025-03-10')` se interpreta como medianoche UTC, que en hora
// local es el día anterior. Estas funciones trabajan siempre en hora local.

const pad = (n) => String(n).padStart(2, '0')

/** Fecha local de hoy en formato YYYY-MM-DD (para inputs type="date"). */
export function hoyLocalISO() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Convierte una fecha (YYYY-MM-DD) o un timestamp de la base a YYYY-MM-DD local.
 * Las fechas puras se devuelven tal cual; los timestamps se pasan a hora local.
 */
export function fechaLocalISO(valor) {
  if (!valor) return ''
  const texto = String(valor)
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
  const d = new Date(texto)
  if (Number.isNaN(d.getTime())) return texto.substring(0, 10)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Crea un Date local a partir de una fecha o timestamp, sin corrimiento de día. */
export function parseFechaLocal(valor) {
  const iso = fechaLocalISO(valor)
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d)
}

/** Fecha del formulario (YYYY-MM-DD) → timestamp para guardar en `fecha_pago`. */
export function fechaFormularioATimestamp(fechaYMD) {
  if (!fechaYMD) return new Date().toISOString()
  // Mediodía UTC: cae en el mismo día calendario en toda América.
  return new Date(`${fechaYMD}T12:00:00Z`).toISOString()
}

/**
 * Fecha de vencimiento de la cuota N según la frecuencia del préstamo.
 * La cuota 1 vence UN período después de la fecha de inicio:
 *   préstamo del 25/11 mensual → cuota 1: 25/12, cuota 2: 25/01, ...
 */
export function calcularFechaVencimiento(fechaInicio, numeroCuota, frecuencia) {
  const base = parseFechaLocal(fechaInicio)
  const offset = numeroCuota
  const freq = (frecuencia || 'mensual').toLowerCase()

  if (freq.includes('diari')) return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset)
  if (freq.includes('seman')) return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset * 7)
  if (freq.includes('quincen')) return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset * 15)

  // Mensual: si el día no existe en el mes destino (ej. 31), usa el último día del mes.
  const ultimoDiaMesDestino = new Date(base.getFullYear(), base.getMonth() + offset + 1, 0).getDate()
  return new Date(base.getFullYear(), base.getMonth() + offset, Math.min(base.getDate(), ultimoDiaMesDestino))
}

/** Redondea a 2 decimales (centavos). */
export function redondear2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

/** Tolerancia para dar un préstamo por cancelado (diferencias de redondeo). */
export const TOLERANCIA_SALDO = 0.5

/**
 * Distribuye lo cobrado entre las cuotas de un préstamo, trabajando en centavos
 * para evitar errores de coma flotante. La última cuota absorbe la diferencia
 * de redondeo, así la suma de cuotas coincide con el total a pagar.
 */
export function calcularCronograma(prestamo, totalCobrado) {
  const totalCent = Math.round(Number(prestamo?.monto_total_pagar || 0) * 100)
  const cantidad = Math.max(1, Number(prestamo?.cantidad_cuotas || 1))
  const cuotaCent = Math.round(Number(prestamo?.monto_cuota || 0) * 100) || Math.round(totalCent / cantidad)

  let restanteCobrado = Math.round(Number(totalCobrado || 0) * 100)
  const cuotas = []

  for (let i = 1; i <= cantidad; i++) {
    const montoCent = i < cantidad ? cuotaCent : Math.max(0, totalCent - cuotaCent * (cantidad - 1))
    const cubiertoCent = Math.min(montoCent, Math.max(0, restanteCobrado))
    restanteCobrado -= cubiertoCent

    let estado = 'pendiente'
    if (montoCent === 0 || cubiertoCent >= montoCent) estado = 'total'
    else if (cubiertoCent > 0) estado = 'parcial'

    cuotas.push({
      numeroCuota: i,
      monto: montoCent / 100,
      cubierto: cubiertoCent / 100,
      restante: (montoCent - cubiertoCent) / 100,
      estado
    })
  }

  const saldoPendiente = Math.max(0, totalCent - Math.round(Number(totalCobrado || 0) * 100)) / 100
  const cuotaActual = cuotas.find((c) => c.estado !== 'total') || null

  return { cuotas, saldoPendiente, cuotaActual }
}

/** Días enteros entre dos fechas (b - a), ignorando la hora. */
export function diasEntre(a, b) {
  const da = parseFechaLocal(a instanceof Date ? fechaLocalDeDate(a) : a)
  const db = parseFechaLocal(b instanceof Date ? fechaLocalDeDate(b) : b)
  return Math.round((db - da) / 86400000)
}

function fechaLocalDeDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Cronograma con fechas de vencimiento y estado de mora de cada cuota.
 * Agrega a cada cuota: fechaVencimiento (Date), diasAtraso y vencida (bool).
 */
export function cronogramaConVencimientos(prestamo, totalCobrado, hoy = hoyLocalISO()) {
  const base = calcularCronograma(prestamo, totalCobrado)
  const fechaInicio = prestamo?.fecha_inicio || prestamo?.created_at
  const cuotas = base.cuotas.map((c) => {
    const fechaVencimiento = calcularFechaVencimiento(fechaInicio, c.numeroCuota, prestamo?.frecuencia)
    const atraso = diasEntre(fechaVencimiento, hoy)
    const vencida = c.estado !== 'total' && atraso > 0
    return { ...c, fechaVencimiento, diasAtraso: vencida ? atraso : 0, vencida }
  })
  return { ...base, cuotas, cuotaActual: cuotas.find((c) => c.estado !== 'total') || null }
}

/**
 * Punitorio de una cuota vencida:
 *   saldo impago de la cuota × tasa% × (bloques completos de `cadaDias` días de atraso)
 * Ej: cuota $10.000, 0,5% cada 1 día, 12 días → 10.000 × 0,005 × 12 = $600
 *     cuota $10.000, 2% cada 5 días, 12 días → 10.000 × 0,02 × 2 = $400
 */
export function calcularPunitorio(montoImpago, diasAtraso, tasaPorcentaje, cadaDias = 1) {
  const intervalo = Math.max(1, Math.floor(Number(cadaDias) || 1))
  const periodos = Math.floor(Math.max(0, Number(diasAtraso) || 0) / intervalo)
  const tasa = Math.max(0, Number(tasaPorcentaje) || 0)
  return redondear2(Math.max(0, Number(montoImpago) || 0) * (tasa / 100) * periodos)
}

/** Punitorio total de un conjunto de cuotas vencidas. */
export function punitorioTotal(cuotasVencidas, tasaPorcentaje, cadaDias) {
  return redondear2(
    (cuotasVencidas || []).reduce((acc, c) => acc + calcularPunitorio(c.restante, c.diasAtraso, tasaPorcentaje, cadaDias), 0)
  )
}

/** Configuración de punitorio recordada en este equipo (solo como valor por defecto). */
const CLAVE_CONFIG_PUNITORIO = 'valora.punitorio'
export function leerConfigPunitorio() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_CONFIG_PUNITORIO) || 'null')
    if (guardado && guardado.tasa >= 0 && guardado.cadaDias >= 1) return guardado
  } catch {
    // sin almacenamiento disponible: se usan los valores por defecto
  }
  return { tasa: 0.5, cadaDias: 1 }
}
export function guardarConfigPunitorio(config) {
  try {
    localStorage.setItem(CLAVE_CONFIG_PUNITORIO, JSON.stringify(config))
  } catch {
    // ignorar
  }
}
