"""Explicitly opt-in, approximate design STEP, never advertised as exact involute CAD."""

from math import atan, pi
from pathlib import Path

import cadquery as cq

from .geometry import flank, polar


def build_gear(g: dict, width: float) -> cq.Solid:
    edges = []
    rf, ra = g["root_diameter"] / 2, g["tip_diameter"] / 2
    t0, t1 = g["t_start"], g["t_end"]
    h0 = g["base_half_angle"] - (t0 - atan(t0))
    h1 = g["base_half_angle"] - (t1 - atan(t1))
    pitch = 2 * pi / g["teeth"]

    def vector(p):
        return cq.Vector(p[0], p[1], 0)

    def line(a, b):
        if (vector(a) - vector(b)).Length > 1e-8:
            edges.append(cq.Edge.makeLine(vector(a), vector(b)))

    def arc(radius, a, b):
        edges.append(
            cq.Edge.makeThreePointArc(
                vector(polar(radius, a)),
                vector(polar(radius, (a + b) / 2)),
                vector(polar(radius, b)),
            )
        )

    for i in range(g["teeth"]):
        a = i * pitch
        line(polar(rf, a - h0), flank(g, a, -1, t0))
        # Interpolation through analytic points. No certified global deviation bound.
        edges.append(
            cq.Edge.makeSpline(
                [vector(flank(g, a, -1, t0 + (t1 - t0) * j / 64)) for j in range(65)], tol=1e-8
            )
        )
        arc(ra, a - h1, a + h1)
        edges.append(
            cq.Edge.makeSpline(
                [vector(flank(g, a, 1, t1 - (t1 - t0) * j / 64)) for j in range(65)], tol=1e-8
            )
        )
        line(flank(g, a, 1, t0), polar(rf, a + h0))
        arc(rf, a + h0, a + pitch - h0)
    wire = cq.Wire.assembleEdges(edges)
    holes = (
        [cq.Wire.makeCircle(g["bore"] / 2, cq.Vector(), cq.Vector(0, 0, 1))] if g["bore"] else []
    )
    solid = cq.Solid.extrudeLinear(wire, holes, cq.Vector(0, 0, width))
    if not solid.isValid() or solid.Volume() <= 0:
        raise ValueError("CAD jadro nevytvorilo platné teleso.")
    return solid


def export_step(result: dict, path: Path):
    g1, g2 = result["gears"]
    first = build_gear(g1, result["parameters"]["width"])
    # Tooth on gear 1 faces the space on gear 2.
    phase = 180 - 180 / g2["teeth"]
    second = (
        build_gear(g2, result["parameters"]["width"])
        .rotate((0, 0, 0), (0, 0, 1), phase)
        .translate((result["center_distance"], 0, 0))
    )
    cq.exporters.export(cq.Compound.makeCompound([first, second]), str(path), exportType="STEP")
