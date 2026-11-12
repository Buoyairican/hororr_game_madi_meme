// Single full-screen pass: tone mapping, colour grade, chromatic aberration,
// film grain, vignette, glitch bands, fear warp, blackout and a retro dither.
import * as THREE from 'three';

const frag = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 res;
uniform float time, exposure, vig, aberr, grain, glitch, blackout, red, retro, flash, warp, desat;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 aces(vec3 x) { const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec2 uv = vUv;
  uv += warp * 0.0045 * vec2(sin(uv.y * 17.0 + time * 2.1), cos(uv.x * 13.0 + time * 1.7));
  if (glitch > 0.001) {
    float band = floor(uv.y * 26.0 + floor(time * 24.0) * 7.0);
    float r = hash(vec2(band, floor(time * 18.0)));
    if (r < glitch * 0.65) uv.x += (hash(vec2(band, 3.1)) - 0.5) * 0.16 * glitch;
    if (hash(vec2(floor(time * 9.0), 1.7)) < glitch * 0.3) uv.y += (hash(vec2(floor(time * 9.0), 2.3)) - 0.5) * 0.05 * glitch;
  }
  vec2 dir = uv - 0.5;
  float d = length(dir);
  vec2 off = dir * aberr * (0.003 + d * 0.022);
  vec3 col;
  col.r = texture2D(tDiffuse, uv + off).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - off).b;
  col = aces(col * exposure);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(l), desat);
  col *= vec3(0.93, 1.02, 0.97);
  col = mix(col, vec3(l * 1.35, l * 0.32, l * 0.28), red);
  col = toSRGB(col);
  col *= mix(1.0, smoothstep(0.9, 0.18, d), vig);
  float n = hash(uv * res + fract(time * 7.13) * 100.0) - 0.5;
  col += n * grain;
  if (retro > 0.5) {
    vec2 p = floor(uv * res);
    float ign = fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
    col = floor(col * 40.0 + ign) / 40.0;
  }
  col = mix(col, vec3(1.0), flash);
  col *= 1.0 - blackout;
  gl_FragColor = vec4(col, 1.0);
}`;

const vert = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    const gl = renderer.getContext();
    const canFloat = renderer.capabilities.isWebGL2 && (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    this.rt = new THREE.WebGLRenderTarget(4, 4, {
      type: canFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.uniforms = {
      tDiffuse: { value: this.rt.texture },
      res: { value: new THREE.Vector2(4, 4) },
      time: { value: 0 }, exposure: { value: 1.0 }, vig: { value: 0.75 }, aberr: { value: 0.4 }, grain: { value: 0.06 },
      glitch: { value: 0 }, blackout: { value: 0 }, red: { value: 0 }, retro: { value: 1 }, flash: { value: 0 }, warp: { value: 0 }, desat: { value: 0.25 },
    };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.retro = true;
  }

  setSize(cssW, cssH, retro) {
    this.retro = retro;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let h;
    if (retro) h = Math.min(400, Math.round(cssH * dpr));
    else h = Math.min(Math.round(cssH * Math.min(dpr, 1.5)), 1100);
    const w = Math.round(h * cssW / cssH);
    this.rt.setSize(w, h);
    const f = retro ? THREE.NearestFilter : THREE.LinearFilter;
    this.rt.texture.minFilter = this.rt.texture.magFilter = f;
    this.rt.texture.needsUpdate = true;
    this.uniforms.res.value.set(w, h);
    this.uniforms.retro.value = retro ? 1 : 0;
    this.renderer.setPixelRatio(retro ? 1 : Math.min(dpr, 1.5));
    this.renderer.setSize(cssW, cssH, false);
  }

  render(scene, camera) {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }
}
