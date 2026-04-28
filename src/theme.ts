import { createTheme } from '@mui/material/styles'
import type { PaletteMode } from '@mui/material'

export const createAppTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
    },
    typography: {
      fontFamily: [
        'Roboto',
        'system-ui',
        '-apple-system',
        'sans-serif',
      ].join(','),
    },
  })
