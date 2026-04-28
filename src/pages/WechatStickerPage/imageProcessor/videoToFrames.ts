import type { ProcessorConfig } from './types'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error_info?: any
  }
}

const LOG_INTERVAL = 10

export const extractFramesFromVideo = async (
  config: ProcessorConfig
): Promise<ImageData[]> => {
  const { file, frameRate, logger, progressManager } = config
  const log = logger.log
  
  progressManager.startNextStep()
  
  log(`开始处理视频文件: ${file.name}`)
  
  const video = document.createElement('video')
  const videoUrl = URL.createObjectURL(file)
  
  try {
    video.src = videoUrl
    video.load()
    
    log('加载视频元数据...')
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve
        video.onerror = (event, source, lineno,colno ,error) => {  
        window.error_info = {
          event,
          source,
          lineno,
          colno,
          error
        }
        reject(new Error(`视频加载失败：${error}`))
      }
    })

    log(`视频尺寸: ${video.videoWidth}x${video.videoHeight}, 时长: ${video.duration.toFixed(2)}s`)

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      throw new Error('无法创建 canvas 上下文')
    }

    const duration = video.duration
    const frameCount = Math.floor(duration * frameRate)
    const extractedFrames: ImageData[] = []

    log(`开始提取帧，帧率: ${frameRate} fps, 总帧数: ${frameCount}`)

    for (let i = 0; i < frameCount; i++) {
      video.currentTime = i / frameRate
      await new Promise((resolve, reject) => {
        video.onseeked = resolve
        video.onerror = (event, source, lineno,colno ,error) => {  
        window.error_info = {
          event,
          source,
          lineno,
          colno,
          error
        }
        reject(new Error(`视频帧读取失败：${event}`))
      }
      })
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      extractedFrames.push(imageData)
      
      // 更新进度
      const progress = ((i + 1) / frameCount) * 100
      progressManager.updateStepProgress(progress)
      
      if ((i + 1) % LOG_INTERVAL === 0 || i === frameCount - 1) {
        log(`已提取 ${i + 1}/${frameCount} 帧`)
      }
    }

    log(`帧提取完成，共 ${extractedFrames.length} 帧`)
    return extractedFrames
  } catch (error) {
    log(`提取帧时出错: ${error instanceof Error ? error.message : '未知错误'}`)
    throw error
  } finally {
    URL.revokeObjectURL(videoUrl)
  }
}
