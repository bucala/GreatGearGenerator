import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import { BufferGeometry, Float32BufferAttribute, ExtrudeGeometry, Mesh, Path, Shape } from 'three';
import { generateMesh, type CadMesh } from './browserMesh';
import type { Analysis, Gear } from './types';

function GearMesh({
  gear,
  width,
  x,
  phase,
  speed,
  animate,
  color,
  cad,
}: {
  gear: Gear;
  width: number;
  x: number;
  phase: number;
  speed: number;
  animate: boolean;
  color: string;
  cad?: CadMesh;
}) {
  const ref = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    if (cad) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(cad.vertices, 3));
      geometry.setAttribute('normal', new Float32BufferAttribute(cad.normals, 3));
      geometry.setIndex(cad.triangles);
      return geometry;
    }
    const shape = new Shape();
    gear.outline.forEach(([px, py], i) => (i ? shape.lineTo(px, py) : shape.moveTo(px, py)));
    shape.closePath();
    if (gear.bore > 0) {
      const hole = new Path();
      hole.absarc(0, 0, gear.bore / 2, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    return new ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 48 });
  }, [gear, width, cad]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (ref.current)
      ref.current.rotation.z = phase + (animate ? clock.getElapsedTime() * speed : 0);
  });
  return (
    <mesh ref={ref} geometry={geometry} position={[x, 0, -width / 2]} rotation={[0, 0, phase]}>
      <meshStandardMaterial color={color} metalness={0.58} roughness={0.31} />
    </mesh>
  );
}

export default function Scene({
  result,
  animate,
  onCadBusy,
}: {
  result: Analysis;
  animate: boolean;
  onCadBusy?: (busy: boolean) => void;
}) {
  const key = JSON.stringify(
    result.gears.map((g) => ({
      teeth: g.teeth,
      outline: g.outline,
      bore: g.bore,
      face: g.face_radius,
      width: result.parameters.width,
    })),
  );
  const [cad, setCad] = useState<{ key: string; meshes: [CadMesh, CadMesh] } | null>(null);
  const [error, setError] = useState('');
  const face = !!result.parameters.face_fillet;
  useEffect(() => {
    if (!face || cad?.key === key) {
      onCadBusy?.(false);
      return;
    }
    onCadBusy?.(true);
    const controller = new AbortController();
    setError('');
    generateMesh(result.parameters, controller.signal)
      .then((meshes) => {
        if (!controller.signal.aborted) setCad({ key, meshes });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) onCadBusy?.(false);
      });
    return () => {
      controller.abort();
      onCadBusy?.(false);
    };
  }, [key, face, onCadBusy]);
  const ready = !face || cad?.key === key;
  const a = result.center_distance;
  const extent = a + (result.gears[0].tip_diameter + result.gears[1].tip_diameter) / 2;
  const scale = 120 / extent;
  return (
    <div
      className="scene-host"
      data-cad-model={face ? 'face' : 'extrusion'}
      data-cad-state={ready ? 'ready' : error ? 'error' : 'pending'}
    >
      <Canvas
        frameloop={animate && ready ? 'always' : 'demand'}
        camera={{ position: [82, 105, 115], fov: 40 }}
        aria-label="Interaktívny 3D náhľad súkolesia"
      >
        <ambientLight intensity={1.7} />
        <directionalLight position={[20, 100, 50]} intensity={3} />
        <directionalLight position={[-70, 30, -30]} intensity={2} color="#75d9e8" />
        {!ready && (
          <Html center>
            <div className="cad-preview-message" role={error ? 'alert' : 'status'}>
              {error || 'Vytváram CAD náhľad zaoblenia hrán…'}
            </div>
          </Html>
        )}
        {ready && (
          <group rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
            <GearMesh
              gear={result.gears[0]}
              width={result.parameters.width}
              x={-a / 2}
              phase={0}
              speed={0.22}
              animate={animate}
              color="#e2ad58"
              cad={face ? cad!.meshes[0] : undefined}
            />
            <GearMesh
              gear={result.gears[1]}
              width={result.parameters.width}
              x={a / 2}
              phase={Math.PI - Math.PI / result.gears[1].teeth}
              speed={-0.22 / result.ratio}
              animate={animate}
              color="#74b8b9"
              cad={face ? cad!.meshes[1] : undefined}
            />
          </group>
        )}
        <Grid
          position={[0, (-result.parameters.width * scale) / 2 - 0.3, 0]}
          args={[250, 250]}
          cellSize={10}
          cellThickness={0.45}
          cellColor="#33505a"
          sectionSize={50}
          sectionColor="#49666e"
          fadeDistance={280}
          infiniteGrid
        />
        <OrbitControls makeDefault minDistance={35} maxDistance={400} />
      </Canvas>
    </div>
  );
}
