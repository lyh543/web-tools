import type { ProcessorConfig } from './imageProcessor/types'
import { extractFramesFromVideo } from './imageProcessor/videoToFrames'
import { renderGifFromFrames } from './imageProcessor/framesToGif'
import { backgroundColorProcessor } from './imageProcessor/colorDetection'
import { replaceBackgroundInFrames } from './imageProcessor/colorReplacement'
import { cropProcessor } from './imageProcessor/imageCrop'
import { cycleDetectProcessor } from './imageProcessor/detectCycle'
import { frameRateDetectProcessor } from './imageProcessor/frameRateDetect'
import { resizeProcessor } from './imageProcessor/imageResize'
import { ProgressManager } from './progressManager'

export interface HandleFileSelectDependencies {
  setConverting: (value: boolean) => void
  setProgress: (value: number) => void
  resetState: () => void
  setGifPreview: (url: string | null) => void
}

export const processFile = async (
  config: ProcessorConfig,
  deps: HandleFileSelectDependencies,
) => {
  const { setConverting, setProgress, resetState, setGifPreview } = deps
  const { logger, removeBackground, debugMode, progressManager } = config

  logger.log("\n\n")
  setConverting(true)
  setProgress(0)

  logger.log('========== 开始转换 =========＝')

  try {
    // 提取视频帧
    let processedFrames = await extractFramesFromVideo(config)
    
    if (processedFrames.length == 0) {
      logger.log('❌ 视频中没有可用的帧')
      logger.log('========== 转换结束 =========＝')
      resetState()
      return
    }


    // 检测循环边界并截取循环段
    progressManager.startNextStep()
    processedFrames = await cycleDetectProcessor(processedFrames, config)
    progressManager.completeCurrentStep()

    // 尝试识别表情包实际帧率
    progressManager.startNextStep()
    processedFrames = await frameRateDetectProcessor(processedFrames, config)
    progressManager.completeCurrentStep()

    // 底色识别
    progressManager.startNextStep()
    processedFrames = await backgroundColorProcessor(processedFrames, config)
    progressManager.completeCurrentStep()
    
    // 检测并裁剪有效区域
    progressManager.startNextStep()
    processedFrames = await cropProcessor(processedFrames, config)
    progressManager.completeCurrentStep()

    // 缩放图片到目标尺寸
    progressManager.startNextStep()
    processedFrames = await resizeProcessor(processedFrames, config)
    progressManager.completeCurrentStep()

    // 根据用户选择决定是否将底色替换为透明色
    progressManager.startNextStep()
    if (removeBackground) {
      processedFrames = await replaceBackgroundInFrames(processedFrames, config)
    } else {
      logger.log('跳过底色替换（用户选择保留背景）')
    }
    progressManager.completeCurrentStep()

    // 生成 GIF
    const gifBlob = await renderGifFromFrames(processedFrames, config)
    progressManager?.completeCurrentStep()
    
    // 创建预览 URL
    const previewUrl = URL.createObjectURL(gifBlob)
    setGifPreview(previewUrl)
    
    // 输出计时统计（调试模式）
    if (debugMode && progressManager) {
      const timingStats = progressManager.getTimingStats()
      const totalDuration = timingStats.reduce((sum, s) => sum + s.duration, 0)
      
      logger.log('\n========== 性能统计 ==========')
      logger.log(`总耗时: ${ProgressManager.formatDuration(totalDuration)}`)
      logger.log('\n各步骤耗时:')
      
      timingStats.forEach(stat => {
        const duration = ProgressManager.formatDuration(stat.duration)
        const percentage = stat.percentage.toFixed(1)
        logger.log(`  ${stat.name}: ${duration} (${percentage}%)`)
      })
      
      logger.log('==============================\n')
    }
    
    logger.log('========== 转换完成 =========＝')
    resetState()
  } catch (error) {
    console.error('转换失败:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    logger.log(`❌ 转换失败: ${errorMessage}`)
    alert(`转换失败: ${errorMessage}`)
    resetState()
  }
}
