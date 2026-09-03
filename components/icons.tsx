import {
  Gauge,
  Scaling,
  Crop,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Repeat,
  FileText,
  Combine,
  Grid3X3,
  Pipette,
  Palette,
  Droplets,
  Stamp,
  type LucideIcon,
} from 'lucide-react';

/** Central icon registry — maps registry icon names to lucide icons. */
export const TOOL_ICONS: Record<string, LucideIcon> = {
  gauge: Gauge,
  scaling: Scaling,
  crop: Crop,
  rotate: RotateCw,
  'flip-horizontal': FlipHorizontal,
  'flip-vertical': FlipVertical,
  repeat: Repeat,
  'file-text': FileText,
  merge: Combine,
  grid: Grid3X3,
  pipette: Pipette,
  palette: Palette,
  grayscale: Droplets,
  stamp: Stamp,
};

export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = TOOL_ICONS[name] ?? Palette;
  return <Icon className={className} aria-hidden="true" />;
}
