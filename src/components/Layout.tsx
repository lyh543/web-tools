import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import MenuIcon from '@mui/icons-material/Menu'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import GitHubIcon from '@mui/icons-material/GitHub'
import { WechatIcon } from './WechatIcon'
import type { PaletteMode } from '@mui/material'

const DRAWER_WIDTH = 240

const NAV_ITEMS = [
  { label: '微信表情包转 GIF', icon: <WechatIcon />, path: '/wechat-sticker' },
  { label: '时间戳转换', icon: <AccessTimeIcon />, path: '/timestamp' },
]

interface LayoutProps {
  mode: PaletteMode
  onToggleMode: () => void
}

export const Layout = ({ mode, onToggleMode }: LayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const APP_NAME = '前端工具箱'

  const handleDrawerToggle = () => setMobileOpen(prev => !prev)

  useEffect(() => {
    const currentItem = NAV_ITEMS.find(item => item.path === location.pathname)
    document.title = currentItem ? `${currentItem.label} - ${APP_NAME}` : APP_NAME
  }, [location.pathname])

  const drawerContent = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap>
          前端工具箱
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {NAV_ITEMS.map(item => (
          <ListItemButton
            key={item.path}
            selected={location.pathname === item.path}
            onClick={() => {
              navigate(item.path)
              setMobileOpen(false)
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{ zIndex: theme => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            前端工具箱
          </Typography>
          <IconButton color="inherit" component="a" href="https://github.com/lyh543/web-tools" target="_blank" rel="noreferrer">
            <GitHubIcon />
          </IconButton>
          <Box sx={{ width: 8 }} />
          <IconButton color="inherit" onClick={onToggleMode}>
            {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Sidebar — permanent on md+, temporary on mobile */}
      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        {/* Mobile temporary drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop permanent drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
        }}
      >
        <Toolbar /> {/* spacer for fixed AppBar */}
        <Outlet />
      </Box>
    </Box>
  )
}
