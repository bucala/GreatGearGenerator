from math import cos, hypot, pi, radians, sin, sqrt

import pytest

from backend.app.geometry import analyze, flank, involute
from backend.app.models import Design


def test_standard_pair_reference_dimensions_and_contact_ratio():
    r = analyze(Design())
    g1, g2 = r["gears"]
    assert g1["pitch_diameter"] == 48
    assert g2["pitch_diameter"] == 96
    assert g1["tip_diameter"] == 52
    assert g1["root_diameter"] == 43
    assert g1["base_diameter"] == pytest.approx(48 * cos(radians(20)))
    assert r["center_distance"] == pytest.approx(72)
    assert r["working_pressure_angle"] == pytest.approx(20)
    expected = (
        sqrt(26**2 - (24 * cos(radians(20))) ** 2)
        + sqrt(50**2 - (48 * cos(radians(20))) ** 2)
        - 72 * sin(radians(20))
    ) / (pi * 2 * cos(radians(20)))
    assert r["contact_ratio"] == pytest.approx(expected)
    assert r["geometry_ok"]
    assert r["ratio"] == 2
    assert r["output_rpm"] == 300


@pytest.mark.parametrize("t", [0, 0.01, 0.2, 0.7, 1.2])
def test_involute_radius_and_tangent_identity(t):
    rb = 21.3
    x, y = involute(t, rb)
    assert hypot(x, y) == pytest.approx(rb * sqrt(1 + t * t))
    h = 1e-6
    xp, yp = involute(t + h, rb)
    xm, ym = involute(t - h, rb)
    assert (xp - xm) / (2 * h) == pytest.approx(rb * t * cos(t), abs=1e-7)
    assert (yp - ym) / (2 * h) == pytest.approx(rb * t * sin(t), abs=1e-7)


def test_pitch_tooth_thickness_matches_half_circular_pitch():
    g = analyze(Design())["gears"][0]
    a, b = (
        flank(g, 0, -1, sin(radians(20)) / cos(radians(20))),
        flank(g, 0, 1, sin(radians(20)) / cos(radians(20))),
    )
    from math import atan2

    thickness = (atan2(b[1], b[0]) - atan2(a[1], a[0])) * 24
    assert thickness == pytest.approx(pi)  # pi*m/2 = pi for m=2


def test_khk_profile_shift_reference_and_clearance():
    # KHK/SDP-SI table 4-3: m=3, z=12/24, x=0.6/0.36, alpha=20.
    r = analyze(Design(module=3, teeth1=12, teeth2=24, profile1=0.6, profile2=0.36))
    assert r["working_pressure_angle"] == pytest.approx(26.0886, abs=0.001)
    assert r["center_distance"] == pytest.approx(56.4999, abs=0.002)
    for i, j in [(0, 1), (1, 0)]:
        assert r["center_distance"] - r["gears"][i]["tip_diameter"] / 2 - r["gears"][j][
            "root_diameter"
        ] / 2 == pytest.approx(0.75)
    assert r["bending_mpa"] is None


def test_undercut_and_interference_are_not_reported_as_safe():
    r = analyze(Design(teeth1=10, bore1=3))
    assert r["gears"][0]["undercut"]
    assert not r["geometry_ok"]
    assert not next(c for c in r["checks"] if c["name"] == "Evolventná interferencia")["ok"]


def test_load_scaling_and_zero_load():
    r = analyze(Design())
    double = analyze(Design(torque=20))
    assert double["hertz_mpa"] == pytest.approx(r["hertz_mpa"] * sqrt(2))
    assert double["bending_mpa"][0] == pytest.approx(r["bending_mpa"][0] * 2)
    assert analyze(Design(torque=0))["hertz_mpa"] == 0


def test_oversize_bore_and_pointed_teeth_rejected():
    with pytest.raises(ValueError, match="Otvor"):
        analyze(Design(bore1=43))
    with pytest.raises(ValueError):
        analyze(Design(teeth1=8, pressure_angle=30, profile1=0.8, bore1=0))
