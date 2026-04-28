import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import AccessTimeIcon from '@mui/icons-material/AccessTime'

export const TimestampPage = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 8, gap: 2 }}>
      <AccessTimeIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
      <Typography variant="h4">时间戳转换</Typography>
      <Typography variant="body1" color="text.secondary">
        开发中…
      </Typography>
    </Box>
  )
}
