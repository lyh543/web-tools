import { useRef, useEffect, useCallback, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import type { LogEntry } from './useLogger'

interface LogViewerProps {
  logs: LogEntry[]
}

const SCROLL_THRESHOLD = 40 // px from bottom to consider "at bottom"

export const LogViewer = ({ logs }: LogViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  // true = auto-scroll enabled (user is at bottom or hasn't scrolled yet)
  const isAtBottom = useRef(true)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const checkAtBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distFromBottom <= SCROLL_THRESHOLD
    isAtBottom.current = atBottom
    setShowScrollBtn(!atBottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  // Auto-scroll when new logs arrive, only if at bottom
  useEffect(() => {
    if (isAtBottom.current) scrollToBottom()
  }, [logs, scrollToBottom])

  return (
    <Box sx={{ position: 'relative' }}>
      <Paper
        ref={containerRef}
        variant="outlined"
        onScroll={checkAtBottom}
        sx={{
          mt: 2,
          p: 2,
          maxHeight: 384,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          textAlign: 'left',
        }}
      >
        {logs.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            暂无日志
          </Typography>
        ) : (
          logs.map((entry, index) => (
            <div key={index} style={{ marginBottom: 2, wordBreak: 'break-word' }}>
              <Typography component="span" variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                [{entry.timestamp}]
              </Typography>{' '}
              <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {entry.message}
              </Typography>
            </div>
          ))
        )}
      </Paper>

      {/* "Scroll to bottom" button — shown when user has scrolled up */}
      {showScrollBtn && (
        <Tooltip title="滚动到底部">
          <Box
            onClick={() => {
              isAtBottom.current = true
              setShowScrollBtn(false)
              scrollToBottom()
            }}
            sx={{
              position: 'absolute',
              bottom: 20,
              right: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: '50%',
              bgcolor: 'action.selected',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <KeyboardDoubleArrowDownIcon fontSize="small" />
          </Box>
        </Tooltip>
      )}
    </Box>
  )
}
