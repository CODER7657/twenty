/* ─────────────────────────────────────────────────────────────────────────
   The chameleon core: Babylon.js scene behind the whole page.

   • Core   — icosphere displaced on the GPU by layered simplex noise
              (noise stack adapted from ThreeUI "Liquid Form", MIT © Meng To),
              lit by a real HDR studio environment through Babylon's PBR
              material with clearcoat + thin-film iridescence.
   • Ring   — 20 glass tiles, one per style, each painted with its palette.
   • Field  — full-screen ribbon field seen through a halftone dot matrix
              (adapted from ThreeUI "Ribbon Field", MIT © Meng To), recoloured
              per style.
   • Post   — MSAA, bloom, ACES tone mapping, chromatic aberration, vignette.

   Public API (window.Core): pose {x,y,s}, setStyle(i|null), kick(velocity).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  const canvas = document.getElementById('core');
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 900;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const Core = (window.Core = {
    pose: { x: 0.42, y: 0.02, s: 1, spin: 0 },
    ready: null,
    setStyle() {}, kick() {}
  });

  if (!window.BABYLON || !BABYLON.Engine.isSupported()) {
    document.documentElement.classList.add('no-webgl');
    Core.ready = Promise.resolve(false);
    return;
  }

  const B = BABYLON;
  const engine = new B.Engine(canvas, true, { antialias: true, stencil: true, powerPreference: 'high-performance' }, true);
  engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.6));
  const scene = new B.Scene(engine);
  scene.clearColor = B.Color4.FromHexString('#0E0D12FF');
  scene.skipPointerMovePicking = true;

  const cam = new B.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2, 9, B.Vector3.Zero(), scene);
  cam.fov = 0.62; cam.minZ = 0.1; cam.maxZ = 200;

  // HDR light — soft gradient softboxes give the liquid, iridescent read.
  scene.environmentTexture = B.CubeTexture.CreateFromPrefilteredData('https://assets.babylonjs.com/environments/environmentSpecular.env', scene);
  scene.environmentIntensity = 1.15;

  const keyA = new B.PointLight('keyA', new B.Vector3(-4.5, 2.5, -3), scene);
  const keyB = new B.PointLight('keyB', new B.Vector3(4.5, -2, -2.5), scene);
  const keyC = new B.PointLight('keyC', new B.Vector3(0.5, -4, -2.5), scene);
  keyA.intensity = 95; keyB.intensity = 75; keyC.intensity = 55;

  /* ── Liquid displacement as a PBR material plugin (runs on the GPU) ── */
  const NOISE = `
    vec3 lqMod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 lqMod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 lqPermute(vec4 x){return lqMod289(((x*34.0)+1.0)*x);}
    vec4 lqTaylor(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float lqSnoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
      i=lqMod289(i);
      vec4 p=lqPermute(lqPermute(lqPermute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=lqTaylor(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }
    vec3 lqDisp(vec3 n){
      vec3 p=n*1.8; float t=lqTime;
      float m=lqSnoise(p*0.62+t*0.1)*0.2+lqSnoise(p*1.1-t*0.05+10.0)*0.07+lqSnoise(p*2.2+t*0.02)*0.012;
      // Pointer reach: the liquid swells toward the cursor and rings ripple out from the contact.
      float k=clamp(dot(n,lqPoke),-1.0,1.0);
      float reach=pow(max(k,0.0),10.0)*0.22;
      float ring=sin((1.0-k)*16.0-lqTime*5.0)*exp(-(1.0-k)*7.0)*0.016;
      return n*(lqRadius*(1.0+m*lqAmp*0.5+(reach+ring)*lqPokeAmt));
    }`;

  class LiquidPlugin extends B.MaterialPluginBase {
    constructor(material) {
      super(material, 'Liquid', 200, { LIQUID: false });
      this.time = 0; this.amp = 1; this.radius = 1.2;
      this.poke = new B.Vector3(0, 0, -1); this.pokeAmt = 0;
      this._enable(true);
    }
    prepareDefines(defines) { defines.LIQUID = true; }
    getClassName() { return 'LiquidPlugin'; }
    isCompatible(lang) { return lang === B.ShaderLanguage.GLSL; }
    getUniforms() {
      return {
        ubo: [{ name: 'lqTime', size: 1, type: 'float' }, { name: 'lqAmp', size: 1, type: 'float' }, { name: 'lqRadius', size: 1, type: 'float' },
              { name: 'lqPoke', size: 3, type: 'vec3' }, { name: 'lqPokeAmt', size: 1, type: 'float' }],
        vertex: 'uniform float lqTime; uniform float lqAmp; uniform float lqRadius; uniform vec3 lqPoke; uniform float lqPokeAmt;'
      };
    }
    bindForSubMesh(ubo) {
      ubo.updateFloat('lqTime', this.time);
      ubo.updateFloat('lqAmp', this.amp);
      ubo.updateFloat('lqRadius', this.radius);
      ubo.updateFloat3('lqPoke', this.poke.x, this.poke.y, this.poke.z);
      ubo.updateFloat('lqPokeAmt', this.pokeAmt);
    }
    getCustomCode(type) {
      if (type !== 'vertex') return null;
      return {
        CUSTOM_VERTEX_DEFINITIONS: NOISE,
        // Displace, then rebuild the normal from two neighbouring displaced points
        // so lighting follows the liquid surface exactly (no seams).
        CUSTOM_VERTEX_UPDATE_POSITION: `
          vec3 lqN0=normalize(position);
          vec3 lqTA=normalize(cross(lqN0, abs(lqN0.y)<0.99?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0)));
          vec3 lqTB=cross(lqN0,lqTA);
          vec3 lqP0=lqDisp(lqN0);
          vec3 lqPA=lqDisp(normalize(lqN0+lqTA*0.012));
          vec3 lqPB=lqDisp(normalize(lqN0+lqTB*0.012));
          vec3 lqNN=normalize(cross(lqPA-lqP0,lqPB-lqP0));
          if(dot(lqNN,lqN0)<0.0) lqNN=-lqNN;
          positionUpdated=lqP0;`,
        CUSTOM_VERTEX_UPDATE_NORMAL: `
          #ifdef NORMAL
          normalUpdated=lqNN;
          #endif`
      };
    }
  }

  const rig = new B.TransformNode('rig', scene);
  const core = B.MeshBuilder.CreateIcoSphere('core', { radius: 1.2, subdivisions: coarse ? 30 : 48, flat: false }, scene);
  core.parent = rig;
  core.alwaysSelectAsActiveMesh = true; // displacement happens on the GPU, bounds don't know about it

  const mat = new B.PBRMaterial('coreMat', scene);
  mat.metallic = 1; mat.roughness = 0.07;
  mat.albedoColor = B.Color3.FromHexString('#E9E6F2');
  mat.clearCoat.isEnabled = true; mat.clearCoat.intensity = 0.8; mat.clearCoat.roughness = 0.04;
  mat.iridescence.isEnabled = true; mat.iridescence.intensity = 1;
  mat.iridescence.indexOfRefraction = 1.3; mat.iridescence.minimumThickness = 80; mat.iridescence.maximumThickness = 380;
  // coloured sheen: a velvet rim of the style's second colour around the silhouette
  mat.sheen.isEnabled = true; mat.sheen.intensity = 0.85; mat.sheen.roughness = 0.35; mat.sheen.color = new B.Color3(0.4, 0.8, 0.8);
  const liquid = new LiquidPlugin(mat);
  core.material = mat;

  /* ── Ring of 20 style tiles ── */
  const ring = new B.TransformNode('ring', scene);
  ring.parent = rig; ring.rotation.x = 1.2; ring.rotation.z = -0.28;
  const tiles = [];
  const R = 2.35;

  function paintTile(i) {
    const st = STYLES[i];
    const tex = new B.DynamicTexture('tt' + i, { width: 192, height: 256 }, scene, true);
    const ctx = tex.getContext();
    const pal = st.palette;
    const bandH = 256 / pal.length;
    pal.forEach((c, k) => { ctx.fillStyle = c; ctx.fillRect(0, k * bandH, 192, bandH + 1); });
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, 0, 192, 256);
    ctx.fillStyle = '#fff';
    ctx.font = `64px ${st.font}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1).padStart(2, '0'), 18, 70);
    ctx.font = `20px ${st.font}`;
    ctx.fillText(st.name, 18, 220);
    tex.update();
    return tex;
  }

  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const t = B.MeshBuilder.CreateBox('tile' + i, { width: 0.34, height: 0.46, depth: 0.018 }, scene);
    t.parent = ring;
    t.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    t.rotation.y = Math.PI / 2 - a;
    const m = new B.PBRMaterial('tm' + i, scene);
    m.metallic = 0; m.roughness = 0.18;
    m.albedoColor = B.Color3.White();
    m.emissiveColor = new B.Color3(0.05, 0.05, 0.05);
    m.clearCoat.isEnabled = true; m.clearCoat.intensity = 1;
    t.material = m;
    tiles.push({ mesh: t, mat: m, a, lift: 0 });
  }
  // Paint tiles once the poster fonts are in, so the numbers render in each style's face.
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    tiles.forEach((t, i) => { const tex = paintTile(i); t.mat.albedoTexture = tex; t.mat.emissiveTexture = tex; });
  });

  /* ── Floating dust for depth (thin instances = one draw call) ── */
  const dust = B.MeshBuilder.CreateIcoSphere('dust', { radius: 0.012, subdivisions: 1 }, scene);
  const dustMat = new B.StandardMaterial('dm', scene);
  dustMat.disableLighting = true; dustMat.emissiveColor = new B.Color3(0.9, 0.88, 1); dustMat.alpha = 0.55;
  dust.material = dustMat;
  const N = coarse ? 90 : 220, buf = new Float32Array(N * 16);
  for (let i = 0; i < N; i++) {
    const s = 0.5 + Math.random() * 1.6;
    B.Matrix.Compose(new B.Vector3(s, s, s), B.Quaternion.Identity(),
      new B.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8 + 1)).copyToArray(buf, i * 16);
  }
  dust.thinInstanceSetBuffer('matrix', buf, 16);

  /* ── Ribbon field background: a camera-locked plane with a screen-space shader ── */
  B.Effect.ShadersStore.ribbonVertexShader = `
    precision highp float; attribute vec3 position; uniform mat4 worldViewProjection;
    void main(){ gl_Position = worldViewProjection * vec4(position,1.0); }`;
  B.Effect.ShadersStore.ribbonFragmentShader = `
    precision highp float;
    uniform vec2 res; uniform float time; uniform vec2 pointer; uniform vec2 focus;
    uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform float dotPx; uniform float strength;
    uniform float pulse; uniform float lift;
    float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float ribbon(vec2 uv,float off,float w,float ph){
      float y=0.55+0.20*sin(uv.x*2.15+ph)+0.045*sin(uv.x*7.0-ph*0.7);
      float d=abs(uv.y-y-off); return exp(-(d*d)/w);
    }
    void main(){
      vec2 uv=gl_FragCoord.xy/res; float t=time*0.22; float drift=(pointer.x-0.5)*0.06;
      float r1=ribbon(vec2(uv.x+drift,uv.y),0.03,0.0065,t+0.9);
      float r2=ribbon(vec2(uv.x-drift*0.7,uv.y),-0.23,0.0085,t+3.25);
      float r3=ribbon(vec2(uv.x+drift*0.4,uv.y),0.25,0.014,t+1.85);
      float glow=r1*1.14+r2*1.05+r3*0.48;
      vec3 col=c1*r1*1.2+c2*r2*0.95+mix(c1,c3,0.5)*r3*0.6;
      vec2 asp=vec2(res.x/res.y,1.0);
      float bloom=exp(-pow(distance(uv*asp,focus*asp),2.0)/0.09);
      col+=mix(c2,c3,0.4)*bloom*0.28;
      vec2 grid=fract(gl_FragCoord.xy/dotPx)-0.5;
      float dotShape=smoothstep(0.29,0.11,length(grid));
      float nz=hash(floor(gl_FragCoord.xy/dotPx));
      float scan=0.72+0.28*sin((uv.x+uv.y)*38.0+time*1.3);
      float dots=dotShape*(0.48+0.52*nz)*scan;
      float mask=0.45+0.55*exp(-pow(distance(uv*asp,focus*asp),2.0)/0.35);
      // style-change shockwave: a ring expanding from the core through the dot matrix
      float dd=distance(uv*asp,focus*asp);
      float wave=exp(-pow(dd-(1.0-pulse)*1.35,2.0)/0.0035)*pulse;
      col+=mix(c1,vec3(1.0),0.35)*wave*1.4;
      float alpha=clamp((glow*1.55+bloom*0.5+wave*2.2)*dots*mask*(1.0+lift*0.9),0.0,1.0)*strength;
      col*=1.0+lift*0.6;
      vec3 base=vec3(0.055,0.051,0.071);
      vec3 fin=mix(base,col,clamp(alpha*1.55,0.0,1.0));
      fin+=hash(gl_FragCoord.xy+time)*0.012;
      gl_FragColor=vec4(fin,1.0);
    }`;
  const bgMat = new B.ShaderMaterial('ribbon', scene, { vertex: 'ribbon', fragment: 'ribbon' }, {
    attributes: ['position'],
    uniforms: ['worldViewProjection', 'res', 'time', 'pointer', 'focus', 'c1', 'c2', 'c3', 'dotPx', 'strength', 'pulse', 'lift']
  });
  bgMat.backFaceCulling = false; bgMat.disableDepthWrite = true;
  const bg = B.MeshBuilder.CreatePlane('bg', { size: 1 }, scene);
  bg.material = bgMat; bg.parent = cam; bg.isPickable = false;
  bg.alwaysSelectAsActiveMesh = true;
  function fitBg() {
    const d = 60, h = 2 * d * Math.tan(cam.fov / 2) * 1.08;
    bg.position.set(0, 0, d);
    bg.scaling.set(h * engine.getAspectRatio(cam), h, 1);
  }
  fitBg();

  /* ── Post-processing ── */
  const pipe = new B.DefaultRenderingPipeline('post', true, scene, [cam]);
  pipe.samples = coarse ? 1 : 2;
  pipe.fxaaEnabled = coarse;
  pipe.bloomEnabled = true; pipe.bloomThreshold = 0.74; pipe.bloomWeight = 0.32; pipe.bloomKernel = 40; pipe.bloomScale = 0.4;
  pipe.chromaticAberrationEnabled = false; // done inside the legibility pass instead
  let caAmt = 0;
  pipe.imageProcessingEnabled = true;
  const ip = pipe.imageProcessing;
  ip.toneMappingEnabled = true; ip.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.05; ip.contrast = 1.18;
  ip.vignetteEnabled = true; ip.vignetteWeight = 2.4; ip.vignetteStretch = 0.3;
  ip.vignetteColor = new B.Color4(0.03, 0.02, 0.05, 0);

  /* ── Legibility field ─────────────────────────────────────────────────
     Instead of fighting the background with heavier text, the scene is told
     where the text is. Every frame the page's text blocks are rasterised into
     a 1/6-resolution mask; a final pass reads it with a soft gaussian and
     quiets whatever sits underneath: highlights are pulled down hardest, colour
     is partly drained, so light type always lands on a calm, dark pool, even
     when the chrome core or a bright ribbon slides behind it. */
  const LEGIBLE = ['.hero-title', '.mq-row', '.ii-num', '.ii-name', '.ii-essence', '.sec-title', '.col-word', '.col-grid'].join(',');
  const MS = 6;
  const maskTex = new B.DynamicTexture('legible', { width: Math.ceil(innerWidth / MS), height: Math.ceil(innerHeight / MS) }, scene, false);
  maskTex.wrapU = maskTex.wrapV = B.Texture.CLAMP_ADDRESSMODE;
  const mctx = maskTex.getContext();
  let legibleEls = [];
  const collectLegible = () => { legibleEls = [...document.querySelectorAll(LEGIBLE)]; };
  collectLegible();
  setInterval(collectLegible, 600); // cheap; catches re-rendered matcher text and split lines
  Core.legibility = 1;
  function drawMask() {
    const { width: w, height: h } = maskTex.getSize(), sx = w / innerWidth, sy = h / innerHeight;
    mctx.clearRect(0, 0, w, h);
    mctx.fillStyle = '#fff';
    for (const el of legibleEls) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.width < 1 || r.height < 1) continue;
      const pad = 24;
      const x = (r.left - pad) * sx, y = (r.top - pad) * sy, rw = (r.width + pad * 2) * sx, rh = (r.height + pad * 2) * sy;
      mctx.beginPath();
      mctx.roundRect ? mctx.roundRect(x, y, rw, rh, Math.min(rw, rh) * 0.5) : mctx.rect(x, y, rw, rh);
      mctx.fill();
    }
    maskTex.update(true);
  }
  B.Effect.ShadersStore.legibleFragmentShader = `
    precision highp float;
    varying vec2 vUV;
    uniform sampler2D textureSampler; uniform sampler2D maskSampler;
    uniform vec2 texel; uniform float strength;
    uniform float grainT; uniform float ca;
    float gHash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main(){
      // radial RGB split (was its own post-process): zero cost when idle
      vec4 c = texture2D(textureSampler, vUV);
      if (ca > 0.0005) {
        vec2 dir = (vUV - 0.5) * ca;
        c.r = texture2D(textureSampler, vUV + dir).r;
        c.b = texture2D(textureSampler, vUV - dir).b;
      }
      // film grain (was its own post-process)
      c.rgb += (gHash(gl_FragCoord.xy + grainT) - 0.5) * 0.035;
      // cheap probe first: the mask is bilinear at 1/6 res, one tap tells us if text is near
      float probe = texture2D(maskSampler, vUV).r;
      if (probe < 0.001) {
        probe = texture2D(maskSampler, vUV + texel * vec2(3.0, 3.0)).r + texture2D(maskSampler, vUV - texel * vec2(3.0, 3.0)).r
              + texture2D(maskSampler, vUV + texel * vec2(3.0, -3.0)).r + texture2D(maskSampler, vUV - texel * vec2(3.0, -3.0)).r;
        if (probe < 0.001) { gl_FragColor = c; return; }
      }
      float m = 0.0, ws = 0.0;
      for (int x = -2; x <= 2; x++) for (int y = -2; y <= 2; y++) {
        float w = exp(-float(x*x + y*y) / 4.5);
        m += texture2D(maskSampler, vUV + vec2(float(x), float(y)) * texel * 2.6).r * w; ws += w;
      }
      m = smoothstep(0.0, 1.0, m / ws) * strength;
      if (m < 0.002) { gl_FragColor = c; return; }
      // Measure how bright the *area* is (a wide ring of samples), not this pixel.
      // Fine detail like the halftone dots averages out dark and is left alone;
      // only a large bright mass (the chrome core) behind the letters is dimmed,
      // evenly and softly, and only as much as needed.
      vec2 px = texel / 6.0;
      float lm = 0.0;
      for (int i = 0; i < 6; i++) {
        float a = float(i) * 1.0472;
        vec2 d = vec2(cos(a), sin(a));
        lm += dot(texture2D(textureSampler, vUV + d * px * 20.0).rgb, vec3(0.299, 0.587, 0.114));
        lm += dot(texture2D(textureSampler, vUV + d.yx * px * 44.0).rgb, vec3(0.299, 0.587, 0.114));
      }
      lm /= 12.0;
      float need = smoothstep(0.22, 0.55, lm);          // 0 on dark areas: no effect at all
      float k = mix(1.0, clamp(0.3 / max(lm, 1e-3), 0.45, 1.0), need * m);
      gl_FragColor = vec4(c.rgb * k, c.a);
    }`;


  const legiblePP = new B.PostProcess('legible', 'legible', ['texel', 'strength', 'grainT', 'ca'], ['maskSampler'], 1.0, cam);
  legiblePP.onApply = (eff) => {
    const { width: w, height: h } = maskTex.getSize();
    eff.setTexture('maskSampler', maskTex);
    eff.setFloat2('texel', 1 / w, 1 / h);
    eff.setFloat('strength', Core.legibility);
    eff.setFloat('grainT', (performance.now() * 0.06) % 1000);
    eff.setFloat('ca', caAmt);
  };
  scene.onBeforeRenderObservable.add(drawMask);

  /* ── Burst: additive sparks thrown off the core whenever the style changes ── */
  const flare = new B.DynamicTexture('flare', 64, scene, false);
  {
    // a crisp, antialiased disc (one pixel of feather), not a soft glow
    const g2 = flare.getContext();
    g2.clearRect(0, 0, 64, 64);
    g2.fillStyle = '#fff'; g2.beginPath(); g2.arc(32, 32, 29, 0, Math.PI * 2); g2.fill();
    flare.hasAlpha = true; flare.update();
  }
  const burst = new B.ParticleSystem('burst', coarse ? 260 : 700, scene);
  burst.particleTexture = flare;
  burst.emitter = new B.Vector3();
  const burstShape = burst.createSphereEmitter(1.25, 0);
  burst.minLifeTime = 1.4; burst.maxLifeTime = 2.6;
  burst.minEmitPower = 1.2; burst.maxEmitPower = 3.6;
  burst.minSize = 0.018; burst.maxSize = 0.05;
  // ease out: fast launch, long glide (no abrupt stop)
  burst.addVelocityGradient(0, 1); burst.addVelocityGradient(0.35, 0.35); burst.addVelocityGradient(1, 0.04);
  // size gradients are absolute world sizes (min, max per particle): small, crisp sparks
  burst.addSizeGradient(0, 0.006, 0.012); burst.addSizeGradient(0.12, 0.018, 0.04); burst.addSizeGradient(1, 0.008, 0.02);
  burst.addColorGradient(0, new B.Color4(1, 1, 1, 0)); // colour gradients are replaced per burst below
  burst.blendMode = B.ParticleSystem.BLENDMODE_STANDARD;
  burst.billboardMode = B.ParticleSystem.BILLBOARDMODE_ALL;
  burst.colorDead = new B.Color4(0, 0, 0, 0);
  burst.updateSpeed = 1 / 60;
  burst.manualEmitCount = 0;
  burst.start();

  /* ── State + animation ── */
  const hex = (h) => B.Color3.FromHexString(h);
  const cur = {
    tint: hex(CORE_DEFAULT.tint), metal: 1, rough: 0.07, amp: 1, iri: 1,
    c1: hex(CORE_DEFAULT.glow[0]), c2: hex(CORE_DEFAULT.glow[1]), c3: hex('#FF7A1A')
  };
  let tgt = { tint: cur.tint.clone(), metal: 1, rough: 0.07, amp: 1, iri: 1, c1: cur.c1.clone(), c2: cur.c2.clone(), c3: cur.c3.clone() };
  let active = -1, energy = 0, pulse = 0, vel = 0, velTarget = 0, booted = false, burstLeft = 0;
  const fireBurst = (a, b, n) => {
    burst.removeColorGradient(0); burst.removeColorGradient(0.1); burst.removeColorGradient(0.75); burst.removeColorGradient(1);
    burst.addColorGradient(0, new B.Color4(a.r, a.g, a.b, 0));
    burst.addColorGradient(0.1, new B.Color4(a.r, a.g, a.b, 1));
    burst.addColorGradient(0.75, new B.Color4(b.r, b.g, b.b, 0.9));
    burst.addColorGradient(1, new B.Color4(b.r, b.g, b.b, 0));
    burstLeft = n;
  };
  Core.dive = 0; // 0..1, scrubbed by the page: the camera plunges through the core
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (e) => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });

  Core.setStyle = (i, quiet) => {
    active = i == null ? -1 : i;
    const src = active < 0 ? CORE_DEFAULT : { ...STYLES[active].core, glow: STYLES[active].glow };
    tgt = {
      tint: hex(src.tint), metal: src.metal, rough: src.rough, amp: src.amp, iri: src.iri,
      c1: hex(src.glow[0]), c2: hex(src.glow[1]),
      c3: active < 0 ? hex('#FF7A1A') : hex(STYLES[active].palette[Math.min(2, STYLES[active].palette.length - 1)])
    };
    energy = Math.max(energy, quiet ? 0.35 : 0.9); // a shiver on every change (softer when quiet)
    if (active >= 0 && booted && !reduce && !quiet) {
      fireBurst(tgt.c1, tgt.c2, coarse ? 90 : 260);
      pulse = 1;
    }
  };
  Core.kick = (v) => { energy = Math.min(1.6, Math.max(energy, Math.abs(v) * 0.02)); };
  Core.setVelocity = (v) => { velTarget = v; };
  setTimeout(() => { booted = true; }, 1200);

  // Pointer reach: find where the cursor's ray passes the core and let the liquid swell toward it.
  const ptr = { x: -1, y: -1, in: false };
  if (!coarse && !reduce) {
    addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.in = true; }, { passive: true });
    document.addEventListener('pointerleave', () => { ptr.in = false; });
    // Click near the core: splash
    addEventListener('pointerdown', (e) => {
      if (liquid.pokeAmt > 0.35 && !e.target.closest('a,button,input,label,.card,.chip,.pal-strip,.tf,.pair,.qc')) {
        energy = 1.6; pulse = 1; liquid.pokeAmt = 2.4;
        fireBurst(cur.c1, new B.Color3(1, 1, 1), 320);
      }
    });
  }
  const invW = new B.Matrix(), tmpDir = new B.Vector3();
  function updatePoke(k) {
    let want = 0;
    if (ptr.in) {
      const ray = scene.createPickingRay(ptr.x, ptr.y, B.Matrix.Identity(), cam);
      const c = rig.position, r = 1.2 * rig.scaling.x;
      const tc = B.Vector3.Dot(c.subtract(ray.origin), ray.direction);
      const closest = ray.origin.add(ray.direction.scale(tc));
      const d = B.Vector3.Distance(c, closest);
      want = 1 - Math.min(1, Math.max(0, (d - r * 0.7) / (r * 1.5)));
      want = want * want * (3 - 2 * want);
      const hit = d < r ? ray.origin.add(ray.direction.scale(tc - Math.sqrt(r * r - d * d))) : closest;
      core.getWorldMatrix().invertToRef(invW);
      B.Vector3.TransformNormalToRef(hit.subtract(c).normalize(), invW, tmpDir);
      tmpDir.normalize();
      B.Vector3.LerpToRef(liquid.poke, tmpDir, Math.min(1, k * 3), liquid.poke);
      liquid.poke.normalize();
    }
    liquid.pokeAmt += (want - liquid.pokeAmt) * Math.min(1, k * 1.6);
  }

  const lerp = (a, b, k) => a + (b - a) * k;
  let time = 0;
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
    const speed = reduce ? 0.08 : 1;
    time += dt * speed;
    const k = 1 - Math.exp(-dt * 3.2);

    // material morph toward the active style
    B.Color3.LerpToRef(cur.tint, tgt.tint, k, cur.tint);
    B.Color3.LerpToRef(cur.c1, tgt.c1, k, cur.c1);
    B.Color3.LerpToRef(cur.c2, tgt.c2, k, cur.c2);
    B.Color3.LerpToRef(cur.c3, tgt.c3, k, cur.c3);
    cur.metal = lerp(cur.metal, tgt.metal, k); cur.rough = lerp(cur.rough, tgt.rough, k);
    cur.amp = lerp(cur.amp, tgt.amp, k); cur.iri = lerp(cur.iri, tgt.iri, k);
    // chrome picks up the style's lead colour; the sheen rim carries the second
    B.Color3.LerpToRef(cur.tint, cur.c1, 0.3, mat.albedoColor); mat.metallic = cur.metal; mat.roughness = cur.rough;
    mat.sheen.color.copyFrom(cur.c2);
    mat.iridescence.intensity = cur.iri;
    mat.clearCoat.intensity = 0.25 + 0.6 * (1 - cur.rough);
    keyA.diffuse.copyFrom(cur.c1); keyA.specular.copyFrom(cur.c1);
    keyB.diffuse.copyFrom(cur.c2); keyB.specular.copyFrom(cur.c2);
    keyC.diffuse.copyFrom(cur.c3); keyC.specular.copyFrom(cur.c3);

    energy *= Math.exp(-dt * 1.4);
    pulse = Math.max(0, pulse - dt * 0.9);
    vel += (velTarget - vel) * (1 - Math.exp(-dt * 6));
    velTarget *= Math.exp(-dt * 4);
    const nv = Math.min(1, Math.abs(vel) / 55), dir = Math.sign(vel) || 1, dive = Core.dive;
    if (!coarse) {
      caAmt = 0.0012 + nv * 0.006 + dive * 0.008;
      updatePoke(k);
    }
    ip.exposure = 1.05 + dive * 0.55;
    pipe.bloomWeight = 0.32 + dive * 0.45 + pulse * 0.15;
    burst.emitter.copyFrom(rig.position);
    if (burstLeft > 0) { const n = Math.min(burstLeft, 22); burst.manualEmitCount = n; burstLeft -= n; } // ~12 frames of emission
    burstShape.radius = 1.25 * rig.scaling.x;
    liquid.time = time * (1.6 + energy * 2.5) + energy * 0.6;
    liquid.amp = cur.amp * (1 + energy * 0.9) * (reduce ? 0.6 : 1);

    // pose from the page (set by GSAP), mapped to world space
    const halfH = cam.radius * Math.tan(cam.fov / 2), halfW = halfH * engine.getAspectRatio(cam);
    mouse.sx = lerp(mouse.sx, mouse.x, k * 0.8); mouse.sy = lerp(mouse.sy, mouse.y, k * 0.8);
    const p = Core.pose;
    rig.position.x = lerp(rig.position.x, p.x * halfW * (1 - dive), k * 1.4);
    rig.position.y = lerp(rig.position.y, p.y * halfH * (1 - dive), k * 1.4);
    const s = lerp(rig.scaling.x, p.s * (1 + dive * 3.4), k * 1.8); rig.scaling.setAll(s);
    rig.rotation.y = mouse.sx * 0.35 + p.spin;
    rig.rotation.x = mouse.sy * 0.22;
    core.rotation.y += dt * 0.12 * speed;
    ring.rotation.y += dt * (0.09 + nv * 1.8 * dir + dive * 1.2) * speed;

    // tiles: the active one lifts out of the ring and glows
    tiles.forEach((t, i) => {
      const want = i === active ? 1 : 0;
      t.lift = lerp(t.lift, want, k * 1.2);
      const r = R * (1 + dive * 1.6 + nv * 0.22) + t.lift * 0.5;
      t.mesh.position.set(Math.cos(t.a) * r, t.lift * 0.12, Math.sin(t.a) * r);
      t.mesh.scaling.setAll(1 + t.lift * 0.7);
      const e = 0.05 + t.lift * 1.25;
      t.mat.emissiveColor.set(e, e, e);
    });

    // background uniforms
    bgMat.setVector2('res', new B.Vector2(engine.getRenderWidth(), engine.getRenderHeight()));
    bgMat.setFloat('time', time * (reduce ? 0 : 1) + 4);
    bgMat.setVector2('pointer', new B.Vector2(mouse.sx * 0.5 + 0.5, 0.5));
    bgMat.setVector2('focus', new B.Vector2(0.5 + p.x * 0.5 * (1 - dive), 0.5 + p.y * 0.5 * (1 - dive)));
    bgMat.setFloat('pulse', pulse);
    bgMat.setFloat('lift', nv + dive * 0.8);
    bgMat.setColor3('c1', cur.c1); bgMat.setColor3('c2', cur.c2); bgMat.setColor3('c3', cur.c3);
    bgMat.setFloat('dotPx', 7 / engine.getHardwareScalingLevel());
    bgMat.setFloat('strength', 1);
  });

  const maxDpr = Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.6), minDpr = coarse ? 0.7 : 0.8;
  // Settle-and-lock resolution scaler. Every change reallocates all render targets
  // (a ~90 ms hitch), so it must not hunt: it calibrates for the first seconds, then
  // only steps down on *sustained* low frame rates, with a long cooldown.
  let dpr = maxDpr, fpsAcc = 0, fpsN = 0, lowRuns = 0, lastChange = 0;
  const calibratingNow = () => document.body.classList.contains('is-loading');
  setInterval(() => {
    if (document.hidden) return;
    fpsAcc += engine.getFps(); fpsN++;
    if (fpsN < (document.body.classList.contains('is-loading') ? 4 : 8)) return; // ~1 s behind the loader, ~2 s after
    const fps = fpsAcc / fpsN, now = performance.now(); fpsAcc = fpsN = 0;
    if (now - lastChange < (calibratingNow() ? 1000 : 4000)) return; // cooldown: let the change settle before judging again
    if (Math.abs(vel) > 0.02 || Math.abs(velTarget) > 0.02) { fpsAcc = fpsN = 0; return; } // never switch mid-scroll: wait for a still moment
    // calibrate behind the loader (nobody sees the ~90 ms re-allocation there)
    const calibrating = document.body.classList.contains('is-loading');
    lowRuns = fps < (calibrating ? 55 : 50) ? lowRuns + 1 : 0;
    const apply = (v) => { dpr = v; lastChange = now; engine.setHardwareScalingLevel(1 / dpr); };
    if (lowRuns >= (calibrating ? 1 : 2)) {
      lowRuns = 0;
      if (pipe.samples > 1) { pipe.samples = 1; pipe.fxaaEnabled = true; lastChange = now; return; }
      if (dpr > minDpr) apply(Math.max(minDpr, +(dpr - 0.15).toFixed(2)));
    } else if (calibrating && fps > 59.5 && dpr < maxDpr) {
      apply(Math.min(maxDpr, +(dpr + 0.1).toFixed(2)));
    }
  }, 250);

  addEventListener('resize', () => { engine.resize(); fitBg(); maskTex.scaleTo(Math.ceil(innerWidth / MS), Math.ceil(innerHeight / MS)); });

  engine.runRenderLoop(() => scene.render());
  Core.ready = new Promise((res) => {
    scene.executeWhenReady(() => { document.documentElement.classList.add('webgl-ready'); res(true); });
    setTimeout(() => res(true), 2500); // never hold the page for a slow HDR download
  });
})();
