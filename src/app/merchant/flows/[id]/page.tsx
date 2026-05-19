'use client'
import dynamic from 'next/dynamic'

const FlowBuilderClient = dynamic(() => import('./FlowBuilderClient'), {
  ssr: false,
  loading: () => (
    <div className="h-screen bg-[#0f0f1a] flex items-center justify-center text-gray-400">
      Loading editor…
    </div>
  ),
})

export default function FlowBuilderPage() {
  return <FlowBuilderClient />
}
