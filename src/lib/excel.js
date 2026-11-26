// Generación de archivos Excel (.xlsx) con SheetJS.
// La librería se carga recién al exportar, para no hacer más pesada la app.

/**
 * Descarga un libro de Excel.
 * @param {string} nombreArchivo  sin extensión
 * @param {Array<{ nombre: string, filas: Array<Object>|Array<Array>, anchos?: number[], formatos?: Object }>} hojas
 *   - filas como objetos: las claves son los encabezados de columna
 *   - filas como arrays: se escriben tal cual (útil para fichas "Campo | Valor")
 *   - formatos: { 'Nombre de columna': '#,##0.00' } para números / fechas
 */
export async function descargarExcel(nombreArchivo, hojas) {
  const XLSX = await import('xlsx')
  const libro = XLSX.utils.book_new()

  for (const hoja of hojas) {
    const filas = hoja.filas || []
    const esMatriz = Array.isArray(filas[0])
    const ws = esMatriz
      ? XLSX.utils.aoa_to_sheet(filas.length ? filas : [['Sin datos']])
      : XLSX.utils.json_to_sheet(filas.length ? filas : [{ Información: 'Sin datos para el período elegido' }], { cellDates: true })

    // Anchos de columna: los indicados o calculados según el contenido
    const encabezados = esMatriz ? [] : Object.keys(filas[0] || {})
    const columnas = esMatriz ? Math.max(0, ...filas.map((f) => f.length)) : encabezados.length
    ws['!cols'] = Array.from({ length: columnas }, (_, i) => {
      if (hoja.anchos?.[i]) return { wch: hoja.anchos[i] }
      const valores = esMatriz ? filas.map((f) => f[i]) : [encabezados[i], ...filas.map((f) => f[encabezados[i]])]
      const largo = Math.max(...valores.map((v) => (v instanceof Date ? 10 : String(v ?? '').length)))
      return { wch: Math.min(45, Math.max(10, largo + 2)) }
    })

    // Formatos numéricos y de fecha por columna
    if (!esMatriz && hoja.formatos && filas.length) {
      const rango = XLSX.utils.decode_range(ws['!ref'])
      encabezados.forEach((col, c) => {
        const formato = hoja.formatos[col]
        if (!formato) return
        for (let r = 1; r <= rango.e.r; r++) {
          const celda = ws[XLSX.utils.encode_cell({ r, c })]
          if (celda && (celda.t === 'n' || celda.t === 'd')) celda.z = formato
        }
      })
    }

    XLSX.utils.book_append_sheet(libro, ws, hoja.nombre.substring(0, 31))
  }

  XLSX.writeFile(libro, `${nombreArchivo}.xlsx`, { compression: true })
}

export const FORMATO_MONEDA = '"$"#,##0.00'
export const FORMATO_FECHA = 'dd/mm/yyyy'
export const FORMATO_PORCENTAJE = '0.00"%"'

/** Fecha de hoy para nombres de archivo: 2026-11-26 */
export function sufijoFecha() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
