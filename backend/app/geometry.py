"""Analytic external involute spur gears, full-depth rack ha*=1, hf*=1.25.

Dimension and profile-shift equations follow KHK / SDP-SI technical references.
See docs/ENGINEERING.md for equations, assumptions and limits of every check.
"""

from math import atan, cos, degrees, hypot, pi, radians, sin, sqrt, tan

from .models import Design


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


def gear(m: float, z: int, alpha: float, x: float, k: float, bore: float) -> dict:
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
    g["outline"] = outline(g)
    return g


def analyze(p: Design) -> dict:
    alpha = radians(p.pressure_angle)
    xsum = p.profile1 + p.profile2
    aw = inverse_inv(inv(alpha) + 2 * xsum * tan(alpha) / (p.teeth1 + p.teeth2))
    a0 = p.module * (p.teeth1 + p.teeth2) / 2
    a = a0 * cos(alpha) / cos(aw)
    # Tip shortening keeps c*=0.25 when working center distance differs from a0.
    y = (a - a0) / p.module
    k = xsum - y
    gears = [
        gear(p.module, z, alpha, x, k, bore)
        for z, x, bore in ((p.teeth1, p.profile1, p.bore1), (p.teeth2, p.profile2, p.bore2))
    ]
    g1, g2 = gears
    rb1, rb2 = g1["base_diameter"] / 2, g2["base_diameter"] / 2
    ra1, ra2 = g1["tip_diameter"] / 2, g2["tip_diameter"] / 2
    q1, q2 = sqrt(ra1**2 - rb1**2), sqrt(ra2**2 - rb2**2)
    span = a * sin(aw)
    contact_ratio = (q1 + q2 - span) / (pi * p.module * cos(alpha))
    # End of each active involute must remain above the partner's involute start.
    start1 = sqrt(max(0, (max(rb1, g1["root_diameter"] / 2)) ** 2 - rb1**2))
    start2 = sqrt(max(0, (max(rb2, g2["root_diameter"] / 2)) ** 2 - rb2**2))
    interference = q1 > span - start2 + 1e-8 or q2 > span - start1 + 1e-8
    rw1, rw2 = a * p.teeth1 / (p.teeth1 + p.teeth2), a * p.teeth2 / (p.teeth1 + p.teeth2)
    ft = p.torque * 1000 / rw1  # N m -> N mm; force at working pitch circle.
    fn = ft / cos(aw)
    req = (rw1 * sin(aw)) * (rw2 * sin(aw)) / ((rw1 + rw2) * sin(aw))
    effective_e = p.elastic_modulus / (2 * (1 - p.poisson_ratio**2))
    hertz = sqrt(fn * effective_e / (pi * p.width * req))
    # Lewis approximation for unshifted 20-degree full-depth teeth only.
    lewis_valid = (
        abs(p.pressure_angle - 20) < 1e-9 and abs(p.profile1) < 1e-9 and abs(p.profile2) < 1e-9
    )
    bending = (
        [ft / (p.width * p.module * (0.484 - 2.87 / g["teeth"])) for g in gears]
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
            "detail": "Kontrola aktívnej dráhy záberu",
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
            "Päty sú radiálne prechody bez generovanej trochoidy a zaoblenia.",
            "Napätia sú odhady bez dynamických faktorov a bezpečnostného súčiniteľa.",
            "STEP bez aproximácie nie je týmto CAD jadrom podporovaný.",
        ],
    }
