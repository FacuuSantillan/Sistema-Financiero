// Avisos breves ("toasts") para confirmar operaciones.
// Uso desde cualquier parte:  avisar('Cliente guardado')  /  avisar('No se pudo...', 'error')
// Los muestra el componente <Avisos /> montado en App.

const EVENTO = 'valora:aviso'

/**
 * @param {string} mensaje
 * @param {'exito'|'error'|'info'} tipo
 * @param {{ accion?: { texto: string, onClick: () => void }, duracion?: number }} opciones
 */
export function avisar(mensaje, tipo = 'exito', opciones = {}) {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { mensaje, tipo, ...opciones } }))
}

export function escucharAvisos(callback) {
  const handler = (e) => callback(e.detail)
  window.addEventListener(EVENTO, handler)
  return () => window.removeEventListener(EVENTO, handler)
}
