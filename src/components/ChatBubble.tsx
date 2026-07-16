import { formatTime } from '@/lib/format'
import type { CoachSender } from '@/types'

interface ChatBubbleProps {
  sender: CoachSender
  message: string
  timestamp?: string
}

export default function ChatBubble({ sender, message, timestamp }: ChatBubbleProps) {
  const isUser = sender === 'user'

  return (
    <div className={`flex animate-fade-in items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm">🌱</div>
      )}
      <div className={`flex max-w-[75%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-sm ${
            isUser
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'border border-border bg-card text-white shadow-md shadow-black/10'
          }`}
        >
          {message}
        </div>
        {timestamp && <span className="mt-1 px-1 text-[10px] text-white/30">{formatTime(timestamp)}</span>}
      </div>
    </div>
  )
}
