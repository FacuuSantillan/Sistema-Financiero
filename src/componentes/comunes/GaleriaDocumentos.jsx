import { useEffect, useRef, useState } from 'react'
import { Camera, Upload, Trash2, FileText } from 'lucide-react'
import { subirDocumentos, eliminarDocumento, obtenerUrlsDocumentos } from '../../lib/documentos'

/**
 * Fotos de documentación de un registro YA guardado (cliente o garante):
 * muestra, permite sacar/subir nuevas y borrar.
 */
export default function GaleriaDocumentos({ tabla, registro, puedeEditar = true, onActualizado }) {
  const [documentos, setDocumentos] = useState(Array.isArray(registro?.documentos) ? registro.documentos : [])
  const [urls, setUrls] = useState({})
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [ampliada, setAmpliada] = useState(null)
  const inputCamara = useRef(null)
  const inputArchivo = useRef(null)

  useEffect(() => {
    let activo = true
    obtenerUrlsDocumentos(documentos).then((m) => { if (activo) setUrls(m) })
    return () => { activo = false }
  }, [documentos])

  const agregar = async (e) => {
    const archivos = Array.from(e.target.files || [])
    e.target.value = ''
    if (!archivos.length || !registro?.id) return
    setSubiendo(true)
    setError('')
    try {
      const nuevos = await subirDocumentos(tabla, registro.id, archivos, documentos)
      setDocumentos(nuevos)
      onActualizado?.(nuevos)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  const borrar = async (doc) => {
    if (!window.confirm('¿Eliminar esta foto?')) return
    setError('')
    try {
      const nuevos = await eliminarDocumento(tabla, registro.id, doc, documentos)
      setDocumentos(nuevos)
      onActualizado?.(nuevos)
    } catch (err) {
      setError(err.message)
    }
  }

  const esPdf = (doc) => /\.pdf$/i.test(doc.path)

  return (
    <div className="space-y-2">
      {puedeEditar && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={subiendo} onClick={() => inputCamara.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0d6b63] text-white text-xs font-bold hover:bg-[#0b5a52] cursor-pointer disabled:opacity-50">
            <Camera className="w-3.5 h-3.5" /> {subiendo ? 'Subiendo...' : 'Sacar foto'}
          </button>
          <button type="button" disabled={subiendo} onClick={() => inputArchivo.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" /> Subir archivo
          </button>
          <input ref={inputCamara} type="file" accept="image/*" capture="environment" className="hidden" onChange={agregar} />
          <input ref={inputArchivo} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={agregar} />
        </div>
      )}

      {error && <p className="text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-xl border border-red-200">⚠️ {error}</p>}

      {documentos.length === 0 ? (
        <p className="text-xs text-slate-400">Sin documentación cargada.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {documentos.map((doc) => (
            <div key={doc.path} className="relative w-24 h-24 rounded-xl overflow-hidden border border-line bg-slate-100 group">
              {esPdf(doc) ? (
                <a href={urls[doc.path]} target="_blank" rel="noreferrer" className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-[10px] font-bold p-1 text-center">
                  <FileText className="w-6 h-6 mb-1" /> {doc.nombre?.slice(0, 20)}
                </a>
              ) : urls[doc.path] ? (
                <button type="button" onClick={() => setAmpliada(urls[doc.path])} className="w-full h-full cursor-zoom-in">
                  <img src={urls[doc.path]} alt={doc.nombre} className="w-full h-full object-cover" />
                </button>
              ) : (
                <div className="w-full h-full animate-pulse" />
              )}
              {puedeEditar && (
                <button type="button" onClick={() => borrar(doc)} aria-label="Eliminar foto"
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white cursor-pointer">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {ampliada && (
        <div className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="Documento" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  )
}
