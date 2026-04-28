import { useMemo } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useLocalStorage } from 'react-use'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import type { PaletteMode } from '@mui/material'
import { createAppTheme } from './theme'
import { Layout } from './components/Layout'
import { WechatStickerPage } from './pages/WechatStickerPage'
import { TimestampPage } from './pages/TimestampPage'

function App() {
  const [mode = 'light', setMode] = useLocalStorage<PaletteMode>('web-tools-theme-mode')
  const theme = useMemo(() => createAppTheme(mode), [mode])

  const toggleMode = () => setMode(mode === 'dark' ? 'light' : 'dark')

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout mode={mode} onToggleMode={toggleMode} />}>
            <Route index element={<Navigate to="/wechat-sticker" replace />} />
            <Route path="/wechat-sticker" element={<WechatStickerPage />} />
            <Route path="/timestamp" element={<TimestampPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
