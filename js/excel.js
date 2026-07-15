/* Lectura del Excel subido y generación de la plantilla Excel descargable.
 * Usa SheetJS global: window.XLSX  */

import { COLUMNAS, COLUMNA_AYUDA, EJEMPLOS, TEMAS_OPCIONES } from "./config.js";

/* Letra de columna Excel (0 -> A, 1 -> B, ...). */
function colLetra(i) {
  let s = "";
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
  return s;
}

/* Divide un elemento <col> que abarca columnas objetivo, aplicando el estilo dado.
 * Devuelve el XML de uno o más <col> que reemplazan al original. */
function dividirCol(attrs, targets, styleIdx) {
  const getAttr = (name) => parseInt((attrs.match(new RegExp(`\\b${name}="(\\d+)"`)) || [])[1] || 0);
  const min = getAttr("min"), max = getAttr("max");
  const overlap = targets.filter((c) => c >= min && c <= max).sort((a, b) => a - b);
  if (!overlap.length) return `<col ${attrs}/>`;

  const makeCol = (lo, hi, style) => {
    let a = attrs
      .replace(/\bmin="\d+"/, `min="${lo}"`)
      .replace(/\bmax="\d+"/, `max="${hi}"`)
      .replace(/\bstyle="\d+"\s*/g, "")
      .trimEnd();
    if (style != null) a += ` style="${style}"`;
    return `<col ${a}/>`;
  };

  const parts = [];
  let cur = min;
  for (const t of overlap) {
    if (cur < t) parts.push(makeCol(cur, t - 1, null));
    parts.push(makeCol(t, t, styleIdx));
    cur = t + 1;
  }
  if (cur <= max) parts.push(makeCol(cur, max, null));
  return parts.join("");
}

/* SheetJS no escribe validación de datos ni formatos de columna.
 * Post-procesamos el xlsx (que es un zip) usando JSZip (async) para:
 *   1. Añadir un XF de formato texto (@) en styles.xml
 *   2. Aplicar ese XF como estilo de columna en sheet1.xml (para IDs grandes)
 *   3. Inyectar la validación de lista desplegable para la columna tema
 * Usamos JSZip en lugar de PizZip porque JSZip es más compatible con los
 * xlsx generados por SheetJS en Excel para Windows. */
async function inyectarDesplegable(arrayBuffer, { hoja, col, desde, hasta, opciones, textoCols }) {
  const zip = await window.JSZip.loadAsync(arrayBuffer);

  // ── 1. Añadir XF de formato texto en styles.xml ─────────────────────────
  let textXfIdx = 1;
  const stylesFile = zip.file("xl/styles.xml");
  if (stylesFile) {
    let stylesXml = await stylesFile.async("string");
    const m = stylesXml.match(/<cellXfs[^>]*count="(\d+)"/);
    if (m) {
      textXfIdx = +m[1]; // el nuevo XF tendrá este índice
      stylesXml = stylesXml
        .replace(/(<cellXfs[^>]*count=")(\d+)(")/, (_, a, n, b) => `${a}${+n + 1}${b}`)
        .replace("</cellXfs>",
          `<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>`);
      zip.file("xl/styles.xml", stylesXml);
    }
  }

  // ── 2. Modificar sheet1.xml ──────────────────────────────────────────────
  const ruta = `xl/worksheets/${hoja}.xml`;
  let xml = await zip.file(ruta).async("string");

  // 2a. Estilo texto en columnas de ID: dividir <col> que las abarquen
  if (textoCols && textoCols.length) {
    xml = xml.replace(/<col ([^>]*?)\/>/g, (_, attrs) => dividirCol(attrs, textoCols, textXfIdx));
  }

  // 2b. Inyectar dataValidations (orden del esquema OOXML)
  const ref = `${col}${desde}:${col}${hasta}`;
  const lista = opciones.join(",").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const dv =
    `<dataValidations count="1">` +
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="${ref}">` +
    `<formula1>"${lista}"</formula1></dataValidation></dataValidations>`;

  const anclas = ["<hyperlinks", "<printOptions", "<pageMargins", "</worksheet>"];
  let pos = -1;
  for (const t of anclas) {
    const i = xml.indexOf(t);
    if (i !== -1 && (pos === -1 || i < pos)) pos = i;
  }
  if (pos === -1) pos = xml.length;
  xml = xml.slice(0, pos) + dv + xml.slice(pos);

  zip.file(ruta, xml);
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/* Genera y descarga la plantilla Excel para llenar. */
export async function descargarPlantillaExcel() {
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
  instr.push(["NOTA", "La columna 'tema' es una lista desplegable: elige una opcion, no escribas a mano."]);
  instr.push(["NOTA", "Por cada fila se generan 2 cartas: idoneidad (a nombre del estudiante nuevo) y reasignacion."]);
  instr.push(["NOTA", "Las columnas id_identificador e id_consultorio estan formateadas como TEXTO: Excel las guarda tal cual se escriban, sin redondear."]);
  const wsI = XLSX.utils.aoa_to_sheet(instr);
  wsI["!cols"] = [{ wch: 22 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsI, "Instrucciones");

  // Exportar a Uint8Array y post-procesar (desplegable + formato texto en IDs).
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const temaCol = colLetra(COLUMNAS.indexOf("tema"));
  const blob = await inyectarDesplegable(buf, {
    hoja: "sheet1",
    col: temaCol,
    desde: 2,
    hasta: 1000,
    opciones: TEMAS_OPCIONES,
    // Columnas que deben ser formato texto para no perder dígitos (1-indexed)
    textoCols: [
      COLUMNAS.indexOf("id_identificador") + 1,
      COLUMNAS.indexOf("id_consultorio") + 1,
    ],
  });
  window.saveAs(blob, "plantilla_cartas_consultorio.xlsx");
}

/* Lee un File (xlsx/xls) y devuelve array de objetos {columna: valor}.
 * Normaliza encabezados (minúsculas, sin espacios extra).
 * Usa raw:true para preservar los tipos nativos y evitar que números grandes
 * en columnas de ID lleguen en notación científica. */
export async function leerExcel(file) {
  const XLSX = window.XLSX;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // raw:true → fechas vienen como Date (cellDates:true), números como number, texto como string
  const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });

  // Columnas que deben tratarse siempre como texto aunque el usuario las haya
  // guardado como número (el formato texto de la plantilla lo previene, pero
  // si alguien editó en otra herramienta pueden venir como number).
  const COLS_TEXTO = new Set(["id_identificador", "id_consultorio"]);

  return json.map((row) => {
    const out = {};
    for (const k of Object.keys(row)) {
      const key = String(k).trim().toLowerCase().replace(/\s+/g, "_");
      let val = row[k];

      if (val instanceof Date) {
        // partesFecha en app.js acepta objetos Date directamente
        out[key] = val;
      } else if (typeof val === "number") {
        if (COLS_TEXTO.has(key)) {
          // toFixed(0) evita la notación científica para enteros grandes.
          // Si el ID fue guardado como número la precisión puede ya estar
          // perdida (IDs de 20+ dígitos superan el rango seguro de float64).
          out[key] = val.toFixed(0);
        } else {
          out[key] = String(val);
        }
      } else {
        out[key] = typeof val === "string" ? val.trim() : String(val ?? "");
      }
    }
    return out;
  });
}
