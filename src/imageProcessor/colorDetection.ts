import type { Logger } from "../hooks/useLogger"
import type { Color, ImageProcessor } from './types'

export const colorToString = (color: Color): string => {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
}

export const detectBackgroundColor = (
  imageData: ImageData,
  logger: Logger,
): Color => {
  
  const width = imageData.width
  const height = imageData.height
  const data = imageData.data
  
  logger.log('开始识别底色...')
  
  const colorMap = new Map<string, { color: Color; count: number }>()
  
  // 采样四周边缘：上下各一行，左右各一列
  // 上边一行
  for (let x = 0; x < width; x++) {
    const index = x * 4
    const color: Color = {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3]
    }
    const key = colorToString(color)
    const entry = colorMap.get(key)
    if (entry) {
      entry.count++
    } else {
      colorMap.set(key, { color, count: 1 })
    }
  }
  
  // 下边一行
  for (let x = 0; x < width; x++) {
    const index = ((height - 1) * width + x) * 4
    const color: Color = {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3]
    }
    const key = colorToString(color)
    const entry = colorMap.get(key)
    if (entry) {
      entry.count++
    } else {
      colorMap.set(key, { color, count: 1 })
    }
  }
  
  // 左边一列（排除已采样的顶点和底点）
  for (let y = 1; y < height - 1; y++) {
    const index = (y * width) * 4
    const color: Color = {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3]
    }
    const key = colorToString(color)
    const entry = colorMap.get(key)
    if (entry) {
      entry.count++
    } else {
      colorMap.set(key, { color, count: 1 })
    }
  }
  
  // 右边一列（排除已采样的顶点和底点）
  for (let y = 1; y < height - 1; y++) {
    const index = (y * width + (width - 1)) * 4
    const color: Color = {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3]
    }
    const key = colorToString(color)
    const entry = colorMap.get(key)
    if (entry) {
      entry.count++
    } else {
      colorMap.set(key, { color, count: 1 })
    }
  }
  
  const totalSamples = width * 2 + (height - 2) * 2
  
  // 找到出现次数最多的颜色
  let maxCount = 0
  let backgroundColor: Color = { r: 0, g: 0, b: 0, a: 255 }
  
  colorMap.forEach((entry) => {
    if (entry.count > maxCount) {
      maxCount = entry.count
      backgroundColor = entry.color
    }
  })
  
  logger.log(`识别到底色: ${colorToString(backgroundColor)} (出现 ${maxCount}/${totalSamples} 次，占比 ${((maxCount / totalSamples) * 100).toFixed(2)}%)`)
  
  return backgroundColor
}

export const backgroundColorProcessor: ImageProcessor = async (imageDataList, config) => {
  const { logger } = config

  if (imageDataList.length === 0) {
    logger.log('没有可用的帧用于底色识别')
    return imageDataList
  }

  const defaultIndex = Math.floor(imageDataList.length / 2)
  const sampleIndexRaw =
    typeof config.backgroundSampleIndex === 'number'
      ? config.backgroundSampleIndex
      : defaultIndex
  const sampleIndex = Math.min(Math.max(0, sampleIndexRaw), imageDataList.length - 1)

  logger.log(`使用第 ${sampleIndex + 1} 帧（中间帧）进行底色识别`)

  const backgroundColor = detectBackgroundColor(imageDataList[sampleIndex], logger)
  config.backgroundColor = backgroundColor

  return imageDataList
}
