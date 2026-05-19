'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ─── Node Components ──────────────────────────────────────────────────────────

function TriggerNode({ data, selected }: NodeProps) {
  const icons: Record<string, string> = { signup: '🎉', tier_silver: '🥈', tier_gold: '🥇', inactive_30: '💤', birthday: '🎂' }
  const labels: Record<string, string> = { signup: 'New Signup', tier_silver: 'Reaches Silver', tier_gold: 'Reaches Gold', inactive_30: '30-Day Inactive', birthday: 'Birthday' }
  return (
    <div className={`rounded-xl px-4 py-3 min-w-[180px] border-2 ${selected ? 'border-purple-400' : 'border-purple-600'}`}
      style={{ background: 'linear-gradient(135deg,#6c3fff,#4c2fff)', color: '#fff' }}>
      <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Trigger</div>
      <div className="font-bold text-sm flex items-center gap-1.5">
        <span>{icons[data.triggerType as string] || '⚡'}</span>
        {labels[data.triggerType as string] || String(data.triggerType || 'Select trigger')}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-300 !w-3 !h-3" />
    </div>
  )
}

function EmailNode({ data, selected }: NodeProps) {
  return (
    <div className={`rounded-xl px-4 py-3 min-w-[200px] border-2 ${selected ? 'border-purple-400' : 'border-purple-600/50'}`}
      style={{ background: '#16162a' }}>
      <Handle type="target" position={Position.Top} className="!bg-purple-400 !w-3 !h-3" />
      <div className="text-[10px] uppercase tracking-widest text-purple-400 mb-1">✉ Email</div>
      <div className="font-semibold text-sm text-white truncate">{(data.subject as string) || 'No subject'}</div>
      {!!(data.body) && <div className="text-[11px] text-gray-400 mt-0.5 truncate">{String(data.body).substring(0, 40)}…</div>}
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400 !w-3 !h-3" />
    </div>
  )
}

function WaitNode({ data, selected }: NodeProps) {
  return (
    <div className={`rounded-xl px-4 py-3 min-w-[160px] border-2 ${selected ? 'border-orange-400' : 'border-orange-600/50'}`}
      style={{ background: '#16162a' }}>
      <Handle type="target" position={Position.Top} className="!bg-orange-400 !w-3 !h-3" />
      <div className="text-[10px] uppercase tracking-widest text-orange-400 mb-1">⏳ Wait</div>
      <div className="font-semibold text-sm text-white">{data.amount as number || 1} {data.unit as string || 'days'}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-400 !w-3 !h-3" />
    </div>
  )
}

function ConditionNode({ data, selected }: NodeProps) {
  const opLabel: Record<string, string> = { '>=': '≥', '<=': '≤', '=': '=' }
  return (
    <div className={`rounded-xl px-4 py-3 min-w-[180px] border-2 ${selected ? 'border-blue-400' : 'border-blue-600/50'}`}
      style={{ background: '#16162a' }}>
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-3 !h-3" />
      <div className="text-[10px] uppercase tracking-widest text-blue-400 mb-1">? Condition</div>
      <div className="font-semibold text-sm text-white">
        {data.field as string || 'points'} {opLabel[data.operator as string] || '≥'} {data.value as string || '0'}
      </div>
      <div className="flex justify-between mt-2 text-[10px]">
        <span className="text-green-400">✓ true</span>
        <span className="text-red-400">✗ false</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="true"
        style={{ left: '25%' }} className="!bg-green-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="false"
        style={{ left: '75%' }} className="!bg-red-500 !w-3 !h-3" />
    </div>
  )
}

function AddPointsNode({ data, selected }: NodeProps) {
  return (
    <div className={`rounded-xl px-4 py-3 min-w-[160px] border-2 ${selected ? 'border-yellow-400' : 'border-yellow-600/50'}`}
      style={{ background: '#16162a' }}>
      <Handle type="target" position={Position.Top} className="!bg-yellow-400 !w-3 !h-3" />
      <div className="text-[10px] uppercase tracking-widest text-yellow-400 mb-1">⭐ Add Points</div>
      <div className="font-semibold text-sm text-white">+{data.points as number || 0} pts</div>
      <Handle type="source" position={Position.Bottom} className="!bg-yellow-400 !w-3 !h-3" />
    </div>
  )
}

function EndNode({ data: _data, selected }: NodeProps) {
  return (
    <div className={`rounded-xl px-4 py-3 min-w-[120px] border-2 ${selected ? 'border-gray-400' : 'border-gray-600/50'}`}
      style={{ background: '#16162a' }}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />
      <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">End</div>
      <div className="font-semibold text-sm text-white">🏁 Flow ends</div>
    </div>
  )
}

const nodeTypes = { trigger: TriggerNode, email: EmailNode, wait: WaitNode, condition: ConditionNode, addPoints: AddPointsNode, end: EndNode }

// ─── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({ node, onChange, onClose }: { node: Node; onChange: (id: string, data: Record<string, unknown>) => void; onClose: () => void }) {
  const [d, setD] = useState<Record<string, unknown>>({ ...node.data as Record<string, unknown> })

  useEffect(() => { setD({ ...node.data as Record<string, unknown> }) }, [node.id])

  function save() { onChange(node.id, d); onClose() }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-[#16162a] border-l border-white/10 z-50 flex flex-col shadow-2xl">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="font-semibold text-white capitalize">{node.type} settings</div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {node.type === 'email' && (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Subject line</label>
              <input value={(d.subject as string) || ''} onChange={e => setD(p => ({ ...p, subject: e.target.value }))}
                placeholder="Welcome to {{store}}!" className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email body</label>
              <p className="text-[10px] text-gray-600 mb-1">{'{{name}} {{points}} {{tier}} {{store}}'}</p>
              <textarea value={(d.body as string) || ''} onChange={e => setD(p => ({ ...p, body: e.target.value }))}
                rows={7} placeholder={'Hi {{name}},\n\nYou have {{points}} points.\n\n— {{store}}'}
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500 resize-none" />
            </div>
          </>
        )}
        {node.type === 'wait' && (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Wait amount</label>
              <input type="number" min={1} value={(d.amount as number) || 1} onChange={e => setD(p => ({ ...p, amount: +e.target.value }))}
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Unit</label>
              <select value={(d.unit as string) || 'days'} onChange={e => setD(p => ({ ...p, unit: e.target.value }))}
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500">
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </>
        )}
        {node.type === 'condition' && (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Field</label>
              <select value={(d.field as string) || 'points'} onChange={e => setD(p => ({ ...p, field: e.target.value }))}
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500">
                <option value="points">Current Points</option>
                <option value="lifetime_points">Lifetime Points</option>
                <option value="tier">Tier</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Operator</label>
              <select value={(d.operator as string) || '>='} onChange={e => setD(p => ({ ...p, operator: e.target.value }))}
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500">
                <option value=">=">≥ (greater or equal)</option>
                <option value="<=">≤ (less or equal)</option>
                <option value="=">= (equals)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Value</label>
              <input value={(d.value as string) || ''} onChange={e => setD(p => ({ ...p, value: e.target.value }))}
                placeholder={d.field === 'tier' ? 'Bronze / Silver / Gold' : '500'}
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <div className="bg-[#0f0f1a] rounded-lg p-3 text-xs text-gray-500">
              <div className="text-green-400 mb-1">✓ True branch → left handle</div>
              <div className="text-red-400">✗ False branch → right handle</div>
            </div>
          </>
        )}
        {node.type === 'addPoints' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Points to add</label>
            <input type="number" min={1} value={(d.points as number) || 100} onChange={e => setD(p => ({ ...p, points: +e.target.value }))}
              className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
          </div>
        )}
        {node.type === 'trigger' && (
          <p className="text-xs text-gray-500">The trigger is set from the top bar. This node can't be deleted.</p>
        )}
        {node.type === 'end' && (
          <p className="text-xs text-gray-500">The flow ends here. Customers who reach this node are marked as completed.</p>
        )}
      </div>
      {node.type !== 'trigger' && (
        <div className="px-5 py-4 border-t border-white/10 shrink-0">
          <button onClick={save} className="w-full bg-purple-600 hover:bg-purple-500 py-2 rounded-lg text-sm font-semibold transition">Apply Changes</button>
        </div>
      )}
    </div>
  )
}

// ─── Node Palette ─────────────────────────────────────────────────────────────

const PALETTE = [
  { type: 'email',     label: 'Email',       icon: '✉',  color: '#6c3fff', desc: 'Send an email' },
  { type: 'wait',      label: 'Wait',        icon: '⏳', color: '#f97316', desc: 'Delay before next step' },
  { type: 'condition', label: 'Condition',   icon: '?',  color: '#3b82f6', desc: 'Branch based on customer data' },
  { type: 'addPoints', label: 'Add Points',  icon: '⭐', color: '#fbbf24', desc: 'Reward customer with points' },
  { type: 'end',       label: 'End',         icon: '🏁', color: '#6b7280', desc: 'Mark flow as complete' },
]

// ─── Main Page ────────────────────────────────────────────────────────────────

function FlowBuilder() {
  const router = useRouter()
  const params = useParams()
  const flowId = params.id as string

  const [flowName, setFlowName] = useState('Untitled Flow')
  const [trigger, setTrigger] = useState('signup')
  const [active, setActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<any>(null)

  useEffect(() => {
    fetch('/api/merchant/me').then(r => { if (r.status === 401) router.push('/') })
    if (flowId !== 'new') {
      fetch(`/api/merchant/flows?id=${flowId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return
          setFlowName(d.name || 'Untitled Flow')
          setTrigger(d.trigger || 'signup')
          setActive(d.active || false)
          if (d.nodes?.length) setNodes(d.nodes)
          if (d.edges?.length) setEdges(d.edges)
        })
    }
  }, [flowId, router])

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: '#6c3fff', strokeWidth: 2 } }, eds))
  }, [setEdges])

  function onNodeClick(_: React.MouseEvent, node: Node) {
    setSelectedNode(node)
  }

  function onPaneClick() {
    setSelectedNode(null)
  }

  function updateNodeData(id: string, data: Record<string, unknown>) {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n))
  }

  function onDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData('application/reactflow', type)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/reactflow')
    if (!type || !rfInstance || !reactFlowWrapper.current) return
    const bounds = reactFlowWrapper.current.getBoundingClientRect()
    const pos = rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top })
    const id = `${type}-${Date.now()}`
    const defaults: Record<string, Record<string, unknown>> = {
      email: { subject: '', body: '' },
      wait: { amount: 1, unit: 'days' },
      condition: { field: 'points', operator: '>=', value: '500' },
      addPoints: { points: 100 },
      end: {},
    }
    setNodes(nds => [...nds, { id, type, position: pos, data: defaults[type] || {} }])
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function deleteSelectedNode() {
    if (!selectedNode || selectedNode.data?.deletable === false) return
    setNodes(nds => nds.filter(n => n.id !== selectedNode.id))
    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNode(null)
  }

  async function save() {
    setSaving(true); setSaveMsg('')
    const method = flowId === 'new' ? 'POST' : 'PATCH'
    const body = flowId === 'new'
      ? { name: flowName, trigger, active, nodes, edges }
      : { id: flowId, name: flowName, trigger, active, nodes, edges }
    const r = await fetch('/api/merchant/flows', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json()
    if (!r.ok) { setSaveMsg(d.error || 'Save failed'); setSaving(false); return }
    if (flowId === 'new' && d.id) {
      router.replace(`/merchant/flows/${d.id}`)
    }
    setSaveMsg('Saved!')
    setTimeout(() => setSaveMsg(''), 2000)
    setSaving(false)
  }

  return (
    <div className="h-screen bg-[#0f0f1a] text-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 py-3 bg-[#16162a] border-b border-white/10 shrink-0 z-10">
        <button onClick={() => router.push('/merchant?tab=flows')}
          className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition mr-1">
          ← Back
        </button>
        <div className="w-px h-5 bg-white/10" />
        <input value={flowName} onChange={e => setFlowName(e.target.value)}
          className="bg-transparent text-white font-semibold text-sm outline-none border-b border-transparent focus:border-purple-500 px-1 py-0.5 min-w-[120px] max-w-[220px]" />
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Trigger</label>
          <select value={trigger} onChange={e => setTrigger(e.target.value)}
            className="bg-[#0f0f1a] border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-purple-500">
            <option value="signup">🎉 New Signup</option>
            <option value="tier_silver">🥈 Reaches Silver</option>
            <option value="tier_gold">🥇 Reaches Gold</option>
            <option value="inactive_30">💤 30-Day Inactive</option>
            <option value="birthday">🎂 Birthday</option>
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {selectedNode && selectedNode.data?.deletable !== false && (
            <button onClick={deleteSelectedNode}
              className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/50 px-3 py-1.5 rounded-lg transition">
              Delete node
            </button>
          )}
          {saveMsg && <span className="text-xs text-green-400">{saveMsg}</span>}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <span className="text-xs text-gray-400">Active</span>
            <button onClick={() => setActive(p => !p)}
              className={`w-9 h-5 rounded-full transition-colors relative ${active ? 'bg-purple-600' : 'bg-gray-700'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${active ? 'left-4' : 'left-0.5'}`} />
            </button>
          </label>
          <button onClick={save} disabled={saving}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-1.5 rounded-lg text-sm font-semibold transition">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — palette */}
        <aside className="w-52 bg-[#16162a] border-r border-white/10 flex flex-col shrink-0 overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">Drag to canvas</div>
            <div className="space-y-2">
              {PALETTE.map(item => (
                <div key={item.type}
                  draggable
                  onDragStart={e => onDragStart(e, item.type)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/10 cursor-grab active:cursor-grabbing hover:border-white/25 hover:bg-white/5 transition select-none">
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-white">{item.label}</div>
                    <div className="text-[10px] text-gray-500 leading-tight">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 pt-4 pb-2 mt-2 border-t border-white/10">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Variables</div>
            <div className="space-y-1">
              {['{{name}}', '{{points}}', '{{tier}}', '{{store}}'].map(v => (
                <div key={v} className="text-[10px] font-mono text-purple-400 bg-purple-900/20 rounded px-2 py-1">{v}</div>
              ))}
            </div>
          </div>
        </aside>

        {/* Canvas */}
        <div ref={reactFlowWrapper} className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={setRfInstance}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={null}
            style={{ background: '#0f0f1a' }}
            defaultEdgeOptions={{ animated: true, style: { stroke: '#6c3fff', strokeWidth: 2 } }}
          >
            <Background color="#1e1e3a" gap={20} size={1} />
            <Controls className="!bg-[#16162a] !border-white/10 !rounded-xl [&_button]:!bg-[#16162a] [&_button]:!border-white/10 [&_button]:!text-gray-400 [&_button:hover]:!text-white" />
            <MiniMap
              style={{ background: '#16162a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
              nodeColor="#6c3fff"
              maskColor="rgba(0,0,0,0.4)"
            />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-4xl mb-3 opacity-20">⚡</div>
                <div className="text-gray-600 text-sm">Drag nodes from the left panel onto the canvas</div>
              </div>
            </div>
          )}
        </div>

        {/* Config panel */}
        {selectedNode && (
          <ConfigPanel
            node={selectedNode}
            onChange={(id, data) => {
              updateNodeData(id, data)
              setSelectedNode(n => n ? { ...n, data: { ...n.data, ...data } } : null)
            }}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  )
}

export default function FlowBuilderPage() {
  return (
    <ReactFlowProvider>
      <FlowBuilder />
    </ReactFlowProvider>
  )
}
