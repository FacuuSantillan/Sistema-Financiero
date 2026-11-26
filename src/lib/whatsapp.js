// Recordatorios de cuota vencida por WhatsApp (wa.me, sin API ni costo).

/**
 * Normaliza un teléfono argentino al formato internacional que pide WhatsApp:
 * 549 + código de área + número, sin 0 ni 15.
 * Ej: "0381 15-498-7654" → "5493814987654"
 */
export function normalizarTelefonoAR(telefono) {
  let digitos = String(telefono || '').replace(/\D/g, '')
  if (!digitos) return ''

  if (digitos.startsWith('549')) return digitos
  if (digitos.startsWith('54')) digitos = digitos.slice(2)
  if (digitos.startsWith('0')) digitos = digitos.slice(1)

  // Quitar el "15" que va después del código de área (2 a 4 dígitos)
  if (digitos.length === 12) {
    for (const largoArea of [2, 3, 4]) {
      if (digitos.substr(largoArea, 2) === '15') {
        digitos = digitos.slice(0, largoArea) + digitos.slice(largoArea + 2)
        break
      }
    }
  }

  if (digitos.length !== 10) return '' // no parece un celular argentino válido
  return `549${digitos}`
}

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (d) => (d instanceof Date ? d : new Date(d)).toLocaleDateString('es-AR')

/** Arma el texto del recordatorio. */
export function mensajeRecordatorio({ nombre, numeroCuota, cantidadCuotas, monto, vencimiento, diasAtraso, punitorio = 0 }) {
  const lineas = [
    `Hola ${nombre || ''}, te recordamos que la cuota ${numeroCuota}${cantidadCuotas ? ` de ${cantidadCuotas}` : ''} de tu préstamo venció el ${fmtFecha(vencimiento)}${diasAtraso > 0 ? ` (${diasAtraso} ${diasAtraso === 1 ? 'día' : 'días'} de atraso)` : ''}.`,
    `Importe pendiente: $${fmt(monto)}`
  ]
  if (punitorio > 0) {
    lineas.push(`Punitorio por mora: $${fmt(punitorio)}`)
    lineas.push(`Total a abonar: $${fmt(Number(monto) + Number(punitorio))}`)
  }
  lineas.push('Por favor comunicate para regularizar el pago. ¡Gracias!')
  return lineas.join('\n')
}

/** Comprobante de un cobro recién registrado. */
export function mensajeComprobante({ nombre, monto, punitorio = 0, metodo, fecha, saldoRestante, prestamoId }) {
  const total = Number(monto || 0) + Number(punitorio || 0)
  const lineas = [
    `Hola ${nombre || ''}, te confirmamos el pago recibido.`,
    '',
    `Fecha: ${fmtFecha(fecha || new Date())}`,
    prestamoId ? `Préstamo: #${String(prestamoId).substring(0, 8)}` : null,
    `Pago de cuota: $${fmt(monto)}`,
    Number(punitorio) > 0 ? `Punitorio: $${fmt(punitorio)}` : null,
    Number(punitorio) > 0 ? `Total abonado: $${fmt(total)}` : null,
    metodo ? `Medio de pago: ${metodo}` : null,
    saldoRestante !== undefined
      ? (Number(saldoRestante) <= 0.5 ? '¡Préstamo cancelado por completo!' : `Saldo pendiente: $${fmt(saldoRestante)}`)
      : null,
    '',
    '¡Gracias!'
  ]
  return lineas.filter((l) => l !== null).join('\n')
}

/** Abre WhatsApp con el mensaje. Devuelve false si el teléfono no es válido. */
export async function abrirWhatsApp(telefono, mensaje) {
  const numero = normalizarTelefonoAR(telefono)
  if (!numero) return false

  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`

  // En la app de escritorio (Tauri) hay que pedirle al sistema que abra el navegador
  if (window.__TAURI_INTERNALS__) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(url)
      return true
    } catch (err) {
      console.warn('No se pudo abrir con el plugin de Tauri:', err)
    }
  }

  window.open(url, '_blank', 'noopener')
  return true
}
