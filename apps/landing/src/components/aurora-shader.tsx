import { useEffect, useRef } from 'react'
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Timer,
  Vector2,
  Vector3,
  WebGLRenderer,
  type IUniform
} from 'three'

export type AuroraTheme = 'dark' | 'light'

/**
 * The WebGL aurora behind the page, ported from the design's three.js
 * background (comment-ui/index.html). The design loads three from a CDN and
 * hardcodes an additive dark palette; here three is bundled, only the classes
 * actually used are imported, and the hardcoded colours became uniforms so a
 * theme switch updates a material instead of rebuilding the GL context.
 *
 * The vertex shader and the fragment shader's noise/field code are verbatim.
 * The additions are the palette uniforms and a light-theme branch: the dark
 * path is the design's exact `col += base` composition, while light blends a
 * brand-tinted wash into the paper colour (`base * (1 - wash)`), because
 * adding light to a near-white background cannot produce a visible hue.
 *
 * `.aurora` keeps its CSS radial gradients: if WebGL2 is unavailable the canvas
 * is hidden and those gradients remain as the fallback. Everything the
 * renderer owns is disposed on unmount, including under StrictMode's
 * mount/unmount/mount.
 */

const DPR_MAX = 1.5

/** Design palette, verbatim: mint #5eead4, indigo #818cf8, pink #f472b6. */
const DARK_PALETTE: AuroraPalette = {
  mint: [0.369, 0.918, 0.831],
  indigo: [0.506, 0.549, 0.973],
  pink: [0.957, 0.447, 0.714],
  base: [0.024, 0.03, 0.045],
  light: 0,
  wash: 0
}

/**
 * Light theme, derived from the brand #1E4FFF (hsl 227 100% 56%): the design's
 * mint/indigo/pink are replaced by the same hue family the CSS fallback uses —
 * azure #4B5CFF, brand #1E4FFF, violet #6D4DFF — over the page's #F3F5FA.
 */
const LIGHT_PALETTE: AuroraPalette = {
  mint: [0.294, 0.361, 1],
  indigo: [0.118, 0.31, 1],
  pink: [0.427, 0.302, 1],
  base: [0.953, 0.961, 0.98],
  light: 1,
  wash: 0.47
}

type Rgb = readonly [number, number, number]

interface AuroraPalette {
  mint: Rgb
  indigo: Rgb
  pink: Rgb
  base: Rgb
  /** 0 = additive dark composition, 1 = light wash composition. */
  light: number
  /** How strongly the light wash pulls the paper towards the tint. */
  wash: number
}

// The index signature is what ShaderMaterial's `uniforms` expects; the named
// members keep the setters below typed.
interface AuroraUniforms extends Record<string, IUniform> {
  uTime: { value: number }
  uRes: { value: Vector2 }
  uMouse: { value: Vector2 }
  uMint: { value: Vector3 }
  uIndigo: { value: Vector3 }
  uPink: { value: Vector3 }
  uBase: { value: Vector3 }
  uLight: { value: number }
  uWash: { value: number }
}

interface AuroraApi {
  uniforms: AuroraUniforms
  render: () => void
}

const VERTEX_SHADER = `
  void main() { gl_Position = vec4(position, 1.0); }
`

const FRAGMENT_SHADER = `
  precision highp float;

  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;

  uniform vec3  uMint;
  uniform vec3  uIndigo;
  uniform vec3  uPink;
  uniform vec3  uBase;
  uniform float uLight;
  uniform float uWash;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      v += amp * noise(p);
      p = rot * p * 2.03;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 p  = uv;
    p.x *= uRes.x / uRes.y;

    float t = uTime * 0.055;
    vec2 q = p * 1.55;

    float n1 = fbm(q + vec2(t, -t * 0.8) + uMouse * 0.16);
    float n2 = fbm(q * 1.85 - vec2(t * 0.7, t * 1.05) - uMouse * 0.10);
    float n3 = fbm(q * 0.72 + vec2(-t * 0.4, t * 0.62));

    vec3 cMint   = uMint;
    vec3 cIndigo = uIndigo;
    vec3 cPink   = uPink;

    float m1 = smoothstep(0.34, 0.96, n1);
    float m2 = smoothstep(0.42, 0.94, n2);
    float m3 = smoothstep(0.56, 1.00, n3);
    float mdMask = exp(-distance(uv, uMouse) * 2.8);

    vec3 glow = vec3(0.0);
    glow += cIndigo * m1 * 0.20;
    glow += cMint   * m2 * 0.14;
    glow += cPink   * m3 * 0.085;
    glow += cMint   * mdMask * 0.085;

    vec2 vc = uv - 0.5;
    float vig = smoothstep(1.05, 0.18, length(vc));
    glow *= vig;

    vec3 col = glow + uBase;

    vec3 wash = vec3(0.0);
    wash += (vec3(1.0) - cIndigo) * m1 * 0.20;
    wash += (vec3(1.0) - cMint)   * m2 * 0.14;
    wash += (vec3(1.0) - cPink)   * m3 * 0.085;
    wash += (vec3(1.0) - cMint)   * mdMask * 0.085;
    wash *= vig;

    vec3 lightCol = uBase * (1.0 - wash * uWash);
    col = mix(col, lightCol, uLight);

    gl_FragColor = vec4(col, 1.0);
  }
`

function createUniforms(): AuroraUniforms {
  return {
    uTime: { value: 0 },
    uRes: { value: new Vector2(1, 1) },
    uMouse: { value: new Vector2(0.5, 0.5) },
    uMint: { value: new Vector3() },
    uIndigo: { value: new Vector3() },
    uPink: { value: new Vector3() },
    uBase: { value: new Vector3() },
    uLight: { value: 0 },
    uWash: { value: 0 }
  }
}

function applyPalette(uniforms: AuroraUniforms, theme: AuroraTheme): void {
  const palette = theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE

  uniforms.uMint.value.set(...palette.mint)
  uniforms.uIndigo.value.set(...palette.indigo)
  uniforms.uPink.value.set(...palette.pink)
  uniforms.uBase.value.set(...palette.base)
  uniforms.uLight.value = palette.light
  uniforms.uWash.value = palette.wash
}

export function AuroraShader({ theme }: { theme: AuroraTheme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const apiRef = useRef<AuroraApi | null>(null)
  // The GL setup must not re-run on theme changes, but it does need the theme
  // that was current at mount; the ref keeps that read without a dependency.
  const themeRef = useRef<AuroraTheme>(theme)
  themeRef.current = theme

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // `?aurora-debug` is for the headless check only: it keeps the drawing
    // buffer readable and exposes the uniforms. Normal visits behave exactly
    // like the design (buffer not preserved).
    const debug = new URLSearchParams(window.location.search).has('aurora-debug')

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'low-power',
        preserveDrawingBuffer: debug
      })
    } catch {
      // No WebGL2: `.aurora`'s CSS gradients are already painting behind us.
      canvas.style.display = 'none'
      return
    }

    const host = canvas.parentElement
    host?.classList.add('has-webgl')
    canvas.style.display = ''

    // The design caps the pixel ratio at 1.5; the same cap keeps 3x phones
    // from rendering 9x the fragments.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_MAX))
    renderer.setSize(window.innerWidth, window.innerHeight, false)

    const scene = new Scene()
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const uniforms = createUniforms()
    applyPalette(uniforms, themeRef.current)

    const material = new ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false
    })
    const geometry = new PlaneGeometry(2, 2)
    const quad = new Mesh(geometry, material)
    quad.frustumCulled = false
    scene.add(quad)

    const mouseTarget = new Vector2(0.5, 0.5)
    const mouseSmooth = new Vector2(0.5, 0.5)

    const render = () => renderer.render(scene, camera)

    const resize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      renderer.setSize(width, height, false)
      // uRes is the drawing-buffer size (CSS size × pixel ratio), so the
      // shader's aspect ratio and the pixel grid agree.
      uniforms.uRes.value.set(renderer.domElement.width, renderer.domElement.height)
      render()
    }

    // Design interaction: normalise the pointer to [0,1], flipping Y so the
    // glow lands under the cursor. Smoothing happens in the loop.
    const onPointerMove = (event: PointerEvent) => {
      mouseTarget.set(
        event.clientX / window.innerWidth,
        1 - event.clientY / window.innerHeight
      )
    }

    resize()

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Timer is Clock's replacement in current three; it also keeps elapsed
    // time from jumping when the tab has been hidden.
    const timer = new Timer()
    timer.connect(document)
    let rafId = 0
    let running = false

    const frame = () => {
      if (!running) return
      rafId = requestAnimationFrame(frame)

      mouseSmooth.x += (mouseTarget.x - mouseSmooth.x) * 0.045
      mouseSmooth.y += (mouseTarget.y - mouseSmooth.y) * 0.045

      timer.update()
      uniforms.uTime.value = timer.getElapsed()
      uniforms.uMouse.value.copy(mouseSmooth)

      render()
    }

    const start = () => {
      if (running || reduced) return
      running = true
      frame()
    }

    const stop = () => {
      running = false
      cancelAnimationFrame(rafId)
      rafId = 0
    }

    const onVisibilityChange = () => {
      if (document.hidden) stop()
      else start()
    }

    // A lost context leaves an opaque black/blank canvas; hiding it puts the
    // CSS gradients back until the browser restores the context.
    const onContextLost = (event: Event) => {
      event.preventDefault()
      stop()
      host?.classList.remove('has-webgl')
    }

    const onContextRestored = () => {
      host?.classList.add('has-webgl')
      resize()
      start()
    }

    window.addEventListener('resize', resize)
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    if (reduced) {
      // Reduced motion: no rAF loop, no pointer tracking. `resize()` above
      // already painted one static frame; theme/resize repaint it.
    } else {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      document.addEventListener('visibilitychange', onVisibilityChange)
      start()
    }

    apiRef.current = { uniforms, render }

    // Query-gated read-only handle so the headless check can assert that the
    // pointer and theme paths update uniforms without shipping a debug API on
    // every page load.
    if (debug) {
      Object.defineProperty(canvas, '__aurora', {
        value: { uniforms },
        configurable: true
      })
    }

    return () => {
      stop()

      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)

      host?.classList.remove('has-webgl')

      if (apiRef.current?.uniforms === uniforms) apiRef.current = null

      const debugCanvas = canvas as HTMLCanvasElement & { __aurora?: unknown }
      if (debugCanvas.__aurora) delete debugCanvas.__aurora

      timer.dispose()

      scene.remove(quad)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  // Theme changes only touch uniforms and repaint; the context, geometry and
  // program are reused.
  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    applyPalette(api.uniforms, theme)
    // In reduced-motion mode the loop is stopped, so this is the repaint.
    api.render()
  }, [theme])

  return <canvas ref={canvasRef} className="aurora-canvas" aria-hidden="true" />
}
