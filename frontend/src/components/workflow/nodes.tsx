'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Bot, GitBranch, Play, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRIGGER_LABELS: Record<string, string> = { manual: 'Manual / API', form: 'Website form', inbox: 'Inbox email', webhook: 'Webhook' };
const ACTION_LABELS: Record<string, string> = {
  slack: 'Slack message', webhook: 'Webhook', crm: 'HubSpot contact', email_draft: 'Save reply draft', approval: 'Request approval',
};
const OP_LABELS: Record<string, string> = {
  eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', contains: 'contains', is_true: 'is true', is_false: 'is false',
};

function Shell({ color, icon: Icon, title, subtitle, selected }: {
  color: string; icon: typeof Zap; title: string; subtitle: string; selected?: boolean;
}) {
  return (
    <div className={cn('w-52 rounded-lg border-2 bg-white px-3 py-2 shadow-sm', color, selected && 'ring-2 ring-blue-500 ring-offset-2')}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate text-sm font-semibold text-gray-900">{title}</span>
      </div>
      <p className="mt-0.5 truncate text-xs text-gray-600">{subtitle}</p>
    </div>
  );
}

export function TriggerNode({ data, selected }: NodeProps) {
  const d = data as any;
  return (
    <>
      <Shell color="border-purple-400" icon={Zap} title={d.label || 'Trigger'} subtitle={`When: ${TRIGGER_LABELS[d.trigger] || '?'}`} selected={selected} />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export function AINode({ data, selected }: NodeProps) {
  const d = data as any;
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Shell color="border-blue-400" icon={Bot} title={d.label || 'AI step'} subtitle={`${d.task || '?'} - ${d.mode === 'crew' ? '4-agent crew' : 'quick'}`} selected={selected} />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as any;
  const showValue = !['is_true', 'is_false'].includes(d.operator);
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Shell color="border-amber-400" icon={GitBranch} title={d.label || 'Condition'}
        subtitle={`${d.field || '?'} ${OP_LABELS[d.operator] || '?'} ${showValue ? d.value ?? '' : ''}`} selected={selected} />
      <Handle type="source" id="true" position={Position.Bottom} style={{ left: '25%', background: '#16a34a' }} />
      <Handle type="source" id="false" position={Position.Bottom} style={{ left: '75%', background: '#dc2626' }} />
      <div className="pointer-events-none flex justify-between px-6 text-[10px] font-semibold">
        <span className="text-green-700">yes</span><span className="text-red-700">no</span>
      </div>
    </>
  );
}

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as any;
  const sub = d.action === 'approval' ? `Approval: ${String(d.approval_action || '?').replace('_', ' ')}` : ACTION_LABELS[d.action] || '?';
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Shell color="border-green-500" icon={Play} title={d.label || 'Action'} subtitle={sub} selected={selected} />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export const nodeTypes = { trigger: TriggerNode, ai: AINode, condition: ConditionNode, action: ActionNode };

export const NEW_NODE_DATA: Record<string, Record<string, any>> = {
  ai: { task: 'lead', mode: 'quick', label: 'AI step' },
  condition: { field: 'lead_score', operator: 'gte', value: '80', label: 'Condition' },
  action: { action: 'slack', text: 'FlowMancer: {input.name} -> {result.lead_score}', label: 'Action' },
};
