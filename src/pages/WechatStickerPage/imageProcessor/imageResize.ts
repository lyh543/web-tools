import type { ImageProcessor } from './types'

export const resizeProcessor: ImageProcessor = async (frames, config) => {
  const { logger, targetSize } = config

  if (frames.length === 0) {
    logger.log('没有可用的帧用于缩放')
    return frames
  }

  const originalWidth = frames[0].width
  const originalHeight = frames[0].height
  
  
  if (targetSize === 0) {
    logger.log(`目标尺寸设置为不压缩，跳过缩放`)
    return frames
  }
  
  logger.log(`开始缩放图片...`)

  const maxDimension = Math.max(originalWidth, originalHeight)
  
  if (maxDimension <= targetSize) {
    logger.log(`原始尺寸: ${originalWidth}x${originalHeight}，目标最大尺寸: ${targetSize}px`)
    logger.log(`原图尺寸未超过目标尺寸，跳过缩放`)
    return frames
  }

  const scale = targetSize / maxDimension
  const newWidth = Math.round(originalWidth * scale)
  const newHeight = Math.round(originalHeight * scale)

  logger.log(`原始尺寸: ${originalWidth}x${originalHeight}，目标最大尺寸: ${targetSize}px，缩放比例: ${(scale * 100).toFixed(2)}%，缩放后尺寸: ${newWidth}x${newHeight}`)

  const resizedFrames: ImageData[] = []

  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index]
    const resizedData = new Uint8ClampedArray(newWidth * newHeight * 4)

    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const srcX = Math.floor(x / scale)
        const srcY = Math.floor(y / scale)
        
        const srcIndex = (srcY * originalWidth + srcX) * 4
        const dstIndex = (y * newWidth + x) * 4

        resizedData[dstIndex] = frame.data[srcIndex]
        resizedData[dstIndex + 1] = frame.data[srcIndex + 1]
        resizedData[dstIndex + 2] = frame.data[srcIndex + 2]
        resizedData[dstIndex + 3] = frame.data[srcIndex + 3]
      }
    }

    resizedFrames.push(new ImageData(resizedData, newWidth, newHeight))

    if (index % 5 === 0) {
      await logger.yield()
    }
  }

  logger.log(`缩放完成，共处理 ${frames.length} 帧`)

  return resizedFrames
}
