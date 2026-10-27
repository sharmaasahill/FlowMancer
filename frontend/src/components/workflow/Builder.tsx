'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, addEdge, useEdgesState, useNodesState,
  useReactFlow, type Connection, type Edge, type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, GitBranch, Play, Save } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { ErrorBanner, Segmented, Spinner } from '@/components/ui';
import NodeSettings from '@/components/workflow/NodeSettings';
import { NEW_NODE_DATA, nodeTypes, RunStatusContext } from '@/components/workflow/nodes';
import RunPanel from '@/components/workflow/RunPanel';
import { errorMessage, workflowsApi } from '@/lib/api';
import type { Workflow, WorkflowExecution, WorkflowGraph } from '@/types';
import { cn } from '@/lib/utils';

const PALETTE = [
  { type: 'ai', label: 'AI step', icon: Bot, tone: 'bg-crimson text-white' },
  { type: 'condition', label: 'Condition', icon: GitBranch, tone: 'bg-amber/90 text-noir-900' },
  { type: 'action', label: 'Action', icon: Play, tone: 'bg-rose/90 text-noir-900' },
] as const;

const edgeStyle = (handle?: string | null) =>
  handle === 'true' ? { stroke: '#5FD3A4' } : handle === 'false' ? { stroke: '#FF8A7A', strokeDasharray: '6 5' } : undefined;

function toFlow(graph: WorkflowGraph | null | undefined): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: (graph?.nodes || []).map((n) => ({ ...n, data: { ...n.data } })),
    edges: (graph?.edges || []).map((e) => ({ ...e, sourceHandle: e.sourceHandle ?? undefined, style: edgeStyle(e.sourceHandle) })),
  };
}

function toGraph(nodes: Node[], edges: Edge[]): WorkflowGraph {
  return {
    nodes: nodes.map((n) => ({ id: n.id, type: n.type as any, position: n.position, data: n.data as Record<string, any> })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
  };
}

function Canvas({ workflow, onSaved }: { workflow: Workflow; onSaved: (w: Workflow) => void }) {
  const initial = useMemo(() => toFlow(workflow.config), [workflow.config]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description || '');
  const [active, setActive] = useState(workflow.is_active);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string | null>(null);
  const [savedGraph, setSavedGraph] = useState(JSON.stringify(toGraph(initial.nodes, initial.edges)));
  const [tab, setTab] = useState<'settings' | 'run'>('settings');
  const [runStatus, setRunStatus] = useState<Record<string, string>>({});
  const { screenToFlowPosition } = useReactFlow();
  const toast = useToast();

  const graphJson = JSON.stringify(toGraph(nodes, edges));
  const dirty = graphJson !== savedGraph || name !== workflow.name || description !== (workflow.description || '') || active !== workflow.is_active;
  const selected = nodes.find((n) => n.id === selectedId) || null;
  const aiTasks = nodes.filter((n) => n.type === 'ai').map((n) => (n.data as any).task);

  // Light up the path a test run actually took (display only; not saved)
  const shownEdges = useMemo(() => edges.map((e) => {
    const traversed = runStatus[e.source] && runStatus[e.target];
    return traversed ? { ...e, className: 'traversed', animated: true } : e;
  }), [edges, runStatus]);

  const onExecution = useCallback((ex: WorkflowExecution | null) => {
    const map: Record<string, string> = {};
    for (const l of ex?.agent_logs || []) if (l.node_id) map[l.node_id] = l.status;
    setRunStatus(map);
  }, []);

  const onConnect = useCallback((c: Connection) => {
    setEdges((eds) => addEdge({ ...c, id: `${c.source}-${c.sourceHandle || 'out'}-${c.target}`, style: edgeStyle(c.sourceHandle) }, eds));
  }, [setEdges]);

  const addNode = (type: string, position?: { x: number; y: number }) => {
    const id = `${type}-${Date.now().toString(36)}`;
    const pos = position || { x: 250 + Math.random() * 60, y: 80 + nodes.length * 100 };
    setNodes((ns) => [...ns, { id, type, position: pos, data: { ...NEW_NODE_DATA[type] } }]);
    setSelectedId(id);
    setTab('settings');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/flowmancer-node');
    if (type) addNode(type, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };

  const save = async () => {
    setSaving(true);
    setErrors(null);
    try {
      const updated = await workflowsApi.update(workflow.id, {
        name, description: description || null, is_active: active, config: toGraph(nodes, edges),
      });
      setSavedGraph(graphJson);
      onSaved(updated);
      toast({ tone: 'success', title: 'Workflow saved' });
    } catch (e) {
      setErrors(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <label htmlFor="wf-name" className="eyebrow mb-2 block">Workflow</label>
          <input id="wf-name" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full border-0 border-b border-white/10 bg-transparent pb-1 font-display text-4xl text-bone outline-none transition focus:border-blush" />
        </div>
        <div className="min-w-[240px] flex-[1.4]">
          <label htmlFor="wf-desc" className="sr-only">Description</label>
          <input id="wf-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="field" placeholder="What does it do?" />
        </div>
        <label className="flex cursor-pointer items-center gap-3 pb-2 text-sm text-bone">
          <span className="relative inline-flex">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="peer sr-only" />
            <span className="h-6 w-11 rounded-full border border-white/10 bg-white/[0.06] transition peer-checked:bg-crimson peer-focus-visible:ring-2 peer-focus-visible:ring-blush" />
            <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-bone transition peer-checked:translate-x-5" />
          </span>
          Active
        </label>
        <button type="button" onClick={save} disabled={saving || !dirty} className="btn-primary !px-5 !py-2.5">
          {saving ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" aria-hidden />} {dirty ? 'Save' : 'Saved'}
        </button>
      </div>
      <ErrorBanner message={errors} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="glass relative overflow-hidden !rounded-[26px]">
          <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2" role="toolbar" aria-label="Add steps">
            {PALETTE.map(({ type, label, icon: Icon, tone }) => (
              <button key={type} type="button" draggable title="Click or drag onto the canvas"
                onDragStart={(e) => { e.dataTransfer.setData('application/flowmancer-node', type); e.dataTransfer.effectAllowed = 'move'; }}
                onClick={() => addNode(type)}
                className="glass-strong flex items-center gap-2 !rounded-full py-1.5 pl-1.5 pr-3.5 text-xs font-semibold text-bone transition hover:-translate-y-0.5">
                <span className={cn('grid h-6 w-6 place-items-center rounded-full', tone)}><Icon className="h-3.5 w-3.5" aria-hidden /></span>
                {label}
              </button>
            ))}
          </div>
          <div className="h-[660px]" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={onDrop}>
            <RunStatusContext.Provider value={runStatus}>
              <ReactFlow
                nodes={nodes} edges={shownEdges} nodeTypes={nodeTypes} colorMode="dark"
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                onNodeClick={(_, n) => { setSelectedId(n.id); setTab('settings'); }}
                onPaneClick={() => setSelectedId(null)}
                deleteKeyCode={['Backspace', 'Delete']}
                fitView fitViewOptions={{ padding: 0.25 }} proOptions={{ hideAttribution: false }}
              >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="rgba(242,184,181,0.14)" />
                <Controls showInteractive={false} position="bottom-left" />
                <MiniMap pannable zoomable position="bottom-right" nodeBorderRadius={10} />
              </ReactFlow>
            </RunStatusContext.Provider>
          </div>
        </div>

        <div className="glass p-5">
          <div className="mb-5">
            <Segmented id="builder-tab" label="Panel" value={tab} onChange={setTab}
              options={[{ value: 'settings', label: 'Step settings' }, { value: 'run', label: 'Test run' }]} />
          </div>
          {tab === 'settings' ? (
            selected ? (
              <NodeSettings key={selected.id} node={selected} aiTasks={aiTasks}
                onChange={(data) => setNodes((ns) => ns.map((n) => (n.id === selected.id ? { ...n, data } : n)))}
                onDelete={() => {
                  setNodes((ns) => ns.filter((n) => n.id !== selected.id));
                  setEdges((es) => es.filter((e) => e.source !== selected.id && e.target !== selected.id));
                  setSelectedId(null);
                }} />
            ) : (
              <ul className="space-y-3 text-sm text-fog">
                <li className="flex gap-3"><span className="font-mono text-blush">01</span>Click a step to edit it.</li>
                <li className="flex gap-3"><span className="font-mono text-blush">02</span>Drag from a step&apos;s bottom dot to another step&apos;s top to connect them.</li>
                <li className="flex gap-3"><span className="font-mono text-blush">03</span>Conditions have two exits: green for yes, red for no.</li>
                <li className="flex gap-3"><span className="font-mono text-blush">04</span>Select a step or connection and press Delete to remove it.</li>
                <li className="flex gap-3"><span className="font-mono text-blush">05</span>Save, then open Test run to watch the path light up.</li>
              </ul>
            )
          ) : (
            <RunPanel workflowId={workflow.id} firstTask={aiTasks[0]} dirty={dirty} onExecution={onExecution} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Builder(props: { workflow: Workflow; onSaved: (w: Workflow) => void }) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
