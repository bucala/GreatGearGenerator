"""Verify real browser downloads after Playwright using the independent CAD engine."""

import sys
from math import isclose, isfinite
from pathlib import Path
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import cadquery as cq
from pypdf import PdfReader

from backend.app.cad import build_gear
from backend.app.geometry import analyze
from backend.app.models import Design

volumes = []
for rounding, filename in (
    (0, "gear-pair-approximate.stp"),
    (1, "gear-pair-rounded.stp"),
    (2, "gear-pair-all-blends.stp"),
):
    result = analyze(
        Design(
            root_fillet=int(rounding > 0),
            tip_fillet=int(rounding == 2),
            face_fillet=int(rounding == 2),
        )
    )
    path = Path("output/samples") / filename
    assert b"ISO-10303-21" in path.read_bytes(), "Not a STEP file"
    solids = cq.importers.importStep(str(path)).solids().vals()
    assert len(solids) == 2, "STEP must contain both gears"
    variant_volumes = []
    for index, (solid, gear) in enumerate(zip(solids, result["gears"])):
        assert solid.isValid(), f"Invalid solid {index}"
        reference = build_gear(gear, 16)
        # A regression check, not a global bound on involute flank deviation.
        assert isclose(solid.Volume(), reference.Volume(), rel_tol=1e-5)
        assert isclose(solid.BoundingBox().zlen, 16, abs_tol=1e-5)
        assert isclose(solid.Center().x, 0 if index == 0 else 72, abs_tol=1e-5)
        assert any(face.geomType() == "CYLINDER" for face in solid.Faces()), "Missing bore"
        variant_volumes.append(solid.Volume())
    volumes.append(variant_volumes)
assert all(rounded > sharp for sharp, rounded in zip(volumes[0], volumes[1])), (
    "Root blends must add material"
)
assert all(all_blends < root_only for root_only, all_blends in zip(volumes[1], volumes[2])), (
    "Convex tip/face blends must remove material"
)

svg = ET.parse("output/drawings/gear-1-dimensioned-tooth.svg").getroot()
assert svg.tag == "{http://www.w3.org/2000/svg}svg"
assert all(isfinite(float(n)) for n in svg.attrib["viewBox"].split()), "Nonfinite SVG"
drawing_text = " ".join(svg.itertext())
for required in ("KRUHOVÉ ZAOBLENIE PÄTY", "Ø d / Dr = 48", "Ø dᶠ = 43", "R päty = 0,6"):
    assert required in drawing_text, f"SVG missing {required}"

pdf = PdfReader("output/pdf/gear-report.pdf")
assert len(pdf.pages) == 1
text = pdf.pages[0].extract_text()
for required in (
    "72.000",
    "431.28",
    "24",
    "48",
    "65 analytic samples",
    "ISO 6336",
    "computed in your browser",
):
    assert required in text, f"PDF missing {required}"
print(
    "Browser exports verified: sharp, root-rounded and fully blended STEP solids, bores, volumes, dimensioned SVG and PDF."
)
