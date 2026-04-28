import { useState, useMemo } from 'react'
import { useLocalStorage } from 'react-use'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'

// ── Constants ──────────────────────────────────────────────

type TimestampUnit = 's' | 'ms' | 'us' | 'ns'

const UNIT_OPTIONS: { value: TimestampUnit; label: string }[] = [
  { value: 's', label: '秒 (s)' },
  { value: 'ms', label: '毫秒 (ms)' },
  { value: 'us', label: '微秒 (µs)' },
  { value: 'ns', label: '纳秒 (ns)' },
]

const COMMON_TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Pacific/Auckland',
  'Pacific/Honolulu',
  'UTC',
]

// ── Helpers ────────────────────────────────────────────────

const detectUnit = (value: number): TimestampUnit => {
  const abs = Math.abs(value)
  if (abs < 1e12) return 's'
  if (abs < 1e15) return 'ms'
  if (abs < 1e18) return 'us'
  return 'ns'
}

const toMs = (value: number, unit: TimestampUnit): number => {
  switch (unit) {
    case 's': return value * 1000
    case 'ms': return value
    case 'us': return value / 1000
    case 'ns': return value / 1e6
  }
}

const fromMs = (ms: number, unit: TimestampUnit): number => {
  switch (unit) {
    case 's': return Math.floor(ms / 1000)
    case 'ms': return Math.floor(ms)
    case 'us': return Math.floor(ms * 1000)
    case 'ns': return Math.floor(ms * 1e6)
  }
}

const formatDate = (date: Date, tz: string, precision: 'day' | 's' | 'ms' = 'ms'): string => {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? ''

  const datePart = `${get('year')}-${get('month')}-${get('day')}`
  if (precision === 'day') return datePart

  const timePart = `${get('hour')}:${get('minute')}:${get('second')}`
  if (precision === 's') return `${datePart} ${timePart}`

  const ms = date.getMilliseconds()
  return `${datePart} ${timePart}.${String(ms).padStart(3, '0')}`
}

const getTimezoneOffsetMs = (date: Date, tz: string): number => {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = date.toLocaleString('en-US', { timeZone: tz })
  return new Date(tzStr).getTime() - new Date(utcStr).getTime()
}

const parseDateString = (
  input: string,
  tz: string,
): { ms: number; precision: 'day' | 's' | 'ms' | 'us' | 'ns' } | null => {
  const trimmed = input.trim()
  if (!trimmed) return null

  // YYYY-MM-DD HH:mm:ss[.fff...]
  const full =
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(trimmed)
  if (full) {
    const [, yr, mo, dy, hh, mm, ss, frac] = full
    const isoUtc = `${yr}-${mo}-${dy}T${hh}:${mm}:${ss}Z`
    const approx = new Date(isoUtc)
    const offset = getTimezoneOffsetMs(approx, tz)
    const ms = approx.getTime() - offset

    let precision: 's' | 'ms' | 'us' | 'ns' = 's'
    let fracMs = 0
    if (frac) {
      const padded = frac.padEnd(9, '0')
      fracMs = parseInt(padded.slice(0, 3))
      if (frac.length <= 3) precision = 'ms'
      else if (frac.length <= 6) precision = 'us'
      else precision = 'ns'
    }

    return { ms: ms + fracMs, precision }
  }

  // YYYY-MM-DD
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (dateOnly) {
    const [, yr, mo, dy] = dateOnly
    const isoUtc = `${yr}-${mo}-${dy}T00:00:00Z`
    const approx = new Date(isoUtc)
    const offset = getTimezoneOffsetMs(approx, tz)
    return { ms: approx.getTime() - offset, precision: 'day' }
  }

  return null
}

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
}

// ── Component ──────────────────────────────────────────────

export const TimestampPage = () => {
  const [timezone = 'Asia/Shanghai', setTimezone] =
    useLocalStorage<string>('web-tools-ts-timezone')
  const [quickUnit = 's', setQuickUnit] =
    useLocalStorage<TimestampUnit>('web-tools-ts-quick-unit')

  // Section 1: Timestamp → Datetime
  const [tsInput, setTsInput] = useState('')
  const [tsResult, setTsResult] = useState('')
  const [tsDetectedUnit, setTsDetectedUnit] = useState('')

  // Section 2: Datetime → Timestamp
  const [dtInput, setDtInput] = useState('')
  const [dtResult, setDtResult] = useState('')
  const [dtDetectedPrecision, setDtDetectedPrecision] = useState('')

  // Section 3: Batch
  const [batchInput, setBatchInput] = useState('')
  const [batchOutput, setBatchOutput] = useState('')

  // Quick-reference baseline (frozen on mount)
  const [quickNow] = useState(() => new Date())

  // ── Handlers ─────────────────────────────────────────────

  const handleTsConvert = () => {
    const num = Number(tsInput.trim())
    if (isNaN(num) || tsInput.trim() === '') {
      setTsResult('无效的时间戳')
      setTsDetectedUnit('')
      return
    }
    const unit = detectUnit(num)
    const ms = toMs(num, unit)
    setTsDetectedUnit(
      `自动识别为${UNIT_OPTIONS.find(o => o.value === unit)!.label}`,
    )
    setTsResult(formatDate(new Date(ms), timezone))
  }

  const handleDtConvert = () => {
    const parsed = parseDateString(dtInput, timezone)
    if (!parsed) {
      setDtResult('无法识别的时间格式')
      setDtDetectedPrecision('')
      return
    }
    const labels: Record<string, string> = {
      day: '天级别',
      s: '秒级别',
      ms: '毫秒级别',
      us: '微秒级别',
      ns: '纳秒级别',
    }
    setDtDetectedPrecision(`自动识别为${labels[parsed.precision]}`)
    const s = Math.floor(parsed.ms / 1000)
    const ms = Math.floor(parsed.ms)
    setDtResult(`秒: ${s}\n毫秒: ${ms}`)
  }

  const handleBatchConvert = () => {
    const lines = batchInput.split('\n').filter(l => l.trim())
    const results = lines.map(line => {
      const trimmed = line.trim()
      const num = Number(trimmed)
      if (!isNaN(num) && trimmed !== '') {
        const unit = detectUnit(num)
        const ms = toMs(num, unit)
        return formatDate(new Date(ms), timezone)
      }
      const parsed = parseDateString(trimmed, timezone)
      if (parsed) return String(Math.floor(parsed.ms / 1000))
      return '(无法识别)'
    })
    setBatchOutput(results.join('\n'))
  }

  // ── Quick-reference table rows ───────────────────────────

  const quickRows = useMemo(() => {
    const now = quickNow
    const todayStr = formatDate(now, timezone, 'day')
    const todayParsed = parseDateString(todayStr, timezone)
    const startMs = todayParsed?.ms ?? now.getTime()
    const endMs = startMs + 23 * 3600_000 + 59 * 60_000 + 59_000

    const rows: { label: string; ms: number }[] = [
      { label: '现在', ms: now.getTime() },
      { label: '今天 00:00:00', ms: startMs },
      { label: '今天 23:59:59', ms: endMs },
    ]

    for (const days of [1, 2, 3, 4, 5, 6, 7, 15, 30, 90, 180, 365]) {
      const base = new Date(now.getTime() - days * 86_400_000)
      const dayStr = formatDate(base, timezone, 'day')
      const dayParsed = parseDateString(dayStr, timezone)
      const dayMs = dayParsed?.ms ?? base.getTime()
      const label = days === 365 ? '去年的今天' : `${days} 天前`

      rows.push({ label: `${label} 00:00:00`, ms: dayMs })
      rows.push({
        label: `${label} 23:59:59`,
        ms: dayMs + 23 * 3600_000 + 59 * 60_000 + 59_000,
      })
      rows.push({
        label: `${label} 此刻`,
        ms: now.getTime() - days * 86_400_000,
      })
    }
    return rows
  }, [quickNow, timezone])

  // ── Render ───────────────────────────────────────────────

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: 2 }}>
      <Typography variant="h4" gutterBottom>
        时间戳转换
      </Typography>

      {/* Global timezone selector */}
      <FormControl size="small" sx={{ mb: 3, minWidth: 200 }}>
        <InputLabel>时区</InputLabel>
        <Select
          value={timezone}
          label="时区"
          onChange={e => setTimezone(e.target.value)}
        >
          {COMMON_TIMEZONES.map(tz => (
            <MenuItem key={tz} value={tz}>
              {tz}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* ── 1. Timestamp → Datetime ── */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          时间戳 → 时间
        </Typography>
        <Stack spacing={2} sx={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <TextField
            label="输入时间戳"
            placeholder="例: 1714286400 / 1714286400000"
            value={tsInput}
            onChange={e => setTsInput(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            onClick={handleTsConvert}
            startIcon={<SwapHorizIcon />}
          >
            转换
          </Button>
        </Stack>
        {tsDetectedUnit && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block' }}
          >
            {tsDetectedUnit}
          </Typography>
        )}
        {tsResult && (
          <Stack spacing={1} sx={{ flexDirection: 'row', alignItems: 'center', mt: 1 }}>
            <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
              {tsResult}
            </Typography>
            <IconButton size="small" onClick={() => copyToClipboard(tsResult)}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Paper>

      {/* ── 2. Datetime → Timestamp ── */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          时间 → 时间戳
        </Typography>
        <Stack spacing={2} sx={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <TextField
            label="输入时间"
            placeholder="例: 2025-04-28 12:00:00.000"
            value={dtInput}
            onChange={e => setDtInput(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            onClick={handleDtConvert}
            startIcon={<SwapHorizIcon />}
          >
            转换
          </Button>
        </Stack>
        {dtDetectedPrecision && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block' }}
          >
            {dtDetectedPrecision}
          </Typography>
        )}
        {dtResult && (
          <Box sx={{ mt: 1 }}>
            {dtResult.split('\n').map((line, i) => (
              <Stack key={i} spacing={1} sx={{ flexDirection: 'row', alignItems: 'center' }}>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {line}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() =>
                    copyToClipboard(line.split(': ')[1] ?? line)
                  }
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Box>
        )}
      </Paper>

      {/* ── 3. Batch conversion ── */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          批量转换
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 1, display: 'block' }}
        >
          每行一个，自动识别时间戳或时间格式
        </Typography>
        <Stack
          spacing={2}
          sx={{ flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'stretch' }}
        >
          <TextField
            label="输入"
            multiline
            minRows={4}
            maxRows={12}
            value={batchInput}
            onChange={e => setBatchInput(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
          />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Button
              variant="contained"
              onClick={handleBatchConvert}
              startIcon={<SwapHorizIcon />}
            >
              转换
            </Button>
          </Box>
          <TextField
            label="结果"
            multiline
            minRows={4}
            maxRows={12}
            value={batchOutput}
            slotProps={{ input: { readOnly: true } }}
            size="small"
            sx={{ flex: 1 }}
          />
        </Stack>
      </Paper>

      <Divider sx={{ my: 3 }} />

      {/* ── 4. Quick reference table ── */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          快速查表
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mb: 2, display: 'block' }}
        >
          基于页面打开时的时间 ({formatDate(quickNow, timezone)})
        </Typography>
        <FormControl size="small" sx={{ mb: 2, minWidth: 160 }}>
          <InputLabel>单位</InputLabel>
          <Select
            value={quickUnit}
            label="单位"
            onChange={e => setQuickUnit(e.target.value as TimestampUnit)}
          >
            {UNIT_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>描述</TableCell>
                <TableCell>时间</TableCell>
                <TableCell>
                  时间戳 (
                  {UNIT_OPTIONS.find(o => o.value === quickUnit)!.label})
                </TableCell>
                <TableCell sx={{ width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {quickRows.map((row, i) => {
                const ts = fromMs(row.ms, quickUnit)
                const formatted = formatDate(new Date(row.ms), timezone, 's')
                return (
                  <TableRow key={i}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell
                      sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                    >
                      {formatted}
                    </TableCell>
                    <TableCell
                      sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                    >
                      {ts}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="复制时间戳">
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(String(ts))}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
