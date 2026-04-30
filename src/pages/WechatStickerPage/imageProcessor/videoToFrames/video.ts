import type { ProcessorConfig } from '../types'

/**
 * 使用 requestVideoFrameCallback 提取视频帧，比逐帧 seek 快 2-5x。
 * 当浏览器不支持 requestVideoFrameCallback 时自动降级为 seek 方案。
 */
export const extractFramesFromVideoVideo = async (
  config: ProcessorConfig,
): Promise<ImageData[]> => {
  const { file, frameRate, logger, progressManager } = config
  const log = logger.log

  progressManager.startNextStep()

  log(`开始处理视频文件（video 方案）: ${file.name}`)

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  const videoUrl = URL.createObjectURL(file)

  try {
    video.src = videoUrl
    video.load()

    log('加载视频元数据…')
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = (_e, _s, _l, _c, error) => reject(new Error(`视频加载失败：${error}`))
    })

    log(`视频尺寸: ${video.videoWidth}x${video.videoHeight}, 时长: ${video.duration.toFixed(2)}s`)

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!

    const duration = video.duration
    const totalFrames = Math.floor(duration * frameRate)
    const extractedFrames: ImageData[] = []

    // requestVideoFrameCallback 路径
    if ('requestVideoFrameCallback' in video) {
      log(`使用 requestVideoFrameCallback 提取帧，帧率: ${frameRate} fps，总帧数: ${totalFrames}`)

      await new Promise<void>((resolve, reject) => {
        const onFrame: VideoFrameRequestCallback = (_now, meta) => {
          // meta.mediaTime 单位为秒
          const expectedIndex = Math.round(meta.mediaTime * frameRate)
          if (expectedIndex >= 0 && expectedIndex < totalFrames) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            extractedFrames[expectedIndex] = ctx.getImageData(0, 0, canvas.width, canvas.height)

            const progress = Math.min(100, Math.floor((expectedIndex + 1) / totalFrames * 100))
            progressManager.updateStepProgress(progress)
          }

          if (video.currentTime < duration - 0.001 && extractedFrames.length < totalFrames) {
            video.requestVideoFrameCallback(onFrame)
          } else {
            resolve()
          }
        }

        video.requestVideoFrameCallback(onFrame)
        video.play().catch(reject)
      })

      // 补齐稀疏数组（某些时间点未触发回调的帧用邻近帧填充）
      let lastFrame: ImageData | undefined
      for (let i = 0; i < totalFrames; i++) {
        if (extractedFrames[i]) {
          lastFrame = extractedFrames[i]
        } else if (lastFrame) {
          extractedFrames[i] = lastFrame
        }
      }
      video.pause()
    } else {
      // 降级：逐帧 seek
      const videoEl = video as HTMLVideoElement
      log(`浏览器不支持 requestVideoFrameCallback，使用 seek 方案，帧率: ${frameRate} fps，总帧数: ${totalFrames}`)

      for (let i = 0; i < totalFrames; i++) {
        videoEl.currentTime = i / frameRate
        await new Promise<void>((resolve, reject) => {
          videoEl.onseeked = () => resolve()
          videoEl.onerror = () => reject(new Error('帧读取失败'))
        })
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
        extractedFrames.push(ctx.getImageData(0, 0, canvas.width, canvas.height))

        progressManager.updateStepProgress(Math.floor((i + 1) / totalFrames * 100))
        if ((i + 1) % 10 === 0 || i === totalFrames - 1) {
          log(`已提取 ${i + 1}/${totalFrames} 帧`)
        }
      }
    }

    // 过滤掉未填充的空洞
    const result = extractedFrames.filter(Boolean)
    log(`帧提取完成，共 ${result.length} 帧`)
    return result
  } catch (error) {
    log(`提取帧时出错: ${error instanceof Error ? error.message : '未知错误'}`)
    throw error
  } finally {
    URL.revokeObjectURL(videoUrl)
  }
}
