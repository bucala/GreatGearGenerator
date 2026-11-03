import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

export default function ViewerZoomControls({
  dimension,
  zoom,
  disabled,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  dimension: '2D' | '3D';
  zoom: number;
  disabled: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const subject = dimension === '2D' ? '2D náčrt' : '3D model';
  return (
    <div className="viewer-zoom-controls" role="group" aria-label={`Priblíženie ${subject}u`}>
      <button
        type="button"
        className="viewer-control"
        aria-label={`Oddialiť ${subject}`}
        title="Oddialiť"
        disabled={disabled || !canZoomOut}
        onClick={onZoomOut}
      >
        <ZoomOut size={18} />
      </button>
      <output aria-label="Priblíženie" aria-live="polite">
        {zoom} %
      </output>
      <button
        type="button"
        className="viewer-control"
        aria-label={`Priblížiť ${subject}`}
        title="Priblížiť"
        disabled={disabled || !canZoomIn}
        onClick={onZoomIn}
      >
        <ZoomIn size={18} />
      </button>
      <button
        type="button"
        className="viewer-control"
        aria-label={`Obnoviť ${dimension} pohľad`}
        title="Obnoviť pohľad"
        disabled={disabled}
        onClick={onReset}
      >
        <Maximize2 size={17} />
      </button>
    </div>
  );
}
