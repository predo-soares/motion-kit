import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Box, Camera, Mesh, Program, Renderer, Texture, Transform } from "ogl"

@customElement("motion-card-3d")
export class MotionCard3D extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
    }
    canvas {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
    }
  `

  @property() image = ""
  @property({ type: Number }) width = 3.2
  @property({ type: Number }) height = 2
  @property({ type: Number }) depth = 0.08
  @property({ type: Number }) radius = 0.15

  private _raf = 0
  private _cancelled = false
  private _smoothRotation = { x: 0, y: 0 }
  private _headPosition = { x: 0, y: 0 }
  private _setImage?: (src: string) => void
  private _disposeWebGL?: () => void

  override firstUpdated() {
    this._start()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._stop()
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("image") && this._setImage) this._setImage(this.image)
  }

  replay() {
    this._stop()
    this._start()
  }

  private _stop() {
    this._cancelled = true
    cancelAnimationFrame(this._raf)
    this._disposeWebGL?.()
    this._disposeWebGL = undefined
    this._setImage = undefined
  }

  private _start() {
    this._cancelled = false
    const canvas = this.shadowRoot!.querySelector("canvas")!

    const renderer = new Renderer({ canvas, alpha: true, antialias: true, dpr: window.devicePixelRatio })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    canvas.style.width = "100%"
    canvas.style.height = "100%"

    const camera = new Camera(gl, { fov: 50, aspect: 1, near: 0.1, far: 100 })
    camera.position.set(0, 0, 5)

    const scene = new Transform()
    const group = new Transform()
    group.setParent(scene)

    const texture = new Texture(gl, {
      image: new Uint8Array([0, 0, 0, 255]),
      width: 1, height: 1,
      format: gl.RGBA, type: gl.UNSIGNED_BYTE,
      minFilter: gl.LINEAR, magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE,
      generateMipmaps: false, flipY: true,
    })

    const program = new Program(gl, {
      vertex: `
        precision highp float;
        attribute vec3 position; attribute vec2 uv;
        uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragment: `
        precision highp float;
        uniform sampler2D uTexture; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uTexture, vUv); }
      `,
      uniforms: { uTexture: { value: texture } },
      transparent: false, depthTest: true, depthWrite: true,
    })

    let imgW = 1, imgH = 1

    const buildGeo = () => {
      const cw = Math.max(0.001, this.width), ch = Math.max(0.001, this.height)
      const cd = Math.max(0.0001, this.depth), cr = Math.max(0, this.radius)
      const geo = new Box(gl, {
        width: cw, height: ch, depth: cd,
        widthSegments: Math.max(12, Math.round(cw * 10)),
        heightSegments: Math.max(12, Math.round(ch * 10)),
        depthSegments: 2,
      })
      const pos = geo.attributes.position.data as Float32Array
      const nor = geo.attributes.normal.data as Float32Array
      const halfW = cw * 0.5, halfH = ch * 0.5
      const rounded = Math.max(0, Math.min(cr, halfW, halfH))
      const iW = Math.max(0, halfW - rounded), iH = Math.max(0, halfH - rounded)

      for (let i = 0; i < pos.length; i += 3) {
        const x = pos[i], y = pos[i + 1]
        const sx = x < 0 ? -1 : 1, sy = y < 0 ? -1 : 1
        const qx = Math.max(Math.abs(x) - iW, 0), qy = Math.max(Math.abs(y) - iH, 0)
        const qLen = Math.hypot(qx, qy)
        let nx = 0, ny = 0
        if (qLen > 1e-6) { nx = qx / qLen; ny = qy / qLen }
        else if (Math.abs(x) >= Math.abs(y)) nx = 1
        else ny = 1
        pos[i] = sx * iW + nx * sx * rounded
        pos[i + 1] = sy * iH + ny * sy * rounded
        if (Math.abs(nor[i + 2]) > 0.9) { nor[i] = 0; nor[i + 1] = 0; nor[i + 2] = nor[i + 2] > 0 ? 1 : -1 }
        else { nor[i] = nx * sx; nor[i + 1] = ny * sy; nor[i + 2] = 0 }
      }
      geo.attributes.position.needsUpdate = true
      geo.attributes.normal.needsUpdate = true

      const uvs = geo.attributes.uv.data as Float32Array
      const ia = Math.max(1e-6, imgW / imgH), ca = Math.max(1e-6, cw / ch)
      let su = 1, sv = 1, ou = 0, ov = 0
      if (ca > ia) { sv = ia / ca; ov = (1 - sv) * 0.5 }
      else { su = ca / ia; ou = (1 - su) * 0.5 }
      const count = pos.length / 3
      for (let i = 0; i < count; i++) {
        const ni = i * 3
        if (Math.abs(nor[ni + 2]) <= 0.9) continue
        uvs[i * 2] = (pos[ni] + cw * 0.5) / cw * su + ou
        uvs[i * 2 + 1] = (pos[ni + 1] + ch * 0.5) / ch * sv + ov
      }
      geo.attributes.uv.needsUpdate = true
      return geo
    }

    let geometry = buildGeo()
    const mesh = new Mesh(gl, { geometry, program, frustumCulled: false })
    mesh.setParent(group)

    let imgTok = 0
    this._setImage = (src: string) => {
      imgTok++; const tok = imgTok
      const img = new Image(); img.crossOrigin = "anonymous"; img.decoding = "async"
      img.onload = () => {
        if (tok !== imgTok) return
        texture.image = img
        imgW = img.naturalWidth || img.width || 1
        imgH = img.naturalHeight || img.height || 1
        const old = geometry; geometry = buildGeo(); mesh.geometry = geometry; old.remove()
      }
      img.src = src
    }
    if (this.image) this._setImage(this.image)

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      this._headPosition.x = ((e.clientX - r.left) / r.width) * 2 - 1
      this._headPosition.y = -(((e.clientY - r.top) / r.height) * 2 - 1)
    }
    const onLeave = () => { this._headPosition.x = 0; this._headPosition.y = 0 }
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerleave", onLeave)

    const tick = () => {
      if (this._cancelled) return
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
      const bw = Math.round(w * renderer.dpr), bh = Math.round(h * renderer.dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw; canvas.height = bh
        renderer.width = w; renderer.height = h
        renderer.state.viewport = { x: 0, y: 0, width: null as any, height: null as any }
        camera.perspective({ fov: 50, aspect: w / Math.max(1, h), near: 0.1, far: 100 })
      }
      const lerp = 0.1
      this._smoothRotation.x += (-this._headPosition.y * 0.4 - this._smoothRotation.x) * lerp
      this._smoothRotation.y += (-this._headPosition.x * 0.5 - this._smoothRotation.y) * lerp
      group.rotation.x = this._smoothRotation.x
      group.rotation.y = this._smoothRotation.y
      renderer.render({ scene, camera, clear: true })
      this._raf = requestAnimationFrame(tick)
    }
    this._raf = requestAnimationFrame(tick)

    this._disposeWebGL = () => {
      imgTok++
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerleave", onLeave)
      if (texture.texture) gl.deleteTexture(texture.texture)
      geometry.remove()
      program.remove()
    }
  }

  override render() {
    return html`<canvas></canvas>`
  }
}
