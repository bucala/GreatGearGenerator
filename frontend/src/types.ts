export type Design = {
  root_fillet?: number;
  module: number;
  teeth1: number;
  teeth2: number;
  pressure_angle: number;
  profile1: number;
  profile2: number;
  width: number;
  bore1: number;
  bore2: number;
  torque: number;
  rpm: number;
  elastic_modulus: number;
  poisson_ratio: number;
};
export const defaults: Design = {
  root_fillet: 0,
  module: 2,
  teeth1: 24,
  teeth2: 48,
  pressure_angle: 20,
  profile1: 0,
  profile2: 0,
  width: 16,
  bore1: 10,
  bore2: 16,
  torque: 10,
  rpm: 600,
  elastic_modulus: 210000,
  poisson_ratio: 0.3,
};
export type Gear = {
  root_fillet: RootFillet | null;
  teeth: number;
  profile_shift: number;
  pitch_diameter: number;
  base_diameter: number;
  tip_diameter: number;
  root_diameter: number;
  bore: number;
  base_half_angle: number;
  t_start: number;
  t_end: number;
  min_teeth: number;
  undercut: boolean;
  tip_thickness: number;
  outline: [number, number][];
};
export type RootFillet = {
  radius: number;
  t: number;
  center: [number, number];
  root: [number, number];
  tangent: [number, number];
};
export type Analysis = {
  parameters: Design;
  gears: [Gear, Gear];
  center_distance: number;
  reference_center_distance: number;
  tip_shortening: number;
  ratio: number;
  working_pressure_angle: number;
  contact_ratio: number;
  output_rpm: number;
  tangential_force: number;
  hertz_mpa: number;
  bending_mpa: number[] | null;
  geometry_ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
  limitations: string[];
};
