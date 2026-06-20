#!/usr/bin/env python3
"""
Separa el .docx maestro (CARTAS_Modelo_Rellenar.docx) en las 6 plantillas
normalizadas que usa la webapp, con los placeholders {{...}} limpios.

Uso:
    python3 scripts/build_templates.py

Genera los archivos en  templates/<nombre>.docx

Cómo mantener:
    - Si cambia un texto / la directora / etc., edita el .docx maestro en Word
      y vuelve a correr este script. (O edita directamente los templates/*.docx,
      teniendo cuidado de no partir los {{placeholders}}.)
"""
import os
import re
import shutil
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, "CARTAS_Modelo_Rellenar.docx")
OUT_DIR = os.path.join(ROOT, "templates")

# Secciones del maestro (en orden de salto de página, 0-indexed) que conservamos.
# Penal se unifica usando {{destinatario}} (sección 0 idoneidad y sección 3
# reasignación, ambas con destinatario variable).
SECTIONS = {
    0: "penal_idoneidad",
    3: "penal_reasignacion",
    4: "civil_idoneidad",
    5: "civil_reasignacion",
    6: "admin_idoneidad",
    7: "admin_reasignacion",
}

# Normalización de placeholders: claves unificadas, sin acentos.
NORMALIZE = {
    "{{año}}": "{{ano}}",
    "{{usuario_c}}": "{{usuario}}",
}


def split_sections(doc_xml):
    """Devuelve lista de secciones; cada sección es una lista de párrafos (XML)."""
    body = re.search(r"<w:body>(.*)</w:body>", doc_xml, re.S).group(1)
    # Quitamos el sectPr final (lo re-añadimos al reconstruir).
    body = re.sub(r"<w:sectPr\b.*?</w:sectPr>", "", body, flags=re.S)
    paras = re.findall(r"<w:p\b.*?</w:p>|<w:p\s*/>", body, re.S)
    sections, current = [], []
    for p in paras:
        if 'w:type="page"' in p:
            # Quitar el run del salto de página, conservar el resto del párrafo.
            p_clean = re.sub(r"<w:r\b[^>]*>(?:(?!</w:r>).)*?<w:br w:type=\"page\"/>.*?</w:r>",
                             "", p, flags=re.S)
            current.append(p_clean)
            sections.append(current)
            current = []
        else:
            current.append(p)
    if current:
        sections.append(current)
    return sections


def collapse_placeholder_paragraphs(paragraphs):
    """En párrafos que contienen '{', colapsa los runs en uno solo para que los
    tags {{...}} nunca queden partidos entre runs."""
    out = []
    for p in paragraphs:
        if "{" not in p:
            out.append(p)
            continue
        ppr_m = re.search(r"<w:pPr>.*?</w:pPr>", p, re.S)
        ppr = ppr_m.group(0) if ppr_m else ""
        # rPr del primer run con texto.
        rpr = ""
        run_m = re.search(r"<w:r\b[^>]*>(.*?)</w:r>", p, re.S)
        if run_m:
            rpr_m = re.search(r"<w:rPr>.*?</w:rPr>", run_m.group(1), re.S)
            rpr = rpr_m.group(0) if rpr_m else ""
        text = "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, re.S))
        for a, b in NORMALIZE.items():
            text = text.replace(a, b)
        run = "<w:r>{rpr}<w:t xml:space=\"preserve\">{text}</w:t></w:r>".format(rpr=rpr, text=text)
        out.append("<w:p>{ppr}{run}</w:p>".format(ppr=ppr, run=run))
    return out


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    with zipfile.ZipFile(MASTER) as z:
        doc_xml = z.read("word/document.xml").decode("utf-8")
        names = z.namelist()

    sectpr = re.search(r"<w:sectPr\b.*?</w:sectPr>", doc_xml, re.S).group(0)
    prefix = doc_xml[: doc_xml.index("<w:body>") + len("<w:body>")]

    sections = split_sections(doc_xml)
    print("Secciones detectadas:", len(sections))

    for idx, out_name in SECTIONS.items():
        paras = sections[idx][1:]  # descartar la primera línea (título del modelo)
        paras = collapse_placeholder_paragraphs(paras)
        new_doc = prefix + "".join(paras) + sectpr + "</w:body></w:document>"

        # Las cartas finales no llevan resaltado ni subrayado (el maestro marcaba
        # en cian los campos a rellenar).
        new_doc = re.sub(r"<w:highlight\b[^>]*/>", "", new_doc)
        new_doc = re.sub(r"<w:u\b[^>]*/>", "", new_doc)

        out_path = os.path.join(OUT_DIR, out_name + ".docx")
        with zipfile.ZipFile(MASTER) as zin, \
                zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in names:
                if item == "word/document.xml":
                    zout.writestr(item, new_doc)
                else:
                    zout.writestr(item, zin.read(item))
        found = sorted(set(re.findall(r"\{\{([^}]+)\}\}", new_doc)))
        print("  ->", out_name + ".docx", "| placeholders:", found)


if __name__ == "__main__":
    main()
