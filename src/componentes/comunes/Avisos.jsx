import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { escucharAvisos } from '../../lib/avisos'

const ESTILOS = {
  exito: { clase: 'bg-[#0d6b63] text-white', Icono: CheckCircle2 },
  error: { clase: 'bg-red-600 text-white', Icono: AlertTriangle },
  info: { clase: 'bg-slate-800 text-white', Icono: Info }
}

let contador = 0

/** Muestra los avisos enviados con avisar(). Va montado una sola vez en App. */
export default function Avisos() {
  const [avisos, setAvisos] = useState([])

  useEffect(() => escucharAvisos((aviso) => {
    const id = ++contador
    setAvisos((prev) => [...prev.slice(-2), { ...aviso, id }]) // máximo 3 a la vez
    const duracion = aviso.duracion ?? (aviso.accion ? 8000 : aviso.tipo === 'error' ? 6000 : 3500)
    setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== id)), duracion)
  }), [])

  const cerrar = (id) => setAvisos((prev) => prev.filter((a) => a.id !== id))

  if (avisos.length === 0) return null

  return (
    // En celular queda arriba de la barra de accesos rápidos
    <div className="fixed z-[90] inset-x-0 bottom-24 sm:bottom-6 flex flex-col items-center gap-2 px-4 pointer-events-none" role="status" aria-live="polite">
      {avisos.map(({ id, mensaje, tipo, accion }) => {
        const { clase, Icono } = ESTILOS[tipo] || ESTILOS.info
        return (
          <div key={id} className={`pointer-events-auto w-full max-w-md flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold aviso-entra ${clase}`}>
            <Icono className="w-5 h-5 shrink-0" />
            <span className="flex-1">{mensaje}</span>
            {accion && (
              <button type="button" onClick={() => { accion.onClick(); cerrar(id) }}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold cursor-pointer">
                {accion.texto}
              </button>
            )}
            <button type="button" onClick={() => cerrar(id)} aria-label="Cerrar aviso" className="shrink-0 p-1 rounded-lg hover:bg-white/20 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
