import { Leaf } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <Leaf size={14} className="text-primary" />
        </div>
      )}
      <div className={`flex max-w-[75%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-3xl px-4 py-2.5 text-sm ${
            isUser ? 'bg-primary text-white shadow-md shadow-primary/20' : 'border border-border text-white shadow-md shadow-black/10'
          }`}
          style={
            isUser
              ? undefined
              : { background: 'linear-gradient(135deg, rgb(var(--color-card)), rgb(var(--color-primary) / 0.08))' }
          }
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message}</p>
          ) : (
            <div className="chat-markdown">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
                  h1: ({ children }) => <h3 className="mb-1.5 mt-2 text-base font-bold first:mt-0">{children}</h3>,
                  h2: ({ children }) => <h4 className="mb-1.5 mt-2 text-sm font-bold first:mt-0">{children}</h4>,
                  h3: ({ children }) => <h5 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h5>,
                  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  code: ({ children }) => (
                    <code className="rounded bg-black/20 px-1 py-0.5 text-xs">{children}</code>
                  ),
                }}
              >
                {message}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {timestamp && <span className="mt-1 px-1 text-[10px] text-muted">{formatTime(timestamp)}</span>}
      </div>
    </div>
  )
}
