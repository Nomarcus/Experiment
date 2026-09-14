import { DEFAULT_CONFIG, initialState, step, type DetectorState, type Frame, type StepResult } from './breath'

export type MicStatus = 'idle' | 'starting' | 'listening' | 'denied' | 'unsupported' | 'error'

/**
 * Owns the microphone and pushes analyser frames through the detector on every
 * animation frame. Nothing is recorded and nothing leaves the device — the
 * audio graph terminates at the analyser, never at a recorder or a network call.
 */
export class BreathMic {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private analyser: AnalyserNode | null = null
  private bins: Float32Array = new Float32Array(0)
  private raf = 0
  private detector: DetectorState = initialState()

  status: MicStatus = 'idle'

  constructor(private onFrame: (r: StepResult, now: number) => void, private onStatus: (s: MicStatus) => void) {}

  private set(status: MicStatus) {
    this.status = status
    this.onStatus(status)
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.set('unsupported')
      return
    }
    this.set('starting')
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Breath is exactly what these filters are designed to remove.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
    } catch (err) {
      this.set((err as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'error')
      return
    }

    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      const source = this.ctx.createMediaStreamSource(this.stream)
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.3
      source.connect(this.analyser)
      this.bins = new Float32Array(this.analyser.frequencyBinCount)
      this.detector = initialState()
      this.set('listening')
      this.tick()
    } catch {
      this.set('error')
    }
  }

  private tick = () => {
    if (!this.analyser || !this.ctx) return
    this.analyser.getFloatFrequencyData(this.bins as Float32Array<ArrayBuffer>)
    const now = performance.now()
    const frame: Frame = {
      bins: this.bins,
      sampleRate: this.ctx.sampleRate,
      fftSize: this.analyser.fftSize,
      now,
    }
    const result = step(this.detector, frame, DEFAULT_CONFIG)
    this.detector = result.state
    this.onFrame(result, now)
    this.raf = requestAnimationFrame(this.tick)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    this.stream = null
    this.ctx = null
    this.analyser = null
    this.set('idle')
  }
}
