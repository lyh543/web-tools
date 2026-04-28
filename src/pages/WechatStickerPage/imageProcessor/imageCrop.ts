import type { Color, CropRegion, ImageProcessor, ProcessorConfig } from './types'
import type { Logger } from '../useLogger'

const MAX_COLOR_DISTANCE = Math.sqrt(4 * 255 * 255)

const isRowUniform = (
  frames: ImageData[],
  y: number,
  backgroundColor: Color | undefined,
  tolerance = 0.01,
  xStart = 0,
  xEndExclusive?: number,
): boolean => {
  if (frames.length === 0) return false
  if (!backgroundColor) return false

  const width = frames[0].width
  const endX = typeof xEndExclusive === 'number' ? Math.min(xEndExclusive, width) : width
  const startX = Math.max(0, xStart)

  if (startX >= endX) return false

  let sumSquaredDistance = 0
  let totalPixels = 0

  for (const frame of frames) {
    const data = frame.data
    for (let x = startX; x < endX; x++) {
      const pixelIndex = (y * width + x) * 4
      const dr = data[pixelIndex] - backgroundColor.r
      const dg = data[pixelIndex + 1] - backgroundColor.g
      const db = data[pixelIndex + 2] - backgroundColor.b
      const da = data[pixelIndex + 3] - backgroundColor.a
      sumSquaredDistance += dr * dr + dg * dg + db * db + da * da
      totalPixels++
    }
  }

  if (totalPixels === 0) return false

  const meanDistance = Math.sqrt(sumSquaredDistance / totalPixels)
  const normalizedDistance = meanDistance / MAX_COLOR_DISTANCE

  return normalizedDistance <= tolerance
}

const isColumnUniform = (
  frames: ImageData[],
  x: number,
  backgroundColor: Color | undefined,
  tolerance = 0.01,
  yStart = 0,
  yEndExclusive?: number,
): boolean => {
  if (frames.length === 0) return false
  if (!backgroundColor) return false

  const width = frames[0].width
  const height = frames[0].height
  const endY = typeof yEndExclusive === 'number' ? Math.min(yEndExclusive, height) : height
  const startY = Math.max(0, yStart)

  if (startY >= endY) return false

  let sumSquaredDistance = 0
  let totalPixels = 0

  for (let frameIdx = 0; frameIdx < frames.length; frameIdx++) {
    const frame = frames[frameIdx]
    const data = frame.data
    for (let y = startY; y < endY; y++) {
      const pixelIndex = (y * width + x) * 4
      const dr = data[pixelIndex] - backgroundColor.r
      const dg = data[pixelIndex + 1] - backgroundColor.g
      const db = data[pixelIndex + 2] - backgroundColor.b
      const da = data[pixelIndex + 3] - backgroundColor.a
      sumSquaredDistance += dr * dr + dg * dg + db * db + da * da
      totalPixels++
    }
  }

  if (totalPixels === 0) return false

  const meanDistance = Math.sqrt(sumSquaredDistance / totalPixels)
  const normalizedDistance = meanDistance / MAX_COLOR_DISTANCE

  return normalizedDistance <= tolerance
}

export const detectCropRegion = async (
  frames: ImageData[],
  tolerance: number,
  config: ProcessorConfig,
): Promise<CropRegion> => {
  const { logger, backgroundColor, progressManager } = config

  if (frames.length === 0) {
    throw new Error('没有可用的帧')
  }
  
  const width = frames[0].width
  const height = frames[0].height
  
  logger.log('开始检测可裁剪区域...')
  logger.log(`原始尺寸: ${width}x${height}`)

  const borderLeft = Math.floor(width * config.borderLeftRatio)
  const borderRight = Math.floor(width * config.borderRightRatio)
  const borderTop = Math.floor(height * config.borderTopRatio)  // 1920px 高的视频，边框约 106px
  const borderBottom = Math.floor(height * config.borderBottomRatio)
  
  logger.log(`边框设置: 上=${borderTop}px, 下=${borderBottom}px, 左=${borderLeft}px, 右=${borderRight}px；容差设置: ${(tolerance * 100).toFixed(2)}% (tolerance=${tolerance})`)
  await logger.yield()
  
  // 从左往右找第一列不可裁剪的列（从边框之后开始）
  let left = borderLeft
  logger.debug(`开始从左往右扫描 (从列 ${borderLeft} 到列 ${width - borderRight - 1})...`)
  
  for (let x = borderLeft; x < width - borderRight; x++) {
    const uniform = isColumnUniform(frames, x, backgroundColor, tolerance, borderTop, height - borderBottom)
    if (x < 3) {
      // 添加详细调试：基于到背景色的平均欧氏距离
      if (!backgroundColor) {
        logger.debug(`  列 ${x}: 无背景色信息，无法计算距离，统一按有内容处理`)
      } else {
        let sumSquaredDistance = 0
        let totalPx = 0
        for (let frameIdx = 0; frameIdx < frames.length; frameIdx++) {
          const frame = frames[frameIdx]
          const data = frame.data
          for (let y = borderTop; y < height - borderBottom; y++) {
            const pixelIndex = (y * width + x) * 4
            const dr = data[pixelIndex] - backgroundColor.r
            const dg = data[pixelIndex + 1] - backgroundColor.g
            const db = data[pixelIndex + 2] - backgroundColor.b
            const da = data[pixelIndex + 3] - backgroundColor.a
            const curDistSquare = dr * dr + dg * dg + db * db + da * da
            if (curDistSquare > 1) {
            logger.debug(`    帧 ${frameIdx}, 像素 (${x}, ${y}): dr=${dr}, dg=${dg}, db=${db}, da=${da}， 距离平方=${curDistSquare}`)
            }
            sumSquaredDistance += curDistSquare
            totalPx++
          }
        }
        if (totalPx > 0) {
          const meanDistance = Math.sqrt(sumSquaredDistance / totalPx)
          const normalizedDistance = meanDistance / MAX_COLOR_DISTANCE
          logger.debug(
            `  列 ${x}: ${uniform ? '背景色' : '有内容'} (平均距离=${meanDistance.toFixed(2)}, 归一化=${normalizedDistance.toFixed(4)}, 容差=${tolerance.toFixed(2)})`,
          )
        }
      }
    }
    if (!uniform) {
      left = x
      logger.debug(`  找到左边界: 列 ${left}`)
      break
    }
    await logger.yield()
  }
  progressManager.updateStepProgress(25)
  
  
  // 从右往左找第一列不可裁剪的列（到边框之前结束）
  let right = width - 1 - borderRight
  logger.debug(`开始从右往左扫描 (从列 ${width - 1 - borderRight} 到列 ${borderLeft})...`)
  for (let x = width - 1 - borderRight; x >= borderLeft; x--) {
    const uniform = isColumnUniform(frames, x, backgroundColor, tolerance, borderTop, height - borderBottom)
    if (!uniform) {
      right = x
      await logger.yield()
  
      break
    }
  }
  progressManager.updateStepProgress(50)
  
  // 从上往下找第一行不可裁剪的行（从边框之后开始）
  let top = borderTop
  for (let y = borderTop; y < height - borderBottom; y++) {
    if (!isRowUniform(frames, y, backgroundColor, tolerance, left, right + 1)) {
      top = y
      break
    }
  }
  progressManager.updateStepProgress(75)
  
  // 从下往上找第一行不可裁剪的行（到边框之前结束）
  let bottom = height - 1 - borderBottom
  for (let y = height - 1 - borderBottom; y >= borderTop; y--) {
    if (!isRowUniform(frames, y, backgroundColor, tolerance, left, right + 1)) {
      bottom = y
      break
    }
  }
  progressManager.updateStepProgress(100)
  
  const cropRegion: CropRegion = {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1
  }
  const savedPercentage = (100 - (cropRegion.width * cropRegion.height) / (width * height) * 100).toFixed(2)
  
  logger.log(`检测到有效区域: left=${left}, top=${top}, width=${cropRegion.width}, height=${cropRegion.height}`)
  logger.log(`裁剪后尺寸: ${cropRegion.width}x${cropRegion.height}，节省空间: ${savedPercentage}%`)
  
  return cropRegion
}

export const cropFrames = async (
  frames: ImageData[],
  cropRegion: CropRegion,
  logger: Logger
): Promise<ImageData[]> => {
  logger.log(`开始裁剪 ${frames.length} 帧...`)
  
  const croppedFrames: ImageData[] = []
  
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index]
    const croppedData = new Uint8ClampedArray(cropRegion.width * cropRegion.height * 4)
    
    for (let y = 0; y < cropRegion.height; y++) {
      for (let x = 0; x < cropRegion.width; x++) {
        const srcIndex = ((cropRegion.top + y) * frame.width + (cropRegion.left + x)) * 4
        const dstIndex = (y * cropRegion.width + x) * 4
        
        croppedData[dstIndex] = frame.data[srcIndex]
        croppedData[dstIndex + 1] = frame.data[srcIndex + 1]
        croppedData[dstIndex + 2] = frame.data[srcIndex + 2]
        croppedData[dstIndex + 3] = frame.data[srcIndex + 3]
      }
    }
    
    croppedFrames.push(new ImageData(croppedData, cropRegion.width, cropRegion.height))
    
    // 每处理 5 帧就让出控制权
    if (index % 5 === 0) {
      await logger.yield()
    }
  }
  
  logger.log(`裁剪完成`)
  
  return croppedFrames
}

export const cropProcessor: ImageProcessor = async (frames, config) => {
  const { logger } = config

  if (frames.length === 0) {
    logger.log('没有可用的帧用于裁剪')
    return frames
  }

  const cropRegion = await detectCropRegion(frames, config.cropTolerance, config)
  config.cropRegion = cropRegion

  const croppedFrames = await cropFrames(frames, cropRegion, logger)
  return croppedFrames
}
