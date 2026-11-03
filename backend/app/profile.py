"""Circular design root blends. Not a rack-generated trochoid or a tool prescription."""

from math import atan, atan2, cos, hypot, pi, sin, sqrt


def proposed_fillet(g: dict, module: float) -> dict:
    from .geometry import flank, polar

    rf, rb = g["root_diameter"] / 2, g["base_diameter"] / 2

    def construct(radius):
        radial = sqrt(rf * rf + 2 * rf * radius)
        t = 0
        if radial <= rb:
            tangent = polar(radial, -g["base_half_angle"])
            normal_angle = -g["base_half_angle"] - pi / 2
        else:
            t = (sqrt((rf + radius) ** 2 - rb**2) - radius) / rb
            tangent = flank(g, 0, -1, t)
            normal_angle = t - g["base_half_angle"] - pi / 2
        center = (tangent[0] + radius * cos(normal_angle), tangent[1] + radius * sin(normal_angle))
        root = (center[0] * rf / (rf + radius), center[1] * rf / (rf + radius))
        return {"radius": radius, "t": t, "tangent": tangent, "center": center, "root": root}

    def fits(f):
        angle = -atan2(f["root"][1], f["root"][0])
        return (
            angle < pi / g["teeth"] - 1e-6
            and f["t"] < g["t_start"] + 0.65 * (g["t_end"] - g["t_start"])
            and hypot(*f["tangent"]) < g["tip_diameter"] / 2
        )

    radius = 0.3 * module
    if not fits(construct(radius)):
        lo, hi = 0, radius
        for _ in range(50):
            mid = (lo + hi) / 2
            if fits(construct(mid)):
                lo = mid
            else:
                hi = mid
        radius = lo * 0.98
    if radius < module * 1e-5:
        raise ValueError("Nemožno navrhnúť oddelené zaoblenia päty. Použite model bez zaoblenia.")
    return construct(radius)


def segments(g: dict, tooth: int | None = None) -> list[dict]:
    from .geometry import flank, polar

    edges = []
    rf, ra = g["root_diameter"] / 2, g["tip_diameter"] / 2
    f = g.get("root_fillet")
    t0, t1 = f["t"] if f else g["t_start"], g["t_end"]
    h0 = g["base_half_angle"] - (t0 - atan(t0))
    h1 = g["base_half_angle"] - (t1 - atan(t1))
    pitch = 2 * pi / g["teeth"]
    root_angle = -atan2(f["root"][1], f["root"][0]) if f else h0

    def rotate(p, a):
        return p[0] * cos(a) - p[1] * sin(a), p[0] * sin(a) + p[1] * cos(a)

    def mirror(p):
        return p[0], -p[1]

    def line(start, end):
        if hypot(start[0] - end[0], start[1] - end[1]) > 1e-8:
            edges.append({"kind": "line", "start": start, "end": end})

    def fillet(center, start, end):
        angle = atan2(start[1] - center[1], start[0] - center[0])
        sweep = atan2(end[1] - center[1], end[0] - center[0]) - angle
        while sweep >= 0:
            sweep -= 2 * pi
        while sweep < -2 * pi:
            sweep += 2 * pi
        edges.append(
            {
                "kind": "arc",
                "center": center,
                "radius": f["radius"],
                "from": angle,
                "sweep": sweep,
                "samples": 12,
            }
        )

    for i in range(g["teeth"]) if tooth is None else [tooth]:
        a = i * pitch
        if f:
            fillet(rotate(f["center"], a), rotate(f["root"], a), rotate(f["tangent"], a))
            line(rotate(f["tangent"], a), flank(g, a, -1, t0))
        else:
            line(polar(rf, a - h0), flank(g, a, -1, t0))
        edges.append({"kind": "involute", "angle": a, "side": -1, "from": t0, "to": t1})
        edges.append(
            {
                "kind": "arc",
                "center": (0, 0),
                "radius": ra,
                "from": a - h1,
                "sweep": 2 * h1,
                "samples": 5,
            }
        )
        edges.append({"kind": "involute", "angle": a, "side": 1, "from": t1, "to": t0})
        if f:
            line(flank(g, a, 1, t0), rotate(mirror(f["tangent"]), a))
            fillet(
                rotate(mirror(f["center"]), a),
                rotate(mirror(f["tangent"]), a),
                rotate(mirror(f["root"]), a),
            )
        else:
            line(flank(g, a, 1, t0), polar(rf, a + h0))
        edges.append(
            {
                "kind": "arc",
                "center": (0, 0),
                "radius": rf,
                "from": a + root_angle,
                "sweep": pitch - 2 * root_angle,
                "samples": 6,
            }
        )
    return edges


def segment_point(g: dict, edge: dict, u: float) -> tuple[float, float]:
    from .geometry import flank, polar

    if edge["kind"] == "involute":
        return flank(g, edge["angle"], edge["side"], edge["from"] + (edge["to"] - edge["from"]) * u)
    if edge["kind"] == "line":
        return tuple(a + (b - a) * u for a, b in zip(edge["start"], edge["end"]))
    p = polar(edge["radius"], edge["from"] + edge["sweep"] * u)
    return edge["center"][0] + p[0], edge["center"][1] + p[1]


def rounded_outline(g: dict) -> list[tuple[float, float]]:
    points = []
    for edge in segments(g):
        count = 28 if edge["kind"] == "involute" else edge.get("samples", 1)
        for i in range(count + 1):
            p = segment_point(g, edge, i / count)
            if not points or hypot(p[0] - points[-1][0], p[1] - points[-1][1]) > 1e-8:
                points.append(p)
    return points
