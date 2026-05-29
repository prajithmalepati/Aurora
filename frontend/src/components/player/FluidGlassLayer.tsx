import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree, createPortal } from '@react-three/fiber'
import { useFBO, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { usePlayerStore } from '@/stores/playerStore'
import { oklchToLinearRgb, BRAND_TEAL_LINEAR } from '@/hooks/useAuroraColor'

// Fluid-glass overlay (reactbits pattern): the aurora is re-rendered into an off-screen
// FBO, and a MeshTransmissionMaterial lens refracts that buffer in screen space. Only the
// lens renders to screen — the rest of the canvas is transparent and pointer-events:none,
// so the real UI underneath stays interactive. One canvas can host multiple lenses.

const AURORA_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Adapted from AuroraCanvas — same curtains/fbm, driven by vUv so it fills the FBO.
const AURORA_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3  uColor1;
  uniform vec3  uColor2;

  float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash(i),b=hash(i+vec2(1.0,0.0)),c=hash(i+vec2(0.0,1.0)),d=hash(i+vec2(1.0,1.0));
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
  float fbm(vec2 p){ float v=0.0,a=0.5; mat2 r=mat2(0.8,0.6,-0.6,0.8);
    for(int i=0;i<3;i++){ v+=a*vnoise(p); p=r*p*2.0; a*=0.5; } return v; }

  float curtain(vec2 uv, float t, float ph, float sp, float fr){
    float w = sin(uv.x*fr + t*sp + ph)*0.14;
    w += sin(uv.x*fr*1.73 + t*sp*0.61 + ph*1.41)*0.07;
    w += fbm(vec2(uv.x*2.2, t*0.12 + ph))*0.10;
    float cy = 0.48 + w + sin(t*0.05 + ph)*0.05;
    float d = abs(uv.y - cy);
    float cw = 0.05 + sin(t*0.04 + ph*0.7)*0.012;
    return smoothstep(cw, 0.0, d) + smoothstep(cw*5.0, cw, d)*0.22;
  }

  // EXACT page aurora — same curtains/palette as AuroraCanvas. No fabricated color.
  void main(){
    vec2 uv = vUv;
    float t = uTime;
    float a = 0.0;
    a += curtain(uv,t,0.00,0.31,2.10)*0.50;
    a += curtain(uv,t,1.70,0.19,3.30)*0.40;
    a += curtain(uv,t,3.14,0.23,1.80)*0.35;
    a += curtain(uv,t,5.30,0.17,4.10)*0.30;
    a = clamp(a, 0.0, 1.0);
    vec3 col = mix(uColor1, uColor2, clamp(uv.y*0.6 + sin(t*0.08)*0.1 + 0.2, 0.0, 1.0));
    vec3 greenCore = vec3(0.05, 0.75, 0.25);
    vec3 redFringe = vec3(0.85, 0.15, 0.10);
    col = mix(col, mix(greenCore, redFringe, smoothstep(0.45, 0.75, uv.y)), 0.35);
    col = mix(col*0.30, col, a);
    col = mix(col, vec3(0.95,0.98,1.0), a*a*0.30);
    gl_FragColor = vec4(col, 1.0);
  }
`

interface ButtonRect { x: number; y: number; size: number }

function LensScene() {
  const { size, gl } = useThree()
  const buffer = useFBO()
  const [auroraScene] = useState(() => new THREE.Scene())
  const auroraCam = useMemo(
    () => new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10),
    []
  )

  const currentSong = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)

  const auroraMat = useRef<THREE.ShaderMaterial>(null)
  const lensRef = useRef<THREE.Mesh>(null)
  const iconRef = useRef<THREE.Group>(null)
  const rectRef = useRef<ButtonRect | null>(null)

  // Track the visible primary play button each frame.
  useEffect(() => {
    auroraCam.position.z = 5
  }, [auroraCam])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(...BRAND_TEAL_LINEAR) },
      uColor2: { value: new THREE.Color(...BRAND_TEAL_LINEAR) },
    }),
    []
  )

  // Match the page aurora exactly: color1 = fixed brand teal, color2 = song's 2nd color.
  useEffect(() => {
    const c2 = currentSong?.dominant_color_2 ? oklchToLinearRgb(currentSong.dominant_color_2) : BRAND_TEAL_LINEAR
    uniforms.uColor1.value.setRGB(BRAND_TEAL_LINEAR[0], BRAND_TEAL_LINEAR[1], BRAND_TEAL_LINEAR[2])
    uniforms.uColor2.value.setRGB(c2[0], c2[1], c2[2])
  }, [currentSong?.id, uniforms])

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime

    // locate the visible primary play button
    const btns = Array.from(document.querySelectorAll<HTMLElement>('.glass-play-btn--primary'))
    const btn = btns.find((b) => b.offsetParent !== null)
    if (btn) {
      const r = btn.getBoundingClientRect()
      rectRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width }
    } else {
      rectRef.current = null
    }

    const lens = lensRef.current
    const icon = iconRef.current
    if (lens && rectRef.current) {
      const { x, y, size: px } = rectRef.current
      // screen px -> ortho world (origin at center, 1 unit = 1px, y up)
      const wx = x - size.width / 2
      const wy = size.height / 2 - y
      const r = px / 2
      lens.visible = true
      lens.position.set(wx, wy, 1)
      lens.scale.set(r, r, r * 0.32)   // flattened disc, not a ball
      if (icon) {
        icon.visible = true
        icon.position.set(wx, wy, 1 + r * 0.32 + 4)   // just in front of the lens
        icon.scale.setScalar(r)
      }
    } else if (lens) {
      lens.visible = false
      if (icon) icon.visible = false
    }

    // render aurora into the FBO (off-screen), then let the main pass refract it
    gl.setRenderTarget(buffer)
    gl.render(auroraScene, auroraCam)
    gl.setRenderTarget(null)
  })

  return (
    <>
      {createPortal(
        <mesh>
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            ref={auroraMat}
            vertexShader={AURORA_VERT}
            fragmentShader={AURORA_FRAG}
            uniforms={uniforms}
          />
        </mesh>,
        auroraScene
      )}

      {/* The glass lens — a flattened sphere acting as a convex disc */}
      <mesh ref={lensRef} visible={false} scale={20}>
        <sphereGeometry args={[1, 48, 48]} />
        <MeshTransmissionMaterial
          buffer={buffer.texture}
          transmission={1}
          roughness={0}
          thickness={1.4}
          ior={1.22}
          chromaticAberration={0.6}
          anisotropy={0.1}
          distortion={0.2}
          distortionScale={0.4}
          temporalDistortion={0.1}
          backside
        />
      </mesh>

      {/* Play / pause icon, rendered in front so it reads on top of the glass */}
      <group ref={iconRef} visible={false} scale={20}>
        {isPlaying ? (
          <>
            <mesh position={[-0.22, 0, 0]}>
              <planeGeometry args={[0.16, 0.62]} />
              <meshBasicMaterial color="white" transparent opacity={0.95} />
            </mesh>
            <mesh position={[0.22, 0, 0]}>
              <planeGeometry args={[0.16, 0.62]} />
              <meshBasicMaterial color="white" transparent opacity={0.95} />
            </mesh>
          </>
        ) : (
          <mesh position={[0.06, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <circleGeometry args={[0.34, 3]} />
            <meshBasicMaterial color="white" transparent opacity={0.95} />
          </mesh>
        )}
      </group>
    </>
  )
}

export function FluidGlassLayer() {
  // Skip under reduced motion — fall back to the CSS glass already on the button.
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return null

  return (
    <div
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex: 25, pointerEvents: 'none' }}
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 100], zoom: 1, near: 0.1, far: 1000 }}
        gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <LensScene />
      </Canvas>
    </div>
  )
}
