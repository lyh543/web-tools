import { useMemo, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useLocalStorage } from 'react-use'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import type { PaletteMode } from '@mui/material'
import { createAppTheme } from './theme'
import { Layout } from './components/Layout'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'

function PageLoading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress />
    </Box>
  )
}

const WechatStickerPage = lazy(() => import('./pages/WechatStickerPage').then(m => ({ default: m.WechatStickerPage })))
const TimestampPage = lazy(() => import('./pages/TimestampPage').then(m => ({ default: m.TimestampPage })))

function App() {
  const [mode = 'light', setMode] = useLocalStorage<PaletteMode>('web-tools-theme-mode')
  const theme = useMemo(() => createAppTheme(mode), [mode])

  const toggleMode = () => setMode(mode === 'dark' ? 'light' : 'dark')

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route element={<Layout mode={mode} onToggleMode={toggleMode} />}>
            <Route index element={<Navigate to="/wechat-sticker" replace />} />
            <Route path="/wechat-sticker" element={<WechatStickerPage />} />
            <Route path="/timestamp" element={<TimestampPage />} />
          </Route>
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
