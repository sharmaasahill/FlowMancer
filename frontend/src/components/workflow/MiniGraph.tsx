import type { WorkflowGraph } from '@/types';

const FILL: Record<string, string> = { trigger: '#F4ECEC', ai: '#D64545', condition: '#E9C46A', action: '#C98F8F' };
const NODE_W = 208;
const NODE_H = 50;
const PAD = 24;

/** A tiny, non-interactive drawing of a workflow graph for cards. */
export default function MiniGraph({ graph, className }: { graph?: WorkflowGraph | null; className?: string }) {
  const nodes = graph?.nodes || [];
  if (!nodes.length) return <div className={className} />;
  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const width = Math.max(...nodes.map((n) => n.position.x)) - minX + NODE_W + PAD * 2;
  const height = Math.max(...nodes.map((n) => n.position.y)) - minY + NODE_H + PAD * 2;
  const pos = Object.fromEntries(nodes.map((n) => [n.id, { x: n.position.x - minX + PAD, y: n.position.y - minY + PAD }]));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {(graph?.edges || []).map((e) => {
        const a = pos[e.source];
        const b = pos[e.target];
        if (!a || !b) return null;
        const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
        const my = (y1 + y2) / 2;
        const no = e.sourceHandle === 'false';
        return (
          <path key={e.id} d={`M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`} fill="none" strokeWidth={5}
            stroke={no ? '#8A6A70' : 'rgba(242,184,181,0.7)'} strokeDasharray={no ? '12 9' : undefined} />
        );
      })}
      {nodes.map((n) => (
        <g key={n.id} transform={`translate(${pos[n.id].x} ${pos[n.id].y})`}>
          <rect width={NODE_W} height={NODE_H} rx={14} fill="rgba(36,28,31,0.98)" stroke="rgba(242,184,181,0.28)" strokeWidth={3} />
          <rect x={14} y={13} width={24} height={24} rx={7} fill={FILL[n.type] || '#A89EA1'} />
          <rect x={50} y={19} width={120} height={12} rx={6} fill="rgba(244,236,236,0.42)" />
        </g>
      ))}
    </svg>
  );
}
