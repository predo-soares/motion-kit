import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Mesh, Program, RenderTarget, Renderer, Triangle, Vec2, Vec3 } from "ogl"
import { toLinearRgb, type ColorRepresentation } from "@/lib/helpers/color"
import { updateFluidPointerState, type FluidPointerState } from "@/lib/helpers/fluid-pointer"

type DoubleFBO = { read: RenderTarget; write: RenderTarget; swap(): void }

const VERTEX = `
  attribute vec2 uv; attribute vec2 position; varying vec2 vUv;
  varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
  uniform vec2 uTexel;
  void main() {
    vUv = uv; vL = vUv - vec2(uTexel.x, 0.); vR = vUv + vec2(uTexel.x, 0.);
    vT = vUv + vec2(0., uTexel.y); vB = vUv - vec2(0., uTexel.y);
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const ADVECTION = `
  precision highp float; varying vec2 vUv;
  uniform sampler2D uVelocity; uniform sampler2D uInput; uniform vec2 uTexel; uniform float uDt; uniform float uDissipation;
  vec4 bilerp(sampler2D s, vec2 uv, vec2 ts) {
    vec2 st = uv / ts - 0.5; vec2 iuv = floor(st); vec2 fuv = fract(st);
    vec4 a = texture2D(s, (iuv + vec2(.5,.5)) * ts); vec4 b = texture2D(s, (iuv + vec2(1.5,.5)) * ts);
    vec4 c = texture2D(s, (iuv + vec2(.5,1.5)) * ts); vec4 d = texture2D(s, (iuv + vec2(1.5,1.5)) * ts);
    return mix(mix(a,b,fuv.x), mix(c,d,fuv.x), fuv.y);
  }
  void main() {
    vec2 coord = vUv - uDt * bilerp(uVelocity, vUv, uTexel).xy * uTexel;
    gl_FragColor = uDissipation * bilerp(uInput, coord, uTexel); gl_FragColor.a = 1.;
  }
`
const DIVERGENCE = `
  precision highp float; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
  uniform sampler2D uVelocity;
  void main() {
    float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y;
    gl_FragColor = vec4(.6 * (R - L + T - B), 0., 0., 1.);
  }
`
const PRESSURE = `
  precision highp float; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
  uniform sampler2D uPressure; uniform sampler2D uDivergence;
  void main() {
    float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;
    float div=texture2D(uDivergence,vUv).x;
    gl_FragColor = vec4((L+R+B+T-div)*.25, 0., 0., 1.);
  }
`
const GRADIENT = `
  precision highp float; varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
  uniform sampler2D uPressure; uniform sampler2D uVelocity;
  void main() {
    float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;
    vec2 vel=texture2D(uVelocity,vUv).xy; vel.xy-=vec2(R-L,T-B);
    gl_FragColor=vec4(vel,0.,1.);
  }
`
const SPLAT = `
  precision highp float; varying vec2 vUv;
  uniform sampler2D uInput; uniform float uRatio; uniform vec3 uPointValue; uniform vec2 uPoint; uniform float uPointSize;
  void main() {
    vec2 p=vUv-uPoint.xy; p.x*=uRatio;
    vec3 splat=pow(2.,-dot(p,p)/uPointSize)*uPointValue;
    gl_FragColor=vec4(texture2D(uInput,vUv).xyz+splat, 1.);
  }
`
const OUTPUT_V = `attribute vec2 uv; attribute vec2 position; varying vec2 vUv; void main() { vUv=uv; gl_Position=vec4(position,0.,1.); }`
const OUTPUT_F = `
  precision highp float; varying vec2 vUv; uniform sampler2D uTexture; uniform vec3 uBackground;
  vec3 lin2srgb(vec3 c) { vec3 s=max(c,vec3(0.)); vec3 lo=s*12.92; vec3 hi=1.055*pow(s,vec3(1./2.4))-.055; return mix(lo,hi,step(vec3(.0031308),s)); }
  void main() {
    vec3 C=texture2D(uTexture,vUv).rgb;
    float a=clamp(max(C.r,max(C.g,C.b)),0.,1.);
    vec2 centered=vUv-vec2(.5);
    float vignette=1.-smoothstep(.18,.78,length(centered));
    vec3 base=uBackground*(.9+.1*vignette);
    vec3 mixed=clamp(base+C,0.,1.);
    gl_FragColor=vec4(lin2srgb(mixed),1.);
  }
`

@customElement("motion-fluid-simulation")
export class MotionFluidSimulation extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property({ type: Number }) dissipation = 0.96
  @property({ type: Number, attribute: "pointer-size" }) pointerSize = 0.005
  @property() color: ColorRepresentation = "#ff6900"
  @property({ attribute: "background-color" }) backgroundColor: ColorRepresentation = "#17181A"
  @property({ type: Number, attribute: "velocity-dissipation" }) velocityDissipation = 0.96
  @property({ type: Number, attribute: "pressure-iterations" }) pressureIterations = 10

  private _raf = 0
  private _cancelled = false

  override firstUpdated() {
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cancelled = true
    cancelAnimationFrame(this._raf)
  }

  replay() {
    this._cancelled = true
    cancelAnimationFrame(this._raf)
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  private _init(canvas: HTMLCanvasElement) {
    this._cancelled = false
    const renderer = new Renderer({ canvas, alpha: true, dpr: window.devicePixelRatio })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    canvas.style.width = "100%"
    canvas.style.height = "100%"

    const halfFloatExt = (gl.renderer.extensions as any)["OES_texture_half_float"] as { HALF_FLOAT_OES: number } | undefined
    const textureType = gl.renderer.isWebgl2 ? (gl as any).HALF_FLOAT : (halfFloatExt?.HALF_FLOAT_OES ?? gl.FLOAT)
    const internalFormat = gl.renderer.isWebgl2
      ? textureType === gl.FLOAT ? (gl as any).RGBA32F : (gl as any).RGBA16F
      : gl.RGBA

    const mkFBO = (w: number, h: number) => new RenderTarget(gl, { width: w, height: h, type: textureType, format: gl.RGBA, internalFormat, minFilter: gl.NEAREST, magFilter: gl.NEAREST, depth: false, stencil: false })
    const mkDouble = (w: number, h: number): DoubleFBO => {
      const d = { read: mkFBO(w, h), write: mkFBO(w, h), swap() { const t = d.read; d.read = d.write; d.write = t } }
      return d
    }

    const SIM = 128
    const density = mkDouble(SIM, SIM), velocity = mkDouble(SIM, SIM), pressure = mkDouble(SIM, SIM)
    const divergence = mkFBO(SIM, SIM)
    const texel = new Vec2(1 / SIM, 1 / SIM)
    const pointerUv = new Vec2()
    const [sr, sg, sb] = toLinearRgb(this.color, [1, 105 / 255, 0])
    const [br, bg, bb] = toLinearRgb(this.backgroundColor, [23 / 255, 24 / 255, 26 / 255])
    const splatColor = new Vec3(sr, sg, sb)
    const backgroundColor = new Vec3(br, bg, bb)

    const pointer: FluidPointerState = { x: 0, y: 0, dx: 0, dy: 0, moved: false, initialized: false }
    const preview = { enabled: true, timeMs: 0 }

    const advU = { uVelocity: { value: velocity.read.texture }, uInput: { value: velocity.read.texture }, uTexel: { value: texel }, uDt: { value: 1 / 60 }, uDissipation: { value: this.velocityDissipation } }
    const divU = { uVelocity: { value: velocity.read.texture }, uTexel: { value: texel } }
    const presU = { uPressure: { value: pressure.read.texture }, uDivergence: { value: divergence.texture }, uTexel: { value: texel } }
    const gradU = { uPressure: { value: pressure.read.texture }, uVelocity: { value: velocity.read.texture }, uTexel: { value: texel } }
    const splatU = { uInput: { value: velocity.read.texture }, uRatio: { value: 1 }, uPointValue: { value: new Vec3() }, uPoint: { value: pointerUv }, uPointSize: { value: this.pointerSize }, uTexel: { value: texel } }
    const outU = { uTexture: { value: density.read.texture }, uBackground: { value: backgroundColor } }

    const mkProg = (frag: string, unis: any) => new Program(gl, { vertex: VERTEX, fragment: frag, uniforms: unis, depthTest: false, depthWrite: false })
    const advProg = mkProg(ADVECTION, advU), divProg = mkProg(DIVERGENCE, divU), presProg = mkProg(PRESSURE, presU), gradProg = mkProg(GRADIENT, gradU), splatProg = mkProg(SPLAT, splatU)
    const outProg = new Program(gl, { vertex: OUTPUT_V, fragment: OUTPUT_F, uniforms: outU, depthTest: false, depthWrite: false, transparent: true })

    const tri = new Triangle(gl)
    const simMesh = new Mesh(gl, { geometry: tri, program: advProg })
    const outMesh = new Mesh(gl, { geometry: tri, program: outProg })

    const pass = (prog: Program, target: RenderTarget) => { simMesh.program = prog; renderer.render({ scene: simMesh, target, clear: true }) }

    const metrics = { w: 1, h: 1 }

    const updatePtr = (px: number, py: number, w: number, h: number) => {
      updateFluidPointerState({ state: pointer, uv: pointerUv, x: px, y: py, width: w, height: h, forceClamp: 450, initialLerp: 0.2, lerp: 0.55 })
    }

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      const wasPreview = preview.enabled; preview.enabled = false
      if (wasPreview) { pointer.initialized = false; pointer.dx = 0; pointer.dy = 0 }
      updatePtr(e.clientX - r.left, e.clientY - r.top, r.width, r.height)
    }
    const onTouch = (e: TouchEvent) => {
      e.preventDefault()
      const t = e.touches[0]; if (!t) return
      const r = canvas.getBoundingClientRect()
      const wasPreview = preview.enabled; preview.enabled = false
      if (wasPreview) { pointer.initialized = false; pointer.dx = 0; pointer.dy = 0 }
      updatePtr(t.clientX - r.left, t.clientY - r.top, r.width, r.height)
    }
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("touchmove", onTouch, { passive: false })

    let prev = 0, pendingW = 0, pendingH = 0, resizeTimer = 0

    const resizeSim = (w: number, h: number) => {
      const sx = Math.max(1, Math.floor(w * 0.5)), sy = Math.max(1, Math.floor(h * 0.5))
      if (sx > density.read.width || sy > density.read.height) {
        for (const d of [density, velocity, pressure]) { d.read.setSize(sx, sy); d.write.setSize(sx, sy) }
        divergence.setSize(sx, sy)
      }
      texel.set(1 / density.read.width, 1 / density.read.height)
      if (w > 0 && h > 0) pointerUv.set(pointer.x / w, 1 - pointer.y / h)
    }

    const tick = (now: number) => {
      if (this._cancelled) return
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
      const bw = Math.round(w * renderer.dpr), bh = Math.round(h * renderer.dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw; canvas.height = bh; renderer.width = w; renderer.height = h
        renderer.state.viewport = { x: 0, y: 0, width: null as any, height: null as any }
        metrics.w = w; metrics.h = h; pendingW = w; pendingH = h
        clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => resizeSim(pendingW, pendingH), 150)
      }
      const delta = prev ? (now - prev) / 1000 : 0; prev = now
      const cw = metrics.w || 1, ch = metrics.h || 1, aspect = cw / ch

      if (preview.enabled) {
        preview.timeMs += delta * 1000
        const px = (0.5 - 0.45 * Math.sin(0.003 * preview.timeMs - 2)) * cw
        const py = (0.5 + 0.1 * Math.sin(0.0025 * preview.timeMs) + 0.1 * Math.cos(0.002 * preview.timeMs)) * ch
        updatePtr(px, py, cw, ch)
      }

      const [sr, sg, sb] = toLinearRgb(this.color, [1, 105 / 255, 0])
      splatColor.set(sr, sg, sb)
      const [br, bg, bb] = toLinearRgb(this.backgroundColor, [23 / 255, 24 / 255, 26 / 255])
      backgroundColor.set(br, bg, bb)

      if (pointer.moved) {
        splatU.uInput.value = velocity.read.texture; splatU.uRatio.value = aspect
        splatU.uPoint.value.set(pointerUv.x, pointerUv.y); splatU.uPointValue.value.set(pointer.dx, -pointer.dy, 1)
        splatU.uPointSize.value = this.pointerSize; pass(splatProg, velocity.write); velocity.swap()

        splatU.uInput.value = density.read.texture; splatU.uPointValue.value.set(splatColor.x, splatColor.y, splatColor.z)
        pass(splatProg, density.write); density.swap()

        if (!preview.enabled) pointer.moved = false
      }

      divU.uVelocity.value = velocity.read.texture; pass(divProg, divergence)
      presU.uDivergence.value = divergence.texture
      const iters = Math.max(0, Math.floor(this.pressureIterations))
      for (let i = 0; i < iters; i++) { presU.uPressure.value = pressure.read.texture; pass(presProg, pressure.write); pressure.swap() }
      gradU.uPressure.value = pressure.read.texture; gradU.uVelocity.value = velocity.read.texture; pass(gradProg, velocity.write); velocity.swap()

      advU.uDt.value = 1 / 60; advU.uVelocity.value = velocity.read.texture; advU.uInput.value = velocity.read.texture; advU.uDissipation.value = this.velocityDissipation
      pass(advProg, velocity.write); velocity.swap()

      advU.uVelocity.value = velocity.read.texture; advU.uInput.value = density.read.texture; advU.uDissipation.value = this.dissipation
      pass(advProg, density.write); density.swap()

      outU.uTexture.value = density.read.texture
      renderer.render({ scene: outMesh, clear: true })
      this._raf = requestAnimationFrame(tick)
    }
    this._raf = requestAnimationFrame(tick)
  }

  override render() {
    return html`<canvas></canvas>`
  }
}
