'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, Handle, Position,
  type Node, type Edge, type Connection, type NodeProps,
} from '@xyflow/react'

// ─── Trigger definitions ──────────────────────────────────────────────────────

const TRIGGERS = [
  { type: 'signup',           icon: '🎉', label: 'New Signup',       desc: 'Customer creates account' },
  { type: 'first_purchase',   icon: '🛍️', label: 'First Purchase',   desc: 'Customer places first order' },
  { type: 'tier_silver',      icon: '🥈', label: 'Reaches Silver',   desc: 'Customer hits Silver tier' },
  { type: 'tier_gold',        icon: '🥇', label: 'Reaches Gold',     desc: 'Customer hits Gold tier' },
  { type: 'inactivity_30',    icon: '💤', label: '30-Day Inactive',  desc: 'No purchase in 30 days' },
  { type: 'inactivity_60',    icon: '😴', label: '60-Day Inactive',  desc: 'No purchase in 60 days' },
  { type: 'inactivity_90',    icon: '🚨', label: '90-Day Inactive',  desc: 'No purchase in 90 days' },
  { type: 'birthday',         icon: '🎂', label: 'Birthday',         desc: "On customer's birthday" },
  { type: 'points_milestone', icon: '⭐', label: 'Points Milestone', desc: 'Customer reaches X points' },
  { type: 'referral_made',    icon: '👥', label: 'Referral Made',    desc: 'Customer refers someone' },
]
const TRIGGER_MAP: Record<string, { icon: string; label: string }> = Object.fromEntries(
  TRIGGERS.map(t => [t.type, { icon: t.icon, label: t.label }])
)

// ─── Node Components ──────────────────────────────────────────────────────────

function TriggerNode({ data, selected }: NodeProps) {
  const info = TRIGGER_MAP[data.triggerType as string] || { icon: '⚡', label: 'Select trigger' }
  return (
    <div className={`rounded-xl px-4 py-3 min-w-[180px] border-2 ${selected ? 'border-purple-300' : 'border-purple-600'}`}
      style={{ background: 'linear-gradient(135deg,#6c3fff,#4c2fff)', color: '#fff' }}>
      <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Trigger</div>
      <div className="font-bold text-sm flex items-center gap-1.5">
        <span>{info.icon}</span>{info.label}
      </div>
      {(data.triggerType as string) === 'points_milestone' && (
        <div className="text-[11px] opacity-70 mt-0.5">at {(data.milestoneValue as number) || '?'} pts</div>
      )}
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
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: '25%' }} className="!bg-green-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '75%' }} className="!bg-red-500 !w-3 !h-3" />
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

function WhatsAppNode({ data, selected }: NodeProps) {
  return (
    <div className={`rounded-xl px-4 py-3 min-w-[200px] border-2 ${selected ? 'border-green-400' : 'border-green-600/50'}`}
      style={{ background: '#16162a' }}>
      <Handle type="target" position={Position.Top} className="!bg-green-400 !w-3 !h-3" />
      <div className="text-[10px] uppercase tracking-widest text-green-400 mb-1">💬 WhatsApp</div>
      <div className="font-semibold text-sm text-white truncate">{(data.body as string) ? String(data.body).substring(0, 40) + '…' : 'No message'}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-400 !w-3 !h-3" />
    </div>
  )
}

function EndNode({ data: _d, selected }: NodeProps) {
  return (
    <div className={`rounded-xl px-4 py-3 min-w-[120px] border-2 ${selected ? 'border-gray-400' : 'border-gray-600/50'}`}
      style={{ background: '#16162a' }}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />
      <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">End</div>
      <div className="font-semibold text-sm text-white">🏁 Flow ends</div>
    </div>
  )
}

const nodeTypes = { trigger: TriggerNode, email: EmailNode, whatsapp: WhatsAppNode, wait: WaitNode, condition: ConditionNode, addPoints: AddPointsNode, end: EndNode }

// ─── Email Preview ────────────────────────────────────────────────────────────

function EmailPreview({ subject, body }: { subject: string; body: string }) {
  const sub = (s: string) => s
    .replace(/\{\{name\}\}/g, 'Alex').replace(/\{\{points\}\}/g, '420')
    .replace(/\{\{tier\}\}/g, 'Silver').replace(/\{\{store\}\}/g, 'Your Store')
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden text-xs">
      <div className="bg-[#0f0f1a] px-3 py-1.5 text-gray-500 border-b border-white/10 text-[10px]">Preview — sample data</div>
      <div className="bg-[#1a1a2e] px-3 py-2.5">
        <div className="font-semibold text-white text-xs mb-1 truncate">{sub(subject) || '(no subject)'}</div>
        <div className="text-gray-300 whitespace-pre-wrap text-[11px] leading-relaxed max-h-32 overflow-y-auto">{sub(body) || '(no body)'}</div>
      </div>
    </div>
  )
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

const WAIT_PRESETS = [
  { label: '1h', amount: 1, unit: 'hours' },
  { label: '6h', amount: 6, unit: 'hours' },
  { label: '1d', amount: 1, unit: 'days' },
  { label: '3d', amount: 3, unit: 'days' },
  { label: '1w', amount: 7, unit: 'days' },
]

function ConfigPanel({ node, onChange, onClose, onDelete, merchantEmail }: {
  node: Node; onChange: (id: string, data: Record<string, unknown>) => void
  onClose: () => void; onDelete: () => void; merchantEmail: string
}) {
  const [d, setD] = useState<Record<string, unknown>>({ ...node.data as Record<string, unknown> })
  const [showPreview, setShowPreview] = useState(false)
  const [testTo, setTestTo] = useState(merchantEmail)
  const [testSending, setTestSending] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  useEffect(() => { setD({ ...node.data as Record<string, unknown> }); setShowPreview(false); setTestTo(merchantEmail); setTestMsg('') }, [node.id])
  function save() { onChange(node.id, d); onClose() }

  async function sendTestEmail() {
    setTestSending(true); setTestMsg('')
    const r = await fetch('/api/merchant/flows/test-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: d.subject, body: d.body, to: testTo }),
    })
    setTestSending(false)
    if (r.ok) { setTestMsg('✓ Sent!'); setTimeout(() => setTestMsg(''), 3000) }
    else { setTestMsg('Failed'); setTimeout(() => setTestMsg(''), 3000) }
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-[#16162a] border-l border-white/10 z-50 flex flex-col shadow-2xl">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="font-semibold text-white capitalize">{node.type} settings</div>
        <div className="flex items-center gap-2">
          {node.type !== 'end' && (
            <button onClick={onDelete} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 border border-red-500/30 rounded-lg transition">Delete</button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {node.type === 'trigger' && (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Trigger event</label>
              <select value={(d.triggerType as string) || 'signup'} onChange={e => setD(p => ({ ...p, triggerType: e.target.value }))}
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500">
                {TRIGGERS.map(t => <option key={t.type} value={t.type}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            {(d.triggerType as string) === 'points_milestone' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Points threshold</label>
                <input type="number" min={1} value={(d.milestoneValue as number) || 100}
                  onChange={e => setD(p => ({ ...p, milestoneValue: +e.target.value }))}
                  className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
              </div>
            )}
          </>
        )}

        {node.type === 'email' && (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Subject line</label>
              <input value={(d.subject as string) || ''} onChange={e => setD(p => ({ ...p, subject: e.target.value }))}
                placeholder="Welcome to {{store}}!"
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email body</label>
              <p className="text-[10px] text-gray-600 mb-1">{'{{name}} {{points}} {{tier}} {{store}}'}</p>
              <textarea value={(d.body as string) || ''} onChange={e => setD(p => ({ ...p, body: e.target.value }))}
                rows={7} placeholder={'Hi {{name}},\n\nYou have {{points}} points.\n\n— {{store}}'}
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500 resize-none" />
            </div>
            <button onClick={() => setShowPreview(p => !p)} className="text-xs text-purple-400 hover:text-purple-300 transition">
              {showPreview ? '▲ Hide preview' : '▼ Show preview'}
            </button>
            {showPreview && <EmailPreview subject={(d.subject as string) || ''} body={(d.body as string) || ''} />}
            <div className="border-t border-white/10 pt-3 space-y-2">
              <label className="block text-xs text-gray-400">Send test email to</label>
              <input
                type="email" value={testTo} onChange={e => setTestTo(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
              />
              <button onClick={sendTestEmail} disabled={testSending || !testTo}
                className="w-full border border-purple-500/40 hover:border-purple-500 bg-purple-900/20 hover:bg-purple-900/30 text-purple-300 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-40">
                {testSending ? 'Sending…' : testMsg || '✉ Send Test Email'}
              </button>
            </div>
          </>
        )}

        {node.type === 'whatsapp' && (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Message</label>
              <p className="text-[10px] text-gray-600 mb-1">{'{{name}} {{points}} {{tier}} {{store}}'}</p>
              <textarea value={(d.body as string) || ''} onChange={e => setD(p => ({ ...p, body: e.target.value }))}
                rows={6} placeholder={'Hi {{name}}, you have {{points}} points at {{store}}! 🎉'}
                className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500 resize-none" />
            </div>
            <div className="bg-[#0f0f1a] rounded-lg p-3 text-xs text-gray-500 space-y-1">
              <div>Only sends to customers who opted in to WhatsApp</div>
              <div>Requires merchant WhatsApp credits</div>
            </div>
          </>
        )}

        {node.type === 'wait' && (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-2">Quick presets</label>
              <div className="flex flex-wrap gap-1.5">
                {WAIT_PRESETS.map(p => (
                  <button key={p.label} onClick={() => setD(prev => ({ ...prev, amount: p.amount, unit: p.unit }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                      d.amount === p.amount && d.unit === p.unit
                        ? 'bg-orange-600 border-orange-500 text-white'
                        : 'bg-[#0f0f1a] border-white/10 text-gray-300 hover:border-orange-500/50'
                    }`}>{p.label}</button>
                ))}
                <button onClick={() => setD(prev => ({ ...prev, amount: 2, unit: 'days' }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-[#0f0f1a] border-white/10 text-gray-400 hover:border-white/25 transition">
                  Custom
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Amount</label>
                <input type="number" min={1} value={(d.amount as number) || 1}
                  onChange={e => setD(p => ({ ...p, amount: +e.target.value }))}
                  className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Unit</label>
                <select value={(d.unit as string) || 'days'} onChange={e => setD(p => ({ ...p, unit: e.target.value }))}
                  className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500">
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                </select>
              </div>
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
            <div className="bg-[#0f0f1a] rounded-lg p-3 text-xs">
              <div className="text-green-400 mb-1">✓ True → left handle</div>
              <div className="text-red-400">✗ False → right handle</div>
            </div>
          </>
        )}

        {node.type === 'addPoints' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Points to add</label>
            <input type="number" min={1} value={(d.points as number) || 100}
              onChange={e => setD(p => ({ ...p, points: +e.target.value }))}
              className="w-full bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
          </div>
        )}

        {node.type === 'end' && (
          <p className="text-xs text-gray-500">Customers who reach this node are marked as completed.</p>
        )}
      </div>
      {node.type !== 'end' && (
        <div className="px-5 py-4 border-t border-white/10 shrink-0">
          <button onClick={save} className="w-full bg-purple-600 hover:bg-purple-500 py-2 rounded-lg text-sm font-semibold transition">Apply Changes</button>
        </div>
      )}
    </div>
  )
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────

function AnalyticsPanel({ flowId, onClose }: { flowId: string; onClose: () => void }) {
  const [stats, setStats] = useState<{ active: number; completed: number; total: number } | null>(null)
  useEffect(() => {
    fetch(`/api/merchant/flows?id=${flowId}&analytics=1`)
      .then(r => r.json()).then(d => setStats(d.analytics || null))
  }, [flowId])
  return (
    <div className="fixed right-0 top-0 h-full w-64 bg-[#16162a] border-l border-white/10 z-50 flex flex-col shadow-2xl">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="font-semibold text-white">Flow Analytics</div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
      </div>
      <div className="flex-1 px-4 py-4 space-y-3">
        {!stats ? <p className="text-xs text-gray-500">Loading…</p> : (
          <>
            {[
              { label: 'Total enrolled', value: stats.total, color: 'text-white' },
              { label: 'Currently active', value: stats.active, color: 'text-purple-400' },
              { label: 'Completed', value: stats.completed, color: 'text-green-400' },
              ...(stats.total > 0 ? [{ label: 'Completion rate', value: `${Math.round((stats.completed / stats.total) * 100)}%`, color: 'text-yellow-400' }] : []),
            ].map(s => (
              <div key={s.label} className="bg-[#0f0f1a] rounded-xl p-4 border border-white/10">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFlow(nodes: Node[], edges: Edge[]): string[] {
  const errors: string[] = []
  const triggers = nodes.filter(n => n.type === 'trigger')
  if (triggers.length === 0) { errors.push('Add at least one Trigger to start the flow.'); return errors }
  for (const t of triggers) {
    if (!edges.some(e => e.source === t.id)) {
      const info = TRIGGER_MAP[(t.data as any).triggerType as string] || { label: 'Trigger' }
      errors.push(`"${info.label}" trigger has no connected action.`)
    }
  }
  if (!nodes.some(n => n.type === 'end')) errors.push('Add an End node to mark flow completion.')
  return errors
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const ACTIONS = [
  { type: 'email',     label: 'Email',      icon: '✉',  desc: 'Send an email' },
  { type: 'whatsapp',  label: 'WhatsApp',   icon: '💬', desc: 'Send a WhatsApp message' },
  { type: 'wait',      label: 'Wait',       icon: '⏳', desc: 'Delay before next step' },
  { type: 'condition', label: 'Condition',  icon: '?',  desc: 'Branch on customer data' },
  { type: 'addPoints', label: 'Add Points', icon: '⭐', desc: 'Award bonus points' },
  { type: 'end',       label: 'End',        icon: '🏁', desc: 'Mark flow complete' },
]

// ─── Flow Builder ─────────────────────────────────────────────────────────────

function FlowBuilder() {
  const router = useRouter()
  const params = useParams()
  const flowId = params.id as string

  useEffect(() => {
    if (!document.getElementById('xyflow-styles')) {
      const link = document.createElement('link')
      link.id = 'xyflow-styles'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/@xyflow/react@12.10.2/dist/style.css'
      document.head.appendChild(link)
    }
  }, [])

  const [flowName, setFlowName] = useState('Untitled Flow')
  const [merchantEmail, setMerchantEmail] = useState('')
  const [active, setActive] = useState(false)
  const [allowReenroll, setAllowReenroll] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<any>(null)

  useEffect(() => {
    fetch('/api/merchant/me').then(r => { if (r.status === 401) router.push('/'); return r.ok ? r.json() : null }).then(d => { if (d?.email) setMerchantEmail(d.email) })
    if (flowId !== 'new') {
      fetch(`/api/merchant/flows?id=${flowId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return
          setFlowName(d.name || 'Untitled Flow')
          setActive(d.active || false)
          setAllowReenroll(d.allow_reenroll || false)
          if (d.nodes?.length) setNodes(d.nodes)
          if (d.edges?.length) setEdges(d.edges)
        })
    }
  }, [flowId, router])

  const onConnect = useCallback((params: Connection) => {
    setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: '#6c3fff', strokeWidth: 2 } }, eds))
  }, [setEdges])

  function onNodeClick(_: React.MouseEvent, node: Node) { setSelectedNode(node); setShowAnalytics(false) }
  function onPaneClick() { setSelectedNode(null) }
  function updateNodeData(id: string, data: Record<string, unknown>) {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n))
  }

  function onDragStart(e: React.DragEvent, type: string, subType?: string) {
    e.dataTransfer.setData('application/reactflow', JSON.stringify({ type, subType }))
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/reactflow')
    if (!raw || !rfInstance || !reactFlowWrapper.current) return
    const { type, subType } = JSON.parse(raw)
    const bounds = reactFlowWrapper.current.getBoundingClientRect()
    const pos = rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top })
    const id = `${type}-${Date.now()}`
    const defaults: Record<string, Record<string, unknown>> = {
      trigger: { triggerType: subType || 'signup' },
      email: { subject: '', body: '' },
      wait: { amount: 1, unit: 'days' },
      condition: { field: 'points', operator: '>=', value: '500' },
      addPoints: { points: 100 },
      end: {},
    }
    setNodes(nds => [...nds, { id, type, position: pos, data: defaults[type] || {} }])
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }

  function deleteNode(nodeId: string) {
    setNodes(nds => nds.filter(n => n.id !== nodeId))
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
  }

  async function duplicateFlow() {
    const r = await fetch('/api/merchant/flows', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${flowName} (copy)`, active: false, allow_reenroll: allowReenroll, nodes, edges }),
    })
    const d = await r.json()
    if (d.id) router.push(`/merchant/flows/${d.id}`)
  }

  async function save() {
    const errors = validateFlow(nodes, edges)
    if (errors.length > 0) { setValidationErrors(errors); return }
    setValidationErrors([])
    setSaving(true); setSaveMsg('')
    const triggers = [...new Set(
      nodes.filter(n => n.type === 'trigger').map(n => (n.data as any).triggerType).filter(Boolean)
    )].join(',')
    const method = flowId === 'new' ? 'POST' : 'PATCH'
    const body = flowId === 'new'
      ? { name: flowName, trigger: triggers, active, allow_reenroll: allowReenroll, nodes, edges }
      : { id: flowId, name: flowName, trigger: triggers, active, allow_reenroll: allowReenroll, nodes, edges }
    const r = await fetch('/api/merchant/flows', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json()
    if (!r.ok) { setSaveMsg(d.error || 'Save failed'); setSaving(false); return }
    if (flowId === 'new' && d.id) router.replace(`/merchant/flows/${d.id}`)
    setSaveMsg('Saved!'); setTimeout(() => setSaveMsg(''), 2000); setSaving(false)
  }

  return (
    <div className="h-screen bg-[#0f0f1a] text-white flex flex-col overflow-hidden">
      {validationErrors.length > 0 && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center">
          <div className="bg-[#16162a] border border-red-500/40 rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="text-red-400 font-bold text-base mb-3">⚠ Fix before saving</div>
            <ul className="space-y-2 mb-4">
              {validationErrors.map((e, i) => (
                <li key={i} className="text-sm text-gray-300 flex gap-2"><span className="text-red-400 shrink-0">•</span>{e}</li>
              ))}
            </ul>
            <button onClick={() => setValidationErrors([])} className="w-full bg-[#0f0f1a] border border-white/10 py-2 rounded-lg text-sm text-white hover:border-white/20 transition">Dismiss</button>
          </div>
        </div>
      )}

      <header className="flex items-center gap-2 px-4 py-3 bg-[#16162a] border-b border-white/10 shrink-0 z-10 flex-wrap">
        <button onClick={() => router.push('/merchant?tab=flows')} className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition mr-1">← Back</button>
        <div className="w-px h-5 bg-white/10" />
        <input value={flowName} onChange={e => setFlowName(e.target.value)}
          className="bg-transparent text-white font-semibold text-sm outline-none border-b border-transparent focus:border-purple-500 px-1 py-0.5 min-w-[120px] max-w-[200px]" />
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <button onClick={duplicateFlow} className="text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-lg transition">⧉ Duplicate</button>
          <button onClick={() => { setShowAnalytics(p => !p); setSelectedNode(null) }}
            className={`text-xs border px-3 py-1.5 rounded-lg transition ${showAnalytics ? 'text-purple-300 border-purple-500/50 bg-purple-900/20' : 'text-gray-400 hover:text-white border-white/10 hover:border-white/25'}`}>
            📊 Analytics
          </button>
          <div className="w-px h-5 bg-white/10" />
          <span className="text-xs text-gray-400">Re-enroll</span>
          <button onClick={() => setAllowReenroll(p => !p)}
            className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${allowReenroll ? 'bg-blue-600' : 'bg-gray-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${allowReenroll ? 'left-4' : 'left-0.5'}`} />
          </button>
          <div className="w-px h-5 bg-white/10" />
          <span className="text-xs text-gray-400">Active</span>
          <button onClick={() => setActive(p => !p)}
            className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${active ? 'bg-purple-600' : 'bg-gray-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${active ? 'left-4' : 'left-0.5'}`} />
          </button>
          {saveMsg && <span className="text-xs text-green-400">{saveMsg}</span>}
          <button onClick={save} disabled={saving}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-1.5 rounded-lg text-sm font-semibold transition">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-52 bg-[#16162a] border-r border-white/10 flex flex-col shrink-0 overflow-y-auto">
          <div className="px-3 pt-4 pb-2">
            <div className="text-[10px] uppercase tracking-widest text-purple-400 mb-2 px-1">⚡ Triggers</div>
            <div className="space-y-1">
              {TRIGGERS.map(t => (
                <div key={t.type} draggable onDragStart={e => onDragStart(e, 'trigger', t.type)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-purple-900/50 cursor-grab active:cursor-grabbing hover:border-purple-500/60 hover:bg-purple-900/20 transition select-none">
                  <span className="text-sm shrink-0">{t.icon}</span>
                  <div><div className="text-xs font-semibold text-white leading-tight">{t.label}</div>
                    <div className="text-[9px] text-gray-500 leading-tight">{t.desc}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-3 pt-3 pb-2 border-t border-white/10">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 px-1">Actions</div>
            <div className="space-y-1">
              {ACTIONS.map(item => (
                <div key={item.type} draggable onDragStart={e => onDragStart(e, item.type)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-white/10 cursor-grab active:cursor-grabbing hover:border-white/25 hover:bg-white/5 transition select-none">
                  <span className="text-sm shrink-0">{item.icon}</span>
                  <div><div className="text-xs font-semibold text-white leading-tight">{item.label}</div>
                    <div className="text-[9px] text-gray-500 leading-tight">{item.desc}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-3 pt-3 pb-4 border-t border-white/10">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 px-1">Variables</div>
            <div className="space-y-1">
              {['{{name}}', '{{points}}', '{{tier}}', '{{store}}'].map(v => (
                <div key={v} className="text-[10px] font-mono text-purple-400 bg-purple-900/20 rounded px-2 py-1">{v}</div>
              ))}
            </div>
          </div>
        </aside>

        <div ref={reactFlowWrapper} className="flex-1 relative" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
            onInit={setRfInstance} nodeTypes={nodeTypes}
            fitView deleteKeyCode={null}
            style={{ background: '#0f0f1a' }}
            defaultEdgeOptions={{ animated: true, style: { stroke: '#6c3fff', strokeWidth: 2 } }}
          >
            <Background color="#1e1e3a" gap={20} size={1} />
            <Controls className="!bg-[#16162a] !border-white/10 !rounded-xl [&_button]:!bg-[#16162a] [&_button]:!border-white/10 [&_button]:!text-gray-400 [&_button:hover]:!text-white" />
            <MiniMap style={{ background: '#16162a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} nodeColor="#6c3fff" maskColor="rgba(0,0,0,0.4)" />
          </ReactFlow>
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-4xl mb-3 opacity-20">⚡</div>
                <div className="text-gray-600 text-sm">Drag a trigger from the left panel to start</div>
              </div>
            </div>
          )}
        </div>

        {selectedNode && !showAnalytics && (
          <ConfigPanel
            node={selectedNode}
            onChange={(id, data) => { updateNodeData(id, data); setSelectedNode(n => n ? { ...n, data: { ...n.data, ...data } } : null) }}
            onClose={() => setSelectedNode(null)}
            onDelete={() => deleteNode(selectedNode.id)}
            merchantEmail={merchantEmail}
          />
        )}
        {showAnalytics && flowId !== 'new' && (
          <AnalyticsPanel flowId={flowId} onClose={() => setShowAnalytics(false)} />
        )}
      </div>
    </div>
  )
}

export default function FlowBuilderClient() {
  return <ReactFlowProvider><FlowBuilder /></ReactFlowProvider>
}
