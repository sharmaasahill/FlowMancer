'use client';

import { createContext, useContext } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Bot, GitBranch, Play, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Status of each node in the latest test run (node id -> status), for highlighting. */
export const RunStatusContext = createContext<Record<string, string>>({});

const TRIGGER_LABELS: Record<string, string> = { manual: 'Manual / API', form: 'Website form', inbox: 'Inbox email', webhook: 'Webhook' };
const ACTION_LABELS: Record<string, string> = {
  slack: 'Slack message', webhook: 'Webhook', crm: 'HubSpot contact', email_draft: 'Save reply draft', approval: 'Request approval',
};
const OP_LABELS: Record<string, string> = {
  eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', contains: 'contains', is_true: 'is true', is_false: 'is false',
};

const TONES = {
  trigger: 'bg-bone/90 text-noir-900',
  ai: 'bg-crimson text-white shadow-ember',
  condition: 'bg-amber/90 text-noir-900',
  action: 'bg-rose/90 text-noir-900',
};

function Shell({ id, type, icon: Icon, title, subtitle, selected }: {
  id: string; type: keyof typeof TONES; icon: typeof Zap; title: string; subtitle: string; selected?: boolean;
}) {
  const status = useContext(RunStatusContext)[id];
  return (
    <div className={cn(
      'w-56 rounded-2xl border bg-noir-800/95 px-3 py-2.5 shadow-glass backdrop-blur-md transition duration-300',
      selected ? 'border-blush/70 ring-2 ring-blush/30' : 'border-white/[0.09]',
      status === 'completed' && 'border-crimson-400/70 shadow-[0_0_0_1px_rgba(214,69,69,0.4),0_0_28px_-4px_rgba(214,69,69,0.7)]',
      status === 'failed' && 'border-coral/70 shadow-[0_0_24px_-6px_rgba(255,138,122,0.8)]',
      status === 'skipped' && 'border-dashed opacity-70')}>
      <div className="flex items-center gap-2.5">
        <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl', TONES[type])}><Icon className="h-4 w-4" aria-hidden /></span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-bone">{title}</p>
          <p className="truncate text-[11px] text-fog">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export function TriggerNode({ id, data, selected }: NodeProps) {
  const d = data as any;
  return (
    <>
      <Shell id={id} type="trigger" icon={Zap} title={d.label || 'Trigger'} subtitle={`When: ${TRIGGER_LABELS[d.trigger] || '?'}`} selected={selected} />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export function AINode({ id, data, selected }: NodeProps) {
  const d = data as any;
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Shell id={id} type="ai" icon={Bot} title={d.label || 'AI step'} subtitle={`${d.task || '?'} · ${d.mode === 'crew' ? '4-agent crew' : 'quick'}`} selected={selected} />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

export function ConditionNode({ id, data, selected }: NodeProps) {
  const d = data as any;
  const showValue = !['is_true', 'is_false'].includes(d.operator);
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Shell id={id} type="condition" icon={GitBranch} title={d.label || 'Condition'}
        subtitle={`${d.field || '?'} ${OP_LABELS[d.operator] || '?'} ${showValue ? d.value ?? '' : ''}`} selected={selected} />
      <Handle type="source" id="true" position={Position.Bottom} style={{ left: '25%', background: '#5FD3A4' }} />
      <Handle type="source" id="false" position={Position.Bottom} style={{ left: '75%', background: '#FF8A7A' }} />
      <div className="pointer-events-none mt-1 flex justify-between px-10 font-mono text-[10px] font-semibold">
        <span className="text-jade">yes</span><span className="text-coral">no</span>
      </div>
    </>
  );
}

export function ActionNode({ id, data, selected }: NodeProps) {
  const d = data as any;
  const sub = d.action === 'approval' ? `Approval: ${String(d.approval_action || '?').replace('_', ' ')}` : ACTION_LABELS[d.action] || '?';
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Shell id={id} type="action" icon={Play} title={d.label || 'Action'} subtitle={sub} selected={selected} />
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
