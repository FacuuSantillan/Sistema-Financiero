import { useEffect, useMemo, useRef } from 'react'
import { Camera, Upload, X } from 'lucide-react'

/**
 * Selector de fotos ANTES de guardar (aún no hay id para subirlas).
 * `archivos` es un array de File que maneja el componente padre.
 */
export default function SelectorFotos({ archivos, setArchivos, titulo = 'Fotos de documentación' }) {
  const inputCamara = useRef(null)
  const inputArchivo = useRef(null)

  const previews = useMemo(() => archivos.map((f) => URL.createObjectURL(f)), [archivos])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const agregar = (e) => {
    const nuevos = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf')
    if (nuevos.length) setArchivos((prev) => [...prev, ...nuevos])
    e.target.value = ''
  }

  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700">{titulo}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputCamara.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0d6b63] text-white text-xs font-bold hover:bg-[#0b5a52] cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" /> Sacar foto
          </button>
          <button
            type="button"
            onClick={() => inputArchivo.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" /> Subir archivo
          </button>
        </div>
      </div>

      {/* capture="environment" abre la cámara trasera en celulares; en PC abre el selector de archivos */}
      <input ref={inputCamara} type="file" accept="image/*" capture="environment" className="hidden" onChange={agregar} />
      <input ref={inputArchivo} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={agregar} />

      {archivos.length === 0 ? (
        <p className="text-[11px] text-slate-400">DNI frente y dorso, recibo de sueldo, servicio, etc. (opcional)</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {archivos.map((f, i) => (
            <div key={`${f.name}-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-line bg-slate-100">
              {f.type === 'application/pdf' ? (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500 p-1 text-center break-all">PDF<br />{f.name.slice(0, 18)}</div>
              ) : (
                <img src={previews[i]} alt={f.name} className="w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => setArchivos((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white cursor-pointer"
                aria-label="Quitar foto"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
