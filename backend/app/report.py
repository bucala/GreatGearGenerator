"""A compact calculation report, with explicit engineering scope and source links."""

from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def report(result: dict) -> bytes:
    # Built-in Helvetica keeps exports portable. English avoids missing glyphs.
    stream = BytesIO()
    doc = SimpleDocTemplate(
        stream,
        pagesize=(210 * mm, 297 * mm),
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Great Gear Generator - Calculation report",
    )
    styles = getSampleStyleSheet()
    styles["Title"].textColor = colors.HexColor("#183c41")
    elements = []

    def para(text, style="BodyText"):
        elements.append(Paragraph(escape(text), styles[style]))
        elements.append(Spacer(1, 2 * mm))

    para("GREAT GEAR GENERATOR", "Title")
    para("External spur gear pair / preliminary calculation", "Heading2")
    para(
        "Geometry checks: "
        + ("PASS" if result["geometry_ok"] else "FAIL")
        + " - limited checks below, not a strength or manufacturing approval."
    )
    p = result["parameters"]
    rows = [
        ["Parameter", "Pinion", "Wheel"],
        ["Module [mm]", f"{p['module']:.3f}", f"{p['module']:.3f}"],
        ["Teeth", str(p["teeth1"]), str(p["teeth2"])],
        ["Profile shift", f"{p['profile1']:.3f}", f"{p['profile2']:.3f}"],
        ["Face width [mm]", f"{p['width']:.3f}", f"{p['width']:.3f}"],
    ]
    for key, name in [
        ("pitch_diameter", "Pitch diameter [mm]"),
        ("base_diameter", "Base diameter [mm]"),
        ("tip_diameter", "Tip diameter [mm]"),
        ("root_diameter", "Root diameter [mm]"),
        ("bore", "Bore [mm]"),
        ("tip_thickness", "Tip tooth thickness [mm]"),
    ]:
        rows.append([name] + [f"{g[key]:.3f}" for g in result["gears"]])
    rows.append(
        ["Root radius [mm]"]
        + [
            f"{g['root_fillet']['radius']:.3f}" if g.get("root_fillet") else "0.000"
            for g in result["gears"]
        ]
    )
    rows.append(
        ["Tip radius [mm]"]
        + [
            f"{g['tip_fillet']['radius']:.3f}" if g.get("tip_fillet") else "0.000"
            for g in result["gears"]
        ]
    )
    rows.append(
        ["Face edge radius [mm]"] + [f"{g.get('face_radius', 0):.3f}" for g in result["gears"]]
    )
    table = Table(rows, colWidths=[86 * mm, 44 * mm, 44 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#183c41")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#edf4f3"), colors.white]),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(table)
    para("Kinematics and checks", "Heading2")
    para(
        f"Pressure angle: {p['pressure_angle']:.2f} deg; working angle: "
        f"{result['working_pressure_angle']:.3f} deg; center distance: {result['center_distance']:.3f} mm. "
        f"Ratio: {result['ratio']:.4f}; input/output: {p['rpm']:.1f}/{result['output_rpm']:.1f} rpm. "
        f"Contact ratio: {result['contact_ratio']:.3f}."
    )
    labels = [
        "Pinion undercut",
        "Wheel undercut",
        "Active involute interference",
        "Continuous contact",
        "Tip thickness >= 0.25 m",
    ]
    para(
        "; ".join(
            f"{label}: {'PASS' if c['ok'] else 'FAIL'}"
            for label, c in zip(labels, result["checks"])
        )
    )
    para("Load estimates (same material on both gears)", "Heading2")
    para(
        f"Effective contact width: {result['effective_width']:.3f} mm; input torque: {p['torque']:.3f} N m; E: {p['elastic_modulus']:.0f} MPa; "
        f"Poisson ratio: {p['poisson_ratio']:.3f}. Tangential force: {result['tangential_force']:.2f} N. "
        f"Hertz line-contact peak stress at working pitch point: {result['hertz_mpa']:.2f} MPa."
    )
    bending = result["bending_mpa"]
    para(
        "Lewis root stress (pinion / wheel): "
        + (
            f"{bending[0]:.2f} / {bending[1]:.2f} MPa."
            if bending
            else "Not evaluated: estimate is restricted to unshifted 20 deg full-depth teeth."
        )
    )
    para("Scope and limitations", "Heading2")
    para(
        "Analytic involute flank equations; preview is sampled. Approximate STEP uses interpolated "
        "B-splines through 65 points per flank (no certified global error bound). Exact involute "
        "STEP is unsupported. Root transitions are radial or tangent circular design blends, "
        "starting at R=0.3m and limited by geometry. They are not rack-generated trochoids; "
        "tip/face blends are optional; width for stress estimates excludes 2R at the edges. "
        "Root blend strength benefits are not evaluated. "
        "No ISO 6336 / DIN 3990 certification, material allowables, fatigue, dynamic factors, "
        "backlash or safety factors are evaluated. Undercut geometry is not simulated. "
        "PASS refers only to the listed preliminary geometric checks."
    )
    para(
        "References: SDP-SI, Elements of Metric Gear Technology, section 4; KHK, Calculation "
        "of Gear Dimensions. Equations and assumptions: docs/ENGINEERING.md."
    )

    def footer(canvas, document):
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#54666a"))
        canvas.drawString(18 * mm, 10 * mm, "GGG / preliminary design / dimensions in mm")
        canvas.drawRightString(192 * mm, 10 * mm, str(document.page))

    doc.build(elements, onFirstPage=footer, onLaterPages=footer)
    return stream.getvalue()
