// Apertura de tickets desde cualquier parte de la app:
//   abrirTicket('prestamo', idPrestamo)  → ticket del préstamo otorgado
//   abrirTicket('cobro', idPago)         → recibo de un cobro
// Los muestra el componente <VisorTicket /> montado en App.

const EVENTO = 'valora:ticket'

export function abrirTicket(tipo, id) {
  if (!id) return
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { tipo, id } }))
}

export function escucharTickets(callback) {
  const handler = (e) => callback(e.detail)
  window.addEventListener(EVENTO, handler)
  return () => window.removeEventListener(EVENTO, handler)
}
