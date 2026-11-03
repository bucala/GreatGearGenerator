"""Generate browser regression cases from the independently tested Python engine.

Run from the repository root: uv run python scripts/generate_browser_fixtures.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.geometry import analyze
from backend.app.models import Design

cases = [
    ("standard", {}),
    ("khk-shifted", {"module": 3, "teeth1": 12, "teeth2": 24, "profile1": 0.6, "profile2": 0.36}),
    ("undercut", {"teeth1": 10, "bore1": 3}),
    ("large-root-no-bore", {"teeth1": 80, "teeth2": 120, "bore1": 0, "bore2": 0}),
    ("small-module-zero-load", {"module": 0.2, "bore1": 0, "bore2": 0, "torque": 0}),
    ("30-degrees", {"pressure_angle": 30}),
    ("opposite-shifts", {"profile1": 0.2, "profile2": -0.2}),
    ("circular-root-blends", {"root_fillet": 1}),
    ("tip-and-face-blends", {"root_fillet": 1, "tip_fillet": 1, "face_fillet": 1}),
    (
        "large-rounded-roots",
        {"root_fillet": 1, "teeth1": 80, "teeth2": 120, "bore1": 0, "bore2": 0},
    ),
]
fixtures = []
for name, values in cases:
    result = analyze(Design(**values))
    for g in result["gears"]:
        points = g.pop("outline")
        g["outline_length"] = len(points)
        g["outline_samples"] = [
            [i, points[i]] for i in (0, 1, 7, 20, len(points) // 2, len(points) - 1)
        ]
    fixtures.append({"name": name, "expected": result})
target = Path("frontend/src/fixtures/python-reference.json")
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(fixtures, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(fixtures)} Python reference cases to {target}")
