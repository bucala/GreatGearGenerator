from math import cos, hypot, isclose, sin

import pytest

from backend.app.geometry import analyze
from backend.app.models import Design
from backend.app.profile import segment_point, segments


@pytest.mark.parametrize(
    "parameters",
    [
        {},
        {"teeth1": 80, "teeth2": 120, "bore1": 0, "bore2": 0},
        {"module": 0.2, "bore1": 0, "bore2": 0},
        {"pressure_angle": 30},
    ],
)
def test_rounding_is_tangent_closed_and_preserves_reference_circles(parameters):
    sharp = analyze(Design(**parameters))
    rounded = analyze(Design(**parameters, root_fillet=1))
    for old, g in zip(sharp["gears"], rounded["gears"]):
        f = g["root_fillet"]
        assert 0 < f["radius"] <= 0.3 * rounded["parameters"]["module"]
        for key in ("root_diameter", "base_diameter", "pitch_diameter", "tip_diameter"):
            assert old[key] == g[key]
        assert isclose(hypot(*f["root"]), g["root_diameter"] / 2, abs_tol=1e-9)
        assert isclose(hypot(*f["center"]), g["root_diameter"] / 2 + f["radius"], abs_tol=1e-9)
        v = [f["tangent"][i] - f["center"][i] for i in (0, 1)]
        assert isclose(hypot(*v), f["radius"], abs_tol=1e-9)
        angle = f["t"] - g["base_half_angle"]
        assert abs(v[0] * cos(angle) + v[1] * sin(angle)) < 1e-9
        edges = segments(g)
        for i, edge in enumerate(edges):
            a, b = segment_point(g, edge, 1), segment_point(g, edges[(i + 1) % len(edges)], 0)
            assert hypot(a[0] - b[0], a[1] - b[1]) < 1e-7


def test_rounded_cad_adds_root_material_and_remains_valid():
    from backend.app.cad import build_gear

    sharp = analyze(Design())
    rounded = analyze(Design(root_fillet=1))
    assert rounded["geometry_ok"]
    for old, g in zip(sharp["gears"], rounded["gears"]):
        first = build_gear(old, 16)
        second = build_gear(g, 16)
        assert second.isValid()
        assert second.Volume() > first.Volume()
        # OCC bounding boxes include the kernel's ~1e-7 mm edge tolerance.
        assert isclose(second.BoundingBox().zlen, 16, abs_tol=1e-6)
        # Each root has true circular cylindrical faces, not polygon-only rounding.
        radii = [
            face._geomAdaptor().Cylinder().Radius()
            for face in second.Faces()
            if face.geomType() == "CYLINDER"
        ]
        assert any(isclose(radius, g["root_fillet"]["radius"], abs_tol=1e-6) for radius in radii)
