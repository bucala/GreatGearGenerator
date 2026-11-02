"""Verify real browser downloads after Playwright using the independent CAD engine."""

import sys
from math import isclose
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import cadquery as cq
from pypdf import PdfReader

from backend.app.cad import build_gear
from backend.app.geometry import analyze
from backend.app.models import Design

result = analyze(Design())
path = Path("output/samples/gear-pair-approximate.stp")
assert b"ISO-10303-21" in path.read_bytes(), "Not a STEP file"
solids = cq.importers.importStep(str(path)).solids().vals()
assert len(solids) == 2, "STEP must contain both gears"
for index, (solid, gear) in enumerate(zip(solids, result["gears"])):
    assert solid.isValid(), f"Invalid solid {index}"
    reference = build_gear(gear, 16)
    # A volume regression check, not a global bound on involute flank deviation.
    assert isclose(solid.Volume(), reference.Volume(), rel_tol=1e-5)
    assert isclose(solid.BoundingBox().zlen, 16, abs_tol=1e-5)
    assert isclose(solid.Center().x, 0 if index == 0 else 72, abs_tol=1e-5)
    assert any(face.geomType() == "CYLINDER" for face in solid.Faces()), "Missing bore"

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
    "Browser exports verified: two valid STEP solids, bores, dimensions, volumes and PDF content."
)
