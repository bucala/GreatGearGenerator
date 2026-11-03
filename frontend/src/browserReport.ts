import { jsPDF } from 'jspdf';
import type { Analysis } from './types';

/** English report uses built-in PDF fonts, so exports do not need a remote font service. */
export function createReport(r: Analysis): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const p = r.parameters;
  let y = 20;
  const ink = () => doc.setTextColor(30, 61, 66);
  function paragraph(text: string, size = 9) {
    ink();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(text, 174);
    doc.text(lines, 18, y);
    y += lines.length * 4.2 + 3;
  }
  function heading(text: string) {
    ink();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    y += 3;
    doc.text(text, 18, y);
    y += 7;
  }
  ink();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('GREAT GEAR GENERATOR', 18, y);
  y += 10;
  paragraph('External spur gear pair / preliminary calculation', 11);
  paragraph(
    `Geometry checks: ${r.geometry_ok ? 'PASS' : 'FAIL'} - limited checks below, not a strength or manufacturing approval.`,
  );
  const rows: string[][] = [
    ['Parameter', 'Pinion', 'Wheel'],
    ['Module [mm]', p.module.toFixed(3), p.module.toFixed(3)],
    ['Teeth', String(p.teeth1), String(p.teeth2)],
    ['Profile shift', p.profile1.toFixed(3), p.profile2.toFixed(3)],
    ['Face width [mm]', p.width.toFixed(3), p.width.toFixed(3)],
  ];
  for (const [key, name] of [
    ['pitch_diameter', 'Pitch diameter [mm]'],
    ['base_diameter', 'Base diameter [mm]'],
    ['tip_diameter', 'Tip diameter [mm]'],
    ['root_diameter', 'Root diameter [mm]'],
    ['bore', 'Bore [mm]'],
    ['tip_thickness', 'Tip tooth thickness [mm]'],
  ] as const)
    rows.push([name, ...r.gears.map((g) => g[key].toFixed(3))]);
  rows.push([
    'Proposed root radius [mm]',
    ...r.gears.map((g) => (g.root_fillet?.radius ?? 0).toFixed(3)),
  ]);
  rows.forEach((row, i) => {
    if (i === 0) doc.setFillColor(24, 60, 65);
    else if (i % 2) doc.setFillColor(237, 244, 243);
    else doc.setFillColor(255, 255, 255);
    doc.rect(18, y - 4.5, 174, 7.5, 'F');
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
    doc.setFontSize(9);
    if (i === 0) doc.setTextColor(255, 255, 255);
    else doc.setTextColor(30, 61, 66);
    row.forEach((cell, j) => doc.text(cell, [21, 113, 157][j], y));
    y += 7.5;
  });
  heading('Kinematics and checks');
  paragraph(
    `Pressure angle: ${p.pressure_angle.toFixed(2)} deg; working angle: ${r.working_pressure_angle.toFixed(3)} deg; center distance: ${r.center_distance.toFixed(3)} mm. Ratio: ${r.ratio.toFixed(4)}; input/output: ${p.rpm.toFixed(1)}/${r.output_rpm.toFixed(1)} rpm. Contact ratio: ${r.contact_ratio.toFixed(3)}.`,
  );
  const labels = [
    'Pinion undercut',
    'Wheel undercut',
    'Active involute interference',
    'Continuous contact',
    'Tip thickness >= 0.25 m',
  ];
  paragraph(r.checks.map((c, i) => `${labels[i]}: ${c.ok ? 'PASS' : 'FAIL'}`).join('; '));
  heading('Load estimates (same material on both gears)');
  paragraph(
    `Input torque: ${p.torque.toFixed(3)} N m; E: ${p.elastic_modulus.toFixed(0)} MPa; Poisson ratio: ${p.poisson_ratio.toFixed(3)}. Tangential force: ${r.tangential_force.toFixed(2)} N. Hertz line-contact peak stress at working pitch point: ${r.hertz_mpa.toFixed(2)} MPa.`,
  );
  paragraph(
    r.bending_mpa
      ? `Lewis root stress (pinion / wheel): ${r.bending_mpa.map((v) => v.toFixed(2)).join(' / ')} MPa.`
      : 'Lewis root stress: not evaluated. Restricted to unshifted 20 deg full-depth teeth.',
  );
  heading('Scope and limitations');
  paragraph(
    'Analytic involute equations; sampled preview. Browser STEP uses B-spline approximation of 65 analytic samples per flank, circular tip/root arcs and optional tangent circular root blends. R starts at 0.3m and is limited by geometry. No certified global deviation bound. Exact involute STEP and rack-generated trochoids are unsupported. Root blend strength benefits are not evaluated. No ISO 6336 / DIN 3990 certification, fatigue, dynamics, material allowables or safety factors. PASS refers only to the listed geometric checks.',
    8,
  );
  paragraph(
    'References: KHK Calculation of Gear Dimensions; SDP-SI Elements of Metric Gear Technology, section 4. Equations and assumptions: docs/ENGINEERING.md in the project repository.',
    8,
  );
  doc.setFontSize(8);
  doc.setTextColor(84, 102, 106);
  doc.text('GGG / preliminary design / dimensions in mm / computed in your browser', 18, 286);
  doc.text('1', 192, 286, { align: 'right' });
  doc.setProperties({
    title: 'Great Gear Generator - Calculation report',
    creator: 'Great Gear Generator',
  });
  return doc.output('blob');
}
