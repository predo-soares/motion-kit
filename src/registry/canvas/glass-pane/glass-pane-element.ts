import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Camera, Mesh, Program, Renderer, Texture, Transform, Triangle, Vec2 } from "ogl"

@customElement("motion-glass-pane")
export class MotionGlassPane extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property() image = ""
  @property({ type: Number }) rotation = 0
  @property({ type: Number }) refraction = 1
  @property({ type: Number, attribute: "chromatic-aberration" }) chromaticAberration = 1
  @property({ type: Number, attribute: "panel-width" }) panelWidth = 0.82
  @property({ type: Number, attribute: "wave-frequency" }) waveFrequency = 0.0
  @property({ type: Number, attribute: "wave-amplitude" }) waveAmplitude = 0.0
  @property({ type: Number }) speed = 0.65

  private _raf = 0
  private _cancelled = false
  private _uniforms?: {
    uRotation: { value: number }; uRefraction: { value: number }; uChromaticAberration: { value: number }
    uPanelWidth: { value: number }; uWaveFrequency: { value: number }; uWaveAmplitude: { value: number }
  }
  private _setImage?: (src: string) => void

  override firstUpdated() {
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cancelled = true
    cancelAnimationFrame(this._raf)
  }

  override updated(changed: Map<string, unknown>) {
    if (!this._uniforms) return
    if (changed.has("rotation")) this._uniforms.uRotation.value = this.rotation
    if (changed.has("refraction")) this._uniforms.uRefraction.value = this.refraction
    if (changed.has("chromaticAberration")) this._uniforms.uChromaticAberration.value = this.chromaticAberration
    if (changed.has("panelWidth")) this._uniforms.uPanelWidth.value = this.panelWidth
    if (changed.has("waveFrequency")) this._uniforms.uWaveFrequency.value = this.waveFrequency
    if (changed.has("waveAmplitude")) this._uniforms.uWaveAmplitude.value = this.waveAmplitude
    if (changed.has("image") && this._setImage) this._setImage(this.image)
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

    const camera = new Camera(gl)
    camera.position.z = 1
    const scene = new Transform()
    const geometry = new Triangle(gl)

    const imageTexture = new Texture(gl, { image: new Uint8Array([0, 0, 0, 255]), width: 1, height: 1, format: gl.RGBA, type: gl.UNSIGNED_BYTE, minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE, generateMipmaps: false, flipY: true })
    const textureSize = new Vec2(1, 1)

    const localUniforms = {
      uTime: { value: 0 },
      uResolution: { value: new Vec2(1, 1) },
      uTextureSize: { value: textureSize },
      uTexture: { value: imageTexture },
      uRotation: { value: this.rotation },
      uRefraction: { value: this.refraction },
      uChromaticAberration: { value: this.chromaticAberration },
      uPanelWidth: { value: this.panelWidth },
      uWaveFrequency: { value: this.waveFrequency },
      uWaveAmplitude: { value: this.waveAmplitude },
    }
    this._uniforms = localUniforms

    let imgToken = 0
    this._setImage = (src: string) => {
      imgToken++; const tok = imgToken
      const img = new Image(); img.crossOrigin = "anonymous"; img.decoding = "async"
      img.onload = () => { if (tok !== imgToken) return; imageTexture.image = img; textureSize.set(img.naturalWidth || 1, img.naturalHeight || 1) }
      img.src = src
    }
    if (this.image) this._setImage(this.image)

    const program = new Program(gl, {
      vertex: `attribute vec2 uv; attribute vec2 position; varying vec2 vUv; void main() { vUv=uv; gl_Position=vec4(position,0.,1.); }`,
      fragment: `
        precision highp float;
        uniform float uTime,uRotation,uRefraction,uChromaticAberration,uPanelWidth,uWaveFrequency,uWaveAmplitude;
        uniform vec2 uResolution,uTextureSize; uniform sampler2D uTexture;
        varying vec2 vUv;
        const float PI=3.141592653589793;
        vec2 rotate2(vec2 p,float a){ float c=cos(a),s=sin(a); return vec2(p.x*c-p.y*s,p.x*s+p.y*c); }
        vec2 coverUV(vec2 uv,vec2 texSize){
          vec2 s=uResolution/max(texSize,vec2(1.)); float sc=max(s.x,s.y);
          vec2 ss=texSize*sc; vec2 off=(uResolution-ss)*.5; return(uv*uResolution-off)/ss;
        }
        vec2 transformUv(vec2 uv,float aspect,float rotation){
          vec2 centered=vec2((uv.x-.5)*aspect,uv.y-.5);
          vec2 t=rotate2(centered,-rotation); return vec2(t.x/aspect+.5,t.y+.5);
        }
        vec4 panelOptics(vec2 uv,float pw,float wf,float wa){
          float aspect=uResolution.x/max(uResolution.y,1.);
          float cosA=1.,sinA=0.;
          vec2 centered=uv-vec2(.5); vec2 asp=vec2(centered.x*aspect,centered.y);
          float u=asp.x*cosA+asp.y*sinA;
          float v=-asp.x*sinA+asp.y*cosA;
          float frequency=9.02/max(pw,.001);
          float cell=fract((u+sin(v*wf*PI*2.)*wa)*frequency)-.5;
          float cellPos=cell*2.;
          float slope=sign(cellPos)*pow(max(abs(cellPos),.0001),3.);
          float refrU=-(slope*3.37)*(.5/frequency);
          return vec4(cellPos,slope,refrU,frequency);
        }
        vec3 imageField(vec2 uv){ return texture2D(uTexture,coverUV(uv,uTextureSize)).rgb; }
        vec3 refractedImage(vec2 uv,vec2 chroma){ return vec3(imageField(uv+chroma).r,imageField(uv).g,imageField(uv-chroma).b); }
        void main(){
          float aspect=uResolution.x/max(uResolution.y,1.);
          vec2 effectUv=transformUv(vUv,aspect,radians(uRotation));
          float animWave=uWaveAmplitude*(.75+.25*sin(uTime*.22));
          vec4 optics=panelOptics(effectUv,uPanelWidth,uWaveFrequency,animWave);
          float refrU=optics.z*uRefraction;
          float cosR=cos(0.),sinR=sin(0.);
          vec2 refractedUv=vec2(vUv.x+(refrU*cosR)/aspect, vUv.y+refrU*sinR);
          float chromaU=refrU*.15*uChromaticAberration;
          vec2 chroma=vec2((chromaU*cosR)/aspect,chromaU*sinR);
          vec3 color=refractedImage(refractedUv,chroma);
          float slope=optics.y;
          float nz=sqrt(1.-min(slope*slope,1.));
          float halfLight=(-90.*PI/180.)*.5;
          float hx=sin(halfLight),hy=cos(halfLight);
          float nDotH=max(slope*hx+nz*hy,0.);
          float shininess=exp2(8.-.11*7.);
          float fresnel=pow(1.-nz,5.);
          float spec=pow(nDotH,shininess)*(.04+.96*fresnel)*2.*max(uRefraction,0.);
          vec3 finalColor=clamp(color+vec3(spec),vec3(0.),vec3(1.));
          gl_FragColor=vec4(finalColor,1.);
        }
      `,
      uniforms: localUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })

    const mesh = new Mesh(gl, { geometry, program })
    mesh.setParent(scene)

    let prev = 0
    const tick = (now: number) => {
      if (this._cancelled) return
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
      const bw = Math.round(w * renderer.dpr), bh = Math.round(h * renderer.dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw; canvas.height = bh; renderer.width = w; renderer.height = h
        renderer.state.viewport = { x: 0, y: 0, width: null as any, height: null as any }
        localUniforms.uResolution.value.set(w, h)
      }
      const delta = prev ? (now - prev) / 1000 : 0; prev = now
      localUniforms.uTime.value += delta * this.speed
      renderer.render({ scene, camera })
      this._raf = requestAnimationFrame(tick)
    }
    this._raf = requestAnimationFrame(tick)
  }

  override render() {
    return html`<canvas></canvas>`
  }
}
