'use client';

/**
 * Fixed-target compression landing pages (100KB / 200KB / 500KB / 1MB).
 * Thin wrappers over the exact-size engine — no duplicated logic.
 */

import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import ExactKbTool from './exact-kb';

type Ctx = { ctx: WorkspaceContext };

export function CompressTo100kbTool({ ctx }: Ctx) {
  return <ExactKbTool ctx={ctx} presetKB={100} lockTarget />;
}
export function CompressTo200kbTool({ ctx }: Ctx) {
  return <ExactKbTool ctx={ctx} presetKB={200} lockTarget />;
}
export function CompressTo500kbTool({ ctx }: Ctx) {
  return <ExactKbTool ctx={ctx} presetKB={500} lockTarget />;
}
export function CompressTo1mbTool({ ctx }: Ctx) {
  return <ExactKbTool ctx={ctx} presetKB={1024} lockTarget />;
}
