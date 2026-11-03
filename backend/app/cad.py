"""Explicitly opt-in, approximate design STEP, never advertised as exact involute CAD."""

from pathlib import Path

import cadquery as cq

from .profile import segment_point, segments


def build_gear(g: dict, width: float) -> cq.Solid:
    edges = []

    def vector(p):
        return cq.Vector(p[0], p[1], 0)

    for edge in segments(g):

        def at(u, edge=edge):
            return vector(segment_point(g, edge, u))

        if edge["kind"] == "line":
            edges.append(cq.Edge.makeLine(at(0), at(1)))
        elif edge["kind"] == "arc":
            edges.append(cq.Edge.makeThreePointArc(at(0), at(0.5), at(1)))
        else:
            # Interpolate 65 points; no certified global involute deviation bound.
            edges.append(cq.Edge.makeSpline([at(j / 64) for j in range(65)], tol=1e-8))
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
