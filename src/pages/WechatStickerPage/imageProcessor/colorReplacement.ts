import { colorToString } from './colorDetection'
import type { Color, ImageProcessor, ProcessorConfig } from './types'
import type { Logger } from '../useLogger'

export const replaceColorWithTransparent = (
  imageData: ImageData,
  targetColor: Color,
  logger: Logger
): ImageData => {
  const log = logger.log
  
  const width = imageData.width
  const height = imageData.height
  const data = new Uint8ClampedArray(imageData.data)
  
  let replacedCount = 0
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    
    // 检查颜色是否匹配
    if (r === targetColor.r && g === targetColor.g && b === targetColor.b && a === targetColor.a) {
      data[i] = data[i + 1] = data[i + 2] = 0 // 方便压缩空间
      data[i + 3] = 0 // 设置透明度为 0
      replacedCount++
    }
  }
  
  const totalPixels = (data.length / 4)
  const percentage = ((replacedCount / totalPixels) * 100).toFixed(2)
  
  log(`替换像素: ${replacedCount}/${totalPixels} (${percentage}%)`)
  
  return new ImageData(data, width, height)
}

export const replaceBackgroundInFrames: ImageProcessor = async (
  frames,
  config,
) => {
  const { logger, backgroundColor } = config as ProcessorConfig

  if (!backgroundColor) {
    logger.log('未检测到底色，跳过底色替换')
    return frames
  }

  const log = logger.log
  
  log(`开始将底色 ${colorToString(backgroundColor)} 替换为透明色...`)
  
  const processedFrames: ImageData[] = []
  
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index]
    const frameLogger: Logger = {
      log: (msg: string) => {
        // 只在特定帧输出日志，避免日志过多
        if ((index + 1) % 10 === 0 || index === 0 || index === frames.length - 1) {
          log(`帧 ${index + 1}: ${msg}`)
        }
      },
      debug: logger.debug,
      yield: logger.yield
    }
    const processed = replaceColorWithTransparent(frame, backgroundColor, frameLogger)
    processedFrames.push(processed)
    
    // 每处理 5 帧就让出控制权
    if (index % 5 === 0) {
      await logger.yield()
    }
  }
  
  log(`底色替换完成，共处理 ${frames.length} 帧`)
  
  return processedFrames
}

