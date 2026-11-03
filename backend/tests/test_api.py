from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader

from backend.app.main import app, cad_lock
from backend.app.models import Design

client = TestClient(app)


def test_health_and_default_analysis():
    assert client.get("/api/health").json() == {"status": "ok", "exact_step": False}
    response = client.post("/api/analyze", json={})
    assert response.status_code == 200
    assert response.json()["geometry_ok"]
    assert len(response.json()["gears"][0]["outline"]) > 500


@pytest.mark.parametrize(
    "invalid",
    [
        {"teeth1": -1},
        {"module": 0},
        {"teeth2": 22.5},
        {"teeth1": True},
        {"pressure_angle": 80},
        {"width": -3},
        {"unexpected": 1},
        {"profile1": 2},
        {"bore1": 100},
        {"poisson_ratio": 0.5},
        {"module": "NaN"},
        {"root_fillet": 2},
        {"root_fillet": 0.5},
        {"torque": "Infinity"},
        {"manual_radii": 0.5},
        {"manual_radii": 1, "root_fillet": 1, "root_radius": 0},
        {"manual_radii": 1, "root_fillet": 1, "root_radius": 100},
        {"manual_radii": 1, "tip_fillet": 1, "tip_radius": 100},
        {
            "manual_radii": 1,
            "root_fillet": 1,
            "tip_fillet": 1,
            "face_fillet": 1,
            "root_radius": 0.4,
            "tip_radius": 0.12,
            "face_radius": 0.2,
        },
    ],
)
def test_bad_parameters_return_validation_error(invalid):
    assert client.post("/api/analyze", json=invalid).status_code == 422


def test_pdf_is_readable_and_includes_limits_and_input():
    response = client.post("/api/generate-report", json={"torque": 12.5})
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
    text = " ".join(p.extract_text() for p in PdfReader(BytesIO(response.content)).pages)
    assert "12.500" in text
    assert "ISO 6336" in text
    assert "65 points" in text
    assert "PASS" in text


def test_exact_step_is_never_silently_approximated():
    response = client.post("/api/generate-step", json={})
    assert response.status_code == 422
    assert "allow_approximation" in response.json()["detail"]


def test_invalid_geometry_blocks_approximate_step():
    assert (
        client.post(
            "/api/generate-step", json={"teeth1": 10, "bore1": 3, "allow_approximation": True}
        ).status_code
        == 422
    )


def test_cad_busy_returns_503():
    with cad_lock:
        assert (
            client.post("/api/generate-step", json={"allow_approximation": True}).status_code == 503
        )


def test_step_round_trip_has_two_valid_solids_and_expected_volume(tmp_path):
    import cadquery as cq

    from backend.app.geometry import analyze

    response = client.post("/api/generate-step", json={"allow_approximation": True})
    assert response.status_code == 200
    assert response.headers["x-geometry-mode"] == "approximate-bspline-radial-root"
    assert b"ISO-10303-21" in response.content
    path = tmp_path / "pair.stp"
    path.write_bytes(response.content)
    solids = cq.importers.importStep(str(path)).solids().vals()
    assert len(solids) == 2
    assert all(s.isValid() for s in solids)
    from math import pi

    for solid, g in zip(solids, analyze(Design())["gears"]):
        lower = pi * (g["root_diameter"] ** 2 - g["bore"] ** 2) / 4 * 16
        upper = pi * (g["tip_diameter"] ** 2 - g["bore"] ** 2) / 4 * 16
        assert lower < solid.Volume() < upper


def test_cad_failure_releases_lock_and_returns_safe_error(monkeypatch):
    from backend.app import cad

    def fail(*args):
        raise RuntimeError("internal path must not leak")

    monkeypatch.setattr(cad, "export_step", fail)
    response = client.post("/api/generate-step", json={"allow_approximation": True})
    assert response.status_code == 500
    assert "internal path" not in response.text
    assert not cad_lock.locked()
