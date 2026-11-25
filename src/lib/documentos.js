import { supabase } from './supabaseClient'

// Fotos de documentación guardadas en Supabase Storage (bucket privado).
// En la tabla (clientes.documentos / garantes.documentos) se guarda un array:
//   [{ path: 'clientes/<id>/1730000000000-dni.jpg', nombre: 'dni.jpg', subido: '2026-...' }]

export const BUCKET_DOCUMENTOS = 'documentacion'

const TAMANO_MAXIMO = 10 * 1024 * 1024 // 10 MB

function nombreSeguro(nombre) {
  return (nombre || 'foto.jpg')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-60)
}

/**
 * Sube archivos al bucket y los agrega al campo `documentos` del registro.
 * @param {'clientes'|'garantes'} tabla
 * @param {string} id  id del cliente o garante
 * @param {File[]} archivos
 * @param {Array} documentosActuales  valor actual de `documentos`
 * @returns {Promise<Array>} nuevo array de documentos
 */
export async function subirDocumentos(tabla, id, archivos, documentosActuales = []) {
  const nuevos = []

  for (const archivo of archivos) {
    if (archivo.size > TAMANO_MAXIMO) {
      throw new Error(`"${archivo.name}" supera los 10 MB.`)
    }
    const path = `${tabla}/${id}/${Date.now()}-${nombreSeguro(archivo.name)}`
    const { error } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .upload(path, archivo, { contentType: archivo.type || 'image/jpeg', upsert: false })

    if (error) throw new Error(`No se pudo subir "${archivo.name}": ${error.message}`)
    nuevos.push({ path, nombre: archivo.name, subido: new Date().toISOString() })
  }

  const documentos = [...(Array.isArray(documentosActuales) ? documentosActuales : []), ...nuevos]

  const { error: errUpdate } = await supabase
    .from(tabla)
    .update({ documentos })
    .eq('id', id)

  if (errUpdate) throw new Error(`Las fotos se subieron pero no se pudieron vincular: ${errUpdate.message}`)
  return documentos
}

/** Elimina una foto del bucket y del registro. */
export async function eliminarDocumento(tabla, id, documento, documentosActuales = []) {
  const { error } = await supabase.storage.from(BUCKET_DOCUMENTOS).remove([documento.path])
  if (error) throw new Error(`No se pudo borrar la foto: ${error.message}`)

  const documentos = (documentosActuales || []).filter((d) => d.path !== documento.path)
  const { error: errUpdate } = await supabase.from(tabla).update({ documentos }).eq('id', id)
  if (errUpdate) throw new Error(errUpdate.message)
  return documentos
}

/** Devuelve URLs firmadas (válidas 1 hora) para mostrar las fotos. */
export async function obtenerUrlsDocumentos(documentos = []) {
  if (!Array.isArray(documentos) || documentos.length === 0) return {}
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrls(documentos.map((d) => d.path), 3600)

  if (error) {
    console.warn('No se pudieron generar las URLs de documentos:', error.message)
    return {}
  }
  const mapa = {}
  ;(data || []).forEach((item) => {
    if (item.signedUrl) mapa[item.path] = item.signedUrl
  })
  return mapa
}
