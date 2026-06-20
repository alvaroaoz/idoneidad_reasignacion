/* Generación de .docx en el navegador con docxtemplater.
 * Las librerías se cargan como scripts globales (ver index.html):
 *   window.PizZip, window.docxtemplater  */

const cacheBuffers = new Map();

/* Descarga una plantilla .docx una sola vez y la cachea como ArrayBuffer. */
export async function cargarPlantilla(ruta) {
  if (cacheBuffers.has(ruta)) return cacheBuffers.get(ruta);
  const resp = await fetch(ruta);
  if (!resp.ok) throw new Error("No se pudo cargar la plantilla: " + ruta);
  const buf = await resp.arrayBuffer();
  cacheBuffers.set(ruta, buf);
  return buf;
}

/* Defensa: si al editar en Word un tag {{x}} quedó partido entre <w:t>,
 * lo recomponemos antes de pasarlo a docxtemplater. */
function limpiarTagsPartidos(zip) {
  const path = "word/document.xml";
  let xml = zip.file(path).asText();
  let prev;
  do {
    prev = xml;
    // 1) Une llaves de apertura/cierre partidas por markup:  {<..>{ -> {{   }<..>} -> }}
    xml = xml.replace(/\{((?:<[^>]+>)+)\{/g, "{{");
    xml = xml.replace(/\}((?:<[^>]+>)+)\}/g, "}}");
    // 2) Quita el markup que haya quedado dentro del cuerpo de un {{ ... }}
    xml = xml.replace(/(\{\{[^{}]*?)<[^>]+>/g, "$1");
  } while (xml !== prev);
  zip.file(path, xml);
}

/* Renderiza una plantilla con un objeto de datos -> Blob .docx */
export async function renderDocx(ruta, datos) {
  const buf = await cargarPlantilla(ruta);
  const zip = new window.PizZip(buf);
  limpiarTagsPartidos(zip);
  const doc = new window.docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "", // placeholders vacíos -> ""
  });
  doc.render(datos);
  return doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
