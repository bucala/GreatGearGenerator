import { calculate } from './geometry';
import type { Design } from './types';

export function generateStep(
  design: Design,
  allowApproximation: boolean,
  onProgress?: (value: string) => void,
): Promise<Blob> {
  if (!allowApproximation)
    return Promise.reject(
      new Error('Exaktný STEP nie je podporovaný. Povoľte návrhovú aproximáciu.'),
    );
  const result = calculate(design);
  if (!result.geometry_ok)
    return Promise.reject(
      new Error('STEP je blokovaný: návrh neprešiel geometrickými kontrolami.'),
    );
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./cad.worker.ts', import.meta.url), { type: 'module' });
    const timeout = setTimeout(
      () => finish(new Error('CAD export prekročil časový limit 120 sekúnd.')),
      120000,
    );
    function finish(error?: Error, blob?: Blob) {
      clearTimeout(timeout);
      worker.terminate();
      if (error) reject(error);
      else if (blob) resolve(blob);
    }
    worker.onmessage = ({
      data,
    }: MessageEvent<{ progress?: string; blob?: Blob; error?: string }>) => {
      if (data.progress) onProgress?.(data.progress);
      if (data.error) finish(new Error(data.error));
      else if (data.blob) finish(undefined, data.blob);
    };
    worker.onerror = () =>
      finish(new Error('Nepodarilo sa spustiť CAD jadro. Skontrolujte pripojenie a skúste znova.'));
    worker.postMessage({ ...design, allow_approximation: allowApproximation });
  });
}
