import type { Design } from './types';
import type { ShapeMesh } from 'replicad';
export type CadMesh = Pick<ShapeMesh, 'vertices' | 'triangles' | 'normals'>;

const key = (p: Design) =>
  JSON.stringify([
    p.module,
    p.teeth1,
    p.teeth2,
    p.pressure_angle,
    p.profile1,
    p.profile2,
    p.width,
    p.bore1,
    p.bore2,
    p.root_fillet ?? 0,
    p.tip_fillet ?? 0,
    p.face_fillet ?? 0,
  ]);
let cached: { key: string; blob: Blob; meshes: [CadMesh, CadMesh] } | null = null;
export const cachedStep = (design: Design) => (cached?.key === key(design) ? cached.blob : null);
export function generateMesh(design: Design, signal: AbortSignal): Promise<[CadMesh, CadMesh]> {
  if (signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
  if (cached?.key === key(design)) return Promise.resolve(cached.meshes);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./cad.worker.ts', import.meta.url), { type: 'module' });
    const finish = (error?: Error, meshes?: [CadMesh, CadMesh]) => {
      clearTimeout(timer);
      worker.terminate();
      signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(meshes!);
    };
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
    const timer = setTimeout(
      () => finish(new Error('3D zaoblenie prekročilo 300 s. Vypnite zaoblenie hrán po šírke.')),
      300000,
    );
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    worker.onmessage = ({ data }) => {
      if (data.error) finish(new Error(data.error));
      else if (data.meshes) {
        if (data.blob) cached = { key: key(design), blob: data.blob, meshes: data.meshes };
        finish(undefined, data.meshes);
      }
    };
    worker.onerror = () => finish(new Error('CAD náhľad sa nepodarilo zostaviť.'));
    worker.postMessage({ ...design, allow_approximation: true, action: 'mesh' });
  });
}
