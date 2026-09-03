'use client';

import type { ToolDef } from '@/lib/tools/registry';
import { ToolWorkspace, ruleFor } from './tool-workspace';
import { toolComponents } from './ui';

export function ToolClient({ tool }: { tool: ToolDef }) {
  const UI = toolComponents[tool.slug];
  if (!UI) return null;
  return (
    <ToolWorkspace tool={tool} rule={ruleFor(tool)}>
      {(ctx) => <UI ctx={ctx} />}
    </ToolWorkspace>
  );
}
