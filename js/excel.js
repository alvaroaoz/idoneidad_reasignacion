/* Lectura del Excel subido y generación de la plantilla Excel descargable.
 * Usa SheetJS global: window.XLSX  */

import { COLUMNAS, COLUMNA_AYUDA, EJEMPLOS, TEMAS_OPCIONES } from "./config.js";

/* Letra de columna Excel (0 -> A, 1 -> B, ...). */
function colLetra(i) {
  let s = "";
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
  return s;
}

/* SheetJS no escribe validación de datos. Inyectamos la lista desplegable
 * directamente en el XML de la hoja (el .xlsx es un zip). */
function inyectarDesplegable(arrayBuffer, { hoja, col, desde, hasta, opciones }) {
  const zip = new window.PizZip(arrayBuffer);
  const ruta = `xl/worksheets/${hoja}.xml`;
  let xml = zip.file(ruta).asText();

  const ref = `${col}${desde}:${col}${hasta}`;
  const lista = opciones.join(",").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const dv = `<dataValidations count="1">` +
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" ` +
    `errorTitle="Tema inválido" error="Elige una opción de la lista." sqref="${ref}">` +
    `<formula1>&quot;${lista}&quot;</formula1></dataValidation></dataValidations>`;

  // dataValidations debe ir tras sheetData y antes de pageMargins/printOptions (orden del esquema).
  if (xml.includes("<pageMargins")) xml = xml.replace("<pageMargins", dv + "<pageMargins");
  else xml = xml.replace("</worksheet>", dv + "</worksheet>");

  zip.file(ruta, xml);
  return zip.generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* Genera y descarga la plantilla Excel para llenar. */
export function descargarPlantillaExcel() {
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();

  // Hoja de datos: encabezados + filas de ejemplo.
  const filas = EJEMPLOS.map((e) => COLUMNAS.map((c) => e[c] ?? ""));
  const aoa = [COLUMNAS, ...filas];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = COLUMNAS.map((c) => ({ wch: Math.max(c.length + 2, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, "Datos");

  // Hoja de instrucciones.
  const instr = [["Columna", "Qué poner"]];
  for (const c of COLUMNAS) instr.push([c, COLUMNA_AYUDA[c] || ""]);
  instr.push([]);
  instr.push(["NOTA", "Borra las filas de ejemplo de la hoja 'Datos' antes de cargar."]);
  instr.push(["NOTA", "La columna 'tema' es una lista desplegable: elige una opción, no escribas a mano."]);
  instr.push(["NOTA", "Por cada fila se generan 2 cartas: idoneidad (a nombre del estudiante nuevo) y reasignación."]);
  const wsI = XLSX.utils.aoa_to_sheet(instr);
  wsI["!cols"] = [{ wch: 22 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsI, "Instrucciones");

  // Exportar a ArrayBuffer y añadir el desplegable en la columna "tema".
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const temaCol = colLetra(COLUMNAS.indexOf("tema"));
  const blob = inyectarDesplegable(buf, {
    hoja: "sheet1", col: temaCol, desde: 2, hasta: 1000, opciones: TEMAS_OPCIONES,
  });
  window.saveAs(blob, "plantilla_cartas_consultorio.xlsx");
}

/* Lee un File (xlsx/xls) y devuelve array de objetos {columna: valor}.
 * Normaliza encabezados (minúsculas, sin espacios extra). */
export async function leerExcel(file) {
  const XLSX = window.XLSX;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

  return json.map((row) => {
    const out = {};
    for (const k of Object.keys(row)) {
      const key = String(k).trim().toLowerCase().replace(/\s+/g, "_");
      out[key] = typeof row[k] === "string" ? row[k].trim() : row[k];
    }
    return out;
  });
}
