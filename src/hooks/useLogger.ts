import { useState, useCallback } from 'react'

export interface LogEntry {
  timestamp: string
  message: string
}

export interface Logger {
  log: (message: string) => void
  debug: (message: string) => void
  yield: () => Promise<void>
}

const formatTimestamp = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`
}

export const useLogger = (debugMode = false) => {
  const [logs, setLogs] = useState<LogEntry[]>([])

  const log = useCallback((message: string) => {
    setLogs(prev => [...prev, { timestamp: formatTimestamp(), message }])
  }, [])

  const debug = useCallback(
    (message: string) => {
      if (!debugMode) return
      setLogs(prev => [...prev, { timestamp: formatTimestamp(), message }])
    },
    [debugMode],
  )

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  const yieldToMain = useCallback(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  }, [])

  const logger: Logger = { log, debug, yield: yieldToMain }

  return { logs, logger, clearLogs }
}
