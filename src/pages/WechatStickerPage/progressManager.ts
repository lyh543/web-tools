/**
 * 全局进度管理器
 * 用于协调多个处理步骤的进度更新
 */

export interface ProgressStep {
  name: string
  weight: number // 权重，表示该步骤占总进度的比例
}

export interface StepTimingInfo {
  name: string
  duration: number // 毫秒
  percentage: number // 占总时长的百分比
}

export class ProgressManager {
  private steps: ProgressStep[]
  private currentStepIndex: number = -1
  private onProgressUpdate: (progress: number) => void
  private stepStartTime: number = 0
  private stepTimings: Map<string, number> = new Map() // 存储每个步骤的用时

  constructor(
    steps: ProgressStep[],
    onProgressUpdate: (progress: number) => void
  ) {
    // 验证权重总和为1
    const totalWeight = steps.reduce((sum, step) => sum + step.weight, 0)
    if (Math.abs(totalWeight - 1) > 0.001) {
      console.warn(`步骤权重总和应为1，当前为 ${totalWeight}`)
    }
    
    this.steps = steps
    this.onProgressUpdate = onProgressUpdate
  }

  /**
   * 开始下一个步骤
   */
  startNextStep(): void {
    // 记录上一个步骤的结束时间
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      const previousStep = this.steps[this.currentStepIndex]
      const duration = Date.now() - this.stepStartTime
      this.stepTimings.set(previousStep.name, duration)
    }

    this.currentStepIndex++
    if (this.currentStepIndex >= this.steps.length) {
      console.warn('所有步骤已完成')
      return
    }

    // 记录新步骤的开始时间
    this.stepStartTime = Date.now()
  }

  /**
   * 更新当前步骤的进度
   * @param stepProgress 当前步骤的进度 (0-100)
   */
  updateStepProgress(stepProgress: number): void {
    if (this.currentStepIndex < 0 || this.currentStepIndex >= this.steps.length) {
      return
    }

    const currentStep = this.steps[this.currentStepIndex]
    
    // 计算之前所有步骤的累积进度
    const previousStepsProgress = this.steps
      .slice(0, this.currentStepIndex)
      .reduce((sum, step) => sum + step.weight, 0)
    
    // 当前步骤的进度贡献
    const currentStepProgress = (stepProgress / 100) * currentStep.weight
    
    // 总进度 = 之前步骤进度 + 当前步骤进度
    const totalProgress = (previousStepsProgress + currentStepProgress) * 100
    
    this.onProgressUpdate(Math.min(100, Math.floor(totalProgress)))
  }

  /**
   * 完成当前步骤（设置为100%）
   */
  completeCurrentStep(): void {
    this.updateStepProgress(100)
    
    // 记录当前步骤的用时
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      const currentStep = this.steps[this.currentStepIndex]
      const duration = Date.now() - this.stepStartTime
      this.stepTimings.set(currentStep.name, duration)
    }
  }

  /**
   * 获取步骤计时统计信息
   */
  getTimingStats(): StepTimingInfo[] {
    const totalDuration = Array.from(this.stepTimings.values()).reduce((sum, d) => sum + d, 0)
    
    return this.steps.map(step => {
      const duration = this.stepTimings.get(step.name) || 0
      const percentage = totalDuration > 0 ? (duration / totalDuration) * 100 : 0
      
      return {
        name: step.name,
        duration,
        percentage
      }
    }).filter(info => info.duration > 0) // 只返回已执行的步骤
  }

  /**
   * 格式化时长为易读字符串
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`
    } else {
      const minutes = Math.floor(ms / 60000)
      const seconds = ((ms % 60000) / 1000).toFixed(1)
      return `${minutes}m ${seconds}s`
    }
  }

  /**
   * 重置进度管理器
   */
  reset(): void {
    this.currentStepIndex = -1
    this.stepStartTime = 0
    this.stepTimings.clear()
    this.onProgressUpdate(0)
  }
}

/**
 * 创建默认的处理步骤配置
 * 可以根据实际情况调整权重
 */
export function createDefaultSteps(): ProgressStep[] {
  return [
    { name: 'videoToFrames', weight: 0.9 },      // 视频提取帧：90%
    { name: 'cycleDetect', weight: 0.005 },      // 循环检测：0.5%
    { name: 'frameRateDetect', weight: 0.005 },  // 帧率检测：0.5%
    { name: 'backgroundDetect', weight: 0.005 }, // 背景识别：0.5%
    { name: 'crop', weight: 0.065 },             // 裁剪：6.5%
    { name: 'resize', weight: 0.005 },           // 缩放：0.5%
    { name: 'colorReplacement', weight: 0.005 }, // 颜色替换：0.5%
    { name: 'framesToGif', weight: 0.01 },       // GIF生成：1%
  ]
}
