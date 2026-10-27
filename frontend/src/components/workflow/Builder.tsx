'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, addEdge, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, GitBranch, Play, Save } from 'lucide-react';
import { errorMessage, workflowsApi } from '@/lib/api';
import type { Workflow, WorkflowGraph } from '@/types';
import { Card, ErrorBanner, Spinner, buttonClass, inputClass } from '@/components/ui';
import { NEW_NODE_DATA, nodeTypes } from '@/components/workflow/nodes';
import NodeSettings from '@/components/workflow/NodeSettings';
import RunPanel from '@/components/workflow/RunPanel';

const PALETTE = [
  { type: 'ai', label: 'AI step', icon: Bot },
  { type: 'condition', label: 'Condition', icon: GitBranch },
  { type: 'action', label: 'Action', icon: Play },
] as const;

const edgeStyle = (handle?: string | null) =>
  handle === 'true' ? { stroke: '#16a34a' } : handle === 'false' ? { stroke: '#dc2626' } : undefined;

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
  const { screenToFlowPosition } = useReactFlow();

  const graphJson = JSON.stringify(toGraph(nodes, edges));
  const dirty = graphJson !== savedGraph || name !== workflow.name || description !== (workflow.description || '') || active !== workflow.is_active;
  const selected = nodes.find((n) => n.id === selectedId) || null;
  const aiTasks = nodes.filter((n) => n.type === 'ai').map((n) => (n.data as any).task);

  const onConnect = useCallback((c: Connection) => {
    setEdges((eds) => addEdge({ ...c, id: `${c.source}-${c.sourceHandle || 'out'}-${c.target}`, style: edgeStyle(c.sourceHandle) }, eds));
  }, [setEdges]);

  const addNode = (type: string, position?: { x: number; y: number }) => {
    const id = `${type}-${Date.now().toString(36)}`;
    const pos = position || { x: 250 + Math.random() * 60, y: 80 + nodes.length * 90 };
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
        name, description: description || null, is_active: active, workflow_type: 'custom', config: toGraph(nodes, edges),
      });
      setSavedGraph(graphJson);
      onSaved(updated);
    } catch (e) {
      setErrors(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="wf-name" className="mb-1 block text-xs font-medium text-gray-600">Workflow name</label>
          <input id="wf-name" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} text-base font-semibold`} />
        </div>
        <div className="min-w-[220px] flex-[2]">
          <label htmlFor="wf-desc" className="mb-1 block text-xs font-medium text-gray-600">Description</label>
          <input id="wf-desc" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
        <button type="button" onClick={save} disabled={saving || !dirty} className={buttonClass.primary}>
          {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" aria-hidden />} {dirty ? 'Save' : 'Saved'}
        </button>
      </div>
      <ErrorBanner message={errors} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center gap-2 border-b p-2" role="toolbar" aria-label="Add steps">
            <span className="px-2 text-xs font-semibold text-gray-500">Add (click or drag):</span>
            {PALETTE.map(({ type, label, icon: Icon }) => (
              <button key={type} type="button" draggable
                onDragStart={(e) => { e.dataTransfer.setData('application/flowmancer-node', type); e.dataTransfer.effectAllowed = 'move'; }}
                onClick={() => addNode(type)} className={buttonClass.secondary}>
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
          <div className="h-[620px]" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={onDrop}>
            <ReactFlow
              nodes={nodes} edges={edges} nodeTypes={nodeTypes}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
              onNodeClick={(_, n) => { setSelectedId(n.id); setTab('settings'); }}
              onPaneClick={() => setSelectedId(null)}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView fitViewOptions={{ padding: 0.2 }}
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
        </div>

        <Card>
          <div role="tablist" aria-label="Panel" className="mb-4 flex gap-2 border-b">
            {(['settings', 'run'] as const).map((t) => (
              <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`border-b-2 px-3 py-2 text-sm font-semibold capitalize ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600'}`}>
                {t === 'settings' ? 'Step settings' : 'Test run'}
              </button>
            ))}
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
              <div className="space-y-2 text-sm text-gray-600">
                <p>Click a step to edit it. Drag from a step&apos;s bottom handle to another step&apos;s top to connect them.</p>
                <p>Select a connection and press Delete to remove it.</p>
                <p>Conditions have two outputs: green for yes, red for no.</p>
              </div>
            )
          ) : (
            <RunPanel workflowId={workflow.id} firstTask={aiTasks[0]} dirty={dirty} />
          )}
        </Card>
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
