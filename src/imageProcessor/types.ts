import type { Logger } from '../hooks/useLogger'
import type { ProgressManager } from '../progressManager'

export type ProcessorLogger = Logger

export interface Color {
  r: number
  g: number
  b: number
  a: number
}

/**
 * 所有图像处理器共享的配置对象。
 * Processor 可以直接修改 config，将中间结果写入其中供后续 processor 使用。
 */
export interface ProcessorConfig {
  /** 日志接口，贯穿整个处理流水线。 */
  logger: ProcessorLogger

  /** 原始视频的帧率（fps）。 */
  frameRate: number

  /** 自动识别出的表情包实际帧率（fps）。 */
  detectedFrameRate?: number

  /** 是否在后续步骤中移除背景。 */
  removeBackground: boolean

  /** 自动识别出的背景色。 */
  backgroundColor?: Color

  /** 背景采样使用的帧索引，缺省为中间帧。 */
  backgroundSampleIndex?: number

  /** 裁剪容差（0-1），用于裁剪处理器。 */
  cropTolerance: number

  /** 裁剪器输出的裁剪区域。 */
  cropRegion?: CropRegion

  /** 裁剪边框比例（0-1），用于裁剪时，分别表示左右上下的初始比例。 */
  borderLeftRatio: number
  borderRightRatio: number
  borderTopRatio: number
  borderBottomRatio: number

  /** 循环检测得到的边界信息。 */
  cycleBoundaries?: CycleBoundary[]

  /** 输出文件名（通常来自原视频文件名）。 */
  fileName: string

  /** 源视频文件对象。 */
  file: File

  /** 进度回调函数，一般由渲染 GIF 的处理器使用。 */
  onProgress: (progress: number) => void

  /** 全局进度管理器，用于协调各处理步骤的进度更新。 */
  progressManager: ProgressManager

  /** 是否启用调试模式，调试模式下会输出更多日志信息。 */
  debugMode: boolean

  /** 目标最大尺寸（像素），图片会按比例缩放使宽高的较大值不超过此值。 */
  targetSize: number
}

export interface ImageProcessor {
  (imageDataList: ImageData[], config: ProcessorConfig): Promise<ImageData[]>
}
export interface CropRegion {
  left: number
  top: number
  width: number
  height: number
}export interface DetectCycleOptions {
  frameRate: number;
  hashDiffThreshold?: number;
  consecutiveMatch?: number;
  minCycleTime?: number;
  logger: Logger;
}
export interface CycleBoundary {
  startFrame: number;
  endFrame: number;
  startMs: number;
  endMs: number;
  cycleTime: number;
  cycleFrameCount: number;
}

