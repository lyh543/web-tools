import { useState, useRef, useCallback, type ChangeEvent } from 'react'
import { useLocalStorage } from 'react-use'
import { useLogger } from './useLogger'
import { LogViewer } from './LogViewer'
import { processFile } from './processFile'
import type { GifMeta } from './processFile'
import { createDefaultSteps, ProgressManager } from './progressManager'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import CardMedia from '@mui/material/CardMedia'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Slider from '@mui/material/Slider'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import CloseIcon from '@mui/icons-material/Close'
import TimerIcon from '@mui/icons-material/Timer'
import type { ProcessorConfig } from './imageProcessor/types'

export const WechatStickerPage = () => {
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [gifPreview, setGifPreview] = useState<string | null>(null)
  const [gifMeta, setGifMeta] = useState<GifMeta | null>(null)
  const [conversionTimeMs, setConversionTimeMs] = useState<number | null>(null)
  const [cropTolerance = 0.02] = useLocalStorage<number>('wechat-sticker-gif-cropTolerance')
  const [removeBackground = false, setRemoveBackground] = useLocalStorage<boolean>('wechat-sticker-gif-removeBackground')
  const [debugMode = false, setDebugMode] = useLocalStorage<boolean>('wechat-sticker-gif-debugMode')
  const [frameRate = 10, setFrameRate] = useLocalStorage<number>('wechat-sticker-gif-frameRate')
  const [targetSizeSlider = 6, setTargetSizeSlider] = useLocalStorage<number>('wechat-sticker-gif-targetSizeSlider')
  const [decoderMethod = 'webcodecs', setDecoderMethod] = useLocalStorage<ProcessorConfig['decoderMethod']>('wechat-sticker-decoder-method', 'webcodecs')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { logs, logger, clearLogs } = useLogger(debugMode)

  // slider 1-16 → 50-800px; slider 17 → no resize (0)
  const targetSize = targetSizeSlider <= 16 ? targetSizeSlider * 50 : 0

  const resetState = useCallback(() => {
    setConverting(false)
    setProgress(0)
    if (gifPreview) {
      URL.revokeObjectURL(gifPreview)
      setGifPreview(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [gifPreview])

  const resetConverting = useCallback(() => {
    setConverting(false)
    setProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // 清理上一次的预览
      setGifPreview(prev => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setGifMeta(null)
      setConversionTimeMs(null)

      const startTime = Date.now()

      const config: ProcessorConfig = {
        logger,
        frameRate,
        removeBackground,
        cropTolerance,
        borderLeftRatio: 0,
        borderRightRatio: 0,
        borderTopRatio: 0.055,
        borderBottomRatio: 0.055,
        fileName: file.name,
        onProgress: setProgress,
        progressManager: new ProgressManager(createDefaultSteps(), setProgress),
        debugMode,
        file,
        targetSize,
        decoderMethod: decoderMethod ?? 'webcodecs',
      }

      processFile(config, {
        setConverting,
        setProgress,
        resetState,
        resetConverting,
        setGifPreview,
        setGifMeta,
        onSuccess: () => setConversionTimeMs(Date.now() - startTime),
      })
    },
    [logger, frameRate, removeBackground, cropTolerance, debugMode, targetSize, decoderMethod, setProgress, setConverting, resetState, resetConverting],
  )

  const targetSizeLabel = targetSize === 0 ? '不压缩' : `${targetSize}px`

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: 2 }}>
      <Typography variant="h4" gutterBottom>
        微信动态表情录屏转 GIF
      </Typography>

      {/* Settings */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          转换设置
        </Typography>
        <Stack spacing={3}>
          {/* Decoder method */}
          <Box>
            <Typography gutterBottom>解码方案</Typography>
            <Select
              value={decoderMethod}
              onChange={e => setDecoderMethod(e.target.value as ProcessorConfig['decoderMethod'])}
              disabled={converting}
              size="small"
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="webcodecs">webcodecs（速度最快，仅限 MP4/H.264）</MenuItem>
              <MenuItem value="video">video（兼容大部分格式，无需额外加载）</MenuItem>
              <MenuItem value="ffmpeg">ffmpeg（全能解码器，兼容性最好，首次加载约 10MB）</MenuItem>
            </Select>
          </Box>

          {/* Remove background */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={removeBackground}
                  onChange={e => setRemoveBackground(e.target.checked)}
                  disabled={converting}
                />
              }
              label="去除背景（将底色替换为透明）"
            />
          </Box>

          {/* Debug mode */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={debugMode}
                  onChange={e => setDebugMode(e.target.checked)}
                  disabled={converting}
                />
              }
              label="调试模式（显示详细日志）"
            />
          </Box>

          {/* Frame rate */}
          <Box>
            <Typography gutterBottom>
              帧率: <strong>{frameRate} fps</strong>
            </Typography>
            <Slider
              min={5}
              max={60}
              step={1}
              value={frameRate}
              onChange={(_, v) => setFrameRate(v as number)}
              disabled={converting}
              valueLabelDisplay="auto"
              sx={{ maxWidth: 400 }}
            />
            <FormHelperText>
              帧率越高，动画越流畅，但文件越大、生成越慢。推荐 10-15fps
            </FormHelperText>
          </Box>

          {/* Target size */}
          <Box>
            <Typography gutterBottom>
              目标尺寸: <strong>{targetSizeLabel}</strong>
            </Typography>
            <Slider
              min={1}
              max={17}
              step={1}
              value={targetSizeSlider}
              onChange={(_, v) => setTargetSizeSlider(v as number)}
              disabled={converting}
              valueLabelDisplay="auto"
              valueLabelFormat={v => (v <= 16 ? `${v * 50}px` : '不压缩')}
              sx={{ maxWidth: 400 }}
            />
            <FormHelperText>
              图片按比例缩放，使宽高较大值不超过此尺寸。推荐 200-400px
            </FormHelperText>
          </Box>
        </Stack>
      </Paper>

      {/* File upload */}
      <Box sx={{ mb: 3 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          disabled={converting}
          style={{ display: 'none' }}
          id="videoInput"
        />
        <Button
          variant="contained"
          component="label"
          htmlFor="videoInput"
          startIcon={<UploadFileIcon />}
          disabled={converting}
          size="large"
        >
          {converting ? '转换中…' : '选择视频文件'}
        </Button>
      </Box>

      {/* Progress bar */}
      {converting && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              处理进度
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }} color="primary">
              {progress}%
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      )}

      {/* GIF preview */}
      {gifPreview && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ pb: 0 }}>
            <Typography variant="h6">
              预览结果
            </Typography>
          </CardContent>
          <CardMedia
            component="img"
            image={gifPreview}
            alt="GIF Preview"
            sx={{ imageRendering: 'pixelated', objectFit: 'contain', maxHeight: 400 }}
          />
          {gifMeta && (
            <CardContent sx={{ pt: 1, pb: 0 }}>
              <Typography variant="body2" color="text.secondary">
                大小 {gifMeta.sizeBytes >= 1024 * 1024
                  ? `${(gifMeta.sizeBytes / 1024 / 1024).toFixed(2)} MB`
                  : `${(gifMeta.sizeBytes / 1024).toFixed(1)} KB`} &nbsp;·&nbsp;
                时长 {gifMeta.durationSec.toFixed(2)}s &nbsp;·&nbsp;
                {gifMeta.frameCount} 帧 &nbsp;·&nbsp;
                {gifMeta.fps} fps
              </Typography>
            </CardContent>
          )}
          <CardActions sx={{ justifyContent: 'flex-end' }}>
            {conversionTimeMs != null && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 'auto' }}>
                <TimerIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  用时 {conversionTimeMs >= 1000
                    ? `${(conversionTimeMs / 1000).toFixed(1)}s`
                    : `${conversionTimeMs}ms`}
                </Typography>
              </Box>
            )}
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<CloseIcon />}
              onClick={() => {
                if (gifPreview) {
                  URL.revokeObjectURL(gifPreview)
                  setGifPreview(null)
                }
                setGifMeta(null)
                setConversionTimeMs(null)
              }}
            >
              关闭预览
            </Button>
          </CardActions>
        </Card>
      )}

      {/* Log controls */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button
          variant="text"
          size="small"
          startIcon={<DeleteSweepIcon />}
          onClick={clearLogs}
          disabled={logs.length === 0 || converting}
        >
          清除日志
        </Button>
      </Box>

      <LogViewer logs={logs} />

    </Box>
  )
}
