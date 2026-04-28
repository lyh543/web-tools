import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import type { LogEntry } from '../hooks/useLogger'

interface LogViewerProps {
  logs: LogEntry[]
}

export const LogViewer = ({ logs }: LogViewerProps) => {
  return (
    <Paper
      variant="outlined"
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
  )
}
