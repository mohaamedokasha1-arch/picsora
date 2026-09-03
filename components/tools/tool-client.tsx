'use client';

import type { ToolDef } from '@/lib/tools/registry';
import { ToolWorkspace, ruleFor } from './tool-workspace';
import { toolComponents } from './ui';
import { standaloneTools } from './kit/registry';

export function ToolClient({ tool }: { tool: ToolDef }) {
  if (tool.kind === 'image') {
    const UI = toolComponents[tool.slug];
    if (!UI) return null;
    return (
      <ToolWorkspace tool={tool} rule={ruleFor(tool)}>
        {(ctx) => <UI ctx={ctx} />}
      </ToolWorkspace>
    );
  }

  const Standalone = standaloneTools[tool.slug];
  if (!Standalone) return null;
  return <Standalone tool={tool} />;
}
