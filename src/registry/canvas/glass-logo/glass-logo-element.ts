import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Camera, Mesh, Program, Renderer, Texture, Transform, Triangle, Vec2, Vec3 } from "ogl"
import { toRgb, type ColorRepresentation } from "@/lib/helpers/color"
import { buildSvgSdf, defaultLogoSvg } from "@/lib/helpers/svg-sdf"

@customElement("motion-glass-logo")
export class MotionGlassLogo extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property({ attribute: "svg-source" }) svgSource = defaultLogoSvg
  @property({ type: Number }) speed = 1
  @property({ type: Number }) scale = 1
  @property({ type: Number, attribute: "offset-x" }) offsetX = 0
  @property({ type: Number, attribute: "offset-y" }) offsetY = 0
  @property({ type: Number }) rotation = 0
  @property({ type: Number }) refraction = 1
  @property({ type: Number, attribute: "chromatic-aberration" }) chromaticAberration = 1
  @property({ type: Number }) blur = 1
  @property({ attribute: "swirl-color-a" }) swirlColorA: ColorRepresentation = "#222326"
  @property({ attribute: "swirl-color-b" }) swirlColorB: ColorRepresentation = "#ff6900"

  private _raf = 0
  private _cancelled = false
  private _uniforms?: {
    uSpeed: { value: number }; uScale: { value: number }; uOffset: { value: Vec2 }
    uRotation: { value: number }; uRefraction: { value: number }; uChromaticAberration: { value: number }
    uBlur: { value: number }; uSwirlColorA: { value: Vec3 }; uSwirlColorB: { value: Vec3 }
  }
  private _setSvg?: (src: string) => void

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
    if (changed.has("speed")) this._uniforms.uSpeed.value = this.speed
    if (changed.has("scale")) this._uniforms.uScale.value = this.scale
    if (changed.has("offsetX") || changed.has("offsetY")) this._uniforms.uOffset.value.set(this.offsetX, this.offsetY)
    if (changed.has("rotation")) this._uniforms.uRotation.value = this.rotation
    if (changed.has("refraction")) this._uniforms.uRefraction.value = this.refraction
    if (changed.has("chromaticAberration")) this._uniforms.uChromaticAberration.value = this.chromaticAberration
    if (changed.has("blur")) this._uniforms.uBlur.value = this.blur
    if (changed.has("swirlColorA")) { const [r, g, b] = toRgb(this.swirlColorA, [0.006, 0.006, 0.005]); this._uniforms.uSwirlColorA.value.set(r, g, b) }
    if (changed.has("swirlColorB")) { const [r, g, b] = toRgb(this.swirlColorB, [1, 105 / 255, 0]); this._uniforms.uSwirlColorB.value.set(r, g, b) }
    if (changed.has("svgSource") && this._setSvg) this._setSvg(this.svgSource)
  }

  replay() {
    this._cancelled = true
    cancelAnimationFrame(this._raf)
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  private _init(canvas: HTMLCanvasElement) {
    this._cancelled = false
    const renderer = new Renderer({ canvas, alpha: true, antialias: true, dpr: Math.min(window.devicePixelRatio, 2), webgl: 2 })
    const gl = renderer.gl
    const webgl2 = gl as WebGL2RenderingContext
    gl.clearColor(0, 0, 0, 0)
    canvas.style.width = "100%"
    canvas.style.height = "100%"

    const camera = new Camera(gl)
    camera.position.z = 1
    const scene = new Transform()
    const geometry = new Triangle(gl)

    const sdfTexture = new Texture(gl, {
      image: new Float32Array([1]), width: 1, height: 1,
      format: webgl2.RED, internalFormat: webgl2.R32F, type: gl.FLOAT,
      minFilter: gl.NEAREST, magFilter: gl.NEAREST, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE,
      generateMipmaps: false, flipY: false, unpackAlignment: 1,
    })

    const [ar, ag, ab] = toRgb(this.swirlColorA, [0.006, 0.006, 0.005])
    const [br, bg, bb] = toRgb(this.swirlColorB, [1, 105 / 255, 0])
    const localUniforms = {
      uResolution: { value: new Vec2(1, 1) },
      uTime: { value: 0 },
      uSdf: { value: sdfTexture },
      uSpeed: { value: this.speed },
      uScale: { value: this.scale },
      uOffset: { value: new Vec2(this.offsetX, this.offsetY) },
      uRotation: { value: this.rotation },
      uRefraction: { value: this.refraction },
      uChromaticAberration: { value: this.chromaticAberration },
      uBlur: { value: this.blur },
      uSwirlColorA: { value: new Vec3(ar, ag, ab) },
      uSwirlColorB: { value: new Vec3(br, bg, bb) },
    }
    this._uniforms = localUniforms

    let svgToken = 0, currentSvg = ""
    this._setSvg = async (src: string) => {
      if (src === currentSvg) return
      currentSvg = src; svgToken++; const tok = svgToken
      try {
        const sdf = await buildSvgSdf(src)
        if (tok !== svgToken) return
        sdfTexture.image = sdf.data; sdfTexture.width = sdf.width; sdfTexture.height = sdf.height; sdfTexture.needsUpdate = true
      } catch (e) { console.error("GlassLogo SDF error", e) }
    }
    void this._setSvg(this.svgSource)

    const program = new Program(gl, {
      vertex: `#version 300 es\nin vec2 uv; in vec2 position; out vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`,
      fragment: `#version 300 es
        precision highp float;
        uniform vec2 uResolution; uniform float uTime; uniform sampler2D uSdf;
        uniform float uSpeed,uScale,uRotation,uRefraction,uChromaticAberration,uBlur;
        uniform vec2 uOffset; uniform vec3 uSwirlColorA,uSwirlColorB;
        in vec2 vUv; out vec4 outColor;
        const float PI = 3.141592653589793;
        vec3 swirl(vec2 uv) {
          float t=uTime*.5; float detail=4.2;
          vec2 d1=vec2(uv.x+sin(uv.y*detail*1.7+t*.8)*.12+cos(uv.x*detail*.9-t*.5)*.05, uv.y+cos(uv.x*detail*1.3-t*.6)*.12+sin(uv.y*detail*1.1+t*.7)*.05);
          float p1=sin(d1.x*detail*2.1+d1.y*detail*1.8+t*.4);
          vec2 d2=vec2(d1.x+cos(d1.y*detail*2.7-t*.45)*.07+sin(d1.x*detail*1.9+t*.6)*.04, d1.y+sin(d1.x*detail*2.3+t*.65)*.07+cos(d1.y*detail*1.6-t*.4)*.04);
          float p2=cos(d2.x*detail*1.4-d2.y*detail*1.9+t*.35);
          float combined=p1*.45+p2*.35;
          float blend=smoothstep(.3,.7,combined*.5+.5-.192);
          float shimmer=sin(t*2.5+combined*8.)*.015+1.;
          return mix(uSwirlColorA,uSwirlColorB,blend)*shimmer;
        }
        float sdfAt(vec2 uv) {
          if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.) return 1.;
          vec2 size=vec2(textureSize(uSdf,0)); vec2 texel=uv*size-.5;
          vec2 base=floor(texel); vec2 f=fract(texel);
          ivec2 p0=ivec2(clamp(base,vec2(0.),size-1.));
          ivec2 p1=ivec2(clamp(base+vec2(1.,0.),vec2(0.),size-1.));
          ivec2 p2=ivec2(clamp(base+vec2(0.,1.),vec2(0.),size-1.));
          ivec2 p3=ivec2(clamp(base+vec2(1.,1.),vec2(0.),size-1.));
          float a=texelFetch(uSdf,p0,0).r,b=texelFetch(uSdf,p1,0).r,c=texelFetch(uSdf,p2,0).r,d=texelFetch(uSdf,p3,0).r;
          return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
        }
        vec3 blurredSwirl(vec2 uv) {
          vec2 px=1./uResolution; float br=40.*uBlur; vec3 acc=vec3(0.);
          acc+=swirl(uv+px*vec2(0.,0.)*br); acc+=swirl(uv+px*vec2(-.737,.675)*br); acc+=swirl(uv+px*vec2(.087,-.996)*br);
          acc+=swirl(uv+px*vec2(.608,.794)*br); acc+=swirl(uv+px*vec2(-.985,-.174)*br); acc+=swirl(uv+px*vec2(.844,-.537)*br);
          acc+=swirl(uv+px*vec2(-.259,.966)*br); acc+=swirl(uv+px*vec2(-.460,-.888)*br); acc+=swirl(uv+px*vec2(.940,.342)*br);
          return acc/9.;
        }
        vec4 glass(vec2 uv) {
          float aspect=uResolution.x/uResolution.y;
          vec2 logoUv=uv-vec2(.5)-uOffset; logoUv.x*=aspect;
          float angle=radians(uRotation); mat2 invRot=mat2(cos(angle),sin(angle),-sin(angle),cos(angle));
          logoUv=invRot*logoUv/max(uScale,.0001);
          vec2 sdfUv=vec2(logoUv.x+.5,1.-(logoUv.y+.5));
          float rawSdf=sdfAt(sdfUv); float pxH=1./uResolution.y;
          if(rawSdf>pxH*2.) return vec4(0.);
          float eps=.01;
          float gradX=(sdfAt(sdfUv+vec2(eps,0.))-rawSdf)/eps;
          float gradY=(sdfAt(sdfUv+vec2(0.,eps))-rawSdf)/eps;
          float sharp=.05;
          float rb1=clamp(-rawSdf/sharp*32.,0.,1.);
          float rb2Base=clamp(-(rawSdf-pxH)/sharp*16.,0.,1.)-clamp(-rawSdf/sharp*16.,0.,1.);
          vec2 lightDir=vec2(cos(radians(300.)),sin(radians(300.)));
          float rb2=rb2Base*(dot(vec2(gradX,gradY),lightDir)*.5+.5)*.3;
          float depthNorm=clamp(-rawSdf/.3,0.,1.);
          float refrStr=(1.-depthNorm)*(1.-depthNorm);
          vec2 offset=vec2(-gradX/aspect,-gradY)*1.57*.15*refrStr*uRefraction;
          vec2 lensUv=vec2(.5)+(uv-vec2(.5))+offset;
          vec2 chroma=offset*.06*uChromaticAberration;
          vec3 blurred=vec3(blurredSwirl(lensUv+chroma).r,blurredSwirl(lensUv).g,blurredSwirl(lensUv-chroma).b);
          vec3 n=normalize(vec3(gradX,gradY,2.)); vec3 h=normalize(vec3(lightDir,2.));
          float shininess=exp2(8.-.5*7.);
          float spec=pow(clamp(dot(n,h),0.,1.),shininess)*.3*refrStr;
          float fresnelDepth=clamp(-rawSdf/max(.31*.06,.001),0.,1.);
          float fresnel=pow(1.-fresnelDepth,2.)*.02*rb1;
          vec3 lighting=blurred+vec3(rb2+spec+fresnel);
          float transition=smoothstep(0.,1.,rb1);
          return vec4(mix(swirl(uv),lighting,transition),transition);
        }
        void main() { outColor=glass(vUv); }
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
      localUniforms.uTime.value += delta * localUniforms.uSpeed.value
      renderer.render({ scene, camera })
      this._raf = requestAnimationFrame(tick)
    }
    this._raf = requestAnimationFrame(tick)
  }

  override render() {
    return html`<canvas></canvas>`
  }
}
