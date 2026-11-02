"""Local engineering API; expensive CAD operations are serialized per worker."""

import logging
import threading
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from .geometry import analyze
from .models import Design, StepRequest
from .report import report

app = FastAPI(title="Great Gear Generator", version="0.1.0")
cad_lock = threading.Lock()
logger = logging.getLogger(__name__)


def calculate(p: Design) -> dict:
    try:
        return analyze(p)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.get("/api/health")
def health():
    return {"status": "ok", "exact_step": False}


@app.post("/api/analyze")
def analysis(p: Design):
    return calculate(p)


@app.post("/api/generate-report")
def generate_report(p: Design):
    return Response(
        report(calculate(p)),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="gear-report.pdf"'},
    )


@app.post("/api/generate-step")
def generate_step(p: StepRequest):
    if not p.allow_approximation:
        raise HTTPException(
            422,
            "Exaktná evolventa bez spline aproximácie nie je podporovaná. "
            "Návrhový STEP vyžaduje allow_approximation=true.",
        )
    result = calculate(Design.model_validate(p.model_dump(exclude={"allow_approximation"})))
    if not result["geometry_ok"]:
        raise HTTPException(422, "STEP je blokovaný: návrh neprešiel geometrickými kontrolami.")
    if not cad_lock.acquire(blocking=False):
        raise HTTPException(503, "CAD export už prebieha. Skúste znova o chvíľu.")
    try:
        from .cad import export_step

        with TemporaryDirectory(prefix="ggg-") as temp:
            path = Path(temp) / "gear-pair-approximate.stp"
            export_step(result, path)
            content = path.read_bytes()
        return Response(
            content,
            media_type="application/step",
            headers={
                "Content-Disposition": 'attachment; filename="gear-pair-approximate.stp"',
                "X-Geometry-Mode": "approximate-bspline-radial-root",
            },
        )
    except Exception as exc:
        logger.exception("CAD export failed")
        raise HTTPException(500, "CAD export zlyhal; podrobnosti sú v serverovom logu.") from exc
    finally:
        cad_lock.release()


# A built frontend is served from the same origin; Vite proxies /api in development.
dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
