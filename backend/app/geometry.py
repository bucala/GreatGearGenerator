"""Analytic external involute spur gears, full-depth rack ha*=1, hf*=1.25.

Dimension and profile-shift equations follow KHK / SDP-SI technical references.
See docs/ENGINEERING.md for equations, assumptions and limits of every check.
"""

from math import atan, atan2, cos, degrees, hypot, pi, radians, sin, sqrt, tan

from .models import Design
from .profile import proposed_fillet, proposed_tip_fillet, rounded_outline


def involute(t: float, rb: float) -> tuple[float, float]:
    """Exact parametric evaluation; t is the roll parameter, not pressure angle."""
    return rb * (cos(t) + t * sin(t)), rb * (sin(t) - t * cos(t))


def inv(angle: float) -> float:
    return tan(angle) - angle


def inverse_inv(value: float) -> float:
    if value <= 0:
        raise ValueError("Korekcie nedovoľujú kladný pracovný uhol záberu.")
    lo, hi = 0.0, radians(80)
    for _ in range(70):
        mid = (lo + hi) / 2
        if inv(mid) < value:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def polar(radius: float, angle: float) -> tuple[float, float]:
    return radius * cos(angle), radius * sin(angle)


def flank(g: dict, tooth_angle: float, side: int, t: float) -> tuple[float, float]:
    """Mirror and rotate the analytic involute to the tooth center line."""
    x, y = involute(t, g["base_diameter"] / 2)
    # involute polar angle = t - atan(t); tooth narrows toward the tip.
    angle = tooth_angle + side * (g["base_half_angle"] - (t - atan(t)))
    return polar(hypot(x, y), angle)


def outline(g: dict, samples: int = 14) -> list[tuple[float, float]]:
    """Preview only: sample flanks and circular arcs; radial root transitions.

    Root transitions are not rack-generated trochoids. Do not use this polygon
    to infer root stress concentration or manufacturing tool clearance.
    """
    points = []
    rf, ra = g["root_diameter"] / 2, g["tip_diameter"] / 2
    t0, t1 = g["t_start"], g["t_end"]
    half0 = g["base_half_angle"] - (t0 - atan(t0))
    half1 = g["base_half_angle"] - (t1 - atan(t1))
    pitch = 2 * pi / g["teeth"]
    for i in range(g["teeth"]):
        a = i * pitch
        points.append(polar(rf, a - half0))
        points.extend(flank(g, a, -1, t0 + (t1 - t0) * j / samples) for j in range(samples + 1))
        points.extend(polar(ra, a - half1 + 2 * half1 * j / 5) for j in range(1, 6))
        points.extend(flank(g, a, 1, t1 - (t1 - t0) * j / samples) for j in range(1, samples + 1))
        points.append(polar(rf, a + half0))
        points.extend(polar(rf, a + half0 + (pitch - 2 * half0) * j / 6) for j in range(1, 7))
    # The last root-arc point is the next tooth's first point.
    return [
        p
        for i, p in enumerate(points)
        if i == 0 or hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-8
    ]


def gear(
    m: float,
    z: int,
    alpha: float,
    x: float,
    k: float,
    bore: float,
    rounding: bool = False,
    head: bool = False,
    face: bool = False,
    width: float = 16,
) -> dict:
    d = m * z
    db = d * cos(alpha)
    da = m * (z + 2 + 2 * x - 2 * k)
    df = m * (z - 2.5 + 2 * x)
    if not 0 < df < da or da <= db:
        raise ValueError("Neplatné hlavové/pätné priemery pre zadanú korekciu.")
    if bore >= df - 0.4 * m:
        raise ValueError("Otvor musí zachovať aspoň 0,2 modulu materiálu pod pätou zuba.")
    base_half = (pi / 2 + 2 * x * tan(alpha)) / z + inv(alpha)
    t0 = sqrt(max(0, (max(df, db) / db) ** 2 - 1))
    t1 = sqrt((da / db) ** 2 - 1)
    half_tip = base_half - (t1 - atan(t1))
    half_root = base_half - (t0 - atan(t0))
    if half_tip <= 1e-5 or half_root >= pi / z:
        raise ValueError("Korekcia vytvára špicatý zub alebo prekrývajúce sa päty zubov.")
    g = {
        "root_fillet": None,
        "tip_fillet": None,
        "face_radius": min(0.05 * m, 0.1 * width) if face else 0,
        "teeth": z,
        "profile_shift": x,
        "pitch_diameter": d,
        "base_diameter": db,
        "tip_diameter": da,
        "root_diameter": df,
        "bore": bore,
        "base_half_angle": base_half,
        "t_start": t0,
        "t_end": t1,
        "min_teeth": 2 * (1 - x) / sin(alpha) ** 2,
        "undercut": z < 2 * (1 - x) / sin(alpha) ** 2 - 1e-10,
        "tip_thickness": da * half_tip,
    }
    if rounding:
        g["root_fillet"] = proposed_fillet(g, m)
    if head:
        g["tip_fillet"] = proposed_tip_fillet(g, m)
        g["tip_thickness"] = -da * atan2(g["tip_fillet"]["tip"][1], g["tip_fillet"]["tip"][0])
    if face:
        g["face_radius"] = min(
            0.05 * m, 0.1 * width, 0.5 * g["root_fillet"]["radius"], 0.5 * g["tip_fillet"]["radius"]
        )
    g["outline"] = rounded_outline(g) if rounding or head else outline(g)
    return g


def analyze(p: Design) -> dict:
    if p.face_fillet and max(p.teeth1, p.teeth2) > 60:
        raise ValueError("Zaoblenie hrán po šírke podporuje najviac 60 zubov.")
    if p.face_fillet and (not p.root_fillet or not p.tip_fillet):
        raise ValueError("Zaoblenie hrán po šírke vyžaduje prechody päty aj hlavy.")
    alpha = radians(p.pressure_angle)
    xsum = p.profile1 + p.profile2
    aw = inverse_inv(inv(alpha) + 2 * xsum * tan(alpha) / (p.teeth1 + p.teeth2))
    a0 = p.module * (p.teeth1 + p.teeth2) / 2
    a = a0 * cos(alpha) / cos(aw)
    # Tip shortening keeps c*=0.25 when working center distance differs from a0.
    y = (a - a0) / p.module
    k = xsum - y
    gears = [
        gear(
            p.module,
            z,
            alpha,
            x,
            k,
            bore,
            bool(p.root_fillet),
            bool(p.tip_fillet),
            bool(p.face_fillet),
            p.width,
        )
        for z, x, bore in ((p.teeth1, p.profile1, p.bore1), (p.teeth2, p.profile2, p.bore2))
    ]
    g1, g2 = gears
    rb1, rb2 = g1["base_diameter"] / 2, g2["base_diameter"] / 2
    q1 = rb1 * (g1["tip_fillet"]["t"] if g1["tip_fillet"] else g1["t_end"])
    q2 = rb2 * (g2["tip_fillet"]["t"] if g2["tip_fillet"] else g2["t_end"])
    span = a * sin(aw)
    contact_ratio = (q1 + q2 - span) / (pi * p.module * cos(alpha))
    # End of each active involute must remain above the partner's involute start.
    start1 = rb1 * (g1["root_fillet"]["t"] if g1["root_fillet"] else g1["t_start"])
    start2 = rb2 * (g2["root_fillet"]["t"] if g2["root_fillet"] else g2["t_start"])
    interference = q1 > span - start2 + 1e-8 or q2 > span - start1 + 1e-8
    rw1, rw2 = a * p.teeth1 / (p.teeth1 + p.teeth2), a * p.teeth2 / (p.teeth1 + p.teeth2)
    ft = p.torque * 1000 / rw1  # N m -> N mm; force at working pitch circle.
    fn = ft / cos(aw)
    req = (rw1 * sin(aw)) * (rw2 * sin(aw)) / ((rw1 + rw2) * sin(aw))
    effective_e = p.elastic_modulus / (2 * (1 - p.poisson_ratio**2))
    effective_width = p.width - 2 * max(g1["face_radius"], g2["face_radius"])
    hertz = sqrt(fn * effective_e / (pi * effective_width * req))
    # Lewis approximation for unshifted 20-degree full-depth teeth only.
    lewis_valid = (
        abs(p.pressure_angle - 20) < 1e-9 and abs(p.profile1) < 1e-9 and abs(p.profile2) < 1e-9
    )
    bending = (
        [ft / (effective_width * p.module * (0.484 - 2.87 / g["teeth"])) for g in gears]
        if lewis_valid
        else None
    )
    checks = [
        {
            "name": "Podrezanie pastorka",
            "ok": not g1["undercut"],
            "detail": f"z₁ ≥ {g1['min_teeth']:.2f}",
        },
        {
            "name": "Podrezanie kolesa",
            "ok": not g2["undercut"],
            "detail": f"z₂ ≥ {g2['min_teeth']:.2f}",
        },
        {
            "name": "Evolventná interferencia",
            "ok": not interference,
            "detail": "Aktívny bok nad navrhovaným zaoblením päty"
            if p.root_fillet
            else "Kontrola aktívnej dráhy záberu",
        },
        {
            "name": "Trvalý záber",
            "ok": contact_ratio >= 1,
            "detail": f"εα = {contact_ratio:.3f} ≥ 1",
        },
        {
            "name": "Hrúbka hlavy zuba",
            "ok": min(g1["tip_thickness"], g2["tip_thickness"]) >= 0.25 * p.module,
            "detail": "Odporúčaná hrúbka ≥ 0,25 m",
        },
    ]
    return {
        "effective_width": effective_width,
        "parameters": p.model_dump(),
        "gears": gears,
        "ratio": p.teeth2 / p.teeth1,
        "center_distance": a,
        "reference_center_distance": a0,
        "tip_shortening": k,
        "working_pressure_angle": degrees(aw),
        "contact_ratio": contact_ratio,
        "output_rpm": p.rpm * p.teeth1 / p.teeth2,
        "tangential_force": ft,
        "hertz_mpa": hertz,
        "bending_mpa": bending,
        "checks": checks,
        "geometry_ok": all(c["ok"] for c in checks),
        "limitations": [
            "Predbežný výpočet; nejde o overenie podľa ISO 6336 ani DIN 3990.",
            "Navrhované kruhové zaoblenia päty nie sú výrobná trochoida; pevnostný účinok nie je overený."
            if p.root_fillet
            else "Päty sú radiálne prechody bez generovanej trochoidy a zaoblenia.",
            "Napätia sú odhady bez dynamických faktorov a bezpečnostného súčiniteľa.",
            "STEP bez aproximácie nie je týmto CAD jadrom podporovaný.",
        ],
    }
