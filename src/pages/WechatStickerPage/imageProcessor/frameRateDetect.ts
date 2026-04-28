import type { ImageProcessor } from './types'

const HASH_DIFF_THRESHOLD = 1

const calculateDHashFromImageData = (imageData: ImageData): string => {
  const thumbWidth = 9 // dHash 标准尺寸：9x8（生成 64 位哈希）
  const thumbHeight = 8
  const { data: pixels, width: imgWidth } = imageData

  let hash = ''
  // 遍历缩略图的每个像素（无需绘制 Canvas，直接计算灰度差异）
  for (let y = 0; y < thumbHeight; y++) {
    // 按比例取原图行（适配任意分辨率帧）
    const originalY = Math.floor((y / thumbHeight) * imageData.height)
    const rowStart = originalY * imgWidth * 4 // RGBA 格式，每像素 4 个值

    for (let x = 0; x < thumbWidth - 1; x++) {
      // 按比例取原图列
      const originalX1 = Math.floor((x / thumbWidth) * imgWidth)
      const originalX2 = Math.floor(((x + 1) / thumbWidth) * imgWidth)

      // 计算两个像素的灰度值（RGB 平均值）
      const gray1 = (pixels[rowStart + originalX1 * 4]
        + pixels[rowStart + originalX1 * 4 + 1]
        + pixels[rowStart + originalX1 * 4 + 2]) / 3
      const gray2 = (pixels[rowStart + originalX2 * 4]
        + pixels[rowStart + originalX2 * 4 + 1]
        + pixels[rowStart + originalX2 * 4 + 2]) / 3

      // 对比灰度，生成哈希位（1=当前<右侧，0=相反）
      hash += gray1 < gray2 ? '1' : '0'
    }
  }

  return hash
}

const calculateHashDiff = (hash1: string, hash2: string): number => {
  let diff = 0
  const len = Math.min(hash1.length, hash2.length)

  for (let i = 0; i < len; i++) {
    if (hash1[i] !== hash2[i]) diff++
    if (diff > HASH_DIFF_THRESHOLD) break
  }

  // 如果长度不同，剩余位也视为差异
  return diff + Math.max(0, hash1.length - len) + Math.max(0, hash2.length - len)
}

export const frameRateDetectProcessor: ImageProcessor = async (imageDataList, config) => {
  const { logger, frameRate } = config
  const log = logger.log

  if (imageDataList.length < 2) {
    log('帧率识别: 帧数过少，跳过识别')
    return imageDataList
  }

  log('开始尝试识别表情包实际帧率...')

  const frameHashes = imageDataList.map(calculateDHashFromImageData)

  const runLengths: number[] = []
  let currentRun = 1

  for (let i = 1; i < frameHashes.length; i++) {
    const diff = calculateHashDiff(frameHashes[i - 1], frameHashes[i])

    if (diff <= HASH_DIFF_THRESHOLD) {
      currentRun++
    } else {
      runLengths.push(currentRun)
      currentRun = 1
    }
  }
  runLengths.push(currentRun)

  if (runLengths.length === 0 || runLengths.every(len => len === 1)) {
    log('帧率识别: 未发现明显重复帧，录屏帧率可能已接近表情包实际帧率')
    log(`帧率识别: 当前使用帧率为 ${frameRate} fps`)
    return imageDataList
  }

  const totalRepeatFrames = runLengths.reduce((sum, len) => sum + len, 0)
  const meanRepeat = totalRepeatFrames / runLengths.length

  const repeatHistogram = new Map<number, number>()
  for (const len of runLengths) {
    repeatHistogram.set(len, (repeatHistogram.get(len) ?? 0) + 1)
  }

  let typicalRepeat = meanRepeat
  let maxCount = 0
  for (const [len, count] of repeatHistogram) {
    if (count > maxCount || (count === maxCount && len < typicalRepeat)) {
      maxCount = count
      typicalRepeat = len
    }
  }

  const estimatedFrameRate = frameRate / typicalRepeat
  const recommendedFrameRate = Math.max(1, Math.round(estimatedFrameRate))

  log(`帧率识别: 重复帧数量数组: ${runLengths.join(', ')}`)
  log(`帧率识别: 重复帧直方图: ${Array.from(repeatHistogram.entries()).sort(([lenA], [lenB]) => lenA - lenB).map(([len, count]) => `${len}帧×${count}`).join(', ')}`)
  log(`帧率识别: 重复帧统计: 平均=${meanRepeat.toFixed(2)}，众数最小值=${typicalRepeat.toFixed(2)}`)
  log(`帧率识别: 捕获帧率约为 ${frameRate} fps，每个画面平均重复 ${meanRepeat.toFixed(2)} 帧，典型重复 ${typicalRepeat.toFixed(2)} 帧`)
  log(`帧率识别: 推测表情包原始帧率 ≈ ${estimatedFrameRate.toFixed(2)} fps（推荐值: ${recommendedFrameRate} fps，仅供参考）`)

  config.detectedFrameRate = recommendedFrameRate

  return imageDataList
}
