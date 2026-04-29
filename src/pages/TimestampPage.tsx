import { useState, useMemo, memo, useEffect, useCallback } from 'react'
import { useLocalStorage } from 'react-use'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SearchIcon from '@mui/icons-material/Search'

// ── Constants ──────────────────────────────────────────────

type TimestampUnit = 's' | 'ms' | 'us' | 'ns'

// Font families
const MONO_FONT_FAMILY = '"Roboto Mono", system-ui, -apple-system, monospace'

const UNIT_OPTIONS: { value: TimestampUnit; label: string }[] = [
  { value: 's', label: '秒 (s)' },
  { value: 'ms', label: '毫秒 (ms)' },
  { value: 'us', label: '微秒 (µs)' },
  { value: 'ns', label: '纳秒 (ns)' },
]

const COMMON_TIMEZONES = [
  'Pacific/Pago_Pago',       // UTC-11
  'Pacific/Honolulu',        // UTC-10
  'Pacific/Gambier',         // UTC-9 (无夏令时)
  'America/Anchorage',       // UTC-9 (夏令时 UTC-8)
  'America/Los_Angeles',     // UTC-8 (夏令时 UTC-7)
  'America/Denver',          // UTC-7 (夏令时 UTC-6)
  'America/Chicago',         // UTC-6 (夏令时 UTC-5)
  'America/New_York',        // UTC-5 (夏令时 UTC-4)
  'America/Halifax',         // UTC-4 (夏令时 UTC-3)
  'America/Sao_Paulo',       // UTC-3
  'Atlantic/South_Georgia',  // UTC-2
  'Atlantic/Cape_Verde',     // UTC-1 (无夏令时)
  'Atlantic/Azores',         // UTC-1 (夏令时 UTC+0)
  'UTC',                     // UTC+0
  'Europe/London',           // UTC+0 (夏令时 UTC+1)
  'Europe/Paris',            // UTC+1 (夏令时 UTC+2)
  'Europe/Helsinki',         // UTC+2 (夏令时 UTC+3)
  'Europe/Moscow',           // UTC+3
  'Asia/Dubai',              // UTC+4
  'Asia/Karachi',            // UTC+5
  'Asia/Kolkata',            // UTC+5:30
  'Asia/Dhaka',              // UTC+6
  'Asia/Bangkok',            // UTC+7
  'Asia/Shanghai',           // UTC+8
  'Asia/Tokyo',              // UTC+9
  'Australia/Darwin',        // UTC+9:30
  'Australia/Sydney',        // UTC+10 (夏令时 UTC+11)
  'Pacific/Noumea',          // UTC+11
  'Pacific/Auckland',        // UTC+12 (夏令时 UTC+13)
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

// Toast state is managed in main TimestampPage component
const copyToClipboard = (text: string, onCopySuccess?: () => void) => {
  navigator.clipboard.writeText(text).then(() => {
    if (onCopySuccess) onCopySuccess()
  })
}

// ── CurrentTimePaper (memoized, updates every 1 second) ──────────

interface CurrentTimePaperProps {
  timezone: string
  onTimezoneChange: (tz: string) => void
  onCopySuccess?: () => void
}

const CurrentTimePaper = memo(({ timezone, onTimezoneChange, onCopySuccess }: CurrentTimePaperProps) => {
  const [now, setNow] = useState(new Date())
  const [tzDialogOpen, setTzDialogOpen] = useState(false)
  const [tzSearch, setTzSearch] = useState('')
  const [sortedTimezones, setSortedTimezones] = useState<string[]>(COMMON_TIMEZONES)
  const [displayInfo, setDisplayInfo] = useState<Map<string, { offset: string; time: string }>>(new Map())
  const [tsUnit = 's', setTsUnit] = useLocalStorage<TimestampUnit>('web-tools-ts-cur-unit')

  // Update current time every second
  useEffect(() => {
    const tick = () => setNow(new Date())
    const delay = 1000 - new Date().getMilliseconds()
    const timeout = setTimeout(() => {
      tick()
      const interval = setInterval(tick, 1000)
      return () => clearInterval(interval)
    }, delay)
    return () => clearTimeout(timeout)
  }, [])

  // Update timezone display info every minute
  useEffect(() => {
    const update = () => {
      const info = new Map<string, { offset: string; time: string }>()
      const cur = dayjs()
      const tzWithTime: [string, number][] = []
      COMMON_TIMEZONES.forEach(tz => {
        const tzNow = cur.tz(tz)
        info.set(tz, { offset: tzNow.format('Z'), time: tzNow.format('MM-DD HH:mm') })
        tzWithTime.push([tz, tzNow.hour() + tzNow.minute() / 60])
      })
      tzWithTime.sort((a, b) => a[1] - b[1])
      setSortedTimezones(tzWithTime.map(([t]) => t))
      setDisplayInfo(info)
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [])

  const dayjsNow = dayjs(now).tz(timezone)
  const formattedTime = dayjsNow.format('YYYY-MM-DD HH:mm:ss')
  const tsValue = fromMs(now.getTime(), tsUnit)
  const tzInfo = displayInfo.get(timezone)

  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
      {/* Row 1: title */}
      <Typography variant="h6" gutterBottom>
        当前时间
      </Typography>

      {/* Row 2: large time + timezone */}
      <Stack sx={{ flexDirection: 'row', alignItems: 'center', mb: 1 }}>
        <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 0.5, flex: 1 }}>
          <Typography sx={{ fontFamily: MONO_FONT_FAMILY, fontSize: '1.5rem', fontWeight: 500 }}>
            {formattedTime}
          </Typography>
          <IconButton size="small" sx={{ mt: 0 }} onClick={() => { copyToClipboard(formattedTime); onCopySuccess?.() }}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {tzInfo ? `${timezone} (UTC${tzInfo.offset})` : timezone}
          </Typography>
          <Button variant="outlined" size="small" onClick={() => setTzDialogOpen(true)}>
            切换时区
          </Button>
        </Stack>
      </Stack>

      {/* Row 3: timestamp + unit selector */}
      <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontFamily: MONO_FONT_FAMILY, fontSize: '1rem' }}>
          {tsValue}
        </Typography>
        <IconButton size="small" sx={{ mt: 0 }} onClick={() => { copyToClipboard(String(tsValue)); onCopySuccess?.() }}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>单位</InputLabel>
          <Select
            value={tsUnit}
            label="单位"
            onChange={e => setTsUnit(e.target.value as TimestampUnit)}
          >
            {UNIT_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* Timezone Dialog */}
      <Dialog open={tzDialogOpen} onClose={() => { setTzDialogOpen(false); setTzSearch('') }} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack sx={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>选择时区</span>
            <TextField
              variant="standard"
              placeholder="搜索时区、偏移"
              value={tzSearch}
              onChange={e => setTzSearch(e.target.value)}
              sx={{ width: 180 }}
              autoFocus
              slotProps={{
                input: {
                  startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />,
                },
              }}
            />
          </Stack>
        </DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>时区</TableCell>
                  <TableCell>偏移</TableCell>
                  <TableCell>当前时间</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedTimezones
                  .filter(tz => {
                    if (!tzSearch.trim()) return true
                    const q = tzSearch.trim().toLowerCase()
                    const info = displayInfo.get(tz)
                    return tz.toLowerCase().includes(q) || (info?.offset ?? '').toLowerCase().includes(q)
                  })
                  .map(tz => {
                    const info = displayInfo.get(tz)
                    return (
                      <TableRow
                        key={tz}
                        hover
                        selected={timezone === tz}
                        onClick={() => { onTimezoneChange(tz); setTzDialogOpen(false); setTzSearch('') }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{tz}</TableCell>
                        <TableCell>{info?.offset}</TableCell>
                        <TableCell>{info?.time}</TableCell>
                      </TableRow>
                    )
                  })
                }
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setTzDialogOpen(false); setTzSearch('') }}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
})
// ── TimestampToDatetimeSection ─────────────────────────────────────

interface TimestampToDatetimeSectionProps {
  timezone: string
  input: string
  result: string
  detectedUnit: string
  onInputChange: (value: string) => void
  onResultChange: (result: string, unit: string) => void
  onCopySuccess?: () => void
}

const TimestampToDatetimeSection = memo(
  ({
    timezone,
    input,
    result,
    detectedUnit,
    onInputChange,
    onResultChange,
    onCopySuccess,
  }: TimestampToDatetimeSectionProps) => {
    useEffect(() => {
      const num = Number(input.trim())
      if (isNaN(num) || input.trim() === '') {
        onResultChange('', '')
        return
      }
      const unit = detectUnit(num)
      const ms = toMs(num, unit)
      const formatted = dayjs(ms).tz(timezone).format('YYYY-MM-DD HH:mm:ss.SSS')
      onResultChange(
        formatted,
        `自动识别为${UNIT_OPTIONS.find(o => o.value === unit)!.label}`,
      )
    }, [input, timezone, onResultChange])

    return (
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          时间戳 → 时间
        </Typography>
        <Stack spacing={2} sx={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <TextField
            label="输入时间戳"
            placeholder="例: 1714286400 / 1714286400000"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
          />
        </Stack>
        {detectedUnit && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block' }}
          >
            {detectedUnit}
          </Typography>
        )}
        {result && (
          <Stack sx={{ flexDirection: 'row', alignItems: 'center', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body1" sx={{ fontFamily: MONO_FONT_FAMILY }}>
              {result}
            </Typography>
            <IconButton size="small" onClick={() => { copyToClipboard(result); onCopySuccess?.() }} sx={{ mt: 0 }}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Paper>
    )
  },
)

// ── DatetimeToTimestampSection ─────────────────────────────────────

interface DatetimeToTimestampSectionProps {
  timezone: string
  input: string
  result: string
  detectedPrecision: string
  onInputChange: (value: string) => void
  onResultChange: (result: string, precision: string) => void
  onCopySuccess?: () => void
}

const DatetimeToTimestampSection = memo(
  ({
    timezone,
    input,
    result,
    detectedPrecision,
    onInputChange,
    onResultChange,
    onCopySuccess,
  }: DatetimeToTimestampSectionProps) => {
    useEffect(() => {
      const parsed = parseDateString(input, timezone)
      if (!parsed) {
        onResultChange('', '')
        return
      }
      const labels: Record<string, string> = {
        day: '天级别',
        s: '秒级别',
        ms: '毫秒级别',
        us: '微秒级别',
        ns: '纳秒级别',
      }
      const s = Math.floor(parsed.ms / 1000)
      const ms = Math.floor(parsed.ms)
      onResultChange(
        `秒: ${s}\n毫秒: ${ms}`,
        `自动识别为${labels[parsed.precision]}`,
      )
    }, [input, timezone, onResultChange])

    return (
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          时间 → 时间戳
        </Typography>
        <Stack spacing={2} sx={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <TextField
            label="输入时间"
            placeholder="例: 2025-04-28 12:00:00.000"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
          />
        </Stack>
        {detectedPrecision && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block' }}
          >
            {detectedPrecision}
          </Typography>
        )}
        {result && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            {result.split('\n').map((line, i) => (
              <Stack key={i} sx={{ flexDirection: 'row', alignItems: 'center', mb: 1 }}>
                <Typography variant="body1" sx={{ fontFamily: MONO_FONT_FAMILY }}>
                  {line}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => { copyToClipboard(line.split(': ')[1] ?? line); onCopySuccess?.() }}
                  sx={{ mt: 0 }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Box>
        )}
      </Paper>
    )
  },
)

// ── BatchConversionSection ─────────────────────────────────────────

interface BatchConversionSectionProps {
  timezone: string
  input: string
  output: string
  onInputChange: (value: string) => void
  onOutputChange: (output: string) => void
}

const BatchConversionSection = memo(
  ({
    timezone,
    input,
    output,
    onInputChange,
    onOutputChange,
  }: BatchConversionSectionProps) => {
    useEffect(() => {
      const lines = input.split('\n').filter(l => l.trim())
      if (lines.length === 0) {
        onOutputChange('')
        return
      }
      const results = lines.map(line => {
        const trimmed = line.trim()
        const num = Number(trimmed)
        if (!isNaN(num) && trimmed !== '') {
          const unit = detectUnit(num)
          const ms = toMs(num, unit)
          return dayjs(ms).tz(timezone).format('YYYY-MM-DD HH:mm:ss')
        }
        const parsed = parseDateString(trimmed, timezone)
        if (parsed) return String(Math.floor(parsed.ms / 1000))
        return '(无法识别)'
      })
      onOutputChange(results.join('\n'))
    }, [input, timezone, onOutputChange])

    return (
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
          spacing={0}
          sx={{ flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'flex-start', gap: { xs: 0, sm: 2 } }}
        >
          <TextField
            label="输入"
            multiline
            minRows={4}
            maxRows={12}
            value={input}
            onChange={e => onInputChange(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
          />
          <TextField
            label="结果"
            multiline
            minRows={4}
            maxRows={12}
            value={output}
            slotProps={{ input: { readOnly: true } }}
            size="small"
            sx={{ flex: 1 }}
          />
        </Stack>
      </Paper>
    )
  },
)

// ── QuickReferenceTable (memoized) ─────────────────────────────────

interface QuickReferenceTableProps {
  quickNow: Date
  timezone: string
  onCopySuccess?: () => void
}

interface DayRow {
  label: string
  midnight: { time: string; ts: number }
  now: { time: string; ts: number }
  endday: { time: string; ts: number }
}

const QuickReferenceTable = memo(({ quickNow, timezone, onCopySuccess }: QuickReferenceTableProps) => {
  const [quickUnit = 's', setQuickUnit] =
    useLocalStorage<TimestampUnit>('web-tools-ts-quick-unit')

  const dayRows = useMemo(() => {
    const now = quickNow
    const todayStr = formatDate(now, timezone, 'day')
    const todayParsed = parseDateString(todayStr, timezone)
    const todayMs = todayParsed?.ms ?? now.getTime()

    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
    const fmtMs = (ms: number) => fmt.format(new Date(ms)).replace('T', ' ')

    const rows: DayRow[] = []

    // Today
    const todayStart = todayMs
    const todayEnd = todayMs + 23 * 3600_000 + 59 * 60_000 + 59_000
    rows.push({
      label: '今天',
      midnight: { time: fmtMs(todayStart), ts: todayStart },
      now: { time: fmtMs(now.getTime()), ts: now.getTime() },
      endday: { time: fmtMs(todayEnd), ts: todayEnd },
    })

    // Past days
    for (const days of [1, 2, 3, 4, 5, 6, 7, 15, 30, 90, 180, 365]) {
      const pastTime = now.getTime() - days * 86_400_000
      const pastStr = formatDate(new Date(pastTime), timezone, 'day')
      const pastParsed = parseDateString(pastStr, timezone)
      const pastMs = pastParsed?.ms ?? pastTime

      const pastStart = pastMs
      const pastEnd = pastMs + 23 * 3600_000 + 59 * 60_000 + 59_000
      const pastNow = now.getTime() - days * 86_400_000

      const label = days === 365 ? '去年的今天' : `${days} 天前`

      rows.push({
        label,
        midnight: { time: fmtMs(pastStart), ts: pastStart },
        now: { time: fmtMs(pastNow), ts: pastNow },
        endday: { time: fmtMs(pastEnd), ts: pastEnd },
      })
    }

    return rows
  }, [quickNow, timezone])

  const renderCell = (item: { time: string; ts: number }) => {
    const ts = fromMs(item.ts, quickUnit)
    return (
      <TableCell sx={{ p: 0.75 }}>
        <Stack spacing={0.25}>
          <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 0.25 }}>
            <Typography sx={{ fontFamily: MONO_FONT_FAMILY, fontSize: '0.75rem', flex: 1 }}>
              {item.time}
            </Typography>
            <IconButton size="small" sx={{ p: 0.25 }} onClick={() => { copyToClipboard(item.time); onCopySuccess?.() }}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 0.25 }}>
            <Typography sx={{ fontFamily: MONO_FONT_FAMILY, fontSize: '0.75rem', flex: 1 }}>
              {ts}
            </Typography>
            <IconButton size="small" sx={{ p: 0.25 }} onClick={() => { copyToClipboard(String(ts)); onCopySuccess?.() }}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </TableCell>
    )
  }

  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
      <Stack sx={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>
            快速查表
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
          >
            基于页面打开时的时间 ({formatDate(quickNow, timezone)})
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 160 }}>
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
      </Stack>
      <TableContainer>
        <Table size="small" sx={{ '& td': { p: 0.75 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>日期</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>00:00:00</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>此时刻</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>23:59:59</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dayRows.map((row, i) => (
              <TableRow key={i} hover>
                <TableCell sx={{ p: 0.75, fontWeight: 500 }}>{row.label}</TableCell>
                {renderCell(row.midnight)}
                {renderCell(row.now)}
                {renderCell(row.endday)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
})

// ── Main Component ─────────────────────────────────────────────────

export const TimestampPage = () => {
  const [timezone = 'Asia/Shanghai', setTimezone] =
    useLocalStorage<string>('web-tools-ts-timezone')

  // Toast notification
  const [showToast, setShowToast] = useState(false)

  const handleCopySuccess = useCallback(() => {
    setShowToast(true)
  }, [])

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

  // Handlers for real-time conversion results
  const handleTsResultChange = useCallback((result: string, unit: string) => {
    setTsResult(result)
    setTsDetectedUnit(unit)
  }, [])

  const handleDtResultChange = useCallback((result: string, precision: string) => {
    setDtResult(result)
    setDtDetectedPrecision(precision)
  }, [])

  const handleBatchOutputChange = useCallback((output: string) => {
    setBatchOutput(output)
  }, [])

  // ── Render ─────────────────────────────────────────────────────

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: 2 }}>
      <Typography variant="h4" gutterBottom>
        时间戳转换
      </Typography>

      {/* Current time paper */}
      <CurrentTimePaper
        timezone={timezone}
        onTimezoneChange={setTimezone}
        onCopySuccess={handleCopySuccess}
      />

      {/* ── 1. Timestamp → Datetime ── */}
      <TimestampToDatetimeSection
        timezone={timezone}
        input={tsInput}
        result={tsResult}
        detectedUnit={tsDetectedUnit}
        onInputChange={setTsInput}
        onResultChange={handleTsResultChange}
        onCopySuccess={handleCopySuccess}
      />

      {/* ── 2. Datetime → Timestamp ── */}
      <DatetimeToTimestampSection
        timezone={timezone}
        input={dtInput}
        result={dtResult}
        detectedPrecision={dtDetectedPrecision}
        onInputChange={setDtInput}
        onResultChange={handleDtResultChange}
        onCopySuccess={handleCopySuccess}
      />

      {/* ── 3. Batch conversion ── */}
      <BatchConversionSection
        timezone={timezone}
        input={batchInput}
        output={batchOutput}
        onInputChange={setBatchInput}
        onOutputChange={handleBatchOutputChange}
      />

      <Divider sx={{ my: 3 }} />

      {/* ── 4. Quick reference table ── */}
      <QuickReferenceTable quickNow={quickNow} timezone={timezone} onCopySuccess={handleCopySuccess} />

      <Snackbar
        open={showToast}
        autoHideDuration={2000}
        onClose={() => setShowToast(false)}
        message="✓ 已复制"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: '#4caf50',
            color: 'white',
          },
        }}
      />
    </Box>
  )
}
