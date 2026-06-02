import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Mesh, Program, RenderTarget, Renderer, Texture, Triangle, Vec2, Vec3 } from "ogl"
import { updateFluidPointerState, type FluidPointerState } from "@/lib/helpers/fluid-pointer"

type DoubleFBO = { read: RenderTarget; write: RenderTarget; swap(): void }

const VERTEX = `
  attribute vec2 uv; attribute vec2 position; varying vec2 vUv;
  varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB; uniform vec2 uTexel;
  void main() {
    vUv=uv; vL=vUv-vec2(uTexel.x,0.); vR=vUv+vec2(uTexel.x,0.);
    vT=vUv+vec2(0.,uTexel.y); vB=vUv-vec2(0.,uTexel.y); gl_Position=vec4(position,0.,1.);
  }
`
const ADVECTION = `
  precision highp float; varying vec2 vUv;
  uniform sampler2D uVelocity,uInput; uniform vec2 uTexel; uniform float uDt,uDissipation;
  vec4 bilerp(sampler2D s,vec2 uv,vec2 ts){vec2 st=uv/ts-.5;vec2 iuv=floor(st);vec2 fuv=fract(st);vec4 a=texture2D(s,(iuv+vec2(.5,.5))*ts);vec4 b=texture2D(s,(iuv+vec2(1.5,.5))*ts);vec4 c=texture2D(s,(iuv+vec2(.5,1.5))*ts);vec4 d=texture2D(s,(iuv+vec2(1.5,1.5))*ts);return mix(mix(a,b,fuv.x),mix(c,d,fuv.x),fuv.y);}
  void main(){vec2 coord=vUv-uDt*bilerp(uVelocity,vUv,uTexel).xy*uTexel;gl_FragColor=uDissipation*bilerp(uInput,coord,uTexel);gl_FragColor.a=1.;}
`
const DIVERGENCE = `
  precision highp float; varying vec2 vL,vR,vT,vB; uniform sampler2D uVelocity;
  void main(){float L=texture2D(uVelocity,vL).x,R=texture2D(uVelocity,vR).x,T=texture2D(uVelocity,vT).y,B=texture2D(uVelocity,vB).y;gl_FragColor=vec4(.6*(R-L+T-B),0.,0.,1.);}
`
const PRESSURE = `
  precision highp float; varying vec2 vUv,vL,vR,vT,vB; uniform sampler2D uPressure,uDivergence;
  void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x,div=texture2D(uDivergence,vUv).x;gl_FragColor=vec4((L+R+B+T-div)*.25,0.,0.,1.);}
`
const GRADIENT = `
  precision highp float; varying vec2 vUv,vL,vR,vT,vB; uniform sampler2D uPressure,uVelocity;
  void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;vec2 vel=texture2D(uVelocity,vUv).xy;vel.xy-=vec2(R-L,T-B);gl_FragColor=vec4(vel,0.,1.);}
`
const SPLAT = `
  precision highp float; varying vec2 vUv; uniform sampler2D uInput; uniform float uRatio,uPointSize; uniform vec3 uPointValue; uniform vec2 uPoint;
  void main(){vec2 p=vUv-uPoint.xy;p.x*=uRatio;vec3 splat=pow(2.,-dot(p,p)/uPointSize)*uPointValue;gl_FragColor=vec4(texture2D(uInput,vUv).xyz+splat,1.);}
`
const OUT_V = `attribute vec2 uv,position; varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,0.,1.);}`
const OUT_F = `
  precision highp float; varying vec2 vUv;
  uniform sampler2D uMaskTexture,uBaseTexture,uRevealTexture;
  uniform vec2 uResolution,uBaseTextureSize,uRevealTextureSize,uMaskTexel;
  uniform float uBlendSoftness;
  vec2 coverUV(vec2 uv,vec2 sz){vec2 s=uResolution/max(sz,vec2(1.));float sc=max(s.x,s.y);vec2 ss=sz*sc;vec2 off=(uResolution-ss)*.5;return(uv*uResolution-off)/ss;}
  float sampleMask(vec2 uv){vec3 m=texture2D(uMaskTexture,uv).rgb;return clamp(max(m.r,max(m.g,m.b)),0.,1.);}
  float smoothMask(vec2 uv){
    vec2 t=uMaskTexel; float m=0.;
    m+=sampleMask(uv+vec2(-t.x,-t.y))*1.;m+=sampleMask(uv+vec2(0.,-t.y))*2.;m+=sampleMask(uv+vec2(t.x,-t.y))*1.;
    m+=sampleMask(uv+vec2(-t.x,0.))*2.;m+=sampleMask(uv)*4.;m+=sampleMask(uv+vec2(t.x,0.))*2.;
    m+=sampleMask(uv+vec2(-t.x,t.y))*1.;m+=sampleMask(uv+vec2(0.,t.y))*2.;m+=sampleMask(uv+vec2(t.x,t.y))*1.;
    return m/16.;
  }
  void main(){
    vec2 baseUv=coverUV(vUv,uBaseTextureSize);vec2 revUv=coverUV(vUv,uRevealTextureSize);
    vec3 base=texture2D(uBaseTexture,baseUv).rgb;vec3 rev=texture2D(uRevealTexture,revUv).rgb;
    float raw=smoothMask(vUv);float soft=clamp(uBlendSoftness,.01,.49);
    float mask=smoothstep(.5-soft,.5+soft,raw);
    gl_FragColor=vec4(mix(base,rev,mask),1.);
  }
`

@customElement("motion-fluid-image-reveal")
export class MotionFluidImageReveal extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property({ attribute: "base-image" }) baseImage = ""
  @property({ attribute: "reveal-image" }) revealImage = ""
  @property({ type: Number }) dissipation = 0.96
  @property({ type: Number, attribute: "pointer-size" }) pointerSize = 0.005
  @property({ type: Number, attribute: "velocity-dissipation" }) velocityDissipation = 0.96
  @property({ type: Number, attribute: "pressure-iterations" }) pressureIterations = 10
  @property({ type: Number, attribute: "blend-softness" }) blendSoftness = 0.22

  private _raf = 0
  private _cancelled = false
  private _setBase?: (src: string) => void
  private _setReveal?: (src: string) => void

  override firstUpdated() {
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cancelled = true
    cancelAnimationFrame(this._raf)
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("baseImage") && this._setBase) this._setBase(this.baseImage)
    if (changed.has("revealImage") && this._setReveal) this._setReveal(this.revealImage)
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
    const baseSize = new Vec2(1, 1), revealSize = new Vec2(1, 1)

    const mkTex = (pixel: Uint8Array) => new Texture(gl, { image: pixel, width: 1, height: 1, format: gl.RGBA, type: gl.UNSIGNED_BYTE, minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE, generateMipmaps: true, flipY: true })
    const baseTex = mkTex(new Uint8Array([0, 0, 0, 255]))
    const revealTex = mkTex(new Uint8Array([0, 0, 0, 255]))

    const loadTex = (tex: Texture, sizeVec: Vec2, getToken: () => number, setToken: (n: number) => void) => (src: string) => {
      setToken(getToken() + 1); const tok = getToken()
      const img = new Image(); img.crossOrigin = "anonymous"; img.decoding = "async"
      img.onload = () => { if (tok !== getToken()) return; tex.image = img; sizeVec.set(img.naturalWidth || 1, img.naturalHeight || 1) }
      img.src = src
    }
    let baseTok = 0, revealTok = 0
    this._setBase = loadTex(baseTex, baseSize, () => baseTok, n => { baseTok = n })
    this._setReveal = loadTex(revealTex, revealSize, () => revealTok, n => { revealTok = n })

    if (this.baseImage) this._setBase(this.baseImage)
    if (this.revealImage) this._setReveal(this.revealImage)

    const pointer: FluidPointerState = { x: 0, y: 0, dx: 0, dy: 0, moved: false, initialized: false }
    const metrics = { w: 1, h: 1 }
    const outResolution = new Vec2(1, 1)
    const maskTexel = new Vec2(1 / SIM, 1 / SIM)

    const advU = { uVelocity: { value: velocity.read.texture }, uInput: { value: velocity.read.texture }, uTexel: { value: texel }, uDt: { value: 1 / 60 }, uDissipation: { value: this.velocityDissipation } }
    const divU = { uVelocity: { value: velocity.read.texture }, uTexel: { value: texel } }
    const presU = { uPressure: { value: pressure.read.texture }, uDivergence: { value: divergence.texture }, uTexel: { value: texel } }
    const gradU = { uPressure: { value: pressure.read.texture }, uVelocity: { value: velocity.read.texture }, uTexel: { value: texel } }
    const splatU = { uInput: { value: velocity.read.texture }, uRatio: { value: 1 }, uPointValue: { value: new Vec3() }, uPoint: { value: pointerUv }, uPointSize: { value: this.pointerSize }, uTexel: { value: texel } }
    const outU = { uMaskTexture: { value: density.read.texture }, uBaseTexture: { value: baseTex }, uRevealTexture: { value: revealTex }, uResolution: { value: outResolution }, uBaseTextureSize: { value: baseSize }, uRevealTextureSize: { value: revealSize }, uMaskTexel: { value: maskTexel }, uBlendSoftness: { value: this.blendSoftness } }

    const mkProg = (frag: string, unis: any) => new Program(gl, { vertex: VERTEX, fragment: frag, uniforms: unis, depthTest: false, depthWrite: false })
    const advProg = mkProg(ADVECTION, advU), divProg = mkProg(DIVERGENCE, divU), presProg = mkProg(PRESSURE, presU), gradProg = mkProg(GRADIENT, gradU), splatProg = mkProg(SPLAT, splatU)
    const outProg = new Program(gl, { vertex: OUT_V, fragment: OUT_F, uniforms: outU, depthTest: false, depthWrite: false })

    const tri = new Triangle(gl)
    const simMesh = new Mesh(gl, { geometry: tri, program: advProg })
    const outMesh = new Mesh(gl, { geometry: tri, program: outProg })

    const pass = (prog: Program, target: RenderTarget) => { simMesh.program = prog; renderer.render({ scene: simMesh, target, clear: true }) }

    const updatePtr = (px: number, py: number, w: number, h: number) => {
      updateFluidPointerState({ state: pointer, uv: pointerUv, x: px, y: py, width: w, height: h, forceClamp: 450, initialLerp: 0.2, lerp: 0.55 })
    }

    const onMove = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); updatePtr(e.clientX - r.left, e.clientY - r.top, r.width, r.height) }
    const onTouch = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; if (!t) return; const r = canvas.getBoundingClientRect(); updatePtr(t.clientX - r.left, t.clientY - r.top, r.width, r.height) }
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("touchmove", onTouch, { passive: false })

    let pendingW = 0, pendingH = 0, resizeTimer = 0
    const resizeSim = (w: number, h: number) => {
      const sx = Math.max(1, Math.floor(w * 0.5)), sy = Math.max(1, Math.floor(h * 0.5))
      if (sx > density.read.width || sy > density.read.height) {
        for (const d of [density, velocity, pressure]) { d.read.setSize(sx, sy); d.write.setSize(sx, sy) }
        divergence.setSize(sx, sy)
      }
      texel.set(1 / density.read.width, 1 / density.read.height)
      maskTexel.set(1 / density.read.width, 1 / density.read.height)
      if (w > 0 && h > 0) pointerUv.set(pointer.x / w, 1 - pointer.y / h)
    }

    const tick = () => {
      if (this._cancelled) return
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
      const bw = Math.round(w * renderer.dpr), bh = Math.round(h * renderer.dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw; canvas.height = bh; renderer.width = w; renderer.height = h
        renderer.state.viewport = { x: 0, y: 0, width: null as any, height: null as any }
        metrics.w = w; metrics.h = h; outResolution.set(bw, bh); pendingW = w; pendingH = h
        clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => resizeSim(pendingW, pendingH), 150)
      }
      const cw = metrics.w || 1, ch = metrics.h || 1, aspect = cw / ch

      if (pointer.moved) {
        splatU.uInput.value = velocity.read.texture; splatU.uRatio.value = aspect
        splatU.uPoint.value.set(pointerUv.x, pointerUv.y); splatU.uPointValue.value.set(pointer.dx, -pointer.dy, 1)
        splatU.uPointSize.value = this.pointerSize; pass(splatProg, velocity.write); velocity.swap()

        splatU.uInput.value = density.read.texture; splatU.uPointValue.value.set(1, 1, 1)
        pass(splatProg, density.write); density.swap()
        pointer.moved = false
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

      outU.uMaskTexture.value = density.read.texture; outU.uBlendSoftness.value = this.blendSoftness
      renderer.render({ scene: outMesh, clear: true })
      this._raf = requestAnimationFrame(tick)
    }
    this._raf = requestAnimationFrame(tick)
  }

  override render() {
    return html`<canvas></canvas>`
  }
}
