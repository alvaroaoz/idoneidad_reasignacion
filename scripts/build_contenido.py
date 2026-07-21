#!/usr/bin/env python3
"""
Extrae el cuerpo de cada carta desde templates/*.docx y genera
js/cartas_contenido.js, que el generador de PDF (js/pdf_render.js) usa como
fuente de texto.

Uso:
    python3 scripts/build_contenido.py

Cómo mantener:
    - Para cambiar la redacción de una carta, edita el .docx en templates/
      con Word (o corre antes scripts/build_templates.py si el cambio viene
      del maestro CARTAS_Modelo_Rellenar.docx) y vuelve a correr este script.
    - El encabezado (Señores/destinatario/Medellín), el saludo, el cierre y
      el bloque de firma son iguales en las 6 plantillas; este script valida
      eso y aborta si alguna quedó desincronizada.
"""
import json
import os
import re
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATES_DIR = os.path.join(ROOT, "templates")
OUT_PATH = os.path.join(ROOT, "js", "cartas_contenido.js")

KEYS = [
    "penal_idoneidad", "penal_reasignacion",
    "civil_idoneidad", "civil_reasignacion",
    "admin_idoneidad", "admin_reasignacion",
]


def parrafos(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf-8")
    body = re.search(r"<w:body>(.*)</w:body>", xml, re.S).group(1)
    out = []
    for p in re.findall(r"<w:p\b.*?</w:p>|<w:p\s*/>", body, re.S):
        texts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, re.S)
        out.append("".join(texts))
    return out


def main():
    contenido = {}
    boilerplate_ref = None
    for key in KEYS:
        paras = parrafos(os.path.join(TEMPLATES_DIR, f"{key}.docx"))
        no_vacios = [p for p in paras if p.strip()]
        # El cuerpo es el párrafo largo que empieza por "En calidad de..."
        # (admin_idoneidad tiene además un segundo párrafo "Solicito...").
        cuerpo = [p for p in no_vacios if p.startswith("En calidad de") or p.startswith("Solicito")]
        if not cuerpo:
            raise SystemExit(f"{key}: no se encontró el párrafo de cuerpo")

        # boilerplate = todo lo que NO es fecha, cuerpo, ni vacío.
        boilerplate = [p for p in no_vacios if p not in cuerpo and not p.startswith("Medellín, {{dia}}")]
        if boilerplate_ref is None:
            boilerplate_ref = boilerplate
        elif boilerplate != boilerplate_ref:
            raise SystemExit(
                f"{key}: el encabezado/cierre difiere del resto de plantillas.\n"
                f"esperado: {boilerplate_ref}\nobtenido: {boilerplate}"
            )

        contenido[key] = cuerpo

    js = (
        "/* Generado automáticamente por scripts/build_contenido.py a partir de\n"
        " * templates/*.docx. No editar a mano: cambia el .docx y vuelve a correr\n"
        " * el script. */\n\n"
        "export const BOILERPLATE = " + json.dumps({
            "senores": "Señores",
            "medellin": "Medellín",
            "saludo": "Cordial saludo,",
            "cierre": "Atentamente,",
            "firmante": ["MARYORY MORENO PARDO", "Directora", "Consultorio Jurídico y Centro de Conciliación"],
            "elaboro": "Alejandra C.",
        }, ensure_ascii=False, indent=2) + ";\n\n"
        "export const CUERPOS = " + json.dumps(contenido, ensure_ascii=False, indent=2) + ";\n"
    )
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(js)
    print("OK ->", OUT_PATH)
    for k, v in contenido.items():
        print(" ", k, "|", len(v), "párrafo(s)")


if __name__ == "__main__":
    main()
