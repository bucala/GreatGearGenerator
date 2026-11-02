import type { Analysis, Design } from './types';

export async function post(
  path: string,
  body: Design | (Design & { allow_approximation: boolean }),
  signal?: AbortSignal,
) {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      typeof error?.detail === 'string'
        ? error.detail
        : Array.isArray(error?.detail)
          ? error.detail
              .map((e: { loc: string[]; msg: string }) => `${e.loc.at(-1)}: ${e.msg}`)
              .join('; ')
          : `Server vrátil chybu ${response.status}.`,
    );
  }
  return response;
}

export async function analyze(design: Design, signal: AbortSignal): Promise<Analysis> {
  return (await post('analyze', design, signal)).json();
}

export async function download(path: string, design: Design, approximate: boolean) {
  const response = await post(
    `generate-${path}`,
    path === 'step' ? { ...design, allow_approximation: approximate } : design,
  );
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = path === 'step' ? 'gear-pair-approximate.stp' : 'gear-report.pdf';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
