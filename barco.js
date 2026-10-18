(() => {
  const viewer = document.getElementById("viewer");
  const loading = document.getElementById("loading");

  if (!window.THREE || !THREE.OrbitControls) {
    loading.textContent =
      "Erro ao carregar Three.js. Verifique sua internet.";
    return;
  }

  // ==================================================
  // CENA E CÂMERA
  // ==================================================

  // perfil de desempenho: celulares e PCs fracos usam uma versão mais leve
  const LOW = (window.matchMedia && matchMedia("(pointer: coarse)").matches) ||
    (navigator.hardwareConcurrency || 8) <= 4 ||
    Math.min(innerWidth, innerHeight) < 600;
  let curPR = Math.min(window.devicePixelRatio || 1, LOW ? 1.5 : 1.75);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bbccb);
  scene.fog = new THREE.Fog(0x9bbccb, 70, 320);

  const camera = new THREE.PerspectiveCamera(
    42,
    innerWidth / innerHeight,
    0.1,
    700
  );

  camera.position.set(8, 6.5, 10);

  const renderer = new THREE.WebGLRenderer({
    antialias: !LOW,
    powerPreference: "high-performance"
  });

  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(curPR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.86;

  viewer.prepend(renderer.domElement);

  const controls = new THREE.OrbitControls(
    camera,
    renderer.domElement
  );

  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0.5, 0);
  controls.minDistance = 5;
  controls.maxDistance = 32;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minPolarAngle = 0.12;

  // ==================================================
  // MAPAS: TEMAS (dados) E PARÂMETROS DE JOGO
  // ==================================================

  const SUN_OFF = new THREE.Vector3(-5, 11, 7);

  // parâmetros de jogo do mapa atual (mudam a cada mapa)
  const MAP = {
    drag: 1,            // arrasto do barco na água
    grip: 1,            // aderência lateral (gelo escorrega)
    force: "none",      // none | vortex | current
    obstacles: [],
    cur: { on: false, x: 0, z: 0, t: 0, next: 12 }
  };

  let WT = [0.55, 0.76, 1.0];   // tom da água
  let WAVE_AMP = 1;             // altura da marolinha
  let WAVE_DAMP = 0.993;        // amortecimento das ondas

  const THEMES = {
    olimpica: {
      id: "olimpica", name: "PISCINA OLÍMPICA", short: "OLÍMPICA",
      desc: "O clássico: piscina de azulejos sob um céu limpo, com arquibancadas e torcida.",
      tags: ["Equilibrado", "Sem obstáculos"],
      bg: 0x9bbccb, fog: [0x9bbccb, 70, 320], exposure: 0.86,
      sky: { top: 0x1f5f9c, horizon: 0x9fc3d2, bottom: 0x2b5b6e },
      sunOff: [-5, 11, 7], sunColor: 0xffe5c2, sunInt: 1.0,
      hemi: [0xdaf4ff, 0x18313b, 0.65], fill: [0x75cfff, 0.3],
      clouds: 1,
      water: { color: 0x7fb0d6, tint: [0.55, 0.76, 1.0], opacity: 0.84, emissive: 0x000000, emissiveInt: 0, idle: 1, damp: 0.993 },
      drag: 1, grip: 1, force: "none", obstacles: [],
      shell: {
        wall: ["tile", "#3f8fbe", "#2f729a"], floor: ["tile", "#1f6a98", "#175580"],
        cope: ["tile", "#d6d1c6", "#b9b3a5"], deck: ["tile", "#b8b2a4", "#9d9788"],
        wallRough: 0.3, deckScale: 1
      }
    },

    lago: {
      id: "lago", name: "LAGO AO PÔR DO SOL", short: "LAGO",
      desc: "Entardecer num lago de montanha. Ondas maiores empurram a bola e o barco.",
      tags: ["Ondas fortes", "Visual"],
      bg: 0xe8a98a, fog: [0xe8a98a, 60, 300], exposure: 0.95,
      sky: { top: 0x3b3f8f, horizon: 0xff9b62, bottom: 0x5a3a55 },
      sunOff: [-16, 6.5, -10], sunColor: 0xffa860, sunInt: 1.15,
      hemi: [0xffc9a0, 0x3a2a40, 0.6], fill: [0xff7a9a, 0.35],
      clouds: 0.9, cloudColor: 0xffc6a8,
      water: { color: 0xc89aa8, tint: [0.7, 0.72, 0.9], opacity: 0.86, emissive: 0x2a1018, emissiveInt: 0.15, idle: 2.0, damp: 0.995 },
      drag: 1, grip: 1, force: "none", obstacles: [],
      shell: {
        wall: ["stone", "#6f6258", "#4d443d"], floor: ["sand", "#8a7a62", "#6e604c"],
        cope: ["plank", "#8b6b4a", "#6a4f35"], deck: ["grass", "#58733f", "#4c6636"],
        wallRough: 0.8, deckScale: 3
      }
    },

    neon: {
      id: "neon", name: "PISCINA NOTURNA", short: "NOTURNA",
      desc: "Noite de decisão: luzes subaquáticas em neon, refletores e torcida de celular na mão.",
      tags: ["Noturno", "Visual"],
      bg: 0x070b1c, fog: [0x070b1c, 50, 260], exposure: 1.05,
      sky: { top: 0x03040f, horizon: 0x2a1450, bottom: 0x050818 },
      sunOff: [-6, 10, -5], sunColor: 0x9db8ff, sunInt: 0.5,
      hemi: [0x4a5bd0, 0x120a2a, 0.5], fill: [0xff3df0, 0.55],
      clouds: 0, stars: true,
      water: { color: 0x4aa8d8, tint: [0.35, 0.8, 1.0], opacity: 0.8, emissive: 0x0b4b7a, emissiveInt: 0.55, idle: 1, damp: 0.993 },
      drag: 1, grip: 1, force: "none", obstacles: [],
      shell: {
        wall: ["tile", "#1b2f6b", "#101c45"], floor: ["tile", "#0f2a66", "#0a1d4a"],
        cope: ["tile", "#22243b", "#15172a"], deck: ["tile", "#1a1b2e", "#10111f"],
        wallRough: 0.25, deckScale: 1
      }
    },

    veneza: {
      id: "veneza", name: "CANAL DE VENEZA", short: "VENEZA",
      desc: "Canal entre casas antigas, com pilares de pedra no meio para passes e rebotes.",
      tags: ["Obstáculos", "Estratégico"],
      bg: 0xe9dcc8, fog: [0xe9dcc8, 70, 300], exposure: 0.9,
      sky: { top: 0x5c8fcb, horizon: 0xf4e2c4, bottom: 0x4a6a78 },
      sunOff: [-9, 10, 6], sunColor: 0xffeacb, sunInt: 1.0,
      hemi: [0xfff1de, 0x3a3340, 0.7], fill: [0x9ec8ff, 0.3],
      clouds: 1,
      water: { color: 0x6fa89a, tint: [0.45, 0.75, 0.7], opacity: 0.9, emissive: 0x000000, emissiveInt: 0, idle: 0.8, damp: 0.993 },
      drag: 1, grip: 1, force: "none",
      obstacles: [
        { kind: "pillar", x: -14, z: -32, r: 1.7 }, { kind: "pillar", x: 14, z: -32, r: 1.7 },
        { kind: "pillar", x: -14, z: 32, r: 1.7 }, { kind: "pillar", x: 14, z: 32, r: 1.7 },
        { kind: "pillar", x: -24, z: 0, r: 1.7 }, { kind: "pillar", x: 24, z: 0, r: 1.7 }
      ],
      shell: {
        wall: ["brick", "#a86f4f", "#7a4e38"], floor: ["tile", "#3d6f68", "#2f5853"],
        cope: ["stone", "#cfc2ad", "#aa9d86"], deck: ["stone", "#b3a58e", "#8f836f"],
        wallRough: 0.8, deckScale: 2
      }
    },

    gelo: {
      id: "gelo", name: "LAGOA CONGELADA", short: "GELO",
      desc: "Crepúsculo polar com aurora. Água pesada, gelo à deriva e pouca aderência.",
      tags: ["Gelo", "Obstáculos móveis", "Escorrega"],
      bg: 0x8fb4cc, fog: [0x8fb4cc, 50, 260], exposure: 0.95,
      sky: { top: 0x0e2a55, horizon: 0x9cc6e0, bottom: 0x2a4a68 },
      sunOff: [-4, 7, 6], sunColor: 0xcfe4ff, sunInt: 0.85,
      hemi: [0xbfdcf5, 0x5a7890, 0.8], fill: [0x7fc4ff, 0.4],
      clouds: 0.5, cloudColor: 0xcfdcea, snow: true, aurora: true,
      water: { color: 0x6aa5c4, tint: [0.3, 0.55, 0.72], opacity: 0.93, emissive: 0x0a2e48, emissiveInt: 0.2, idle: 0.35, damp: 0.985 },
      drag: 1.3, grip: 0.45, force: "none",
      obstacles: [
        { kind: "floe", x: -16, z: -14, r: 2.6, vx: 1.2, vz: 0.8 },
        { kind: "floe", x: 15, z: 12, r: 2.2, vx: -1.0, vz: 1.1 },
        { kind: "floe", x: -6, z: -40, r: 2.8, vx: 1.3, vz: -0.6 },
        { kind: "floe", x: 10, z: 42, r: 2.4, vx: -1.2, vz: -0.9 },
        { kind: "floe", x: 22, z: -30, r: 2.0, vx: -0.9, vz: 0.7 }
      ],
      shell: {
        wall: ["ice", "#8fd0e6", "#6fb3cc"], floor: ["ice", "#4a8fb8", "#3a7aa0"],
        cope: ["snow", "#f2f8fb", "#d4e4ec"], deck: ["snow", "#e6f0f5", "#cadbe5"],
        wallRough: 0.12, deckScale: 3
      }
    },

    tropical: {
      id: "tropical", name: "PORTO TROPICAL", short: "TROPICAL",
      desc: "Porto com palmeiras, boias que bloqueiam o caminho e um redemoinho no centro.",
      tags: ["Obstáculos", "Redemoinho"],
      bg: 0xbfe9ea, fog: [0xbfe9ea, 80, 330], exposure: 0.88,
      sky: { top: 0x1d8fe0, horizon: 0xc7f2f0, bottom: 0x2f9cae },
      sunOff: [-4, 13, 4], sunColor: 0xfff4d6, sunInt: 1.15,
      hemi: [0xe5fbff, 0x2a6a6a, 0.8], fill: [0x7fe8ff, 0.3],
      clouds: 1,
      water: { color: 0x5fe0d8, tint: [0.35, 0.95, 0.85], opacity: 0.72, emissive: 0x000000, emissiveInt: 0, idle: 1.3, damp: 0.992 },
      drag: 1, grip: 1, force: "vortex",
      obstacles: [
        { kind: "buoy", x: -12, z: -14, r: 1.1 }, { kind: "buoy", x: 12, z: -14, r: 1.1 },
        { kind: "buoy", x: -12, z: 14, r: 1.1 }, { kind: "buoy", x: 12, z: 14, r: 1.1 },
        { kind: "buoy", x: 0, z: -42, r: 1.1 }, { kind: "buoy", x: 0, z: 42, r: 1.1 }
      ],
      shell: {
        wall: ["plank", "#9a7448", "#6f5233"], floor: ["tile", "#3ac0c4", "#2ea0a8"],
        cope: ["plank", "#b88a55", "#8d6a3f"], deck: ["sand", "#ead9a8", "#d8c58f"],
        wallRough: 0.7, deckScale: 3
      }
    },

    caos: {
      id: "caos", name: "MAPA CAÓTICO", short: "CAÓTICO",
      desc: "Pura bagunça: argolas à deriva, correntezas surpresa que empurram tudo e cores berrantes.",
      tags: ["Caótico", "Correnteza", "Obstáculos móveis"],
      bg: 0xffa6e6, fog: [0xffa6e6, 60, 280], exposure: 0.92,
      sky: { top: 0x5a2bd6, horizon: 0xff86d6, bottom: 0x1fd6c4 },
      sunOff: [-6, 11, 5], sunColor: 0xfff0d0, sunInt: 1.0,
      hemi: [0xffd6ff, 0x2a1a5a, 0.75], fill: [0x40ffe0, 0.45],
      clouds: 0.6, cloudColor: 0xffd0f5, confetti: true,
      water: { color: 0xb48cff, tint: [0.8, 0.55, 1.0], opacity: 0.82, emissive: 0x3a1470, emissiveInt: 0.25, idle: 1.4, damp: 0.992 },
      drag: 1, grip: 0.85, force: "current",
      obstacles: [
        { kind: "ring", x: -18, z: -20, r: 1.7, vx: 2.4, vz: 1.6 },
        { kind: "ring", x: 18, z: -10, r: 1.7, vx: -2.0, vz: 2.4 },
        { kind: "ring", x: -10, z: 12, r: 1.7, vx: 2.6, vz: -1.8 },
        { kind: "ring", x: 12, z: 25, r: 1.7, vx: -2.8, vz: -1.4 },
        { kind: "ring", x: -20, z: 40, r: 1.7, vx: 1.8, vz: -2.6 },
        { kind: "ring", x: 20, z: -45, r: 1.7, vx: -1.6, vz: 2.2 }
      ],
      shell: {
        wall: ["tile", "#e0409a", "#a82a72"], floor: ["tile", "#ffd23a", "#d9a91f"],
        cope: ["checker", "#ffffff", "#222222"], deck: ["checker", "#6a3fd1", "#4a28a8"],
        wallRough: 0.3, deckScale: 4
      }
    }
  };

  const MAP_ORDER = ["olimpica", "lago", "neon", "veneza", "gelo", "tropical", "caos"];
  let curTheme = THEMES.olimpica;

  // ==================================================
  // ILUMINAÇÃO
  // ==================================================

  const hemi = new THREE.HemisphereLight(0xdaf4ff, 0x18313b, 0.65);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe5c2, 1.0);
  sun.position.set(-5, 11, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.radius = 3;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x75cfff, 0.3);
  fill.position.set(5, 5, -8);
  scene.add(fill);

  // ==================================================
  // CÉU, NUVENS E REFLEXOS (ENVIRONMENT MAP)
  // ==================================================

  function skyMaterial() {
    const lin = hex => new THREE.Color(hex).convertSRGBToLinear();

    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: lin(curTheme.sky.top) },
        horizon: { value: lin(curTheme.sky.horizon) },
        bottom: { value: lin(curTheme.sky.bottom) },
        sunColor: { value: lin(curTheme.sunColor) },
        sunDir: { value: SUN_OFF.clone().normalize() }
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 bottom;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        varying vec3 vDir;

        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;

          vec3 col = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55));
          col = mix(bottom, col, smoothstep(-0.25, 0.0, h));

          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 700.0) * 3.0 + pow(s, 14.0) * 0.20);

          gl_FragColor = vec4(col, 1.0);
          #include <encodings_fragment>
        }
      `
    });
  }

  // Domo do céu visível na cena
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(100, 32, 16),
    skyMaterial()
  );
  skyDome.renderOrder = -10;
  scene.add(skyDome);

  // Nuvens suaves
  function cloudTexture() {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const g = c.getContext("2d");

    for (let i = 0; i < 14; i++) {
      const x = 50 + Math.random() * 156;
      const y = 50 + Math.random() * 30;
      const r = 24 + Math.random() * 30;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);

      grad.addColorStop(0, "rgba(255,255,255,0.55)");
      grad.addColorStop(1, "rgba(255,255,255,0)");

      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 128);
    }

    return new THREE.CanvasTexture(c);
  }

  const cloudGroup = new THREE.Group();
  scene.add(cloudGroup);

  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloudTexture(),
        transparent: true,
        opacity: 0.55 + Math.random() * 0.25,
        depthWrite: false,
        fog: false
      })
    );

    cloud.userData.op = cloud.material.opacity;
    const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
    const radius = 80;

    cloud.position.set(
      Math.cos(angle) * radius,
      16 + Math.random() * 24,
      Math.sin(angle) * radius
    );

    const size = 38 + Math.random() * 26;
    cloud.scale.set(size, size * 0.45, 1);
    cloudGroup.add(cloud);
  }

  // Mapa de reflexos gerado a partir do céu (cromo, vidro e verniz)
  function buildEnv() {
  try {
    const envScene = new THREE.Scene();

    envScene.add(new THREE.Mesh(
      new THREE.SphereGeometry(50, 32, 16),
      skyMaterial()
    ));

    const sunBall = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );

    sunBall.material.color.setScalar(8);
    sunBall.position.copy(SUN_OFF).normalize().multiplyScalar(40);
    envScene.add(sunBall);

    const pmrem = new THREE.PMREMGenerator(renderer);
    if (scene.environment) scene.environment.dispose();
    scene.environment = pmrem.fromScene(envScene, 0.03).texture;
    pmrem.dispose();

    envScene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  } catch (err) {
    console.warn("Environment map indisponível:", err);
  }
  }

  buildEnv();

  // ==================================================
  // MATERIAIS
  // ==================================================

  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0xf3f5f4,
    metalness: 0.22,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    side: THREE.DoubleSide
  });

  const darkMat = new THREE.MeshPhysicalMaterial({
    color: 0x101c27,
    metalness: 0.45,
    roughness: 0.25,
    clearcoat: 1
  });

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xc9d7df,
    metalness: 0.88,
    roughness: 0.2
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x448aa4,
    metalness: 0.2,
    roughness: 0.12,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    clearcoat: 1
  });

  const seatMat = new THREE.MeshStandardMaterial({
    color: 0xe8e0d2,
    roughness: 0.65
  });

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x8c512b,
    roughness: 0.42
  });

  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x101418,
    roughness: 0.8
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x252c30,
    roughness: 0.9
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe6f6ff,
    metalness: 0.95,
    roughness: 0.12
  });

  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xbdeaff,
    emissiveIntensity: 6.0
  });

  // ==================================================
  // TEXTURAS PROCEDURAIS
  // ==================================================

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // Deck de teca com tábuas, veios e juntas
  (function () {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const g = c.getContext("2d");

    const planks = 9;
    const ph = c.height / planks;

    for (let p = 0; p < planks; p++) {
      const light = 38 + Math.random() * 10;
      g.fillStyle = `hsl(25, 52%, ${light}%)`;
      g.fillRect(0, p * ph, c.width, ph);

      for (let i = 0; i < 38; i++) {
        const y = p * ph + Math.random() * ph;
        g.strokeStyle = `rgba(60,28,10,${0.05 + Math.random() * 0.12})`;
        g.lineWidth = 0.6 + Math.random() * 1.2;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(
          c.width * 0.3, y + (Math.random() - 0.5) * 5,
          c.width * 0.7, y + (Math.random() - 0.5) * 5,
          c.width, y + (Math.random() - 0.5) * 3
        );
        g.stroke();
      }

      // junta entre tábuas
      g.fillStyle = "rgba(15,8,4,0.85)";
      g.fillRect(0, p * ph, c.width, 3);

      // emenda transversal
      const jx = Math.random() * c.width;
      g.fillRect(jx, p * ph, 2.5, ph);
    }

    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = maxAniso;

    woodMat.map = t;
    woodMat.color.set(0xffffff);
    woodMat.roughness = 0.38;
    woodMat.needsUpdate = true;
  })();

  // Estofado com costura em losango
  const seatPadMat = (function () {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d");

    g.fillStyle = "#efe7d8";
    g.fillRect(0, 0, 256, 256);

    g.strokeStyle = "rgba(150,132,104,0.75)";
    g.lineWidth = 2;

    for (let i = -256; i <= 512; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 256, 256);
      g.stroke();

      g.beginPath();
      g.moveTo(i, 256);
      g.lineTo(i + 256, 0);
      g.stroke();
    }

    g.fillStyle = "rgba(120,104,80,0.9)";
    for (let x = 0; x <= 256; x += 64) {
      for (let y = 0; y <= 256; y += 64) {
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
      }
    }

    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1.5, 1.5);
    t.anisotropy = maxAniso;

    return new THREE.MeshStandardMaterial({
      map: t,
      roughness: 0.5,
      metalness: 0.02
    });
  })();

  // Vidro e acabamentos mais realistas com os reflexos do céu
  glassMat.envMapIntensity = 1.6;
  chromeMat.envMapIntensity = 1.4;
  hullMat.envMapIntensity = 0.9;

  const boatRig = new THREE.Group();
  scene.add(boatRig);
  const boat = new THREE.Group();
  boatRig.add(boat);

  // ==================================================
  // FERRAMENTAS DE MODELAGEM
  // ==================================================

  function mesh(geometry, material, parent = boat) {
    const obj = new THREE.Mesh(geometry, material);
    obj.castShadow = true;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }

  function box(parent, material, x, y, z, sx, sy, sz) {
    const obj = mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      material,
      parent
    );

    obj.position.set(x, y, z);
    return obj;
  }

  function cylinder(parent, material, a, b, radius, segments = 12) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = new THREE.Vector3().subVectors(end, start);

    const obj = mesh(
      new THREE.CylinderGeometry(
        radius,
        radius,
        direction.length(),
        segments
      ),
      material,
      parent
    );

    obj.position.copy(start).add(end).multiplyScalar(0.5);

    obj.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    );

    return obj;
  }

  function sphere(parent, material, x, y, z, sx, sy, sz) {
    const obj = mesh(
      new THREE.SphereGeometry(1, 20, 12),
      material,
      parent
    );

    obj.position.set(x, y, z);
    obj.scale.set(sx, sy, sz);
    return obj;
  }

  function beam(parent, material, a, b, radius = 0.035) {
    return cylinder(parent, material, a, b, radius, 10);
  }

  function curveTube(parent, points, material, radius = 0.018) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(p => new THREE.Vector3(...p))
    );

    return mesh(
      new THREE.TubeGeometry(curve, 48, radius, 8, false),
      material,
      parent
    );
  }

  // ==================================================
  // CASCO
  // ==================================================

  const stations = [
    [-3.45, 0.08, 0.90, 0.15],
    [-3.00, 0.48, 0.62, 0.00],
    [-2.20, 0.78, 0.36, -0.12],
    [-1.20, 0.91, 0.20, -0.18],
    [ 0.00, 0.98, 0.10, -0.20],
    [ 1.20, 0.88, 0.10, -0.18],
    [ 2.20, 0.60, 0.12, -0.10],
    [ 3.05, 0.26, 0.18, 0.02],
    [ 3.35, 0.05, 0.24, 0.12]
  ];

  const hullVertices = [];
  const hullIndices = [];
  const ring = 8;

  stations.forEach(([x, width, bottom, top]) => {
    const points = [
      [x, bottom, 0],
      [x, bottom + 0.12, width * 0.62],
      [x, top - 0.03, width * 0.94],
      [x, top, width],
      [x, top, -width],
      [x, top - 0.03, -width * 0.94],
      [x, bottom + 0.12, -width * 0.62],
      [x, bottom, 0]
    ];

    points.forEach(p => hullVertices.push(...p));
  });

  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j;
      const b = i * ring + (j + 1) % ring;
      const c = (i + 1) * ring + j;
      const d = (i + 1) * ring + (j + 1) % ring;

      hullIndices.push(a, c, b, b, c, d);
    }
  }

  const hullGeometry = new THREE.BufferGeometry();

  hullGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(hullVertices, 3)
  );

  hullGeometry.setIndex(hullIndices);
  hullGeometry.computeVertexNormals();

  mesh(hullGeometry, hullMat);

  // Frisos laterais metálicos
  for (const side of [-1, 1]) {
    curveTube(boat, [
      [-3.1, 0.02, side * 0.45],
      [-2.4, 0.08, side * 0.72],
      [-1.2, 0.02, side * 0.87],
      [0.2, 0.02, side * 0.91],
      [1.5, 0.06, side * 0.76],
      [2.5, 0.10, side * 0.48],
      [3.15, 0.17, side * 0.18]
    ], chromeMat, 0.025);
  }

  // ==================================================
  // CONVÉS
  // ==================================================

  const deckShape = new THREE.Shape();

  deckShape.moveTo(-3.2, -0.42);
  deckShape.lineTo(-3.2, 0.42);
  deckShape.lineTo(-2.5, 0.73);
  deckShape.lineTo(-1.3, 0.86);
  deckShape.lineTo(0, 0.91);
  deckShape.lineTo(1.3, 0.79);
  deckShape.lineTo(2.25, 0.53);
  deckShape.lineTo(3, 0.22);
  deckShape.lineTo(3.18, 0);
  deckShape.lineTo(3, -0.22);
  deckShape.lineTo(2.25, -0.53);
  deckShape.lineTo(1.3, -0.79);
  deckShape.lineTo(0, -0.91);
  deckShape.lineTo(-1.3, -0.86);
  deckShape.lineTo(-2.5, -0.73);
  deckShape.closePath();

  const deck = mesh(
    new THREE.ShapeGeometry(deckShape, 12),
    seatMat
  );

  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.12;

  // Piso de madeira
  box(boat, woodMat, 0.65, 0.145, 0, 2.8, 0.035, 1.05);

  for (let z = -0.49; z <= 0.5; z += 0.14) {
    box(boat, darkMat, 0.65, 0.166, z,
      2.65, 0.008, 0.012);
  }

  for (const side of [-1, 1]) {
    curveTube(boat, [
      [0.9, 0.18, side * 0.56],
      [1.8, 0.18, side * 0.48],
      [2.5, 0.18, side * 0.29],
      [3.0, 0.18, side * 0.10]
    ], chromeMat, 0.012);
  }

  // ==================================================
  // ASSENTOS: UM ATRÁS DO OUTRO
  // ==================================================

  function seat(x, z, width, depth) {
    const group = new THREE.Group();
    boat.add(group);

    // Base
    box(group, rubberMat,
      x, 0.24, z,
      width + 0.08, 0.10, depth + 0.08);

    // Almofada
    box(group, seatPadMat,
      x, 0.31, z,
      width, 0.10, depth);

    // Encosto
    const back = box(group, seatPadMat,
      x - depth * 0.42, 0.53, z,
      0.11, 0.40, width);

    back.rotation.z = 0.08;
  }

  // Assento dianteiro — deslocado para trás
  seat(-0.45, 0, 0.56, 0.55);

  // Assento traseiro — deslocado para trás
  seat(-1.55, 0, 0.56, 0.55);

  // Solário da proa
  box(boat, seatMat, 2.15, 0.23, 0,
    1.05, 0.12, 0.75);

  box(boat, seatMat, 2.7, 0.23, 0,
    0.45, 0.12, 0.45);

  // ==================================================
  // PAINEL E VOLANTE
  // Volante atrás da viseira e à frente dos assentos
  // ==================================================

  // Painel central
  // (desce até o piso para não ficar flutuando)
  box(boat, darkMat,
    0.20, 0.41, 0,
    0.18, 0.54, 0.66);

  // Instrumentos do painel
  for (let i = 0; i < 3; i++) {
    const z = -0.21 + i * 0.21;

    const dial = mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.025, 24),
      blackMat
    );

    dial.position.set(0.10, 0.57, z);
    dial.rotation.z = Math.PI / 2;

    sphere(boat, chromeMat,
      0.081, 0.57, z,
      0.009, 0.018, 0.018);
  }

  // Coluna do volante: nasce dentro do painel e sobe até o centro do volante
  cylinder(boat, metalMat,
    [0.16, 0.52, 0],
    [0.01, 0.78, 0],
    0.035
  );

  // Volante (grupo inclinado, preso ao fim da coluna)
  const steering = new THREE.Group();
  steering.position.set(0.01, 0.78, 0);
  steering.rotation.z = -0.35;
  boat.add(steering);

  const wheelRing = mesh(
    new THREE.TorusGeometry(0.15, 0.018, 8, 28),
    darkMat,
    steering
  );
  wheelRing.rotation.y = Math.PI / 2;

  // Centro do volante
  sphere(steering, metalMat, 0, 0, 0, 0.035, 0.035, 0.035);

  // Raios do volante (do centro até o aro)
  beam(steering, metalMat, [0, 0, 0], [0, 0.15, 0], 0.012);
  beam(steering, metalMat, [0, 0, 0], [0, -0.075, 0.13], 0.012);
  beam(steering, metalMat, [0, 0, 0], [0, -0.075, -0.13], 0.012);

  // Alavanca de câmbio (base apoiada no piso, ao lado do painel)
  box(boat, darkMat, 0.06, 0.18, -0.42, 0.14, 0.07, 0.14);

  beam(boat, metalMat,
    [0.06, 0.18, -0.42],
    [0.04, 0.44, -0.42], 0.025);

  sphere(boat, blackMat,
    0.04, 0.45, -0.42,
    0.045, 0.045, 0.045);

  // ==================================================
  // VISEIRA / PARA-BRISA
  // ==================================================

  function glassPane(points) {
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points.flat(), 3)
    );

    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();

    return mesh(geometry, glassMat);
  }

  glassPane([
    [0.55, 0.58, -0.73],
    [1.12, 0.98, -0.44],
    [1.12, 0.98, 0],
    [0.55, 0.58, 0]
  ]);

  glassPane([
    [0.55, 0.58, 0],
    [1.12, 0.98, 0],
    [1.12, 0.98, 0.44],
    [0.55, 0.58, 0.73]
  ]);

  // Base da viseira: parede que liga o para-brisa ao convés
  box(boat, darkMat,
    0.55, 0.36, 0,
    0.12, 0.45, 1.50);

  for (const z of [-0.73, 0, 0.73]) {
    beam(boat, metalMat,
      [0.55, 0.58, z],
      [1.12, 0.98, z * 0.62],
      0.025);
  }

  beam(boat, darkMat,
    [0.55, 0.58, -0.73],
    [0.55, 0.58, 0.73],
    0.035);

  for (const z of [-0.73, 0.73]) {
    beam(boat, darkMat,
      [0.55, 0.58, z],
      [0.55, 0.14, z],
      0.04);
  }

  beam(boat, metalMat,
    [1.12, 0.98, -0.45],
    [1.12, 0.98, 0.45],
    0.025);

  // ==================================================
  // GUARDA-CORPO
  // ==================================================

  for (const side of [-1, 1]) {
    const points = [
      [0.95, 0.28, side * 0.56],
      [1.7, 0.33, side * 0.62],
      [2.5, 0.36, side * 0.40],
      [3.13, 0.32, side * 0.12]
    ];

    curveTube(boat, points, chromeMat, 0.025);

    points.forEach(p => {
      beam(boat, metalMat,
        [p[0], 0.17, p[2] * 0.96],
        p, 0.018);
    });
  }

  // ==================================================
  // TORRE SUPERIOR
  // ==================================================

  for (const side of [-1, 1]) {
    // Pilar traseiro: do convés até a estrutura do teto
    beam(boat, darkMat,
      [-1.9, 0.14, side * 0.50],
      [-1.35, 1.75, side * 0.58],
      0.075);

    beam(boat, darkMat,
      [-1.35, 1.75, side * 0.58],
      [0.35, 1.75, side * 0.58],
      0.075);
  }

  const roof = box(boat, darkMat,
    -0.5, 1.79, 0, 2, 0.10, 1.42);

  roof.rotation.z = -0.025;

  box(boat, metalMat,
    -0.5, 1.84, 0, 1.85, 0.012, 1.32);

  for (const z of [-0.48, 0, 0.48]) {
    box(boat, ledMat,
      0.43, 1.72, z, 0.20, 0.025, 0.06);
  }

  beam(boat, metalMat,
    [-0.9, 1.83, 0],
    [-0.9, 2.15, 0],
    0.012);

  sphere(boat, blackMat,
    -0.9, 2.15, 0, 0.04, 0.035, 0.04);

  // ==================================================
  // MOTOR TRASEIRO
  // ==================================================

  const motor = new THREE.Group();
  boat.add(motor);

  // Materiais do motor: casco branco com faixa azul, bem visível
  const motorMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2f5f7,
    metalness: 0.3,
    roughness: 0.25,
    clearcoat: 1
  });

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: 0x1676a2,
    metalness: 0.5,
    roughness: 0.25,
    clearcoat: 1
  });

  // Suporte preso à borda traseira do convés
  box(motor, metalMat, -3.25, 0.31, 0,
    0.16, 0.38, 0.50);

  // Capô superior
  sphere(motor, motorMat, -3.45, 0.78, 0,
    0.34, 0.26, 0.30);

  // Faixa azul sob o capô
  sphere(motor, accentMat, -3.45, 0.62, 0,
    0.33, 0.09, 0.29);

  // Grade de ventilação
  box(motor, blackMat, -3.12, 0.78, 0,
    0.02, 0.07, 0.26);

  // Coluna central do motor
  box(motor, motorMat, -3.45, 0.20, 0,
    0.30, 0.75, 0.26);

  // Cavitation plate
  box(motor, accentMat, -3.47, -0.17, 0,
    0.50, 0.03, 0.30);

  // Pé / torpedo da hélice
  sphere(motor, motorMat, -3.50, -0.28, 0,
    0.28, 0.12, 0.12);

  // Cubo da hélice
  sphere(motor, chromeMat, -3.80, -0.28, 0,
    0.06, 0.06, 0.06);

  // Hélice com 3 pás
  for (let i = 0; i < 3; i++) {
    const prop = new THREE.Group();
    prop.position.set(-3.80, -0.28, 0);
    prop.rotation.x = i * Math.PI * 2 / 3;
    motor.add(prop);

    const blade = box(prop, metalMat, 0, 0.10, 0,
      0.015, 0.20, 0.07);
    blade.rotation.y = 0.5;
  }

  // ==================================================
  // DETALHES EXTERNOS
  // ==================================================

  for (const side of [-1, 1]) {
    for (const x of [-2.4, -1.5, 1, 2]) {
      sphere(boat, chromeMat,
        x, 0.20, side * 0.66,
        0.075, 0.025, 0.035);
    }
  }

  for (const side of [-1, 1]) {
    const lamp = box(boat, ledMat,
      2.91, 0.20, side * 0.23,
      0.22, 0.045, 0.12);

    lamp.rotation.y = side * 0.18;
  }

  sphere(boat, metalMat,
    0.2, 0.19, -0.91,
    0.13, 0.06, 0.025);

  // ==================================================
  // ÁGUA TEXTURIZADA
  // ==================================================

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);

  gradient.addColorStop(0, "#0c4059");
  gradient.addColorStop(0.5, "#146581");
  gradient.addColorStop(1, "#092b44");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 700; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const length = 4 + Math.random() * 32;

    ctx.beginPath();
    ctx.moveTo(x, y);

    ctx.quadraticCurveTo(
      x + length * 0.5,
      y - 2,
      x + length,
      y + Math.random() * 3
    );

    ctx.strokeStyle = Math.random() > 0.5
      ? "rgba(170,225,240,0.20)"
      : "rgba(0,15,30,0.18)";

    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.stroke();
  }

  const waterTexture = new THREE.CanvasTexture(canvas);

  waterTexture.wrapS = THREE.RepeatWrapping;
  waterTexture.wrapT = THREE.RepeatWrapping;
  waterTexture.repeat.set(24, 24);
  waterTexture.anisotropy = maxAniso;

  // Mapa de normais de ondas (repetível, gerado por somas de senos)
  const waveCanvas = document.createElement("canvas");
  waveCanvas.width = 256;
  waveCanvas.height = 256;

  (function () {
    const g = waveCanvas.getContext("2d");
    const img = g.createImageData(256, 256);
    const N = 256;
    const TAU = Math.PI * 2;

    const waves = [
      [3, 1, 1.0, 0.3], [2, 5, 0.8, 1.7], [6, 2, 0.6, 2.9],
      [1, 7, 0.5, 4.1], [9, 4, 0.35, 0.8], [5, 11, 0.3, 5.2],
      [12, 3, 0.22, 3.3], [7, 9, 0.2, 1.1]
    ];

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let dx = 0;
        let dy = 0;

        for (const [kx, ky, a, ph] of waves) {
          const arg = TAU * (kx * x + ky * y) / N + ph;
          const c = Math.cos(arg) * a * TAU / N;
          dx += c * kx;
          dy += c * ky;
        }

        const nx = -dx * 6;
        const ny = -dy * 6;
        const len = Math.hypot(nx, ny, 1);
        const i = (y * N + x) * 4;

        img.data[i] = (nx / len * 0.5 + 0.5) * 255;
        img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
        img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }

    g.putImageData(img, 0, 0);
  })();

  const waveNormal = new THREE.CanvasTexture(waveCanvas);
  waveNormal.wrapS = THREE.RepeatWrapping;
  waveNormal.wrapT = THREE.RepeatWrapping;
  waveNormal.anisotropy = maxAniso;

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x7fb0d6,
    map: waterTexture,
    normalMap: waveNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    metalness: 0.12,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.5
  });

  // ==================================================
  // PISCINA FECHADA (formato vertical: comprida no eixo Z)
  // ==================================================

  const HX = 30;           // meia-largura da piscina
  const HZ = 90;           // meio-comprimento da piscina
  const WATER_Y = -0.38;   // nível da água
  const FLOOR_Y = -2.6;    // fundo
  const RIM_Y = 0.55;      // borda / deck

  function tileCanvas(base, grout) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");

    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);

    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
        g.fillRect(x * 64, y * 64, 64, 64);
        g.fillStyle = `rgba(0,30,50,${Math.random() * 0.06})`;
        g.fillRect(x * 64, y * 64, 64, 64);
      }
    }

    g.strokeStyle = grout;
    g.lineWidth = 4;
    g.strokeRect(0, 0, 128, 128);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(64, 0); g.lineTo(64, 128);
    g.moveTo(0, 64); g.lineTo(128, 64);
    g.stroke();

    return c;
  }

  function tileTexture(canvasEl, rx, ry) {
    const t = new THREE.CanvasTexture(canvasEl);
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = maxAniso;
    return t;
  }

  const wallCanvas = tileCanvas("#3f8fbe", "#2f729a");
  const floorCanvas = tileCanvas("#1f6a98", "#175580");
  const deckCanvas = tileCanvas("#b8b2a4", "#9d9788");

  const WALL_H = RIM_Y - FLOOR_Y;

  const wallMats = [];

  function poolWall(len, cx, cz, rotY) {
    const wm = new THREE.MeshStandardMaterial({
      map: tileTexture(wallCanvas, len / 1.2, WALL_H / 1.2),
      roughness: 0.3
    });
    wm.userData.rx = len / 1.2;
    wm.userData.ry = WALL_H / 1.2;
    wallMats.push(wm);

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(len, WALL_H),
      wm
    );

    wall.position.set(cx, (RIM_Y + FLOOR_Y) / 2, cz);
    wall.rotation.y = rotY;
    wall.receiveShadow = true;
    scene.add(wall);
  }

  poolWall(2 * HX, 0, -HZ, 0);
  poolWall(2 * HX, 0, HZ, Math.PI);
  poolWall(2 * HZ, -HX, 0, Math.PI / 2);
  poolWall(2 * HZ, HX, 0, -Math.PI / 2);

  const poolFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * HX, 2 * HZ),
    new THREE.MeshStandardMaterial({
      map: tileTexture(floorCanvas, (2 * HX) / 1.2, (2 * HZ) / 1.2),
      roughness: 0.4
    })
  );

  poolFloor.rotation.x = -Math.PI / 2;
  poolFloor.position.y = FLOOR_Y;
  poolFloor.receiveShadow = true;
  scene.add(poolFloor);

  // marcações pintadas no fundo (raias, círculo central, áreas dos gols)
  const markCanvas = document.createElement("canvas");
  markCanvas.width = 512;
  markCanvas.height = 1536;
  (function () {
    const g = markCanvas.getContext("2d");
    const W = markCanvas.width, H = markCanvas.height;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,0.85)";
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.lineWidth = 7;
    g.strokeRect(10, 10, W - 20, H - 20);
    g.beginPath(); g.moveTo(10, H / 2); g.lineTo(W - 10, H / 2); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, 70, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, 9, 0, Math.PI * 2); g.fill();
    // áreas dos gols
    g.strokeRect(W / 2 - 120, 10, 240, 150);
    g.strokeRect(W / 2 - 120, H - 160, 240, 150);
    g.beginPath(); g.arc(W / 2, 160, 60, 0, Math.PI); g.stroke();
    g.beginPath(); g.arc(W / 2, H - 160, 60, Math.PI, Math.PI * 2); g.stroke();
  })();
  const markTex = new THREE.CanvasTexture(markCanvas);
  markTex.encoding = THREE.sRGBEncoding;
  markTex.anisotropy = maxAniso;
  const markMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * HX, 2 * HZ),
    new THREE.MeshBasicMaterial({ map: markTex, transparent: true, opacity: 0.7, depthWrite: false })
  );
  markMesh.rotation.x = -Math.PI / 2;
  markMesh.position.y = FLOOR_Y + 0.02;
  markMesh.renderOrder = 1;
  scene.add(markMesh);

  // cáusticas: luz do sol refratada dançando no fundo
  const causticCanvas = document.createElement("canvas");
  causticCanvas.width = causticCanvas.height = 192;
  (function () {
    const g = causticCanvas.getContext("2d");
    const N = 192;
    const img = g.createImageData(N, N);
    const TAU = Math.PI * 2;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const px = (x / N) * TAU * 2 % TAU - 250;
        const py = (y / N) * TAU * 2 % TAU - 250;
        let ix = px, iy = py, c = 1;
        const tt = 23.5;
        for (let n = 0; n < 5; n++) {
          const tn = tt * (1 - 3.5 / (n + 1));
          ix = px + Math.cos(tn - ix) + Math.sin(tn + iy);
          iy = py + Math.sin(tn - iy) + Math.cos(tn + ix);
          c += 1 / Math.hypot(px / (Math.sin(ix + tn) / 0.005), py / (Math.cos(iy + tn) / 0.005));
        }
        c /= 5;
        c = 1.17 - Math.pow(c, 1.4);
        const v = Math.min(1, Math.pow(Math.abs(c), 8));
        const k = (y * N + x) * 4;
        img.data[k] = 255; img.data[k + 1] = 255; img.data[k + 2] = 255;
        img.data[k + 3] = v * 255;
      }
    }
    g.putImageData(img, 0, 0);
  })();
  const causticTex = new THREE.CanvasTexture(causticCanvas);
  causticTex.wrapS = causticTex.wrapT = THREE.RepeatWrapping;
  causticTex.repeat.set(HX / 5, HZ / 5);
  causticTex.anisotropy = maxAniso;
  const causticMat = new THREE.MeshBasicMaterial({
    map: causticTex, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  let causticBase = 0.4;
  const causticMesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * HX, 2 * HZ), causticMat);
  causticMesh.rotation.x = -Math.PI / 2;
  causticMesh.position.y = FLOOR_Y + 0.04;
  causticMesh.renderOrder = 2;
  scene.add(causticMesh);

  // Deck ao redor + borda (coping)
  function ringGeometry(oX, oZ, iX, iZ) {
    const s = new THREE.Shape();
    s.moveTo(-oX, -oZ);
    s.lineTo(oX, -oZ);
    s.lineTo(oX, oZ);
    s.lineTo(-oX, oZ);
    s.closePath();

    const hole = new THREE.Path();
    hole.moveTo(-iX, -iZ);
    hole.lineTo(-iX, iZ);
    hole.lineTo(iX, iZ);
    hole.lineTo(iX, -iZ);
    hole.closePath();
    s.holes.push(hole);

    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    return g;
  }

  const COPE = 1.3;

  const copingMesh = new THREE.Mesh(
    ringGeometry(HX + COPE, HZ + COPE, HX, HZ),
    new THREE.MeshStandardMaterial({
      map: tileTexture(tileCanvas("#d6d1c6", "#b9b3a5"), 1 / 1.2, 1 / 1.2),
      roughness: 0.45
    })
  );
  copingMesh.position.y = RIM_Y;
  copingMesh.receiveShadow = true;
  scene.add(copingMesh);

  const deckMesh = new THREE.Mesh(
    ringGeometry(600, 600, HX + COPE, HZ + COPE),
    new THREE.MeshStandardMaterial({
      map: tileTexture(deckCanvas, 1 / 1.2, 1 / 1.2),
      roughness: 0.7
    })
  );
  deckMesh.position.y = RIM_Y - 0.02;
  deckMesh.receiveShadow = true;
  scene.add(deckMesh);

  // ==================================================
  // ÁGUA: SIMULAÇÃO DE ONDAS (equação de onda em grade)
  // ==================================================

  const NX = LOW ? 64 : 90;
  const NZ = LOW ? 192 : 270;
  const GW = NX + 1;
  const GN = GW * (NZ + 1);
  const dx = (2 * HX) / NX;
  const dz = (2 * HZ) / NZ;

  const hf = new Float32Array(GN);     // altura
  const vf = new Float32Array(GN);     // velocidade vertical
  const foamField = new Float32Array(GN); // espuma persistente (esteira)

  let simTime = 0;

  const waterGeo = new THREE.PlaneGeometry(2 * HX, 2 * HZ, NX, NZ);
  waterGeo.rotateX(-Math.PI / 2);

  const wPos = waterGeo.attributes.position;
  const wCol = new Float32Array(GN * 3);
  const gridX = new Float32Array(GW);
  const gridZ = new Float32Array(NZ + 1);

  for (let i = 0; i <= NX; i++) gridX[i] = -HX + i * dx;
  for (let j = 0; j <= NZ; j++) gridZ[j] = -HZ + j * dz;

  for (let j = 0; j <= NZ; j++) {
    for (let i = 0; i <= NX; i++) {
      const k = j * GW + i;
      wPos.setXYZ(k, gridX[i], 0, gridZ[j]);
    }
  }

  waterGeo.setAttribute("color", new THREE.BufferAttribute(wCol, 3));

  waterMat.vertexColors = true;
  waterMat.transparent = true;
  waterMat.opacity = 0.84;
  waterMat.depthWrite = false;   // deixa ver bolhas e fundo através da água
  waterMat.needsUpdate = true;

  waterTexture.repeat.set((2 * HX) / 2.5, (2 * HZ) / 2.5);

  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  scene.add(water);

  // Marolinha ambiente (sempre presente, mesmo com o barco parado)
  function idleWave(x, z, t) {
    return 0.03 * WAVE_AMP * (Math.sin(x * 0.7 + t * 1.1) + Math.sin(z * 0.45 - t * 0.8) +
      0.6 * Math.sin((x + z) * 1.3 + t * 1.7));
  }

  function clampN(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  // Altura da água em qualquer ponto (interpolação bilinear)
  function heightAt(x, z) {
    const fx = (x + HX) / dx;
    const fz = (z + HZ) / dz;
    const i = clampN(Math.floor(fx), 0, NX - 1);
    const j = clampN(Math.floor(fz), 0, NZ - 1);
    const tx = clampN(fx - i, 0, 1);
    const tz = clampN(fz - j, 0, 1);
    const k = j * GW + i;

    const top = hf[k] * (1 - tx) + hf[k + 1] * tx;
    const bot = hf[k + GW] * (1 - tx) + hf[k + GW + 1] * tx;

    return top * (1 - tz) + bot * tz + idleWave(x, z, simTime);
  }

  // Empurra a água (amp negativo = afunda, positivo = levanta)
  function impulse(x, z, amp, rad) {
    const ci = (x + HX) / dx;
    const cj = (z + HZ) / dz;
    const ri = rad / dx;
    const rj = rad / dz;

    const j0 = Math.max(1, Math.floor(cj - rj));
    const j1 = Math.min(NZ - 1, Math.ceil(cj + rj));
    const i0 = Math.max(1, Math.floor(ci - ri));
    const i1 = Math.min(NX - 1, Math.ceil(ci + ri));

    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot((i - ci) * dx, (j - cj) * dz) / rad;
        if (d < 1) {
          const f = 1 - d * d;
          vf[j * GW + i] += amp * f * f;
        }
      }
    }
  }

  function foamAt(x, z, amt, rad) {
    const ci = (x + HX) / dx;
    const cj = (z + HZ) / dz;
    const ri = rad / dx;
    const rj = rad / dz;

    const j0 = Math.max(1, Math.floor(cj - rj));
    const j1 = Math.min(NZ - 1, Math.ceil(cj + rj));
    const i0 = Math.max(1, Math.floor(ci - ri));
    const i1 = Math.min(NX - 1, Math.ceil(ci + ri));

    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot((i - ci) * dx, (j - cj) * dz) / rad;
        if (d < 1) {
          const k = j * GW + i;
          foamField[k] = Math.min(1, foamField[k] + amt * (1 - d));
        }
      }
    }
  }

  // Um passo da simulação (60 Hz fixo)
  function stepWaves() {
    for (let j = 1; j < NZ; j++) {
      const row = j * GW;
      for (let i = 1; i < NX; i++) {
        const k = row + i;
        const avg = (hf[k - 1] + hf[k + 1] + hf[k - GW] + hf[k + GW]) * 0.25;
        vf[k] = (vf[k] + (avg - hf[k]) * 0.14) * WAVE_DAMP;
      }
    }

    for (let j = 1; j < NZ; j++) {
      const row = j * GW;
      for (let i = 1; i < NX; i++) {
        const k = row + i;
        let n = hf[k] + vf[k];
        if (n > 0.45) n = 0.45;
        else if (n < -0.45) n = -0.45;
        hf[k] = n;

        const av = Math.abs(vf[k]);
        let f = foamField[k] * 0.9972;
        if (av > 0.006) f = Math.min(1, f + (av - 0.006) * 5);
        foamField[k] = f;
      }
    }

    // Paredes refletem as ondas
    for (let i = 0; i <= NX; i++) {
      hf[i] = hf[GW + i];
      hf[NZ * GW + i] = hf[(NZ - 1) * GW + i];
    }
    for (let j = 0; j <= NZ; j++) {
      hf[j * GW] = hf[j * GW + 1];
      hf[j * GW + NX] = hf[j * GW + NX - 1];
    }
  }

  // Atualiza malha e cores (estilo: cristas claras + espuma)
  function updateWaterMesh() {
    const arr = wPos.array;
    const t = simTime;

    for (let j = 0; j <= NZ; j++) {
      const z = gridZ[j];
      for (let i = 0; i <= NX; i++) {
        const k = j * GW + i;
        const x = gridX[i];
        const h0 = hf[k];

        arr[k * 3 + 1] = h0 + idleWave(x, z, t);

        const crest = clampN(h0 * 3.6, -0.2, 0.32);
        const f = clampN(foamField[k] * 0.9 + Math.max(0, h0 - 0.1) * 2.5, 0, 1);
        const shade = 0.86 + crest;

        wCol[k * 3] = Math.min(1, (WT[0] * shade) * (1 - f) + f);
        wCol[k * 3 + 1] = Math.min(1, (WT[1] * shade) * (1 - f) + f);
        wCol[k * 3 + 2] = Math.min(1, (WT[2] * shade) * (1 - f) + f);
      }
    }

    wPos.needsUpdate = true;
    waterGeo.attributes.color.needsUpdate = true;
    waterGeo.computeVertexNormals();
  }

  // ==================================================
  // GOLS E BOLA
  // ==================================================

  const GOAL_W = 7;            // meia-largura do gol
  const GOAL_LINE = HZ - 4;    // linha do gol (z)
  const GOAL_H = 3.4;          // altura do travessão (acima da água)
  const POST_R = 0.18;
  const goalPosts = [];

  function netMaterial(w, h) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.strokeStyle = "rgba(235,248,255,0.9)";
    g.lineWidth = 2;
    g.strokeRect(0, 0, 64, 64);

    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / 0.5, h / 0.5);

    return new THREE.MeshBasicMaterial({
      map: t,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }

  function makeGoal(sign, color) {
    const group = new THREE.Group();
    scene.add(group);

    const frameMat = new THREE.MeshPhysicalMaterial({
      color, metalness: 0.3, roughness: 0.25, clearcoat: 1
    });

    const H = GOAL_H - FLOOR_Y;            // altura total (do fundo)
    const midY = (GOAL_H + FLOOR_Y) / 2;
    const depth = HZ - GOAL_LINE;
    const zLine = sign * GOAL_LINE;
    const zMid = sign * (GOAL_LINE + depth / 2);

    function bar(geo, x, y, z, rx, ry, rz) {
      const m = new THREE.Mesh(geo, frameMat);
      m.position.set(x, y, z);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      m.castShadow = true;
      group.add(m);
    }

    for (const sx of [-1, 1]) {
      // poste da frente
      bar(new THREE.CylinderGeometry(POST_R, POST_R, H, 14), sx * GOAL_W, midY, zLine);
      goalPosts.push([sx * GOAL_W, zLine]);

      // barra superior lateral (do poste até a parede)
      bar(new THREE.CylinderGeometry(POST_R * 0.7, POST_R * 0.7, depth, 10),
        sx * GOAL_W, GOAL_H, zMid, Math.PI / 2, 0, 0);

      // poste de trás
      bar(new THREE.CylinderGeometry(POST_R * 0.7, POST_R * 0.7, H, 10),
        sx * GOAL_W, midY, sign * HZ);
    }

    // travessão da frente e de trás
    bar(new THREE.CylinderGeometry(POST_R, POST_R, 2 * GOAL_W, 14),
      0, GOAL_H, zLine, 0, 0, Math.PI / 2);
    bar(new THREE.CylinderGeometry(POST_R * 0.7, POST_R * 0.7, 2 * GOAL_W, 10),
      0, GOAL_H, sign * HZ, 0, 0, Math.PI / 2);

    // redes
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2 * GOAL_W, H), netMaterial(2 * GOAL_W, H));
    back.position.set(0, midY, sign * (HZ - 0.05));
    group.add(back);

    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(depth, H), netMaterial(depth, H));
      side.rotation.y = Math.PI / 2;
      side.position.set(sx * GOAL_W, midY, zMid);
      group.add(side);
    }

    const top = new THREE.Mesh(new THREE.PlaneGeometry(2 * GOAL_W, depth), netMaterial(2 * GOAL_W, depth));
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, GOAL_H, zMid);
    group.add(top);
  }

  makeGoal(-1, 0x1f6fe0);   // gol azul (lado -Z)
  makeGoal(1, 0xd7263d);    // gol vermelho (lado +Z)

  // ---------- bola ----------
  const BALL_R = 1.0;

  const ballTex = (function () {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d");

    g.fillStyle = "#f4f4f2";
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = "#16191c";

    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 7; col++) {
        const cx = col * 78 + (r % 2) * 39;
        const cy = 40 + r * 88;
        g.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
          const px = cx + Math.cos(a) * 24;
          const py = cy + Math.sin(a) * 24;
          if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
        g.fill();
      }
    }

    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = maxAniso;
    return t;
  })();

  // grupo da bola: começa com a esfera procedural e troca pelo modelo GLB ao carregar
  const ballFallback = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 32, 24),
    new THREE.MeshPhysicalMaterial({ map: ballTex, roughness: 0.35, clearcoat: 0.6 })
  );
  ballFallback.castShadow = true;
  ballFallback.receiveShadow = true;

  const ballMesh = new THREE.Group();
  ballMesh.add(ballFallback);
  scene.add(ballMesh);

  function useBallModel(gltf) {
    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = (2 * BALL_R) / (Math.max(size.x, size.y, size.z) || 1);

    root.position.copy(center).multiplyScalar(-1);
    const holder = new THREE.Group();
    holder.add(root);
    holder.scale.setScalar(s);

    holder.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    ballMesh.remove(ballFallback);
    ballMesh.add(holder);
  }

  // carrega o modelo da bola (precisa de servidor local; se falhar, fica a bola simples)
  (function loadBallModel() {
    if (!THREE.GLTFLoader) return;
    new THREE.GLTFLoader().load(
      "ball.glb",
      useBallModel,
      undefined,
      err => console.warn("Não foi possível carregar ball.glb:", err)
    );
  })();

  const ball = { x: 0, z: 0, vx: 0, vz: 0, timer: 0 };
  const score = [0, 0];   // gols dentro do gol azul (-Z) / vermelho (+Z)
  const scoreEl = document.getElementById("score");
  const goalMsg = document.getElementById("goalMsg");

  // ---------- partida ----------
  const MATCH_TIME = 180;   // 3 minutos
  const isComp = () => match.type === "comp" || match.type === "online";
  const match = {
    type: "train",          // train | comp
    size: 1,                // 1, 2 ou 3 jogadores por time
    time: MATCH_TIME,
    countdown: 0,
    lastSec: 999,
    over: false
  };

  // todos os barcos em jogo (jogador + bots)
  const allBoats = [];

  function drawScore() {
    if (match.type === "comp" || match.type === "online") {
      const mt = playerAgent.team;
      scoreEl.textContent = "VOCÊ " + score[mt] + "  ×  " + score[1 - mt] + " ELES";
    } else {
      scoreEl.textContent = "🔵 " + score[0] + "  ×  " + score[1] + " 🔴";
    }
  }
  drawScore();

  function resetBall() {
    ball.x = 0;
    ball.z = 0;
    ball.vx = 0;
    ball.vz = 0;
    ball.timer = 0;
  }

  function bounceOff(nx, nz, e) {
    const vn = ball.vx * nx + ball.vz * nz;
    if (vn < 0) {
      ball.vx -= (1 + e) * vn * nx;
      ball.vz -= (1 + e) * vn * nz;
      return -vn;
    }
    return 0;
  }

  function ballStep(dt) {
    // as ondas empurram a bola ladeira abaixo
    const e = 0.6;
    const sx = (heightAt(ball.x + e, ball.z) - heightAt(ball.x - e, ball.z)) / (2 * e);
    const sz = (heightAt(ball.x, ball.z + e) - heightAt(ball.x, ball.z - e)) / (2 * e);
    ball.vx -= sx * 8 * dt;
    ball.vz -= sz * 8 * dt;

    if (MAP.force !== "none") {
      const fa = mapAccel(ball.x, ball.z);
      ball.vx += fa.x * 0.8 * dt;
      ball.vz += fa.z * 0.8 * dt;
    }

    // arrasto da água
    const drag = Math.exp(-1.1 * dt);
    ball.vx *= drag;
    ball.vz *= drag;

    let sp = Math.hypot(ball.vx, ball.vz);
    if (sp > 18) {
      ball.vx *= 18 / sp;
      ball.vz *= 18 / sp;
    }

    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;

    // paredes da piscina
    const lx = HX - BALL_R;
    const lz = HZ - BALL_R;

    if (ball.x > lx) { ball.x = lx; sfx.ballWall(bounceOff(-1, 0, 0.7), ball.x, ball.z); }
    if (ball.x < -lx) { ball.x = -lx; sfx.ballWall(bounceOff(1, 0, 0.7), ball.x, ball.z); }
    if (ball.z > lz) { ball.z = lz; sfx.ballWall(bounceOff(0, -1, 0.7), ball.x, ball.z); }
    if (ball.z < -lz) { ball.z = -lz; sfx.ballWall(bounceOff(0, 1, 0.7), ball.x, ball.z); }

    // redes laterais dos gols funcionam como parede
    if (Math.abs(ball.z) > GOAL_LINE) {
      for (const side of [-1, 1]) {
        const d = ball.x - side * GOAL_W;
        if (Math.abs(d) < BALL_R) {
          const inside = side * ball.x < side * side * GOAL_W; // lado de dentro do gol
          const dir = d === 0 ? (inside ? -side : side) : Math.sign(d);
          ball.x = side * GOAL_W + dir * BALL_R;
          sfx.ballWall(bounceOff(dir, 0, 0.5) * 0.7, ball.x, ball.z);
        }
      }
    }

    // traves
    for (const [px, pz] of goalPosts) {
      const dx = ball.x - px;
      const dz = ball.z - pz;
      const d = Math.hypot(dx, dz);
      const minD = BALL_R + POST_R;

      if (d < minD && d > 1e-4) {
        const nx = dx / d;
        const nz = dz / d;
        ball.x = px + nx * minD;
        ball.z = pz + nz * minD;
        sfx.ballPost(bounceOff(nx, nz, 0.6), ball.x, ball.z);
      }
    }

    // obstáculos do mapa
    for (const o of MAP.obstacles) {
      const ox = ball.x - o.x;
      const oz = ball.z - o.z;
      const d = Math.hypot(ox, oz);
      const minD = BALL_R + o.r;

      if (d < minD && d > 1e-4) {
        const nx = ox / d;
        const nz = oz / d;
        ball.x = o.x + nx * minD;
        ball.z = o.z + nz * minD;

        const vn = (ball.vx - (o.vx || 0)) * nx + (ball.vz - (o.vz || 0)) * nz;
        if (vn < 0) {
          ball.vx -= 1.75 * vn * nx;
          ball.vz -= 1.75 * vn * nz;
          sfx.ballWall(-vn, ball.x, ball.z);
        }
      }
    }

    // ---------- barcos batem na bola (cápsula ao longo do casco) ----------
    for (const agent of allBoats) {
    const st = agent.st;
    const c = Math.cos(st.heading);
    const s = Math.sin(st.heading);
    const fx = c;
    const fz = -s;
    let t = (ball.x - st.x) * fx + (ball.z - st.z) * fz;
    t = Math.max(-2.5, Math.min(2.5, t));

    const px = st.x + fx * t;
    const pz = st.z + fz * t;
    let nx = ball.x - px;
    let nz = ball.z - pz;
    const d = Math.hypot(nx, nz);
    const minD = BALL_R + 0.85;

    if (d < minD) {
      if (d > 1e-4) {
        nx /= d;
        nz /= d;
      } else {
        nx = -fz;
        nz = fx;
      }

      ball.x = px + nx * minD;
      ball.z = pz + nz * minD;

      const rvx = ball.vx - st.vx;
      const rvz = ball.vz - st.vz;
      const vn = rvx * nx + rvz * nz;

      if (vn < 0) {
        const mBoat = 14;
        const mBall = 1;
        const j = -(1 + 0.3) * vn / (1 / mBoat + 1 / mBall);

        ball.vx += (j * nx) / mBall;
        ball.vz += (j * nz) / mBall;
        st.vx -= (j * nx) / mBoat;
        st.vz -= (j * nz) / mBoat;

        impulse(ball.x, ball.z, 0.02 * Math.min(-vn, 12), 1.4);
        sfx.ballHit(-vn, ball.x, ball.z);
        foamAt(ball.x, ball.z, 0.5, 1.4);
      }
    }

    // onda de proa: carrega a bola quando ela está logo à frente do barco
    {
      const rx = ball.x - st.x;
      const rz = ball.z - st.z;
      const ahead = rx * fx + rz * fz;
      const lateral = Math.abs(-rx * fz + rz * fx);
      const boatSp = Math.hypot(st.vx, st.vz);

      if (ahead > 2.5 && ahead < 7 && lateral < 2.4 && boatSp > 1) {
        const k = Math.min(1, 2.2 * dt);
        ball.vx += (st.vx * 0.95 - ball.vx) * k;
        ball.vz += (st.vz * 0.95 - ball.vz) * k;
      }
    }
    }

    // bola deslizando faz marola
    sp = Math.hypot(ball.vx, ball.vz);
    if (sp > 0.4) {
      impulse(ball.x, ball.z, -0.003 * Math.min(1, sp / 12), 1.1);
      foamAt(ball.x, ball.z, 0.03 * Math.min(1, sp / 12), 0.9);

      // rolagem visual
      const axis = new THREE.Vector3(ball.vz, 0, -ball.vx).normalize();
      ballMesh.quaternion.premultiply(
        new THREE.Quaternion().setFromAxisAngle(axis, (sp * dt) / BALL_R)
      );
    }

    // ---------- gol! ----------
    if (ball.timer > 0) {
      ball.timer -= dt;
      if (ball.timer <= 0) {
        resetBall();
        goalMsg.classList.remove("show");
        // no competitivo todo mundo volta para a posição inicial
        if (isComp() && !match.over) resetPositions();
      }
    } else if (!match.over && match.countdown <= 0 &&
               Math.abs(ball.x) < GOAL_W && Math.abs(ball.z) > GOAL_LINE + 0.4 && net.role !== "guest") {
      score[ball.z < 0 ? 0 : 1]++;
      drawScore();
      ball.timer = 2.4;
      goalMsg.textContent = "GOL!";
      goalMsg.classList.add("show");
      sfx.goal(isComp() && (ball.z < 0 ? 0 : 1) !== playerAgent.team);
      if (net.role === "host") netSend({ t: "goal", team: ball.z < 0 ? 0 : 1, sc: score.slice() });
      tutEvent("goal");
    }
  }

  // ==================================================
  // MAPAS: CENÁRIO, OBSTÁCULOS, FORÇAS E TROCA DE TEMA
  // ==================================================

  const mapRoot = new THREE.Group();
  scene.add(mapRoot);

  let mapDyn = [];                 // funções chamadas a cada frame
  const bannerEl = document.getElementById("banner");

  const rr = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const stdM = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, o || {}));
  const basicM = (color, o) => new THREE.MeshBasicMaterial(Object.assign({ color }, o || {}));

  // ---------- texturas de superfície ----------
  function surfaceCanvas(kind, base, grout) {
    if (kind === "tile") return tileCanvas(base, grout);

    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);

    if (kind === "plank") {
      for (let i = 0; i < 4; i++) {
        g.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.1})`;
        g.fillRect(0, i * 32, 128, 32);
        g.strokeStyle = "rgba(0,0,0,0.12)";
        g.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
          const y = i * 32 + 4 + Math.random() * 24;
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(128, y + rr(-2, 2));
          g.stroke();
        }
        g.fillStyle = grout;
        g.fillRect(0, i * 32, 128, 2);
        g.fillRect(((i * 53) % 100) + 10, i * 32, 2, 32);
      }
    } else if (kind === "stone") {
      g.strokeStyle = grout;
      g.lineWidth = 3;
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const ox = x * 32 + (y % 2) * 8;
          const oy = y * 32;
          g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
          g.fillRect(ox, oy, 32, 32);
          g.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`;
          g.fillRect(ox + 4, oy + 4, 24, 24);
          g.strokeRect(ox, oy, 32, 32);
        }
      }
    } else if (kind === "brick") {
      for (let row = 0; row < 8; row++) {
        for (let col = -1; col < 4; col++) {
          const ox = col * 32 + (row % 2) * 16;
          g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.1})`;
          g.fillRect(ox, row * 16, 32, 16);
        }
      }
      g.strokeStyle = grout;
      g.lineWidth = 2;
      for (let row = 0; row < 8; row++) {
        g.beginPath();
        g.moveTo(0, row * 16);
        g.lineTo(128, row * 16);
        g.stroke();
        for (let col = 0; col < 5; col++) {
          const x = col * 32 + (row % 2) * 16;
          g.beginPath();
          g.moveTo(x, row * 16);
          g.lineTo(x, row * 16 + 16);
          g.stroke();
        }
      }
    } else if (kind === "ice") {
      const gr = g.createLinearGradient(0, 0, 128, 128);
      gr.addColorStop(0, "rgba(255,255,255,0.22)");
      gr.addColorStop(1, "rgba(0,40,80,0.18)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = "rgba(255,255,255,0.4)";
      g.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        let x = Math.random() * 128;
        let y = Math.random() * 128;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += rr(-22, 22);
          y += rr(-22, 22);
          g.lineTo(x, y);
        }
        g.stroke();
      }
    } else if (kind === "grass" || kind === "sand" || kind === "snow") {
      const dots = kind === "snow" ? 260 : 700;
      for (let i = 0; i < dots; i++) {
        const light = Math.random() < 0.5;
        g.fillStyle = kind === "snow"
          ? (light ? "rgba(255,255,255,0.8)" : "rgba(150,185,215,0.25)")
          : (light ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)");
        const s = 1 + Math.random() * (kind === "grass" ? 2 : 3);
        g.fillRect(Math.random() * 128, Math.random() * 128, s, s * (kind === "grass" ? 3 : 1));
      }
    } else if (kind === "checker") {
      g.fillStyle = grout;
      g.fillRect(0, 0, 64, 64);
      g.fillRect(64, 64, 64, 64);
    }

    return c;
  }

  function retex(mat, canvasEl, rx, ry) {
    if (mat.map) mat.map.dispose();
    mat.map = tileTexture(canvasEl, rx, ry);
    mat.needsUpdate = true;
  }

  function stripeTexture(c1, c2, n, vertical) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? c2 : c1;
      if (vertical) g.fillRect(0, (i * 64) / n, 64, 64 / n + 1);
      else g.fillRect((i * 64) / n, 0, 64 / n + 1, 64);
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function glowTexture(inner, outer) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner);
    gr.addColorStop(0.18, inner);
    gr.addColorStop(0.5, outer);
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function disposeTree(root) {
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    while (root.children.length) root.remove(root.children[0]);
  }

  function instanced(geo, mat, items) {
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    const d = new THREE.Object3D();
    items.forEach((it, i) => {
      d.position.set(it.p[0], it.p[1], it.p[2]);
      d.rotation.set(...(it.r || [0, 0, 0]));
      d.scale.set(...(it.s || [1, 1, 1]));
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      if (it.c !== undefined) m.setColorAt(i, new THREE.Color(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    return m;
  }

  // ---------- peças reutilizáveis de cenário ----------
  function buildStands(g, neon) {
    const mat = stdM(neon ? 0x1c1f3a : 0xb9bec7, { roughness: 0.7 });
    const palette = neon
      ? [0x2a2f6a, 0x5a2a7a, 0x1f4a7a, 0x3a2a5a]
      : [0xd7263d, 0x1f6fe0, 0xffd23f, 0xffffff];
    const seats = [];
    const backs = [];

    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const h = 1.2 * (k + 1);
        const x0 = side * (HX + COPE + 3 + k * 4);
        const m = new THREE.Mesh(new THREE.BoxGeometry(4, h, 150), mat);
        m.position.set(x0, RIM_Y + h / 2, 0);
        g.add(m);

        // faixa de acabamento na quina do degrau
        const lip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 150),
          stdM(neon ? 0x6a7cff : 0xe8ecf2, { roughness: 0.5 }));
        lip.position.set(x0 - side * 1.95, RIM_Y + h + 0.06, 0);
        g.add(lip);

        for (let z = -71; z <= 71; z += 1.35) {
          const c = palette[Math.floor((z + 71) / 14) % palette.length];
          seats.push({ p: [x0 + side * 0.2, RIM_Y + h + 0.2, z], c });
          backs.push({ p: [x0 + side * 1.0, RIM_Y + h + 0.6, z], c });
        }
      }
    }

    const seatMatL = stdM(0xffffff, { roughness: 0.55 });
    g.add(instanced(new THREE.BoxGeometry(1.4, 0.35, 1.0), seatMatL, seats));
    g.add(instanced(new THREE.BoxGeometry(0.2, 0.9, 1.0), seatMatL, backs));
  }

  function buildTowers(g, neon) {
    const pole = stdM(0x4b5060, { roughness: 0.6, metalness: 0.4 });
    const head = basicM(0xffffff);
    head.color.setScalar(neon ? 3 : 1.6);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (HX + 9);
        const z = sz * (HZ - 6);

        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 24, 8), pole);
        p.position.set(x, RIM_Y + 12, z);
        g.add(p);

        const h = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 2), head);
        h.position.set(x, RIM_Y + 24.5, z);
        h.lookAt(0, RIM_Y + 10, 0);
        g.add(h);
      }
    }
  }

  function buildTreeBand(g, n, colors, snowCap) {
    const trunks = [];
    const cones1 = [];
    const cones2 = [];

    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * rr(HX + 8, HX + 48);
      const z = rr(-HZ - 40, HZ + 40);
      const s = rr(0.8, 1.7);
      trunks.push({ p: [x, RIM_Y + 1.2 * s, z], s: [s, s, s] });
      cones1.push({ p: [x, RIM_Y + 4.2 * s, z], s: [s, s, s], c: pick(colors) });
      cones2.push({ p: [x, RIM_Y + 6.4 * s, z], s: [s * 0.75, s * 0.75, s * 0.75], c: pick(colors) });
    }

    g.add(instanced(new THREE.CylinderGeometry(0.3, 0.45, 2.4, 6), stdM(0x4a3524), trunks));
    g.add(instanced(new THREE.ConeGeometry(2.4, 5, 8), stdM(0xffffff, { roughness: 0.9 }), cones1));
    g.add(instanced(new THREE.ConeGeometry(1.9, 4.2, 8), stdM(0xffffff, { roughness: 0.9 }), cones2));

    if (snowCap) {
      const caps = cones2.map(c => ({ p: [c.p[0], c.p[1] + 1.2 * c.s[1], c.p[2]], s: [c.s[0] * 0.55, c.s[1] * 0.6, c.s[2] * 0.55] }));
      g.add(instanced(new THREE.ConeGeometry(1.9, 4.2, 8), stdM(0xf4fafc, { roughness: 0.8 }), caps));
    }
  }

  function buildMountains(g, rings) {
    rings.forEach(([count, radius, color, hMin, hMax]) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rr(-0.12, 0.12);
        const h = rr(hMin, hMax);
        const m = new THREE.Mesh(
          new THREE.ConeGeometry(rr(34, 62), h, 7),
          stdM(color, { flatShading: true, roughness: 1 })
        );
        m.position.set(Math.cos(a) * radius, h / 2 - 2, Math.sin(a) * radius);
        m.rotation.y = rr(0, 6);
        g.add(m);
      }
    });
  }

  function birdFlock(g, n, color, cy, rMin, rMax) {
    const birds = [];
    const wingM = basicM(color, { side: THREE.DoubleSide });

    for (let i = 0; i < n; i++) {
      const b = new THREE.Group();
      const l = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), wingM);
      const r = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), wingM);
      l.position.x = -1.1;
      r.position.x = 1.1;
      l.geometry.translate(0, 0, 0);
      b.add(l, r);
      g.add(b);
      birds.push({ b, l, r, a: rr(0, 6.28), rad: rr(rMin, rMax), sp: rr(0.05, 0.1), ph: rr(0, 6), y: cy + rr(-6, 8) });
    }

    mapDyn.push((dt, t) => {
      birds.forEach(o => {
        o.a += o.sp * dt;
        o.b.position.set(Math.cos(o.a) * o.rad, o.y + Math.sin(t * 0.6 + o.ph) * 1.2, Math.sin(o.a) * o.rad);
        o.b.rotation.y = -o.a;
        const f = 0.35 * Math.sin(t * 7 + o.ph);
        o.l.rotation.z = f;
        o.r.rotation.z = -f;
      });
    });
  }

  // grupo que acompanha a câmera (estrelas, lua, sol, aurora, neve)
  function skyFollower(g) {
    const grp = new THREE.Group();
    g.add(grp);
    mapDyn.push(() => grp.position.copy(camera.position));
    return grp;
  }

  function fallingPoints(grp, n, w, h, speed, size, colorFn, sway) {
    n = LOW ? (n >> 1) : n;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rr(-w, w);
      pos[i * 3 + 1] = rr(-4, h);
      pos[i * 3 + 2] = rr(-w, w);
      const c = colorFn(i);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size, sizeAttenuation: false, vertexColors: true, transparent: true,
      opacity: 0.9, depthWrite: false, fog: false
    }));
    pts.frustumCulled = false;
    grp.add(pts);

    mapDyn.push((dt, t) => {
      for (let i = 0; i < n; i++) {
        pos[i * 3 + 1] -= speed * (0.7 + (i % 5) * 0.12) * dt;
        pos[i * 3] += Math.sin(t * 0.8 + i) * sway * dt;
        if (pos[i * 3 + 1] < -4) {
          pos[i * 3 + 1] = h;
          pos[i * 3] = rr(-w, w);
          pos[i * 3 + 2] = rr(-w, w);
        }
      }
      geo.attributes.position.needsUpdate = true;
    });
  }

  // ---------- construtores de cada mapa ----------
  const BUILD = {};

  BUILD.olimpica = g => {
    buildStands(g, false);
    buildTowers(g, false);
  };

  BUILD.lago = g => {
    buildMountains(g, [[14, 250, 0x3a2d55, 55, 95], [16, 190, 0x5a4468, 35, 70]]);
    buildTreeBand(g, 90, [0x2f4a2a, 0x3a5a30, 0x254021, 0x4a6a35], false);

    // sol grande no horizonte
    const sf = skyFollower(g);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture("rgba(255,236,190,1)", "rgba(255,150,80,0.55)"),
      transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending
    }));
    const dir = SUN_OFF.clone().normalize();
    sunSprite.position.copy(dir).multiplyScalar(88);
    sunSprite.scale.set(80, 80, 1);
    sf.add(sunSprite);

    // trapiche de madeira e barcos de pesca
    const wood = stdM(0x7a5a3a, { roughness: 0.9 });
    const dock = new THREE.Mesh(new THREE.BoxGeometry(9, 0.35, 34), wood);
    dock.position.set(-HX - 12, RIM_Y + 0.2, 12);
    g.add(dock);
    for (let i = 0; i < 6; i++) {
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 6), wood);
        post.position.set(-HX - 12 + sx * 4.2, RIM_Y + 0.9, 12 - 15 + i * 6);
        g.add(post);
      }
    }
    [[-HX - 22, -22, 0.4], [-HX - 25, 30, -0.3], [HX + 24, -40, 2.6]].forEach(([x, z, rot]) => {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8), stdM(0xc84a3a, { roughness: 0.6 }));
      hull.scale.set(3, 0.75, 1.1);
      hull.position.y = 0.4;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 1.5), stdM(0xe8e0d0));
      cab.position.set(-0.8, 1.5, 0);
      boat.add(hull, cab);
      boat.position.set(x, RIM_Y + 0.3, z);
      boat.rotation.y = rot;
      g.add(boat);
    });

    birdFlock(g, 8, 0x2a2030, 38, 70, 120);
  };

  BUILD.neon = g => {
    buildStands(g, true);
    buildTowers(g, true);

    // estrelas e lua
    const sf = skyFollower(g);
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rr(-1, 1), rr(0.05, 1), rr(-1, 1)).normalize().multiplyScalar(92);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, fog: false
    }));
    stars.frustumCulled = false;
    sf.add(stars);

    const moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture("rgba(240,246,255,1)", "rgba(150,180,255,0.35)"),
      transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending
    }));
    moon.position.copy(SUN_OFF).normalize().multiplyScalar(86);
    moon.scale.set(34, 34, 1);
    sf.add(moon);

    // fitas de neon na borda da piscina
    const stripA = basicM(0xff2bd6);
    const stripB = basicM(0x20e8ff);
    stripA.color.setScalar(1);
    const sideLen = 2 * (HZ + COPE);
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, sideLen), stripA);
      m.position.set(sx * (HX + 0.05), RIM_Y + 0.16, 0);
      g.add(m);
    }
    for (const sz of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2 * HX + 0.6, 0.28, 0.28), stripB);
      m.position.set(0, RIM_Y + 0.16, sz * (HZ + 0.05));
      g.add(m);
    }

    // luzes subaquáticas coloridas
    const lights = [];
    for (const z of [-60, 0, 60]) {
      for (const sx of [-1, 1]) {
        const l = new THREE.PointLight(0x20e8ff, 1.6, 62, 1.4);
        l.position.set(sx * 24, -1.6, z);
        g.add(l);
        lights.push(l);
      }
    }

    mapDyn.push((dt, t) => {
      stripA.color.setHSL((t * 0.06) % 1, 1, 0.55);
      stripB.color.setHSL((t * 0.06 + 0.5) % 1, 1, 0.55);
      lights.forEach((l, i) => l.color.setHSL((t * 0.05 + i * 0.17) % 1, 1, 0.55));
    });
  };

  BUILD.veneza = g => {
    const palette = [0xd9a066, 0xc9694a, 0xe8d3a8, 0xd98a8a, 0x9fbf9a, 0xe6b86a, 0xb7796a];

    function windows(w, h) {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 256;
      const x = c.getContext("2d");
      x.fillStyle = "#ffffff";
      x.fillRect(0, 0, 128, 256);
      for (let r = 0; r < 4; r++) {
        for (let k = 0; k < 2; k++) {
          const px = 18 + k * 60;
          const py = 20 + r * 60;
          x.fillStyle = "#6b5a4a";
          x.fillRect(px - 4, py - 4, 34, 46);
          x.fillStyle = Math.random() < 0.3 ? "#ffd98a" : "#33414f";
          x.fillRect(px, py, 26, 38);
          x.fillStyle = "#6b5a4a";
          x.fillRect(px + 12, py, 2, 38);
        }
      }
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w / 7, h / 14);
      return t;
    }

    for (const side of [-1, 1]) {
      let z = -HZ - 30;
      while (z < HZ + 30) {
        const w = rr(14, 20);
        const h = rr(14, 26);
        const bx = side * (HX + COPE + 9 + rr(0, 3));
        const mat = stdM(pick(palette), { map: windows(w, h), roughness: 0.9 });

        const b = new THREE.Mesh(new THREE.BoxGeometry(13, h, w - 0.5), mat);
        b.position.set(bx, RIM_Y + h / 2, z + w / 2);
        g.add(b);

        const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(8, w * 0.6), 3.2, 4), stdM(0xb5523b, { roughness: 0.8 }));
        roof.rotation.y = Math.PI / 4;
        roof.position.set(bx, RIM_Y + h + 1.5, z + w / 2);
        g.add(roof);

        z += w;
      }
    }

    // campanário e cúpula ao fundo
    const towerM = stdM(0xd9a066);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(7, 42, 7), towerM);
    tower.position.set(HX + 30, RIM_Y + 21, -HZ - 45);
    g.add(tower);
    const tRoof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 9, 4), stdM(0x3a8a6a));
    tRoof.rotation.y = Math.PI / 4;
    tRoof.position.set(HX + 30, RIM_Y + 46, -HZ - 45);
    g.add(tRoof);

    const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 12, 20), stdM(0xe8d3a8));
    domeBase.position.set(-HX - 28, RIM_Y + 6, HZ + 50);
    g.add(domeBase);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), stdM(0x4a9a8a, { metalness: 0.2, roughness: 0.5 }));
    dome.position.set(-HX - 28, RIM_Y + 12, HZ + 50);
    g.add(dome);

    // postes de luz quente ao longo da borda
    const lampM = basicM(0xffd9a0);
    lampM.color.setScalar(2);
    const poleM = stdM(0x2e2a28, { metalness: 0.4, roughness: 0.5 });
    for (const sx of [-1, 1]) {
      for (let z = -80; z <= 80; z += 20) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.4, 6), poleM);
        p.position.set(sx * (HX + 0.7), RIM_Y + 1.7, z);
        g.add(p);
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampM);
        l.position.set(sx * (HX + 0.7), RIM_Y + 3.5, z);
        g.add(l);
      }
    }
  };

  BUILD.gelo = g => {
    buildTreeBand(g, 85, [0x2f5d4a, 0x27503f, 0x3a6a55], true);

    // rochedos de gelo
    for (let i = 0; i < 22; i++) {
      const s = rr(2.5, 7);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), stdM(pick([0xdcecf5, 0xbfdcec, 0xeef6fa]), { roughness: 0.35, flatShading: true }));
      const side = Math.random() < 0.5 ? -1 : 1;
      m.position.set(side * rr(HX + 10, HX + 80), RIM_Y + s * 0.3, rr(-HZ - 40, HZ + 40));
      m.scale.y = 0.65;
      m.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
      g.add(m);
    }

    // neve caindo e aurora boreal
    const sf = skyFollower(g);
    fallingPoints(sf, 1600, 60, 38, 3.2, 2.4, () => new THREE.Color(1, 1, 1), 1.2);

    const auroraMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `
        uniform float time; varying vec2 vUv;
        void main(){
          float band = sin(vUv.x * 9.0 + time * 0.5) * 0.5 + 0.5;
          band += sin(vUv.x * 21.0 - time * 0.8) * 0.25;
          float y = vUv.y;
          float edge = smoothstep(0.0, 0.25, y) * (1.0 - smoothstep(0.55, 1.0, y));
          vec3 col = mix(vec3(0.1, 1.0, 0.55), vec3(0.55, 0.3, 1.0), smoothstep(0.35, 0.95, y + 0.15 * sin(vUv.x * 5.0 + time * 0.3)));
          float a = edge * clamp(band, 0.0, 1.0) * (0.55 + 0.25 * sin(time * 0.7 + vUv.x * 4.0));
          gl_FragColor = vec4(col * a, a);
        }`
    });

    [200, 250, 300].forEach(deg => {
      const a = deg * Math.PI / 180;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(240, 70), auroraMat);
      p.position.set(Math.cos(a) * 150, 62, Math.sin(a) * 150);
      p.lookAt(0, 40, 0);
      sf.add(p);
    });

    mapDyn.push((dt, t) => { auroraMat.uniforms.time.value = t; });
  };

  BUILD.tropical = g => {
    const trunks = [];
    const fronds = [];
    const leafColors = [0x2e8b3a, 0x3fa04a, 0x5fbf4a, 0x2a7a35];

    function palm(x, z, s) {
      const lean = rr(-0.25, 0.25);
      trunks.push({ p: [x, RIM_Y + 4.5 * s, z], r: [0, 0, lean], s: [s, s, s] });
      const tx = x - Math.sin(lean) * 4.5 * s;
      const ty = RIM_Y + 4.5 * s * 2 * 0.98;
      for (let k = 0; k < 7; k++) {
        fronds.push({
          p: [tx, ty, z],
          r: [0, (k / 7) * Math.PI * 2 + rr(-0.2, 0.2), -0.45 + rr(-0.15, 0.1)],
          s: [s, s, s * 0.9],
          c: pick(leafColors)
        });
      }
    }

    for (let i = 0; i < 22; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      palm(side * rr(HX + 6, HX + 40), rr(-HZ - 30, HZ + 30), rr(0.8, 1.3));
    }

    // ilhas ao longe com palmeiras
    [[-120, -60], [125, 40], [-110, 90]].forEach(([x, z]) => {
      const isl = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 10), stdM(0xe2cf9c, { roughness: 1 }));
      isl.scale.y = 0.22;
      isl.position.set(x, RIM_Y - 1, z);
      g.add(isl);
      for (let i = 0; i < 6; i++) palm(x + rr(-14, 14), z + rr(-14, 14), rr(1, 1.6));
    });

    const frondGeo = new THREE.ConeGeometry(0.55, 5, 6);
    frondGeo.rotateZ(-Math.PI / 2);
    frondGeo.translate(2.5, 0, 0);

    g.add(instanced(new THREE.CylinderGeometry(0.3, 0.5, 9, 8), stdM(0x7a5a3a), trunks));
    g.add(instanced(frondGeo, stdM(0xffffff, { roughness: 0.8, side: THREE.DoubleSide }), fronds));

    // cabanas de sapé
    for (const [x, z] of [[-HX - 16, -35], [HX + 16, 30], [-HX - 18, 55], [HX + 18, -60]]) {
      const hut = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), stdM(0xb8864f));
      hut.position.set(x, RIM_Y + 1.5, z);
      g.add(hut);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 3, 4), stdM(0x8a6a3a, { roughness: 1 }));
      roof.rotation.y = Math.PI / 4;
      roof.position.set(x, RIM_Y + 4.4, z);
      g.add(roof);
    }

    // espiral do redemoinho
    const sc = document.createElement("canvas");
    sc.width = sc.height = 256;
    const sg = sc.getContext("2d");
    sg.strokeStyle = "rgba(255,255,255,0.85)";
    sg.lineWidth = 5;
    sg.lineCap = "round";
    for (let arm = 0; arm < 3; arm++) {
      sg.beginPath();
      for (let k = 0; k <= 60; k++) {
        const a = arm * 2.094 + k * 0.16;
        const r = 8 + k * 1.9;
        const px = 128 + Math.cos(a) * r;
        const py = 128 + Math.sin(a) * r;
        if (k === 0) sg.moveTo(px, py); else sg.lineTo(px, py);
      }
      sg.stroke();
    }
    const spiral = new THREE.Mesh(
      new THREE.CircleGeometry(15, 48),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, opacity: 0.25, depthWrite: false })
    );
    spiral.rotation.x = -Math.PI / 2;
    spiral.position.y = WATER_Y + 0.14;
    g.add(spiral);
    mapDyn.push((dt) => { spiral.rotation.z += dt * 0.9; });

    birdFlock(g, 7, 0xf4f4f4, 34, 60, 110);
  };

  BUILD.caos = g => {
    const colors = [0xff2bd6, 0x20e8ff, 0xffd23a, 0x7cff3a, 0xff7a2b, 0x6a4bff];
    const items = [];
    const geos = [new THREE.BoxGeometry(5, 5, 5), new THREE.SphereGeometry(3.2, 14, 10), new THREE.OctahedronGeometry(4)];
    const metas = [];

    geos.forEach((geo, gi) => {
      const list = [];
      for (let i = 0; i < 9; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        list.push({ p: [side * rr(HX + 12, HX + 110), rr(8, 46), rr(-HZ - 30, HZ + 30)], c: pick(colors) });
      }
      const mesh = instanced(geo, stdM(0xffffff, { roughness: 0.35, metalness: 0.1 }), list);
      mesh.frustumCulled = false;
      g.add(mesh);
      metas.push({ mesh, list, ph: list.map(() => rr(0, 6)), sp: list.map(() => rr(0.3, 1.1)) });
    });

    const d = new THREE.Object3D();
    mapDyn.push((dt, t) => {
      metas.forEach(m => {
        m.list.forEach((it, i) => {
          d.position.set(it.p[0], it.p[1] + Math.sin(t * 0.8 + m.ph[i]) * 2, it.p[2]);
          d.rotation.set(t * m.sp[i] * 0.5, t * m.sp[i], 0);
          d.updateMatrix();
          m.mesh.setMatrixAt(i, d.matrix);
        });
        m.mesh.instanceMatrix.needsUpdate = true;
      });
    });

    const sf = skyFollower(g);
    fallingPoints(sf, 900, 60, 36, 2.2, 3, () => new THREE.Color(pick(colors)), 3);
  };

  // ---------- obstáculos ----------
  function makeObstacleMesh(o) {
    const g = new THREE.Group();
    o.bob = o.kind !== "pillar";

    if (o.kind === "pillar") {
      const top = 3.4;
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(o.r, o.r * 1.08, -0.5 - FLOOR_Y, 20),
        stdM(0xcfc6b4, { roughness: 0.9 })
      );
      stone.position.y = (-0.5 + FLOOR_Y) / 2;
      const tex = stripeTexture("#2a4a9a", "#f4f0e6", 6, true);
      tex.repeat.set(1, 1);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(o.r, o.r, top + 0.5, 20),
        stdM(0xffffff, { map: tex, roughness: 0.6 })
      );
      pole.position.y = (top - 0.5) / 2;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(o.r * 0.95, 16, 10), stdM(0xd4a437, { metalness: 0.7, roughness: 0.3 }));
      cap.position.y = top + 0.3;
      g.add(stone, pole, cap);
    } else if (o.kind === "floe") {
      const slab = new THREE.Mesh(
        new THREE.CylinderGeometry(o.r, o.r * 1.06, 0.7, 7),
        stdM(0xcfeaf5, { roughness: 0.2, metalness: 0.05, flatShading: true })
      );
      slab.position.y = 0.1;
      const snow = new THREE.Mesh(
        new THREE.CylinderGeometry(o.r * 0.8, o.r * 0.9, 0.18, 7),
        stdM(0xf6fbfd, { roughness: 0.9 })
      );
      snow.position.y = 0.5;
      const bump = new THREE.Mesh(new THREE.IcosahedronGeometry(o.r * 0.45, 0), stdM(0xe6f4fa, { roughness: 0.3, flatShading: true }));
      bump.scale.y = 0.55;
      bump.position.set(o.r * 0.2, 0.7, -o.r * 0.1);
      g.add(slab, snow, bump);
    } else if (o.kind === "buoy") {
      const tex = stripeTexture("#d7263d", "#ffffff", 4, true);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(o.r, 16, 12), stdM(0xffffff, { map: tex, roughness: 0.4 }));
      ball.position.y = 0.25;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.1, 8), stdM(0x555a60, { metalness: 0.5 }));
      mast.position.y = o.r + 0.6;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), basicM(0xffe27a));
      lamp.material.color.setScalar(2.4);
      lamp.position.y = o.r + 1.3;
      g.add(ball, mast, lamp);
      o.lamp = lamp;
    } else {
      const col = pick([0xff2bd6, 0xffd23a, 0x20e8ff, 0x7cff3a]);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.5, 12, 26), stdM(col, { roughness: 0.35 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.2;
      g.add(ring);
    }

    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return g;
  }

  // ---------- física do mapa ----------
  const _acc = { x: 0, z: 0 };

  // aceleração extra do mapa em (x, z): redemoinho ou correnteza
  function mapAccel(x, z) {
    _acc.x = 0;
    _acc.z = 0;

    if (MAP.force === "vortex") {
      const r = Math.hypot(x, z);
      const R = 15;
      if (r < R && r > 0.5) {
        const f = 1 - r / R;
        _acc.x = (-z / r) * 3.2 * f - (x / r) * 0.6 * f;
        _acc.z = (x / r) * 3.2 * f - (z / r) * 0.6 * f;
      }
    } else if (MAP.force === "current" && MAP.cur.on) {
      _acc.x = MAP.cur.x;
      _acc.z = MAP.cur.z;
    }

    return _acc;
  }

  function showBanner(text) {
    if (!bannerEl) return;
    bannerEl.textContent = text;
    bannerEl.classList.add("show");
    clearTimeout(showBanner.t);
    showBanner.t = setTimeout(() => bannerEl.classList.remove("show"), 3200);
  }

  function resetMapState() {
    MAP.cur.on = false;
    MAP.cur.next = 10;
    MAP.cur.t = 0;
    MAP.ang = 0;
    if (bannerEl) bannerEl.classList.remove("show");
  }

  function stepMap(dt) {
    // obstáculos móveis quicam nas paredes (e não invadem a área dos gols)
    const lx = HX - 1.5;
    const lz = GOAL_LINE - 12;
    for (const o of MAP.obstacles) {
      if (!o.vx && !o.vz) continue;
      o.x += o.vx * dt;
      o.z += o.vz * dt;
      if (o.x > lx - o.r) { o.x = lx - o.r; o.vx = -Math.abs(o.vx); }
      if (o.x < -lx + o.r) { o.x = -lx + o.r; o.vx = Math.abs(o.vx); }
      if (o.z > lz - o.r) { o.z = lz - o.r; o.vz = -Math.abs(o.vz); }
      if (o.z < -lz + o.r) { o.z = -lz + o.r; o.vz = Math.abs(o.vz); }
    }

    if (MAP.force === "vortex") {
      MAP.ang = (MAP.ang || 0) + dt * 1.1;
      for (let k = 0; k < 4; k++) {
        const a = MAP.ang + (k * Math.PI) / 2;
        const r = 4 + (k % 2) * 4;
        foamAt(Math.cos(a) * r, Math.sin(a) * r, 0.06, 1.6);
      }
      impulse(0, 0, -0.0004, 5);
    }

    if (MAP.force === "current") {
      const active = mode === "play" && !match.over && !(isComp() && match.countdown > 0.9);
      const cur = MAP.cur;

      if (active && net.role !== "guest") {
        if (!cur.on) {
          cur.next -= dt;
          if (cur.next <= 0) {
            const dir = Math.random() < 0.5 ? -1 : 1;
            cur.on = true;
            cur.t = 4;
            cur.x = dir * 4.2;
            cur.z = rr(-1.4, 1.4);
            showBanner("⚠ CORRENTEZA " + (dir > 0 ? "→" : "←"));
            sfx.warn();
          }
        } else {
          cur.t -= dt;
          for (let i = 0; i < 3; i++) {
            foamAt(rr(-HX, HX), rr(-HZ + 8, HZ - 8), 0.5, 2);
          }
          if (cur.t <= 0) {
            cur.on = false;
            cur.next = rr(12, 18);
          }
        }
      }
    }
  }

  function updateMapVisuals(dt) {
    for (const o of MAP.obstacles) {
      if (!o.mesh) continue;
      const wy = o.bob ? WATER_Y + heightAt(o.x, o.z) : 0;
      o.mesh.position.set(o.x, wy, o.z);

      if (o.kind === "floe") o.mesh.rotation.y += dt * 0.15;
      else if (o.kind === "ring") o.mesh.rotation.y += dt * 1.4;
      else if (o.kind === "buoy") {
        o.mesh.rotation.z = Math.sin(simTime * 1.3 + o.x) * 0.1;
        o.mesh.rotation.x = Math.cos(simTime * 1.1 + o.z) * 0.1;
        if (o.lamp) o.lamp.visible = Math.sin(simTime * 4 + o.x) > -0.4;
      }
    }

    for (const f of mapDyn) f(dt, simTime);
  }

  // ---------- trocar de mapa ----------
  function applyMap(id) {
    const T = THEMES[id] || THEMES.olimpica;
    curTheme = T;
    try { localStorage.setItem("oceanlux-map", T.id); } catch (e) { /* ok */ }

    scene.background.set(T.bg);
    scene.fog.color.set(T.fog[0]);
    scene.fog.near = T.fog[1];
    scene.fog.far = T.fog[2];
    renderer.toneMappingExposure = T.exposure;

    hemi.color.set(T.hemi[0]);
    hemi.groundColor.set(T.hemi[1]);
    hemi.intensity = T.hemi[2];
    sun.color.set(T.sunColor);
    sun.intensity = T.sunInt;
    SUN_OFF.set(T.sunOff[0], T.sunOff[1], T.sunOff[2]);
    fill.color.set(T.fill[0]);
    fill.intensity = T.fill[1];

    // céu
    const u = skyDome.material.uniforms;
    const lin = h => new THREE.Color(h).convertSRGBToLinear();
    u.top.value = lin(T.sky.top);
    u.horizon.value = lin(T.sky.horizon);
    u.bottom.value = lin(T.sky.bottom);
    u.sunColor.value = lin(T.sunColor);
    u.sunDir.value.copy(SUN_OFF).normalize();

    cloudGroup.visible = T.clouds > 0;
    cloudGroup.children.forEach(c => {
      c.material.opacity = c.userData.op * T.clouds;
      c.material.color.set(T.cloudColor || 0xffffff);
    });

    // água
    waterMat.color.set(T.water.color);
    waterMat.opacity = T.water.opacity;
    waterMat.emissive.set(T.water.emissive);
    waterMat.emissiveIntensity = T.water.emissiveInt;
    WT = T.water.tint;
    WAVE_AMP = T.water.idle;
    WAVE_DAMP = T.water.damp;

    MAP.drag = T.drag;
    MAP.grip = T.grip;
    MAP.force = T.force;

    // cáusticas por mapa
    causticBase = { neon: 0.55, gelo: 0.18, caos: 0.5, tropical: 0.55 }[T.id] || 0.4;
    causticMat.color.set(T.id === "neon" ? 0x6ff0ff : T.id === "caos" ? 0xffb0ff : 0xffffff);

    // piscina / margem
    const sh = T.shell;
    wallMats.forEach(m => {
      retex(m, surfaceCanvas(sh.wall[0], sh.wall[1], sh.wall[2]), m.userData.rx, m.userData.ry);
      m.roughness = sh.wallRough;
    });
    retex(poolFloor.material, surfaceCanvas(sh.floor[0], sh.floor[1], sh.floor[2]), (2 * HX) / 1.2, (2 * HZ) / 1.2);
    retex(copingMesh.material, surfaceCanvas(sh.cope[0], sh.cope[1], sh.cope[2]), 1 / 1.2, 1 / 1.2);
    retex(deckMesh.material, surfaceCanvas(sh.deck[0], sh.deck[1], sh.deck[2]), 1 / (1.2 * sh.deckScale), 1 / (1.2 * sh.deckScale));

    // cenário e obstáculos
    disposeTree(mapRoot);
    mapDyn = [];
    BUILD[T.id](mapRoot);

    MAP.obstacles = (T.obstacles || []).map(o => Object.assign({}, o));
    MAP.obstacles.forEach(o => {
      o.mesh = makeObstacleMesh(o);
      mapRoot.add(o.mesh);
    });

    resetMapState();
    buildEnv();
  }

  // ==================================================
  // IMAGENS DE PRÉVIA DOS MAPAS (desenhadas em canvas)
  // ==================================================

  const drawMapPreview = (() => {
    const W = 640;
    const H = 360;
    const HOR = 190;
    let seed = 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    const grad = (g, y0, y1, stops) => {
      const gr = g.createLinearGradient(0, y0, 0, y1);
      stops.forEach(([p, c]) => gr.addColorStop(p, c));
      return gr;
    };

    const skyFill = (g, stops) => { g.fillStyle = grad(g, 0, HOR, stops); g.fillRect(0, 0, W, HOR); };

    function waterFill(g, c1, c2, streak) {
      g.fillStyle = grad(g, HOR, H, [[0, c1], [1, c2]]);
      g.fillRect(0, HOR, W, H - HOR);
      g.strokeStyle = streak;
      g.lineWidth = 1.5;
      for (let i = 0; i < 50; i++) {
        const y = HOR + 4 + Math.pow(rnd(), 1.5) * (H - HOR - 8);
        const x = rnd() * W;
        const l = 6 + (y - HOR) * 0.45;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + l, y);
        g.stroke();
      }
    }

    function glow(g, x, y, r, c0, c1) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, c0);
      gr.addColorStop(1, c1);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    function disc(g, x, y, r, c) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    function mountains(g, color, base, n, hMin, hMax) {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, base);
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * W;
        g.lineTo(x - 20, base - hMin - rnd() * (hMax - hMin));
        g.lineTo(x + 30, base);
      }
      g.lineTo(W, base);
      g.closePath();
      g.fill();
    }

    function pine(g, x, y, s, col, snow) {
      g.fillStyle = "#3a2a1c";
      g.fillRect(x - 2 * s, y - 6 * s, 4 * s, 8 * s);
      for (let k = 0; k < 3; k++) {
        const w = (16 - k * 4) * s;
        const top = y - (14 + k * 11) * s;
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(x, top - 14 * s);
        g.lineTo(x + w, top + 8 * s);
        g.lineTo(x - w, top + 8 * s);
        g.closePath();
        g.fill();
        if (snow) {
          g.fillStyle = "#f2f8fb";
          g.beginPath();
          g.moveTo(x, top - 14 * s);
          g.lineTo(x + w * 0.55, top - 2 * s);
          g.lineTo(x - w * 0.55, top - 2 * s);
          g.closePath();
          g.fill();
        }
      }
    }

    function palm(g, x, y, s) {
      g.strokeStyle = "#6b4a2a";
      g.lineWidth = 5 * s;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 10 * s, y - 40 * s, x + 4 * s, y - 78 * s);
      g.stroke();
      g.strokeStyle = "#2e9a3f";
      g.lineWidth = 4 * s;
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k - 3) * 0.55;
        g.beginPath();
        g.moveTo(x + 4 * s, y - 78 * s);
        g.quadraticCurveTo(x + 4 * s + Math.cos(a) * 26 * s, y - 78 * s + Math.sin(a) * 26 * s - 8 * s,
          x + 4 * s + Math.cos(a) * 44 * s, y - 78 * s + Math.sin(a) * 36 * s + 18 * s);
        g.stroke();
      }
    }

    function building(g, x, y, w, h, color, roof) {
      g.fillStyle = color;
      g.fillRect(x, y - h, w, h);
      g.fillStyle = roof;
      g.beginPath();
      g.moveTo(x - 3, y - h);
      g.lineTo(x + w / 2, y - h - 14);
      g.lineTo(x + w + 3, y - h);
      g.closePath();
      g.fill();
      for (let r = 0; r < Math.floor(h / 22); r++) {
        for (let c = 0; c < Math.floor(w / 18); c++) {
          g.fillStyle = rnd() < 0.3 ? "#ffd98a" : "#34414f";
          g.fillRect(x + 5 + c * 18, y - h + 8 + r * 22, 9, 13);
        }
      }
    }

    function lancha(g, x, y, s, hull, acc, glowColor) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);

      g.fillStyle = "rgba(255,255,255,0.75)";
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.ellipse(-100 - i * 22, 6 + i * 1.5, 18 + i * 3, 4, 0, 0, Math.PI * 2);
        g.fill();
      }

      if (glowColor) glow(g, 0, 8, 120, glowColor, "rgba(0,0,0,0)");

      g.fillStyle = hull;
      g.beginPath();
      g.moveTo(-70, 0);
      g.lineTo(78, 0);
      g.lineTo(104, -20);
      g.lineTo(-72, -32);
      g.closePath();
      g.fill();

      g.fillStyle = acc;
      g.fillRect(-72, -22, 160, 5);

      g.fillStyle = "#e9eef2";
      g.fillRect(-46, -56, 66, 26);
      g.fillStyle = "#274b66";
      g.beginPath();
      g.moveTo(-6, -54);
      g.lineTo(34, -34);
      g.lineTo(-6, -34);
      g.closePath();
      g.fill();
      g.fillStyle = "#2c3a46";
      g.fillRect(-52, -60, 78, 5);

      g.fillStyle = acc;
      g.fillRect(-86, -30, 14, 38);
      g.restore();
    }

    function ball(g, x, y, r) {
      disc(g, x, y, r, "#f4f4f2");
      g.fillStyle = "#16191c";
      g.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
        const px = x + Math.cos(a) * r * 0.45;
        const py = y + Math.sin(a) * r * 0.45;
        if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
    }

    function pillar(g, x, y, s) {
      g.fillStyle = "#cfc6b4";
      g.fillRect(x - 11 * s, y - 6 * s, 22 * s, 14 * s);
      for (let k = 0; k < 6; k++) {
        g.fillStyle = k % 2 ? "#f4f0e6" : "#2a4a9a";
        g.fillRect(x - 11 * s, y - (6 + (k + 1) * 9) * s, 22 * s, 9 * s);
      }
      disc(g, x, y - 66 * s, 10 * s, "#d4a437");
    }

    function buoy(g, x, y, s) {
      for (let k = 0; k < 4; k++) {
        g.fillStyle = k % 2 ? "#ffffff" : "#d7263d";
        g.beginPath();
        g.ellipse(x, y - k * 3 * s, 13 * s - k * 0.5 * s, 10 * s, 0, 0, Math.PI * 2);
        g.fill();
      }
      disc(g, x, y - 30 * s, 13 * s, "#d7263d");
      g.fillStyle = "#555a60";
      g.fillRect(x - 2 * s, y - 46 * s, 4 * s, 16 * s);
      disc(g, x, y - 48 * s, 3.5 * s, "#ffe27a");
    }

    function floe(g, x, y, s) {
      g.fillStyle = "#cfeaf5";
      g.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const r = (30 + (k % 2) * 6) * s;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r * 0.32;
        if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.fillStyle = "#f6fbfd";
      g.beginPath();
      g.ellipse(x, y - 3 * s, 22 * s, 6 * s, 0, 0, Math.PI * 2);
      g.fill();
    }

    function ringObj(g, x, y, s, c) {
      g.strokeStyle = c;
      g.lineWidth = 8 * s;
      g.beginPath();
      g.ellipse(x, y, 22 * s, 8 * s, 0, 0, Math.PI * 2);
      g.stroke();
    }

    function farGoal(g, cx, base, s, c) {
      g.strokeStyle = c;
      g.lineWidth = 3 * s;
      g.strokeRect(cx - 30 * s, base - 26 * s, 60 * s, 26 * s);
      g.strokeStyle = "rgba(255,255,255,0.45)";
      g.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        g.beginPath();
        g.moveTo(cx - 30 * s + i * 7.5 * s, base - 26 * s);
        g.lineTo(cx - 30 * s + i * 7.5 * s, base);
        g.stroke();
      }
    }

    const draw = {
      olimpica(g) {
        skyFill(g, [[0, "#2f7cc0"], [1, "#cfe6ee"]]);
        for (let tier = 0; tier < 2; tier++) {
          g.fillStyle = tier ? "#aeb4bd" : "#c4c9d1";
          g.fillRect(0, HOR - 36 + tier * 14, W, 20);
          for (let i = 0; i < 110; i++) {
            disc(g, rnd() * W, HOR - 30 + tier * 14 + rnd() * 14, 3.2,
              ["#d7263d", "#1f6fe0", "#ffd23f", "#ffffff", "#2dc97e"][Math.floor(rnd() * 5)]);
          }
        }
        for (const x of [40, 600]) {
          g.fillStyle = "#4b5060";
          g.fillRect(x - 3, 40, 6, HOR - 40);
          g.fillStyle = "#fff6d8";
          g.fillRect(x - 22, 32, 44, 14);
        }
        waterFill(g, "#2a9cc0", "#0f5f8e", "rgba(200,240,255,0.35)");
        g.strokeStyle = "rgba(255,255,255,0.55)";
        g.lineWidth = 2;
        [-260, -90, 90, 260].forEach(dx => {
          g.beginPath();
          g.moveTo(W / 2, HOR);
          g.lineTo(W / 2 + dx * 2.2, H);
          g.stroke();
        });
        farGoal(g, W / 2, HOR + 6, 1, "#d7263d");
        lancha(g, 210, 300, 1.05, "#f3f5f4", "#1676a2");
        ball(g, 430, 290, 13);
      },

      lago(g) {
        skyFill(g, [[0, "#3b3f8f"], [0.55, "#c4577a"], [1, "#ff9b62"]]);
        glow(g, 440, HOR - 6, 130, "rgba(255,200,120,0.95)", "rgba(255,120,80,0)");
        disc(g, 440, HOR - 6, 38, "#fff0c4");
        mountains(g, "#4a3a66", HOR, 7, 30, 80);
        mountains(g, "#2f2447", HOR + 2, 9, 14, 42);
        for (let i = 0; i < 22; i++) pine(g, rnd() * W, HOR + 6, 0.55 + rnd() * 0.3, "#1f3b25", false);
        waterFill(g, "#d68a8a", "#4a3260", "rgba(255,210,170,0.35)");
        const gr = g.createLinearGradient(0, HOR, 0, H);
        gr.addColorStop(0, "rgba(255,190,110,0.7)");
        gr.addColorStop(1, "rgba(255,190,110,0)");
        g.fillStyle = gr;
        g.fillRect(410, HOR, 60, H - HOR);
        g.strokeStyle = "#2a2030";
        g.lineWidth = 2;
        [[120, 60], [150, 48], [180, 66], [90, 74]].forEach(([x, y]) => {
          g.beginPath();
          g.moveTo(x - 9, y + 3);
          g.quadraticCurveTo(x - 4, y - 5, x, y);
          g.quadraticCurveTo(x + 4, y - 5, x + 9, y + 3);
          g.stroke();
        });
        lancha(g, 250, 300, 1.05, "#f3f5f4", "#e6562a");
        ball(g, 450, 292, 13);
      },

      neon(g) {
        skyFill(g, [[0, "#03040f"], [1, "#2a1450"]]);
        for (let i = 0; i < 90; i++) disc(g, rnd() * W, rnd() * (HOR - 30), 0.6 + rnd() * 1.2, "rgba(255,255,255,0.85)");
        glow(g, 520, 60, 60, "rgba(240,246,255,0.95)", "rgba(150,180,255,0)");
        disc(g, 520, 60, 16, "#f0f6ff");
        g.fillStyle = "#12142a";
        g.fillRect(0, HOR - 38, W, 38);
        for (let i = 0; i < 160; i++) disc(g, rnd() * W, HOR - 32 + rnd() * 28, 1.6, rnd() < 0.55 ? "#fff2b0" : "#3a3f6a");
        for (const x of [60, 580]) {
          g.fillStyle = "#2a2d44";
          g.fillRect(x - 3, 30, 6, HOR - 30);
          glow(g, x, 36, 60, "rgba(255,255,255,0.95)", "rgba(255,255,255,0)");
        }
        waterFill(g, "#0e4a7c", "#06203f", "rgba(90,220,255,0.3)");
        glow(g, 150, 290, 160, "rgba(255,43,214,0.55)", "rgba(255,43,214,0)");
        glow(g, 500, 300, 170, "rgba(32,232,255,0.55)", "rgba(32,232,255,0)");
        g.shadowBlur = 16;
        g.shadowColor = "#ff2bd6";
        g.fillStyle = "#ff2bd6";
        g.fillRect(0, HOR - 2, W / 2, 4);
        g.shadowColor = "#20e8ff";
        g.fillStyle = "#20e8ff";
        g.fillRect(W / 2, HOR - 2, W / 2, 4);
        g.shadowBlur = 0;
        lancha(g, 260, 300, 1.05, "#e9eef2", "#20e8ff", "rgba(32,232,255,0.4)");
        ball(g, 450, 292, 13);
      },

      veneza(g) {
        skyFill(g, [[0, "#6a9bd2"], [1, "#f6e6c8"]]);
        const cols = ["#d9a066", "#c9694a", "#e8d3a8", "#d98a8a", "#9fbf9a", "#e6b86a"];
        for (let i = 0; i < 6; i++) {
          building(g, i * 52, HOR + 4, 50, 70 + rnd() * 60, cols[i % cols.length], "#b5523b");
          building(g, W - (i + 1) * 52, HOR + 4, 50, 70 + rnd() * 60, cols[(i + 3) % cols.length], "#b5523b");
        }
        g.fillStyle = "#d9a066";
        g.fillRect(300, HOR - 150, 26, 154);
        g.fillStyle = "#3a8a6a";
        g.beginPath();
        g.moveTo(296, HOR - 150);
        g.lineTo(313, HOR - 190);
        g.lineTo(330, HOR - 150);
        g.closePath();
        g.fill();
        waterFill(g, "#6fb0a0", "#2f6a62", "rgba(220,255,240,0.3)");
        pillar(g, 130, 262, 1.15);
        pillar(g, 520, 262, 1.15);
        pillar(g, 330, 222, 0.7);
        lancha(g, 300, 322, 0.95, "#f3f5f4", "#2a4a9a");
        ball(g, 430, 300, 13);
      },

      gelo(g) {
        skyFill(g, [[0, "#0a1f48"], [0.7, "#4f86b8"], [1, "#a9d0e6"]]);
        [["#19ff9a", 40], ["#6a5bff", 78], ["#2fe0ff", 112]].forEach(([c, y], i) => {
          const gr = g.createLinearGradient(0, y - 40, 0, y + 50);
          gr.addColorStop(0, "rgba(0,0,0,0)");
          gr.addColorStop(0.45, c + "aa");
          gr.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(0, y);
          for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x * 0.014 + i * 2) * 26);
          g.lineTo(W, y + 70);
          g.lineTo(0, y + 70);
          g.closePath();
          g.fill();
        });
        mountains(g, "#dce9f2", HOR, 6, 24, 70);
        for (let i = 0; i < 18; i++) pine(g, rnd() * W, HOR + 6, 0.5 + rnd() * 0.3, "#2f5d4a", true);
        waterFill(g, "#4a86ac", "#183a58", "rgba(220,245,255,0.3)");
        floe(g, 130, 250, 1.1);
        floe(g, 520, 300, 1.4);
        floe(g, 400, 224, 0.8);
        floe(g, 250, 330, 1.2);
        for (let i = 0; i < 90; i++) disc(g, rnd() * W, rnd() * H, 1 + rnd() * 1.6, "rgba(255,255,255,0.9)");
        lancha(g, 270, 300, 1.0, "#f3f5f4", "#2a8cc0");
        ball(g, 440, 288, 13);
      },

      tropical(g) {
        skyFill(g, [[0, "#1d8fe0"], [1, "#c7f2f0"]]);
        glow(g, 500, 50, 110, "rgba(255,250,210,0.95)", "rgba(255,250,210,0)");
        disc(g, 500, 50, 26, "#fffbe0");
        g.fillStyle = "#e2cf9c";
        g.beginPath();
        g.ellipse(190, HOR + 2, 170, 20, 0, Math.PI, Math.PI * 2);
        g.fill();
        palm(g, 120, HOR - 4, 0.9);
        palm(g, 190, HOR - 6, 1.2);
        palm(g, 262, HOR - 4, 0.85);
        g.fillStyle = "#b8864f";
        g.fillRect(430, HOR - 22, 44, 24);
        g.fillStyle = "#8a6a3a";
        g.beginPath();
        g.moveTo(424, HOR - 22);
        g.lineTo(452, HOR - 46);
        g.lineTo(480, HOR - 22);
        g.closePath();
        g.fill();
        waterFill(g, "#5fe6d8", "#12909c", "rgba(255,255,255,0.4)");
        g.strokeStyle = "rgba(255,255,255,0.8)";
        g.lineWidth = 3;
        for (let arm = 0; arm < 3; arm++) {
          g.beginPath();
          for (let k = 0; k <= 40; k++) {
            const a = arm * 2.094 + k * 0.2;
            const r = 6 + k * 3.2;
            const px = W / 2 + Math.cos(a) * r * 1.5;
            const py = 262 + Math.sin(a) * r * 0.32;
            if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
          }
          g.stroke();
        }
        buoy(g, 110, 280, 1.1);
        buoy(g, 540, 270, 1.0);
        buoy(g, 380, 222, 0.7);
        lancha(g, 270, 322, 0.95, "#f3f5f4", "#ff8a3d");
        ball(g, 430, 300, 13);
      },

      caos(g) {
        skyFill(g, [[0, "#5a2bd6"], [0.6, "#ff86d6"], [1, "#ffd6a8"]]);
        const cols = ["#ff2bd6", "#20e8ff", "#ffd23a", "#7cff3a", "#ff7a2b", "#6a4bff"];
        for (let i = 0; i < 10; i++) {
          const x = rnd() * W;
          const y = 20 + rnd() * 120;
          const s = 10 + rnd() * 16;
          g.fillStyle = cols[i % cols.length];
          if (i % 3 === 0) {
            g.save();
            g.translate(x, y);
            g.rotate(rnd() * 3);
            g.fillRect(-s, -s, s * 2, s * 2);
            g.restore();
          } else if (i % 3 === 1) {
            disc(g, x, y, s, cols[i % cols.length]);
          } else {
            g.beginPath();
            g.moveTo(x, y - s * 1.3);
            g.lineTo(x + s, y);
            g.lineTo(x, y + s * 1.3);
            g.lineTo(x - s, y);
            g.closePath();
            g.fill();
          }
        }
        waterFill(g, "#b48cff", "#3a1d78", "rgba(255,255,255,0.3)");
        g.fillStyle = "rgba(255,255,255,0.4)";
        g.font = "bold 46px Arial";
        g.fillText("» » » »", 150, 240);
        g.fillText("» » » »", 330, 330);
        ringObj(g, 120, 262, 1.3, "#ffd23a");
        ringObj(g, 520, 250, 1.1, "#ff2bd6");
        ringObj(g, 400, 215, 0.8, "#20e8ff");
        for (let i = 0; i < 90; i++) disc(g, rnd() * W, rnd() * H, 1.5 + rnd() * 1.8, cols[Math.floor(rnd() * cols.length)]);
        lancha(g, 280, 312, 1.0, "#f3f5f4", "#ff2bd6");
        ball(g, 440, 296, 13);
      }
    };

    return function (canvasEl, id) {
      seed = 7;
      const g = canvasEl.getContext("2d");
      g.clearRect(0, 0, W, H);
      (draw[id] || draw.olimpica)(g);

      const vg = g.createLinearGradient(0, H - 70, 0, H);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.35)");
      g.fillStyle = vg;
      g.fillRect(0, H - 70, W, 70);
    };
  })();

  let initialMap = "olimpica";
  try { initialMap = localStorage.getItem("oceanlux-map") || "olimpica"; } catch (e) { /* ok */ }
  applyMap(THEMES[initialMap] ? initialMap : "olimpica");

  // ==================================================
  // BOLHAS
  // ==================================================

  const MAXB = LOW ? 600 : 1100;
  const bPos = new Float32Array(MAXB * 3);
  const bVel = new Float32Array(MAXB * 3);
  const bSize = new Float32Array(MAXB);
  const bAlpha = new Float32Array(MAXB);
  const bLife = new Float32Array(MAXB);
  let bNext = 0;

  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
  bGeo.setAttribute("size", new THREE.BufferAttribute(bSize, 1));
  bGeo.setAttribute("alpha", new THREE.BufferAttribute(bAlpha, 1));

  const bubbleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uScale: { value: 600 } },
    vertexShader: `
      attribute float size;
      attribute float alpha;
      uniform float uScale;
      varying float vA;
      void main() {
        vA = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(size * uScale / -mv.z, 1.5);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vA;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        if (d > 0.5 || vA < 0.01) discard;
        float rim = smoothstep(0.30, 0.48, d);
        float hi = smoothstep(0.18, 0.0, length(p - vec2(-0.14, 0.14)));
        vec3 col = mix(vec3(0.72, 0.92, 1.0), vec3(1.0), rim * 0.6 + hi);
        float a = (0.15 + rim * 0.6 + hi * 0.8) * vA;
        gl_FragColor = vec4(col, a);
      }
    `
  });

  const bubblePoints = new THREE.Points(bGeo, bubbleMat);
  bubblePoints.frustumCulled = false;
  bubblePoints.renderOrder = 6;
  scene.add(bubblePoints);

  function updateBubbleScale() {
    bubbleMat.uniforms.uScale.value =
      (innerHeight * renderer.getPixelRatio()) /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  }

  updateBubbleScale();
  window.addEventListener("resize", updateBubbleScale);

  function spawnBubble(x, z, depth) {
    const i = bNext;
    bNext = (bNext + 1) % MAXB;

    bPos[i * 3] = x + (Math.random() - 0.5) * 0.3;
    bPos[i * 3 + 1] = WATER_Y + heightAt(x, z) - depth;
    bPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;

    bVel[i * 3] = (Math.random() - 0.5) * 0.5;
    bVel[i * 3 + 1] = 0.5 + Math.random() * 1.0;
    bVel[i * 3 + 2] = (Math.random() - 0.5) * 0.5;

    bSize[i] = 0.07 + Math.random() * Math.random() * 0.3;
    bAlpha[i] = 0.9;
    bLife[i] = 6;
  }

  function burstBubbles(x, z, count) {
    for (let k = 0; k < count; k++) {
      spawnBubble(
        x + (Math.random() - 0.5) * 1.8,
        z + (Math.random() - 0.5) * 1.8,
        0.2 + Math.random() * 1.0
      );
    }
  }

  function updateBubbles(dt) {
    for (let i = 0; i < MAXB; i++) {
      if (bAlpha[i] <= 0) continue;

      const k = i * 3;
      bPos[k] += (bVel[k] + Math.sin(simTime * 4 + i) * 0.12) * dt;
      bPos[k + 1] += bVel[k + 1] * dt;
      bPos[k + 2] += (bVel[k + 2] + Math.cos(simTime * 3.4 + i) * 0.12) * dt;

      const px = bPos[k];
      const pz = bPos[k + 2];

      if (Math.abs(px) > HX || Math.abs(pz) > HZ) {
        bAlpha[i] = 0;
        continue;
      }

      const surface = WATER_Y + heightAt(px, pz) + 0.02;

      if (bPos[k + 1] >= surface) {
        // chegou na superfície: fica um instante e estoura
        bPos[k + 1] = surface;
        bVel[k + 1] = 0;
        bLife[i] = Math.min(bLife[i], 0.5);
        bVel[k] *= 0.9;
        bVel[k + 2] *= 0.9;
      }

      bLife[i] -= dt;
      bAlpha[i] = bLife[i] <= 0 ? 0 : Math.min(0.9, bLife[i] * 1.8);
    }

    bGeo.attributes.position.needsUpdate = true;
    bGeo.attributes.alpha.needsUpdate = true;
    bGeo.attributes.size.needsUpdate = true;
  }

  let bubbleAcc = 0;

  // ==================================================
  // RESPINGOS (gotas de água)
  // ==================================================

  const MAXS = LOW ? 450 : 800;
  const sPos = new Float32Array(MAXS * 3);
  const sVel = new Float32Array(MAXS * 3);
  const sSize = new Float32Array(MAXS);
  const sAlpha = new Float32Array(MAXS);
  let sNext = 0;

  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute("size", new THREE.BufferAttribute(sSize, 1));
  sGeo.setAttribute("alpha", new THREE.BufferAttribute(sAlpha, 1));

  const sprayMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uScale: bubbleMat.uniforms.uScale },
    vertexShader: `
      attribute float size;
      attribute float alpha;
      uniform float uScale;
      varying float vA;
      void main() {
        vA = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(size * uScale / -mv.z, 1.5);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vA < 0.01) discard;
        float a = smoothstep(0.5, 0.12, d) * vA;
        gl_FragColor = vec4(0.9, 0.97, 1.0, a);
      }
    `
  });

  const sprayPoints = new THREE.Points(sGeo, sprayMat);
  sprayPoints.frustumCulled = false;
  sprayPoints.renderOrder = 7;
  scene.add(sprayPoints);

  function spawnSpray(x, y, z, vx, vy, vz, size) {
    const i = sNext;
    sNext = (sNext + 1) % MAXS;

    sPos[i * 3] = x;
    sPos[i * 3 + 1] = y;
    sPos[i * 3 + 2] = z;
    sVel[i * 3] = vx;
    sVel[i * 3 + 1] = vy;
    sVel[i * 3 + 2] = vz;
    sSize[i] = size;
    sAlpha[i] = 0.85;
  }

  function updateSpray(dt) {
    for (let i = 0; i < MAXS; i++) {
      if (sAlpha[i] <= 0) continue;

      const k = i * 3;
      sVel[k + 1] -= 9.5 * dt;
      sPos[k] += sVel[k] * dt;
      sPos[k + 1] += sVel[k + 1] * dt;
      sPos[k + 2] += sVel[k + 2] * dt;

      const px = sPos[k];
      const pz = sPos[k + 2];

      if (Math.abs(px) > HX || Math.abs(pz) > HZ) {
        sAlpha[i] = 0;
        continue;
      }

      const surface = WATER_Y + heightAt(px, pz);

      if (sPos[k + 1] < surface && sVel[k + 1] < 0) {
        // gota caiu: marola pequena + espuma
        sAlpha[i] = 0;
        if (i % 3 === 0) {
          impulse(px, pz, 0.006, 0.7);
          foamAt(px, pz, 0.06, 0.7);
        }
      }
    }

    sGeo.attributes.position.needsUpdate = true;
    sGeo.attributes.alpha.needsUpdate = true;
    sGeo.attributes.size.needsUpdate = true;
  }

  let sprayAcc = 0;
  let bowAcc = 0;

  // ==================================================
  // ÁUDIO: SÍNTESE EM TEMPO REAL (Web Audio API)
  // Tudo é gerado por código — nenhum arquivo de som.
  // ==================================================

  const sfx = (() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const MASTER = 0.7;

    let ctx = null;
    let master = null;
    let dry = null;
    let convolver = null;
    let muted = false;
    let sfxVol = 0.6;
    let frame = 0;
    let accDt = 0;
    let playerEng = null;
    let wake = null;
    let crowd = null;
    let sceneKind = "olimpica";
    let windG = null;
    let crowdBase = 0.02;

    try { muted = localStorage.getItem("oceanlux-mute") === "1"; } catch (e) { /* ok */ }

    const buf = {};
    const lastT = {};
    const engines = new Map();

    const fwd = new THREE.Vector3();
    const rgt = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const rnd = (a, b) => a + Math.random() * (b - a);

    function ok(key, ms) {
      const n = performance.now();
      if (lastT[key] && n - lastT[key] < ms) return false;
      lastT[key] = n;
      return true;
    }

    function ready() {
      return !!ctx && !muted && !document.hidden && ctx.state !== "closed";
    }

    // ---------- ruídos base ----------
    function makeNoise(type, secs) {
      const len = Math.floor(ctx.sampleRate * secs);
      const b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);

      if (type === "white") {
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } else if (type === "pink") {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.96900 * b2 + w * 0.1538520;
          b3 = 0.86650 * b3 + w * 0.3104856;
          b4 = 0.55000 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.0168980;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        }
      } else {
        let last = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      }

      // emenda suave para o loop não "estalar"
      const fade = Math.floor(ctx.sampleRate * 0.05);
      for (let i = 0; i < fade; i++) {
        const k = i / fade;
        d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k;
      }

      return b;
    }

    // reverb de piscina coberta: eco longo, escurecendo com o tempo
    function makeIR(secs, decay) {
      const len = Math.floor(ctx.sampleRate * secs);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);

      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / len;
          const w = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
          lp += (w - lp) * (0.6 - 0.45 * t);
          d[i] = lp;
        }
      }

      return ir;
    }

    // limitador suave: linear até 0.6 e comprime o resto, sem estalos de clipping
    function limiterCurve() {
      const n = 2048;
      const c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        const a = Math.abs(x);
        const y = a < 0.6 ? a : 0.6 + 0.4 * Math.tanh((a - 0.6) / 0.4);
        c[i] = Math.sign(x) * y;
      }
      return c;
    }

    function softClip(k) {
      const n = 1024;
      const c = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        c[i] = Math.tanh(k * x);
      }
      return c;
    }

    // ---------- atalhos de nós ----------
    const gainNode = v => { const g = ctx.createGain(); g.gain.value = v; return g; };

    const biquad = (type, f, q) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q === undefined ? 0.7 : q;
      return b;
    };

    function loopNoise(type) {
      const s = ctx.createBufferSource();
      s.buffer = buf[type];
      s.loop = true;
      s.start(0, Math.random() * buf[type].duration * 0.9);
      return s;
    }

    function osc(type, f) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.start();
      return o;
    }

    function send(node, amt) {
      const s = gainNode(amt);
      node.connect(s);
      s.connect(convolver);
    }

    // posição no mundo → volume e panorama estéreo em relação à câmera
    function spatial(x, z) {
      if (x === undefined) return { g: 1, p: 0 };

      camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      rgt.crossVectors(fwd, UP);

      const dx = x - camera.position.x;
      const dz = z - camera.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const pan = clamp(((dx * rgt.x + dz * rgt.z) / d) * Math.min(1, d / 6), -1, 1);
      const g = Math.min(1, 1.25 / (1 + d / 24));

      return { g, p: pan };
    }

    // saída para sons pontuais: ganho + pan + envio de reverb
    function bus(x, z, vol, wet) {
      const sp = spatial(x, z);
      const g = gainNode(vol * sp.g);
      let tail = g;

      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = sp.p;
        g.connect(p);
        tail = p;
      }

      tail.connect(dry);

      if (wet > 0) {
        const s = gainNode(wet);
        tail.connect(s);
        s.connect(convolver);
      }

      return g;
    }

    // ---------- blocos de síntese ----------
    function tone(type, f0, f1, t, dur, vol, dest, attack) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const a = Math.min(attack || 0.004, dur * 0.5);

      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      o.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    function nburst(dest, t, dur, vol, ftype, f0, f1, q, nt) {
      const b = buf[nt || "white"];
      const s = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();

      s.buffer = b;
      f.type = ftype;
      f.Q.value = q || 0.7;
      f.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + Math.min(0.006, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      s.connect(f);
      f.connect(g);
      g.connect(dest);
      s.start(t, Math.random() * Math.max(0.1, b.duration - dur - 0.2));
      s.stop(t + dur + 0.05);
    }

    function bubble(o, t, vol) {
      const f = rnd(380, 1200);
      tone("sine", f, f * rnd(1.25, 1.6), t, rnd(0.05, 0.11), vol, o, 0.003);
    }

    // ---------- ambiente da piscina ----------
    function buildAmbient() {
      // marolinha: ruído marrom filtrado com ondulação lenta
      const lapG = gainNode(0.1);
      const lap = loopNoise("brown");
      const lapLP = biquad("lowpass", 420, 0.7);
      const lfo = osc("sine", 0.17);
      const lfoG = gainNode(0.04);
      lfo.connect(lfoG);
      lfoG.connect(lapG.gain);
      lap.connect(lapLP);
      lapLP.connect(lapG);
      lapG.connect(dry);
      send(lapG, 0.12);

      // brilho da superfície da água
      const shG = gainNode(0.02);
      const sh = loopNoise("pink");
      const shBP = biquad("bandpass", 2200, 0.6);
      const shL = osc("sine", 0.31);
      const shLG = gainNode(0.012);
      shL.connect(shLG);
      shLG.connect(shG.gain);
      sh.connect(shBP);
      shBP.connect(shG);
      shG.connect(dry);
      send(shG, 0.2);

      // zumbido grave do ambiente fechado
      const rumG = gainNode(0.025);
      const rum = loopNoise("pink");
      const rumLP = biquad("lowpass", 130, 0.7);
      rum.connect(rumLP);
      rumLP.connect(rumG);
      rumG.connect(dry);

      // vento (intensidade depende do mapa)
      const wG = gainNode(0);
      const wn = loopNoise("pink");
      const wBP = biquad("bandpass", 480, 0.5);
      const wL = osc("sine", 0.11);
      const wLG = gainNode(140);
      wL.connect(wLG);
      wLG.connect(wBP.frequency);
      wn.connect(wBP);
      wBP.connect(wG);
      wG.connect(dry);
      send(wG, 0.1);
      windG = wG;

      // gotas, bolhas e tapinhas de onda aleatórios
      const next = () => {
        setTimeout(() => {
          if (ready()) {
            const t = ctx.currentTime;
            const x = camera.position.x + rnd(-30, 30);
            const z = camera.position.z + rnd(-30, 30);
            const o = bus(x, z, 0.55, 0.5);
            const r = Math.random();

            if (r < 0.5) {
              bubble(o, t, rnd(0.08, 0.2));
            } else if (r < 0.82) {
              nburst(o, t, rnd(0.12, 0.26), rnd(0.1, 0.2), "lowpass", 1500, 380, 0.8, "brown");
            } else {
              const f = rnd(1500, 2600);
              tone("sine", f, f * 0.8, t, 0.07, 0.1, o, 0.002);
            }

            if (Math.random() < 0.4) sceneEvent(o, t);
          }
          next();
        }, rnd(350, 1700));
      };
      next();
    }

    // ---------- torcida ----------
    function buildCrowd() {
      const out = gainNode(0);
      out.connect(dry);
      send(out, 0.3);

      const mod = gainNode(0.8);
      mod.connect(out);

      const a = loopNoise("pink");
      const bp1 = biquad("bandpass", 520, 0.45);
      a.connect(bp1);
      bp1.connect(mod);

      const b = loopNoise("pink");
      const bp2 = biquad("bandpass", 1500, 0.6);
      const g2 = gainNode(0.45);
      b.connect(bp2);
      bp2.connect(g2);
      g2.connect(mod);

      const l = osc("sine", 0.23);
      const lg = gainNode(0.2);
      l.connect(lg);
      lg.connect(mod.gain);

      return { out };
    }

    // ---------- motor de popa ----------
    function makeEngine(light, panned) {
      const out = gainNode(0);
      const lp = biquad("lowpass", 300, 2.5);
      const pulse = gainNode(0.7);
      const sh = ctx.createWaveShaper();
      sh.curve = softClip(2.2);

      const mix = gainNode(1);
      const o1 = osc("sawtooth", 30);
      const o2 = osc("square", 15);
      const g1 = gainNode(0.5);
      const g2 = gainNode(0.4);
      o1.connect(g1); g1.connect(mix);
      o2.connect(g2); g2.connect(mix);

      let o3 = null;
      if (!light) {
        o3 = osc("sawtooth", 60);
        const g3 = gainNode(0.18);
        o3.connect(g3);
        g3.connect(mix);
      }

      mix.connect(sh);
      sh.connect(lp);
      lp.connect(pulse);

      // explosões dos cilindros: oscilação de amplitude na frequência de ignição
      const lfo = osc("sine", 15);
      const lfoG = gainNode(0.3);
      lfo.connect(lfoG);
      lfoG.connect(pulse.gain);

      // descarga borbulhando na água
      const ng = gainNode(0.08);
      const nz = loopNoise("pink");
      const nbp = biquad("bandpass", 850, 0.8);
      nz.connect(nbp);
      nbp.connect(ng);
      ng.connect(pulse);

      pulse.connect(out);

      let pan = null;
      if (panned && ctx.createStereoPanner) {
        pan = ctx.createStereoPanner();
        out.connect(pan);
        pan.connect(dry);
        send(pan, 0.12);
      } else {
        out.connect(dry);
        send(out, 0.1);
      }

      const nodes = [o1, o2, o3, lfo, nz].filter(Boolean);

      return {
        rpm: 0.14,
        update(rpm, thr, vol, panV, bright) {
          const t = ctx.currentTime;
          const f0 = 24 + rpm * 92;
          o1.frequency.setTargetAtTime(f0, t, 0.05);
          o2.frequency.setTargetAtTime(f0 * 0.5, t, 0.05);
          if (o3) o3.frequency.setTargetAtTime(f0 * 2.01, t, 0.05);
          lfo.frequency.setTargetAtTime(f0 * 0.5, t, 0.05);
          lp.frequency.setTargetAtTime((220 + rpm * 1500 + thr * 500) * (bright === undefined ? 1 : bright), t, 0.08);
          ng.gain.setTargetAtTime(0.05 + rpm * 0.18, t, 0.1);
          out.gain.setTargetAtTime(vol, t, 0.08);
          if (pan) pan.pan.setTargetAtTime(panV || 0, t, 0.1);
        },
        stop() {
          const t = ctx.currentTime;
          out.gain.cancelScheduledValues(t);
          out.gain.setTargetAtTime(0, t, 0.06);
          setTimeout(() => {
            nodes.forEach(n => { try { n.stop(); } catch (e) { /* ok */ } });
            try { out.disconnect(); } catch (e) { /* ok */ }
          }, 500);
        }
      };
    }

    // ---------- água passando pelo casco ----------
    function buildWake() {
      const rushG = gainNode(0);
      const rush = loopNoise("pink");
      const rushBP = biquad("bandpass", 700, 0.7);
      rush.connect(rushBP); rushBP.connect(rushG); rushG.connect(dry); send(rushG, 0.08);

      const hissG = gainNode(0);
      const hiss = loopNoise("white");
      const hissHP = biquad("highpass", 3500, 0.7);
      hiss.connect(hissHP); hissHP.connect(hissG); hissG.connect(dry);

      // ondas batendo no casco
      const slapG = gainNode(0);
      const slapMod = gainNode(0.6);
      const slap = loopNoise("brown");
      const slapLP = biquad("lowpass", 280, 0.9);
      const slapL = osc("sine", 3);
      const slapLG = gainNode(0.4);
      slapL.connect(slapLG); slapLG.connect(slapMod.gain);
      slap.connect(slapLP); slapLP.connect(slapMod); slapMod.connect(slapG); slapG.connect(dry);

      // hélice batendo na água
      const propG = gainNode(0);
      const prop = loopNoise("pink");
      const propBP = biquad("bandpass", 240, 2);
      prop.connect(propBP); propBP.connect(propG); propG.connect(dry); send(propG, 0.1);

      return { rushG, rushBP, hissG, slapG, slapL, propG };
    }

    // ---------- inicialização ----------
    function init() {
      if (!AC) return;

      if (ctx) {
        if (ctx.state === "suspended" && !muted && !document.hidden) ctx.resume();
        return;
      }

      try {
        ctx = new AC({ latencyHint: "interactive" });
      } catch (e) {
        ctx = null;
        return;
      }

      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER * sfxVol;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 8;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;
      const lim = ctx.createWaveShaper();
      lim.curve = limiterCurve();
      master.connect(comp);
      comp.connect(lim);
      lim.connect(ctx.destination);

      dry = ctx.createGain();
      dry.connect(master);

      convolver = ctx.createConvolver();
      convolver.buffer = makeIR(2.4, 3);
      const wet = gainNode(0.55);
      convolver.connect(wet);
      wet.connect(master);

      buf.white = makeNoise("white", 4);
      buf.pink = makeNoise("pink", 4);
      buf.brown = makeNoise("brown", 4);

      buildAmbient();
      playerEng = makeEngine(false, false);
      wake = buildWake();
      crowd = buildCrowd();
      applyScene();

      if (muted && ctx.suspend) setTimeout(() => ctx.suspend(), 100);
      else if (ctx.state === "suspended") ctx.resume();
    }

    // ---------- interface ----------
    function click() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = bus(undefined, undefined, 0.5, 0.1);
      nburst(o, t, 0.01, 0.5, "highpass", 3500, 3500, 0.7);
      tone("sine", 1250, 700, t, 0.06, 0.4, o);
      tone("triangle", 2400, 1800, t, 0.025, 0.12, o);
    }

    function hover() {
      if (!ready() || !ok("hover", 40)) return;
      const t = ctx.currentTime;
      const o = bus(undefined, undefined, 0.3, 0.05);
      tone("sine", 1900, 1900, t, 0.035, 0.12, o);
      nburst(o, t, 0.008, 0.08, "highpass", 5000, 5000, 0.7);
    }

    function confirm() {
      if (!ready()) return;
      click();
      const t = ctx.currentTime + 0.05;
      const o = bus(undefined, undefined, 0.4, 0.35);
      tone("triangle", 880, 880, t, 0.16, 0.5, o, 0.006);
      tone("triangle", 1320, 1320, t + 0.09, 0.28, 0.5, o, 0.006);
      tone("sine", 2640, 2640, t + 0.09, 0.2, 0.12, o, 0.006);
    }

    function back() {
      if (!ready()) return;
      click();
      const t = ctx.currentTime + 0.04;
      const o = bus(undefined, undefined, 0.35, 0.3);
      tone("triangle", 660, 660, t, 0.12, 0.45, o, 0.006);
      tone("triangle", 440, 440, t + 0.08, 0.22, 0.45, o, 0.006);
    }

    function swatch(idx) {
      if (!ready()) return;
      const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5, 1568, 1760, 2093];
      const f = scale[idx % scale.length];
      const t = ctx.currentTime;
      const o = bus(undefined, undefined, 0.4, 0.5);
      nburst(o, t, 0.01, 0.35, "highpass", 3500, 3500, 0.7);
      tone("triangle", f, f, t, 0.5, 0.5, o, 0.005);
      tone("sine", f * 2, f * 2, t, 0.35, 0.18, o, 0.005);
      tone("sine", f * 3.01, f * 3.01, t, 0.2, 0.06, o, 0.005);
    }

    function swoosh() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = bus(undefined, undefined, 0.5, 0.4);
      nburst(o, t, 0.4, 0.3, "bandpass", 300, 2800, 1.2, "pink");
    }

    // ---------- bola, água e batidas ----------
    function ballHit(p, x, z) {
      if (!ready() || !ok("ballhit", 70)) return;
      const t = ctx.currentTime;
      const v = clamp(p / 12, 0.15, 1);
      const o = bus(x, z, 0.35 + 0.65 * v, 0.25);

      tone("sine", 210, 62, t, 0.16, 0.9, o);                       // pancada grave
      tone("triangle", 520, 240, t, 0.05, 0.35, o);                 // "tum" do couro
      nburst(o, t, 0.045, 0.55, "bandpass", 1800, 900, 1.2);        // tapa na bola
      nburst(o, t + 0.01, 0.28, 0.5 * v, "lowpass", 3800, 700, 0.8); // respingo
      for (let i = 0; i < 3; i++) bubble(o, t + 0.04 + i * rnd(0.03, 0.06), 0.08 * v + 0.03);
    }

    function ballWall(imp, x, z) {
      if (!ready() || imp < 0.8 || !ok("ballwall", 90)) return;
      const t = ctx.currentTime;
      const v = clamp(imp / 12, 0.1, 1);
      const o = bus(x, z, 0.3 + 0.5 * v, 0.6);

      nburst(o, t, 0.07, 0.45 * v, "lowpass", 1100, 300, 0.8);
      tone("sine", 130, 70, t, 0.13, 0.5 * v, o);
      nburst(o, t, 0.015, 0.18 * v, "bandpass", 3000, 2500, 2);
    }

    function ballPost(imp, x, z) {
      if (!ready() || imp < 0.8 || !ok("ballpost", 150)) return;
      const t = ctx.currentTime;
      const v = clamp(imp / 12, 0.2, 1);
      const o = bus(x, z, 0.35 + 0.5 * v, 0.55);

      // clang metálico: parciais inarmônicos com decaimentos diferentes
      [[310, 0.9], [745, 0.7], [1230, 0.5], [1810, 0.35], [2570, 0.22]].forEach(([f, d], i) => {
        tone("sine", f, f * 0.995, t, d, 0.42 * v / (1 + i * 0.5), o, 0.002);
      });
      nburst(o, t, 0.02, 0.4 * v, "highpass", 2500, 2500, 0.7);
      tone("sine", 180, 80, t, 0.1, 0.4 * v, o);

      crowdOoh(0.6 * v);
    }

    function hullHit(imp, x, z) {
      if (!ready() || imp < 0.4 || !ok("hull" + (x | 0), 120)) return;
      const t = ctx.currentTime;
      const v = clamp(imp / 9, 0.1, 1);
      const o = bus(x, z, 0.3 + 0.7 * v, 0.35);

      tone("sine", 100, 48, t, 0.22, 0.9 * v, o);                        // casco de fibra
      nburst(o, t, 0.16, 0.5 * v, "lowpass", 700, 200, 0.8, "brown");
      nburst(o, t, 0.04, 0.32 * v, "bandpass", 2600, 1800, 1.5);         // estalo
      nburst(o, t + 0.01, 0.3, 0.3 * v, "bandpass", 2400, 500, 0.7);     // respingo
    }

    function boatCrash(vn, x, z) {
      if (!ready() || !ok("crash", 140)) return;
      const t = ctx.currentTime;
      const v = clamp(vn / 9, 0.15, 1);
      const o = bus(x, z, 0.4 + 0.6 * v, 0.4);

      tone("sine", 95, 42, t, 0.28, 1.0 * v, o);
      tone("sine", 130, 55, t + 0.025, 0.2, 0.7 * v, o);
      nburst(o, t, 0.2, 0.6 * v, "lowpass", 900, 200, 0.8, "brown");
      nburst(o, t, 0.05, 0.4 * v, "bandpass", 2200, 1200, 1.2);
      nburst(o, t + 0.02, 0.4, 0.4 * v, "bandpass", 2800, 450, 0.7);
      for (let i = 0; i < 4; i++) bubble(o, t + 0.05 + i * 0.04, 0.06 * v + 0.02);
    }

    function smallSplash(x, z, vol) {
      if (!ready() || !ok("splash", 80)) return;
      const t = ctx.currentTime;
      const o = bus(x, z, vol, 0.2);
      nburst(o, t, rnd(0.08, 0.18), 0.5, "bandpass", rnd(2200, 3400), 700, 0.8);
      if (Math.random() < 0.5) bubble(o, t + 0.03, 0.05);
    }

    // ---------- torcida, gol e apito ----------
    function crowdOoh(vol) {
      if (!ready() || !ok("ooh", 1500)) return;
      const t = ctx.currentTime;
      const o = bus(undefined, undefined, vol, 0.5);
      nburst(o, t, 1.2, 0.5, "bandpass", 700, 420, 0.8, "pink");
      nburst(o, t, 1.0, 0.3, "bandpass", 1400, 800, 1, "pink");
    }

    function horn(t, dest, low) {
      const k = low ? 0.8 : 1;
      [233.1, 293.7, 349.2, 466.2].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const lp = biquad("lowpass", 2200, 0.8);

        o.type = "sawtooth";
        o.frequency.value = f * k;
        o.detune.value = (i - 1.5) * 6;

        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.13, t + 0.05);
        g.gain.setValueAtTime(0.13, t + 1.1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);

        o.connect(lp); lp.connect(g); g.connect(dest);
        o.start(t); o.stop(t + 1.7);
      });
    }

    function cheer(t, dest, vol) {
      const s = ctx.createBufferSource();
      const g = ctx.createGain();
      s.buffer = buf.pink;
      s.loop = true;

      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.5);
      g.gain.setValueAtTime(vol, t + 2.4);
      g.gain.linearRampToValueAtTime(0.0001, t + 4.6);

      // três "vogais" em paralelo imitam muitas vozes gritando
      [[800, 1.1, 1], [1400, 1.2, 0.8], [2600, 1.4, 0.4]].forEach(([f, q, a], i) => {
        const bp = biquad("bandpass", f, q);
        const ag = gainNode(a);
        bp.frequency.setValueAtTime(f * 0.85, t);
        bp.frequency.linearRampToValueAtTime(f * 1.15, t + 1.2 + i * 0.3);
        bp.frequency.linearRampToValueAtTime(f, t + 3);
        s.connect(bp); bp.connect(ag); ag.connect(g);
      });

      g.connect(dest);
      s.start(t, Math.random() * 2);
      s.stop(t + 4.7);

      // palmas e gritos soltos
      for (let i = 0; i < 46; i++) {
        const tt = t + 0.2 + Math.pow(Math.random(), 0.8) * 3.6;
        const env = 1 - Math.abs(tt - (t + 1.6)) / 2.4;
        nburst(dest, tt, 0.03, 0.08 * clamp(env, 0.1, 1) * vol * 1.3, "bandpass", rnd(900, 2200), rnd(600, 1500), 1.5);
      }
    }

    function goal(conceded) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = bus(undefined, undefined, 0.6, 0.5);

      horn(t, o, conceded);
      cheer(t + 0.05, o, conceded ? 0.28 : 0.6);

      // rede balançando e bola na água
      for (let i = 0; i < 10; i++) {
        nburst(o, t + i * 0.035 + rnd(0, 0.02), 0.04, 0.12, "highpass", 4200, 3500, 0.7);
      }
      nburst(o, t, 0.4, 0.4, "lowpass", 3000, 500, 0.8);
      tone("sine", 160, 55, t, 0.25, 0.7, o);
    }

    function whistleBlast(t, dur, vol, dest) {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const am = gainNode(0.55);
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoG = gainNode(0.45);

      o1.type = "sine";
      o2.type = "sine";
      o1.frequency.setValueAtTime(2800, t);
      o1.frequency.linearRampToValueAtTime(3050, t + 0.06);
      o2.frequency.setValueAtTime(3300, t);
      o2.frequency.linearRampToValueAtTime(3480, t + 0.06);

      // bolinha de cortiça: trinado
      lfo.frequency.value = 34;
      lfo.connect(lfoG);
      lfoG.connect(am.gain);

      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.025);
      g.gain.setValueAtTime(vol, t + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      o1.connect(am);
      o2.connect(am);
      am.connect(g);
      g.connect(dest);

      nburst(dest, t, dur, vol * 0.25, "highpass", 2600, 2600, 0.7);

      o1.start(t); o2.start(t); lfo.start(t);
      o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    }

    function count(n) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = bus(undefined, undefined, 0.5, 0.25);
      tone("sine", 660, 660, t, 0.22, 0.6, o, 0.005);
      tone("triangle", 1320, 1320, t, 0.12, 0.15, o, 0.005);
    }

    function go() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = bus(undefined, undefined, 0.5, 0.4);
      tone("sine", 1320, 1320, t, 0.55, 0.6, o, 0.005);
      tone("triangle", 2640, 2640, t, 0.3, 0.15, o, 0.005);
      whistleBlast(t, 0.6, 0.35, o);
    }

    function tick(urgent) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = bus(undefined, undefined, urgent ? 0.5 : 0.35, 0.1);
      tone("sine", urgent ? 2000 : 1500, urgent ? 2000 : 1500, t, 0.05, 0.4, o, 0.002);
      nburst(o, t, 0.01, 0.2, "highpass", 4000, 4000, 0.7);
    }

    function endWhistle() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = bus(undefined, undefined, 0.6, 0.5);
      whistleBlast(t, 0.35, 0.4, o);
      whistleBlast(t + 0.5, 0.35, 0.4, o);
      whistleBlast(t + 1.0, 0.9, 0.45, o);
    }

    function note(t, f, dur, vol, o, type) {
      tone(type || "triangle", f, f, t, dur, vol, o, 0.01);
      tone("sine", f * 2, f * 2, t, dur * 0.8, vol * 0.3, o, 0.01);
    }

    function result(kind) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = bus(undefined, undefined, 0.5, 0.5);

      if (kind === "win") {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(t + i * 0.12, f, 0.3, 0.5, o));
        [523.25, 659.25, 783.99, 1046.5].forEach(f => note(t + 0.55, f, 1.5, 0.3, o));
        cheer(t, o, 0.4);
      } else if (kind === "lose") {
        [440, 392, 349.2, 293.7].forEach((f, i) => note(t + i * 0.28, f, 0.4, 0.45, o, "sine"));
        note(t + 1.15, 220, 1.4, 0.4, o, "sine");
      } else {
        note(t, 523.25, 0.3, 0.45, o);
        note(t + 0.25, 523.25, 0.3, 0.45, o);
        note(t + 0.5, 392, 0.9, 0.45, o);
      }
    }

    // ---------- sons característicos de cada mapa ----------
    function birdChirp(o, t) {
      const base = rnd(2600, 4200);
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        tone("sine", base, base * rnd(1.2, 1.6), t + i * 0.09, 0.07, 0.07, o, 0.004);
      }
    }

    function seagull(o, t) {
      const f = rnd(700, 950);
      [0, 0.3].forEach(d => {
        const os = ctx.createOscillator();
        const bp = biquad("bandpass", 1500, 1.2);
        const g = ctx.createGain();
        os.type = "sawtooth";
        os.frequency.setValueAtTime(f * 1.3, t + d);
        os.frequency.exponentialRampToValueAtTime(f * 0.75, t + d + 0.35);
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.linearRampToValueAtTime(0.12, t + d + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.4);
        os.connect(bp); bp.connect(g); g.connect(o);
        os.start(t + d); os.stop(t + d + 0.45);
      });
    }

    function cricket(o, t) {
      for (let i = 0; i < 6; i++) tone("sine", 4600, 4500, t + i * 0.07, 0.03, 0.05, o, 0.003);
    }

    function bell(o, t) {
      [[220, 3], [370, 2.4], [543, 1.8], [830, 1.2], [1190, 0.8]].forEach(([f, d]) => {
        tone("sine", f, f * 0.998, t, d, 0.1, o, 0.003);
      });
    }

    function iceCreak(o, t) {
      const os = ctx.createOscillator();
      const bp = biquad("bandpass", 380, 4);
      const g = ctx.createGain();
      os.type = "sawtooth";
      os.frequency.setValueAtTime(95, t);
      os.frequency.exponentialRampToValueAtTime(58, t + 0.9);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      os.connect(bp); bp.connect(g); g.connect(o);
      os.start(t); os.stop(t + 1);
      for (let i = 0; i < 4; i++) nburst(o, t + rnd(0.1, 0.8), 0.02, 0.15, "bandpass", rnd(1500, 3000), 1000, 3);
    }

    function chaosBlip(o, t) {
      const base = rnd(300, 700);
      [1, 1.5, 2].forEach((m, i) => tone("square", base * m, base * m * 1.05, t + i * 0.1, 0.09, 0.05, o, 0.004));
    }

    function sceneEvent(o, t) {
      const r = Math.random();
      if (sceneKind === "lago") { if (r < 0.6) birdChirp(o, t); else cricket(o, t); }
      else if (sceneKind === "tropical") { if (r < 0.5) seagull(o, t); else birdChirp(o, t); }
      else if (sceneKind === "veneza") { if (r < 0.25) bell(o, t); else if (r < 0.6) seagull(o, t); }
      else if (sceneKind === "gelo") { if (r < 0.5) iceCreak(o, t); }
      else if (sceneKind === "neon") { if (r < 0.4) cricket(o, t); }
      else if (sceneKind === "caos") { if (r < 0.7) chaosBlip(o, t); }
    }

    function applyScene() {
      if (!ctx || !windG) return;
      const wind = { gelo: 0.06, lago: 0.02, tropical: 0.025, veneza: 0.012, caos: 0.015 }[sceneKind] || 0.004;
      windG.gain.setTargetAtTime(wind, ctx.currentTime, 0.6);
      crowdBase = { olimpica: 0.025, neon: 0.06, veneza: 0.02 }[sceneKind] || 0;
    }

    function setScene(kind) {
      sceneKind = kind;
      applyScene();
    }

    // alerta de correnteza (mapa caótico)
    function warn() {
      if (!ready()) return;
      const t = ctx.currentTime;
      const o = bus(undefined, undefined, 0.5, 0.4);
      tone("square", 880, 880, t, 0.18, 0.18, o, 0.005);
      tone("square", 660, 660, t + 0.22, 0.18, 0.18, o, 0.005);
      nburst(o, t, 1.6, 0.35, "bandpass", 180, 700, 0.8, "pink");
    }

    // ---------- atualização contínua ----------
    function update(dt) {
      if (!ctx || !ready()) return;

      accDt += dt;
      frame++;
      if (frame % 3 !== 0) return;
      const d = accDt;
      accDt = 0;

      const t = ctx.currentTime;
      const playing = mode === "play" || mode === "result";

      // ---- motor e água do barco do jogador
      const sp = Math.hypot(state.vx, state.vz);
      const n = Math.min(1, sp / 11);
      const thr = Math.abs(state.throttle);

      const rpmT = clamp(0.16 + 0.5 * n + 0.34 * thr, 0.14, 1);
      playerEng.rpm += (rpmT - playerEng.rpm) * Math.min(1, d * 3.5);
      playerEng.update(
        playerEng.rpm,
        thr,
        (0.1 + 0.1 * playerEng.rpm) * (playing ? 1 : 0.5),
        0,
        1
      );

      wake.rushG.gain.setTargetAtTime(0.01 + 0.14 * Math.pow(n, 1.3), t, 0.1);
      wake.rushBP.frequency.setTargetAtTime(400 + n * 900, t, 0.1);
      wake.hissG.gain.setTargetAtTime(0.05 * n * n, t, 0.1);
      wake.slapG.gain.setTargetAtTime(0.03 + 0.12 * n, t, 0.12);
      wake.slapL.frequency.setTargetAtTime(2 + n * 6, t, 0.2);
      wake.propG.gain.setTargetAtTime(0.12 * thr * (0.4 + n), t, 0.08);

      if (playing && Math.random() < n * n * 0.3) {
        smallSplash(state.x, state.z, 0.12 + 0.12 * n);
      }

      // ---- motores dos bots (com distância e panorama)
      for (const [agent, eng] of engines) {
        if (!allBoats.includes(agent)) {
          eng.stop();
          engines.delete(agent);
        }
      }

      for (const b of allBoats) {
        if (b.isPlayer) continue;
        let eng = engines.get(b);
        if (!eng) {
          eng = makeEngine(true, true);
          engines.set(b, eng);
        }

        const bs = Math.hypot(b.st.vx, b.st.vz);
        const bn = Math.min(1, bs / 11);
        const bt = Math.abs(b.st.throttle);
        const target = clamp(0.16 + 0.5 * bn + 0.34 * bt, 0.14, 1);
        eng.rpm += (target - eng.rpm) * Math.min(1, d * 3.5);

        const spt = spatial(b.st.x, b.st.z);
        eng.update(eng.rpm, bt, (0.09 + 0.08 * eng.rpm) * spt.g, spt.p, 0.5 + 0.5 * spt.g);
      }

      // ---- torcida
      const comp = isComp() && playing;
      const near = clamp((Math.abs(ball.z) - 40) / 46, 0, 1);
      crowd.out.gain.setTargetAtTime(comp ? 0.05 + 0.08 * near : crowdBase, t, 0.4);
    }

    // ---------- som ligado / desligado ----------
    function toggleMute() {
      init();
      muted = !muted;
      try { localStorage.setItem("oceanlux-mute", muted ? "1" : "0"); } catch (e) { /* ok */ }

      if (ctx) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(muted ? 0 : MASTER * sfxVol, ctx.currentTime, 0.03);

        if (muted) {
          setTimeout(() => { if (muted && ctx.state === "running") ctx.suspend(); }, 250);
        } else if (ctx.state === "suspended") {
          ctx.resume();
        }
      }
      return muted;
    }

    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend();
      else if (!muted) ctx.resume();
    });

    return {
      init, update, click, hover, confirm, back, swatch, swoosh,
      ballHit, ballWall, ballPost, hullHit, boatCrash,
      goal, count, go, tick, endWhistle, result, toggleMute, setScene, warn,
      setVolume(v) {
        sfxVol = clamp(v, 0, 1);
        if (ctx && master && !muted) master.gain.setTargetAtTime(MASTER * sfxVol, ctx.currentTime, 0.03);
      },
      isMuted: () => muted
    };
  })();

  // ==================================================
  // BARCO: ESTADO, FÍSICA E COLISÃO
  // ==================================================

  const STEP = 1 / 60;
  let paused = false;
  const net = { role: "off", peer: null, conn: null, players: [], roster: [], byAid: null, myAid: 0, inMatch: false, acc: 0, lastBits: -1, lastSend: 0, code: "", size: 1, lobby: null, you: 0 };
  let mode = "start";   // start | pick | play

  // ---------- BOOST ----------
  const BOOST_DRAIN_S = 3;      // segundos de boost com a barra cheia
  const BOOST_RECHARGE_S = 9;   // segundos para encher do zero
  const BOOST_DELAY = 0.8;      // espera após soltar antes de recarregar
  const BOOST_ACCEL = 7.5;      // aceleração extra

  const state = {
    x: 0,
    z: 22,
    heading: Math.PI / 2,   // aponta para -Z (comprimento da piscina)
    vx: 0,
    vz: 0,
    kick: 0,                // giro extra vindo de batidas
    throttle: 0,
    steer: 0,
    heave: 0,
    pitch: 0,
    roll: 0,
    propAngle: 0,
    propSpin: 0,
    boost: 1,
    boosting: false,
    boostDelay: 0,
    boostLock: false
  };

  const input = { up: false, down: false, left: false, right: false, brake: false, kick: false, boost: false };

  // Pontos do casco usados na colisão (x = proa/popa, z = bordo)
  const hullPoints = [
    [3.3, 0],
    [2.7, 0.3], [2.7, -0.3],
    [1.5, 0.7], [1.5, -0.7],
    [0, 0.95], [0, -0.95],
    [-1.8, 0.85], [-1.8, -0.85],
    [-3.2, 0.6], [-3.2, -0.6],
    [-3.9, 0]
  ];

  const LIMX = HX - 0.12;
  const LIMZ = HZ - 0.12;

  const tmp = { x: 0, z: 0 };

  function toWorldS(st, lx, lz) {
    const c = Math.cos(st.heading);
    const s = Math.sin(st.heading);
    tmp.x = st.x + lx * c + lz * s;
    tmp.z = st.z - lx * s + lz * c;
    return tmp;
  }

  // versão do jogador (usada pela câmera, respingos etc.)
  function toWorld(lx, lz) {
    return toWorldS(state, lx, lz);
  }

  function collide(st) {
    let pushX = 0;
    let pushZ = 0;
    let hitX = null;
    let hitZ = null;

    for (const [lx, lz] of hullPoints) {
      const p = toWorldS(st, lx, lz);

      if (p.x > LIMX && LIMX - p.x < pushX) {
        pushX = LIMX - p.x;
        hitX = [p.x, p.z];
      } else if (p.x < -LIMX && -LIMX - p.x > pushX) {
        pushX = -LIMX - p.x;
        hitX = [p.x, p.z];
      }

      if (p.z > LIMZ && LIMZ - p.z < pushZ) {
        pushZ = LIMZ - p.z;
        hitZ = [p.x, p.z];
      } else if (p.z < -LIMZ && -LIMZ - p.z > pushZ) {
        pushZ = -LIMZ - p.z;
        hitZ = [p.x, p.z];
      }
    }

    for (const [gx, gz] of goalPosts) {
      for (const [lx, lz] of hullPoints) {
        const p = toWorldS(st, lx, lz);
        const dx = p.x - gx;
        const dz = p.z - gz;
        const d = Math.hypot(dx, dz);

        if (d < 0.4 && d > 1e-4) {
          const nx = dx / d;
          const nz = dz / d;
          st.x += nx * (0.4 - d);
          st.z += nz * (0.4 - d);

          const vn = st.vx * nx + st.vz * nz;
          if (vn < 0) {
            sfx.hullHit(-vn * 0.8, st.x + nx * -0.4, st.z + nz * -0.4);
            st.vx -= 1.35 * vn * nx;
            st.vz -= 1.35 * vn * nz;
          }
        }
      }
    }

    // obstáculos do mapa (pilares, boias, blocos de gelo, argolas)
    for (const o of MAP.obstacles) {
      for (const [lx, lz] of hullPoints) {
        const p = toWorldS(st, lx, lz);
        const ox = p.x - o.x;
        const oz = p.z - o.z;
        const d = Math.hypot(ox, oz);
        const minD = o.r + 0.3;

        if (d < minD && d > 1e-4) {
          const nx = ox / d;
          const nz = oz / d;
          st.x += nx * (minD - d);
          st.z += nz * (minD - d);

          const vn = (st.vx - (o.vx || 0)) * nx + (st.vz - (o.vz || 0)) * nz;
          if (vn < 0) {
            sfx.hullHit(-vn, p.x, p.z);
            st.vx -= 1.4 * vn * nx;
            st.vz -= 1.4 * vn * nz;
            st.kick += (lz * nx - lx * nz) * -vn * 0.01;
          }
        }
      }
    }

    function bounce(nx, nz, hit) {
      const vn = st.vx * nx + st.vz * nz;   // componente contra a parede
      if (vn < 0) {
        const impact = -vn;
        st.vx -= (1 + 0.35) * vn * nx;
        st.vz -= (1 + 0.35) * vn * nz;

        // batida gira o barco conforme o ponto de contato
        const rx = hit[0] - st.x;
        const rz = hit[1] - st.z;
        st.kick += (rz * nx - rx * nz) * impact * 0.035;
        st.kick = Math.max(-2.2, Math.min(2.2, st.kick));

        if (impact > 0.4) {
          impulse(hit[0], hit[1], 0.025 * Math.min(impact, 10), 1.6);
          foamAt(hit[0], hit[1], 0.6, 1.6);
          sfx.hullHit(impact, hit[0], hit[1]);
        }
      }
    }

    if (pushX !== 0) {
      st.x += pushX;
      bounce(Math.sign(pushX), 0, hitX);
    }

    if (pushZ !== 0) {
      st.z += pushZ;
      bounce(0, Math.sign(pushZ), hitZ);
    }
  }

  function stepBoat(st, inp, dt) {
    const thr = (inp.up ? 1 : 0) - (inp.down ? 1 : 0);
    const str = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);

    st.throttle += (thr - st.throttle) * Math.min(1, dt * 5);
    st.steer += (str - st.steer) * Math.min(1, dt * 6);

    const c = Math.cos(st.heading);
    const s = Math.sin(st.heading);

    // velocidade decomposta em frente / lateral
    let vF = st.vx * c - st.vz * s;
    let vL = st.vx * s + st.vz * c;

    // ---------- boost: gasta a barra enquanto ativo, recarrega depois ----------
    const wantBoost = !!inp.boost && st.boost > 0.01 && !st.boostLock;
    if (wantBoost && !st.boosting && st === state) sfx.swoosh();
    st.boosting = wantBoost;

    if (wantBoost) {
      st.boost = Math.max(0, st.boost - dt / BOOST_DRAIN_S);
      st.boostDelay = BOOST_DELAY;
      if (st.boost <= 0) st.boostLock = true;   // esvaziou: só volta a usar com 25%
    } else {
      st.boostDelay = Math.max(0, st.boostDelay - dt);
      if (st.boostDelay <= 0) st.boost = Math.min(1, st.boost + dt / BOOST_RECHARGE_S);
      if (st.boostLock && st.boost >= 0.25) st.boostLock = false;
    }

    vF += (thr > 0 ? 8.5 : thr < 0 ? 4 : 0) * thr * dt;
    if (wantBoost) vF += (thr > 0 ? BOOST_ACCEL : 16) * dt;
    vF -= (0.5 * vF + 0.02 * Math.abs(vF) * vF) * MAP.drag * dt;

    if (inp.brake) vF *= Math.exp(-3.2 * dt);

    vL *= Math.exp(-2.4 * MAP.grip * dt);

    st.vx = vF * c + vL * s;
    st.vz = -vF * s + vL * c;

    if (MAP.force !== "none") {
      const fa = mapAccel(st.x, st.z);
      st.vx += fa.x * 0.75 * dt;
      st.vz += fa.z * 0.75 * dt;
    }

    const speedFactor = Math.max(-1, Math.min(1, vF / 1.8));
    st.heading += (st.steer * 1.5 * speedFactor + st.kick) * dt;
    st.kick *= 0.93;

    st.x += st.vx * dt;
    st.z += st.vz * dt;

    collide(st);

    // ---------- o barco mexe a água ----------
    const sp = Math.hypot(st.vx, st.vz);
    const n = Math.min(1, sp / 11);
    const wash = Math.max(Math.abs(st.throttle), st.boosting ? 1 : 0);

    if (sp > 0.25 || wash > 0.1) {
      // afundamento sob o casco (deslocamento)
      for (const lx of [-2.4, -0.8, 0.8, 2.4]) {
        const p = toWorldS(st, lx, 0);
        impulse(p.x, p.z, -0.007 * n, 1.7);
      }

      // onda de proa
      let p = toWorldS(st, 3.2, 0);
      impulse(p.x, p.z, 0.032 * n, 1.7);
      foamAt(p.x, p.z, 0.18 * n * n, 1.3);

      // ondas laterais (cristas ao lado do casco)
      for (const side of [-1, 1]) {
        p = toWorldS(st, 1.2, side * 1.05);
        impulse(p.x, p.z, 0.011 * n, 1.3);
        foamAt(p.x, p.z, 0.1 * n, 1.1);
      }

      // esteira da hélice
      p = toWorldS(st, -4.1, 0);
      impulse(p.x, p.z, 0.016 * wash * (0.5 + n), 1.2);
      foamAt(p.x, p.z, 0.3 * (wash * 0.6 + n), 1.5);

      // ondas em V abrindo atrás do barco
      for (const side of [-1, 1]) {
        const q = toWorldS(st, -3.0, side * 1.15);
        impulse(q.x, q.z, 0.015 * n, 1.4);
      }

      // trilha de espuma mais larga e comprida
      const tr = toWorldS(st, -5.2, 0);
      foamAt(tr.x, tr.z, 0.22 * n, 1.9);
    }

  }

  const IDLE = { up: false, down: false, left: false, right: false, brake: false };

  // ---------- CHUTE (botão esquerdo do mouse / botão ⚽ / tecla E) ----------
  const KICK_CD = 0.55;       // intervalo entre chutes (s)
  const KICK_REACH = 2.4;     // alcance extra além do casco
  const kickState = { cd: 0 };

  function tryKick(agent) {
    agent = agent || playerAgent;
    const cdo = agent.isPlayer ? kickState : agent;
    if (mode !== "play" || match.over) return;
    if (isComp() && match.countdown > 0.9) return;
    if (cdo.cd > 0) return;

    const st = agent.st;
    cdo.cd = KICK_CD;

    const fx = Math.cos(st.heading);
    const fz = -Math.sin(st.heading);

    // ponto do casco mais próximo da bola (mesma cápsula da colisão)
    let t = (ball.x - st.x) * fx + (ball.z - st.z) * fz;
    t = Math.max(-2.5, Math.min(3.0, t));
    const px = st.x + fx * t;
    const pz = st.z + fz * t;

    let nx = ball.x - px;
    let nz = ball.z - pz;
    const d = Math.hypot(nx, nz);
    const hullD = BALL_R + 0.85;

    // balanço do casco + marola mesmo quando erra a bola
    st.pitch += 0.1;
    const bow = toWorldS(st, 3.2, 0);
    impulse(bow.x, bow.z, 0.01, 1.4);
    foamAt(bow.x, bow.z, 0.25, 1.4);

    if (d > hullD + KICK_REACH) return;   // bola longe: chute no ar

    if (agent.isPlayer) tutEvent("kick");

    if (d > 1e-4) { nx /= d; nz /= d; } else { nx = fx; nz = fz; }

    // direção: mistura "do barco para a bola" com a direção da proa
    let dx = nx * 0.65 + fx * 0.35;
    let dz = nz * 0.65 + fz * 0.35;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;

    // quanto mais perto da bola, mais forte o chute
    const k = Math.max(0.45, Math.min(1, 1 - (d - hullD) / KICK_REACH));
    const power = 9 + 8 * k;

    ball.vx = ball.vx * 0.3 + dx * power + st.vx * 0.5;
    ball.vz = ball.vz * 0.3 + dz * power + st.vz * 0.5;

    // o barco sente o coice
    st.vx -= dx * 1.2;
    st.vz -= dz * 1.2;

    impulse(ball.x, ball.z, 0.03, 1.6);
    foamAt(ball.x, ball.z, 0.6, 1.6);
    sfx.ballHit(power * 0.8, ball.x, ball.z);

    for (let i = 0; i < 14; i++) {
      spawnSpray(
        ball.x + (Math.random() - 0.5) * 0.8,
        WATER_Y + heightAt(ball.x, ball.z) + 0.2,
        ball.z + (Math.random() - 0.5) * 0.8,
        dx * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2,
        2 + Math.random() * 3,
        dz * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2,
        0.06 + Math.random() * 0.1
      );
    }
  }

  function physicsStep(dt) {
    kickState.cd = Math.max(0, kickState.cd - dt);
    if (input.kick) {
      input.kick = false;
      tryKick();
      if (net.role === "guest" && mode === "play") netSend({ t: "k" });
    }
    for (const b of allBoats) {
      if (b.isPlayer) continue;
      b.cd = Math.max(0, (b.cd || 0) - dt);
      if (b.wantKick) { b.wantKick = false; tryKick(b); }
    }

    const comp = isComp();
    const frozen = comp && match.countdown > 0.9;     // contagem regressiva
    const live = comp && !frozen && !match.over;

    if (comp) assignRoles();
    stepMap(dt);

    for (const b of allBoats) {
      if (!b.isPlayer && !b.remote) {
        if (live) {
          botThink(b, dt);
        } else {
          b.inp.up = b.inp.down = b.inp.left = b.inp.right = false;
          b.inp.brake = true;
        }
      }
      stepBoat(b.st, frozen ? IDLE : b.inp, dt);
    }

    boatCollisions();
    ballStep(dt);
    stepWaves();
  }

  // ==================================================
  // AGENTES: JOGADOR E BOTS
  // ==================================================

  function newState(x, z, heading) {
    return {
      x, z, heading, vx: 0, vz: 0, kick: 0, throttle: 0, steer: 0,
      heave: 0, pitch: 0, roll: 0, propAngle: 0, propSpin: 0,
      boost: 1, boosting: false, boostDelay: 0, boostLock: false
    };
  }

  const playerAgent = {
    isPlayer: true,
    team: 0,
    st: state,
    inp: input,
    role: "attack",
    spawn: { x: 0, z: 22, h: Math.PI / 2 }
  };
  allBoats.push(playerAgent);

  // posições iniciais por tamanho de time (time 0 em +Z, time 1 espelhado)
  const FORMATION = {
    1: [[0, 22]],
    2: [[-8, 22], [8, 40]],
    3: [[0, 22], [-16, 38], [16, 38]]
  };

  function spawnFor(team, slot, size) {
    const f = FORMATION[size][slot];
    return team === 0
      ? { x: f[0], z: f[1], h: Math.PI / 2 }
      : { x: -f[0], z: -f[1], h: -Math.PI / 2 };
  }

  // ---------- modelos 3D dos bots (clones do barco do jogador) ----------
  const botPool = [];

  function makeBotRig() {
    const rig = boatRig.clone(true);
    if (LOW) rig.traverse(o => { if (o.isMesh) o.castShadow = false; });
    rig.visible = false;
    scene.add(rig);

    const g = rig.children[0];
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);

    const hullM = hullMat.clone();
    const accM = accentMat.clone();

    rig.traverse(o => {
      if (!o.isMesh) return;
      if (o.material === hullMat) o.material = hullM;
      else if (o.material === accentMat) o.material = accM;
    });

    const mo = g.children[boat.children.indexOf(motor)];
    const props = mo.children.filter(o => o.isGroup);

    return { rig, g, hullM, accM, props };
  }

  // seta amarela sobre o barco do jogador (só no competitivo)
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.7, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.92 })
  );
  marker.rotation.x = Math.PI;
  marker.visible = false;
  scene.add(marker);

  const teamMarks = [0, 1, 2, 3, 4, 5].map(() => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.rotation.x = Math.PI;
    m.visible = false;
    scene.add(m);
    return m;
  });

  function accentFor(color) {
    const t = new THREE.Color(color);
    return t.getHSL({}).s < 0.15 && t.r > 0.8
      ? new THREE.Color(0x1676a2)
      : t.clone().multiplyScalar(0.6);
  }

  // cor do time adversário: contrasta com a cor escolhida pelo jogador
  function opponentColor() {
    const hsl = paintTarget.getHSL({});
    const warm = hsl.h < 0.17 || hsl.h > 0.9;
    return hsl.s < 0.2 || warm ? (hsl.s < 0.2 ? 0xd7263d : 0x1f6fe0) : 0xd7263d;
  }

  function buildBoats(type, size) {
    botPool.forEach(v => { v.rig.visible = false; });
    allBoats.length = 0;

    playerAgent.team = 0;
    playerAgent.aid = 0;
    playerAgent.spawn = spawnFor(0, 0, size);
    Object.assign(state, newState(playerAgent.spawn.x, playerAgent.spawn.z, playerAgent.spawn.h));
    allBoats.push(playerAgent);

    marker.visible = false;
    if (type !== "comp") return;

    const oppHex = opponentColor();
    let used = 0;

    const addBot = (team, slot) => {
      if (botPool.length <= used) botPool.push(makeBotRig());
      const vis = botPool[used++];
      const sp = spawnFor(team, slot, size);

      if (team === 0) {
        vis.hullM.color.copy(paintTarget);
        vis.accM.color.copy(accentTarget);
      } else {
        vis.hullM.color.set(oppHex);
        vis.accM.color.copy(accentFor(oppHex));
      }

      vis.rig.visible = true;

      allBoats.push({
        isPlayer: false,
        team,
        vis,
        st: newState(sp.x, sp.z, sp.h),
        inp: { up: false, down: false, left: false, right: false, brake: false },
        spawn: sp,
        role: "defend",
        skill: 0.92 + Math.random() * 0.08,
        stuck: 0,
        rev: 0
      });
    };

    for (let slot = 1; slot < size; slot++) addBot(0, slot);
    for (let slot = 0; slot < size; slot++) addBot(1, slot);
  }

  function resetPositions() {
    for (const b of allBoats) {
      Object.assign(b.st, newState(b.spawn.x, b.spawn.z, b.spawn.h));
      if (!b.isPlayer && !b.remote) {
        b.inp.up = b.inp.down = b.inp.left = b.inp.right = b.inp.brake = false;
        b.stuck = 0;
        b.rev = 0;
      }
    }
    prevPos.set(state.x, 0, state.z);
    if (mode === "play") snapCamera();
  }

  // ---------- colisão entre barcos ----------
  const BOAT_PTS = [-2.1, 0, 2.1];
  const BOAT_R = 1.0;

  function boatCollisions() {
    for (let i = 0; i < allBoats.length; i++) {
      for (let j = i + 1; j < allBoats.length; j++) {
        const a = allBoats[i].st;
        const b = allBoats[j].st;
        if (Math.hypot(a.x - b.x, a.z - b.z) > 9) continue;

        for (const la of BOAT_PTS) {
          for (const lb of BOAT_PTS) {
            const pa = toWorldS(a, la, 0);
            const ax = pa.x, az = pa.z;
            const pb = toWorldS(b, lb, 0);
            const bx = pb.x, bz = pb.z;

            let nx = ax - bx;
            let nz = az - bz;
            const d = Math.hypot(nx, nz);
            const minD = BOAT_R * 2;
            if (d >= minD) continue;

            if (d > 1e-4) { nx /= d; nz /= d; } else { nx = 1; nz = 0; }

            const push = (minD - d) * 0.5;
            a.x += nx * push; a.z += nz * push;
            b.x -= nx * push; b.z -= nz * push;

            const vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
            if (vn < 0) {
              const jj = -(1 + 0.3) * vn * 0.5;
              a.vx += jj * nx; a.vz += jj * nz;
              b.vx -= jj * nx; b.vz -= jj * nz;

              if (vn < -1) {
                sfx.boatCrash(-vn, (ax + bx) / 2, (az + bz) / 2);
                impulse((ax + bx) / 2, (az + bz) / 2, 0.02 * Math.min(-vn, 8), 1.4);
                foamAt((ax + bx) / 2, (az + bz) / 2, 0.4, 1.4);
              }
            }
          }
        }
      }
    }
  }

  // ---------- inteligência dos bots ----------
  const BOT_MAX = 10.5;  // velocidade máxima dos bots (o jogador chega a ~11.5)
  const clampV = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function roleDist(b) {
    // quem já é atacante ganha uma vantagem, para os papéis não ficarem trocando
    return Math.hypot(b.st.x - ball.x, b.st.z - ball.z) - (b.role === "attack" ? 5 : 0);
  }

  function assignRoles() {
    for (const team of [0, 1]) {
      const list = allBoats.filter(b => b.team === team);
      list.sort((p, q) => roleDist(p) - roleDist(q));
      list.forEach((b, i) => {
        b.role = i === 0 ? "attack"
          : (i === 1 && list.length === 3 ? "support" : "defend");
      });
    }
  }

  function botThink(b, dt) {
    const st = b.st;
    const inp = b.inp;
    const own = b.team === 0 ? 1 : -1;      // lado (z) do gol que o time defende
    const goalZ = -own * GOAL_LINE;         // gol adversário
    const maxSp = BOT_MAX * b.skill;

    const c = Math.cos(st.heading);
    const s = Math.sin(st.heading);
    const vF = st.vx * c - st.vz * s;
    const sp = Math.hypot(st.vx, st.vz);

    const dBall = Math.hypot(ball.x - st.x, ball.z - st.z);

    // ---------- bola prevista (onde ela estará quando eu chegar) ----------
    const lead = clampV(dBall / (Math.max(sp, 3) + 4), 0, 1.1);
    const px = clampV(ball.x + ball.vx * lead, -(HX - BALL_R), HX - BALL_R);
    const pz = clampV(ball.z + ball.vz * lead, -(HZ - BALL_R), HZ - BALL_R);

    // ---------- papel efetivo ----------
    let role = b.role;
    const ballInOwnBox = ball.z * own > GOAL_LINE - 24;
    // zagueiro sai para tirar a bola quando ela chega perto do gol
    if (role === "defend" && ballInOwnBox && dBall < 16) {
      const mate = allBoats.find(o => o !== b && o.team === b.team && o.role === "attack");
      const mateD = mate ? Math.hypot(mate.st.x - ball.x, mate.st.z - ball.z) : 999;
      if (mateD > dBall + 3) role = "attack";   // só sai se o atacante estiver mais longe
    }

    // bola presa no canto atrás do gol
    const pocket = Math.abs(ball.z) > GOAL_LINE - 1.5 && Math.abs(ball.x) > GOAL_W + 0.5;
    const endZone = Math.abs(ball.z) > GOAL_LINE - 8 && Math.abs(ball.x) > GOAL_W + 0.5;

    let tx, tz;
    let hold = false;

    if (role === "attack") {
      // mira no lado do gol que o goleiro adversário deixou livre
      let aimX = (ball.x > 0 ? -1 : 1) * 2.5;
      const keepers = allBoats.filter(o => o.team !== b.team && o.role === "defend");
      if (keepers.length) {
        let kx = 0;
        keepers.forEach(k => { kx += k.st.x; });
        kx /= keepers.length;
        aimX = kx > 0 ? -4.5 : 4.5;
      }

      let aimZ = goalZ;
      // bola perto da linha de fundo fora do gol: tira dali para o campo
      if (endZone) {
        aimX = ball.x * 0.3;
        aimZ = Math.sign(ball.z) * (GOAL_LINE - 30);
      }

      let dx = aimX - px;
      let dz = aimZ - pz;
      const dl = Math.hypot(dx, dz) || 1;
      dx /= dl; dz /= dl;

      const bx = st.x - px;
      const bz = st.z - pz;
      const along = bx * dx + bz * dz;           // < 0: barco está atrás da bola
      const cross = bx * -dz + bz * dx;          // lado da linha de chute

      if (pocket) {
        // bate de frente e deixa rebater na parede
        tx = ball.x;
        tz = ball.z;
      } else {
        const ac = Math.abs(cross);

        if (along < -0.5) {
          // atrás da bola: a "isca" fica na linha de chute, tanto mais atrás
          // quanto maior o desvio lateral; alinhado, vira a própria bola
          const k = clampV(ac * 1.5, 0, 8);
          tx = px + dx * (1 - k);
          tz = pz + dz * (1 - k);
        } else {
          // na frente da bola: contorna pelo lado até ficar atrás dela
          const side = cross >= 0 ? 1 : -1;
          const back = 5 + Math.min(4, sp * 0.4);
          tx = px - dx * back + (-dz) * side * 7;
          tz = pz - dz * back + dx * side * 7;
        }
      }
    } else if (role === "support") {
      // segundo homem: acompanha a jogada por trás e pelo lado
      const side = ball.x >= 0 ? -1 : 1;
      const attacking = ball.z * own < 0;        // bola no campo adversário
      tx = ball.x * 0.4 + side * 10;
      // bola funda no próprio campo: espera à frente dela para receber o passe
      tz = ballInOwnBox ? ball.z - own * 16 : ball.z + own * (attacking ? 8 : 12);
      hold = true;
    } else {
      // goleiro: vai até onde a bola vai cruzar a linha de defesa
      const lineZ = own * (GOAL_LINE - 10);
      let ix = ball.x;
      if (ball.vz * own > 1) {
        const t = (lineZ - ball.z) / ball.vz;
        if (t > 0 && t < 4) ix = ball.x + ball.vx * t;
      }
      tx = clampV(ix, -GOAL_W + 1.5, GOAL_W - 1.5);
      tz = lineZ;
      hold = true;
    }

    // afasta dos companheiros para não ficarem um em cima do outro
    for (const o of allBoats) {
      if (o === b || o.team !== b.team) continue;
      const ox = st.x - o.st.x;
      const oz = st.z - o.st.z;
      const od = Math.hypot(ox, oz);
      if (od < 7 && od > 0.1) {
        tx += (ox / od) * (7 - od) * 1.2;
        tz += (oz / od) * (7 - od) * 1.2;
      }
    }

    // desvia dos obstáculos do mapa
    for (const o of MAP.obstacles) {
      const ox = o.x - st.x;
      const oz = o.z - st.z;
      const od = Math.hypot(ox, oz);
      if (od > o.r + 16 || od < 0.1) continue;

      const ahead = ox * c - oz * s;            // distância à frente do barco
      if (ahead < 0) continue;
      if (Math.hypot(tx - st.x, tz - st.z) < ahead - o.r) continue;   // alvo vem antes do obstáculo

      const side = ox * s + oz * c;             // lado (+/-) em que o obstáculo está
      const clear = o.r + 3.5 - Math.abs(side);
      if (clear > 0) {
        const dir = side >= 0 ? -1 : 1;
        const k = clear * 2.4 * (1.3 - od / (o.r + 16));
        tx += s * dir * k;
        tz += c * dir * k;
      }
    }

    const zLim = endZone ? HZ - 3.5 : GOAL_LINE - 2;
    tx = clampV(tx, -(HX - 5), HX - 5);
    tz = clampV(tz, -zLim, zLim);

    const ddx = tx - st.x;
    const ddz = tz - st.z;
    const dist = Math.hypot(ddx, ddz);
    const want = Math.atan2(-ddz, ddx);
    let diff = want - st.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));

    // preso na parede / trave: dá ré girando a proa para o alvo
    if (b.rev > 0) {
      b.rev -= dt;
      inp.up = false;
      inp.down = true;
      inp.brake = false;
      inp.left = diff < 0;     // de ré o volante funciona ao contrário
      inp.right = diff > 0;
      return;
    }

    // alvo colado no barco e fora do ângulo: ele ficaria girando em círculos,
    // então dá ré para ganhar espaço e apontar a proa de novo
    b.cool = Math.max(0, (b.cool || 0) - dt);
    if (Math.abs(diff) > 1.7 && dist < 4.5 && vF < 3.5 && !hold && b.cool <= 0) {
      b.rev = 0.8;
      b.cool = 2.5;
      return;
    }

    if (sp < 0.7 && dist > 4) b.stuck += dt;
    else b.stuck = Math.max(0, b.stuck - dt * 2);

    if (b.stuck > 1.3) {
      b.rev = 1.0;
      b.stuck = 0;
    }

    inp.left = diff > 0.05;
    inp.right = diff < -0.05;

    // o barco só vira com velocidade, mas curva fechada pede velocidade baixa
    let target = maxSp;
    const ad = Math.abs(diff);
    if (ad > 1.2) target = Math.min(target, 3.4);
    else if (ad > 0.6) target = Math.min(target, 6.5);
    if (hold) target = Math.min(target, Math.max(0, (dist - 2) * 0.9));

    inp.down = false;
    inp.up = vF < target;
    inp.brake = vF > target + 2.5 || (hold && dist < 3 && vF > 0.4);
  }

  function hAtLocal(st, lx, lz) {
    const p = toWorldS(st, lx, lz);
    return heightAt(p.x, p.z);
  }

  function updateBotVisual(b, dt) {
    const st = b.st;
    const v = b.vis;

    const hBow = hAtLocal(st, 3, 0);
    const hStern = hAtLocal(st, -3, 0);
    const hPort = hAtLocal(st, 0, -0.9);
    const hStar = hAtLocal(st, 0, 0.9);
    const hMid = (hBow + hStern + hPort + hStar) * 0.25;

    const sp = Math.hypot(st.vx, st.vz);
    const n = Math.min(1, sp / 11);
    const k = Math.min(1, dt * 7);

    const targetPitch = Math.atan2(hBow - hStern, 6) * 0.9 + 0.05 * n * st.throttle;
    const targetRoll = Math.atan2(hPort - hStar, 1.8) * 0.9 + -st.steer * Math.min(1, sp / 5) * 0.3;

    st.pitch += (targetPitch - st.pitch) * k;
    st.roll += (targetRoll - st.roll) * k;
    st.heave += (hMid * 0.8 - st.heave) * k;

    v.rig.position.set(st.x, 0, st.z);
    v.rig.rotation.y = st.heading;
    v.g.position.y = st.heave;
    v.g.rotation.z = st.pitch;
    v.g.rotation.x = st.roll;

    const spinTarget = sp > 0.4 ? 10 + sp * 5 : 0;
    st.propSpin += (spinTarget - st.propSpin) * Math.min(1, dt * 4);
    st.propAngle += st.propSpin * dt;
    v.props.forEach((g, i) => {
      g.rotation.x = st.propAngle + i * Math.PI * 2 / 3;
    });
  }

  // ==================================================
  // CONTROLES (TECLADO + TOQUE)
  // ==================================================

  const keyMap = {
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    Space: "brake",
    ShiftLeft: "boost", ShiftRight: "boost",
    KeyE: "kick"
  };

  // botão esquerdo do mouse = chutar (só durante o jogo)
  renderer.domElement.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button === 0 && mode === "play" && !paused) {
      input.kick = true;
      e.preventDefault();
    }
  });

  // no jogo, o botão esquerdo não gira a câmera: giro passa para o direito
  function setCameraButtons(playing) {
    controls.mouseButtons = {
      LEFT: playing ? -1 : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    };
  }
  setCameraButtons(false);

  window.addEventListener("keydown", e => {
    const k = keyMap[e.code];
    if (k && mode === "play" && !paused) {
      input[k] = true;
      e.preventDefault();
    }
  });

  window.addEventListener("keyup", e => {
    const k = keyMap[e.code];
    if (k) {
      input[k] = false;
      e.preventDefault();
    }
  });

  window.addEventListener("blur", () => {
    for (const k in input) input[k] = false;
  });

  function makePad(className, buttons) {
    const pad = document.createElement("div");
    pad.className = "pad " + className;

    buttons.forEach(([label, key]) => {
      const b = document.createElement("button");
      b.textContent = label;

      const on = e => {
        e.preventDefault();
        input[key] = true;
        b.classList.add("on");
      };

      const off = e => {
        e.preventDefault();
        input[key] = false;
        b.classList.remove("on");
      };

      b.addEventListener("pointerdown", on);
      b.addEventListener("pointerup", off);
      b.addEventListener("pointercancel", off);
      b.addEventListener("pointerleave", off);
      b.addEventListener("contextmenu", e => e.preventDefault());

      pad.appendChild(b);
    });

    viewer.appendChild(pad);
  }

  makePad("left", [["◀", "left"], ["▶", "right"], ["🚀", "boost"]]);
  makePad("right", [["⚽", "kick"], ["▼", "down"], ["▲", "up"]]);

  // ==================================================
  // CÂMERA DE PERSEGUIÇÃO
  // ==================================================

  const chase = { on: true, dragging: false };
  const prevPos = new THREE.Vector3(state.x, 0, state.z);
  const camGoal = new THREE.Vector3();
  const tgtGoal = new THREE.Vector3();
  const fwdVec = new THREE.Vector3();

  controls.addEventListener("start", () => { chase.dragging = true; });
  controls.addEventListener("end", () => { chase.dragging = false; });

  function computeGoals() {
    fwdVec.set(Math.cos(state.heading), 0, -Math.sin(state.heading));
    camGoal.set(state.x, 6.8, state.z).addScaledVector(fwdVec, -11);
    tgtGoal.set(state.x, 0.4, state.z).addScaledVector(fwdVec, 3);
  }

  function snapCamera() {
    computeGoals();
    camera.position.copy(camGoal);
    controls.target.copy(tgtGoal);
    controls.update();
  }

  // Vinheta suave nas bordas da tela
  const vignette = document.createElement("div");
  vignette.style.cssText =
    "position:absolute;inset:0;pointer-events:none;z-index:1;" +
    "background:radial-gradient(ellipse at center," +
    "rgba(0,0,0,0) 60%,rgba(3,18,30,0.5) 100%);";
  viewer.appendChild(vignette);

  // ==================================================
  // TELAS: START → ESCOLHA DE COR → JOGO
  // ==================================================

  const startScreen = document.getElementById("start");
  const pickerScreen = document.getElementById("picker");
  const paletteEl = document.getElementById("palette");

  const paintColors = [
    ["Branco", 0xf3f5f4], ["Vermelho", 0xd7263d], ["Laranja", 0xff7a1a],
    ["Amarelo", 0xffc933], ["Verde", 0x2bb673], ["Turquesa", 0x14b8c4],
    ["Azul", 0x1f6fe0], ["Marinho", 0x14275a], ["Roxo", 0x7b3fe4],
    ["Rosa", 0xff5fa2], ["Preto", 0x15191d]
  ];

  const paintTarget = new THREE.Color(0xf3f5f4);
  const accentTarget = new THREE.Color(0x1676a2);
  const swatches = [];

  paintColors.forEach(([name, hex], idx) => {
    const b = document.createElement("button");
    b.className = "sw" + (idx === 0 ? " selected" : "");
    b.title = name;
    b.setAttribute("aria-label", name);
    b.style.background = "#" + hex.toString(16).padStart(6, "0");

    b.onclick = () => {
      paintTarget.set(hex);
      if (idx === 0) accentTarget.set(0x1676a2);
      else accentTarget.copy(paintTarget).multiplyScalar(0.6);
      swatches.forEach(x => x.classList.remove("selected"));
      b.classList.add("selected");
    };

    swatches.push(b);
    paletteEl.appendChild(b);
  });

  let shiftX = 0, shiftY = 0, tShiftX = 0, tShiftY = 0;

  function setPickerShift() {
    if (innerWidth > innerHeight) { tShiftX = 0.2; tShiftY = 0; }
    else { tShiftX = 0; tShiftY = 0.17; }
  }

  window.addEventListener("resize", () => {
    if (mode === "pick" || mode === "maps" || mode === "modes") setPickerShift();
  });

  function menuCamera() {
    controls.target.set(state.x, 0.7, state.z);
    camera.position.set(state.x + 8, 4.6, state.z + 9);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.4;
    controls.enableZoom = false;
    controls.update();
  }

  // ---------- sons de interface ----------
  const unlockAudio = () => sfx.init();
  window.addEventListener("keydown", unlockAudio, true);

  window.addEventListener("pointerdown", e => {
    sfx.init();
    const b = e.target.closest && e.target.closest("button");
    if (!b || b.closest(".pad") || b.id === "mute") return;

    if (b.classList.contains("sw")) {
      sfx.swatch(Array.prototype.indexOf.call(b.parentNode.children, b));
    } else if (b.classList.contains("ghost") || b.id === "quit") {
      sfx.back();
    } else if (b.classList.contains("big") || b.closest("#sizes")) {
      sfx.confirm();
    } else {
      sfx.click();
    }
  }, true);

  window.addEventListener("pointerover", e => {
    if (e.pointerType !== "mouse") return;
    const b = e.target.closest && e.target.closest("button");
    if (!b || b.closest(".pad") || b.id === "mute") return;
    if (e.relatedTarget && b.contains(e.relatedTarget)) return;
    sfx.hover();
  });

  const muteBtn = document.getElementById("mute");
  const drawMute = () => { muteBtn.textContent = sfx.isMuted() ? "🔇" : "🔊"; };
  drawMute();
  muteBtn.onclick = () => {
    sfx.toggleMute();
    drawMute();
    if (!sfx.isMuted()) sfx.click();
  };

  const modesScreen = document.getElementById("modes");
  const resultScreen = document.getElementById("result");
  const resultTitle = document.getElementById("resultTitle");
  const resultScoreEl = document.getElementById("resultScore");
  const resultSub = document.getElementById("resultSub");
  const modeLabelEl = document.getElementById("modeLabel");
  const timerEl = document.getElementById("timer");

  // START → COR
  document.getElementById("play").onclick = () => {
    sfx.swoosh();
    mode = "pick";
    startScreen.classList.add("hidden");
    pickerScreen.classList.remove("hidden");
    setPickerShift();
  };

  // ---------- escolha de mapa ----------
  const mapsScreen = document.getElementById("maps");
  const mapImg = document.getElementById("mapImg");
  const mapNameEl = document.getElementById("mapName");
  const mapDescEl = document.getElementById("mapDesc");
  const mapTagsEl = document.getElementById("mapTags");
  const mapDotsEl = document.getElementById("mapDots");
  const mapIdxEl = document.getElementById("mapIdx");

  let mapIdx = Math.max(0, MAP_ORDER.indexOf(curTheme.id));
  let mapTimer = 0;

  MAP_ORDER.forEach((id, i) => {
    const d = document.createElement("button");
    d.className = "dot";
    d.setAttribute("aria-label", THEMES[id].name);
    d.onclick = () => showMap(i);
    mapDotsEl.appendChild(d);
  });

  function showMap(i) {
    mapIdx = (i + MAP_ORDER.length) % MAP_ORDER.length;
    const T = THEMES[MAP_ORDER[mapIdx]];

    drawMapPreview(mapImg, T.id);
    mapNameEl.textContent = T.name;
    mapDescEl.textContent = T.desc;
    mapIdxEl.textContent = (mapIdx + 1) + "/" + MAP_ORDER.length;

    mapTagsEl.innerHTML = "";
    T.tags.forEach(tag => {
      const s = document.createElement("span");
      s.className = "tag";
      s.textContent = tag;
      mapTagsEl.appendChild(s);
    });

    Array.prototype.forEach.call(mapDotsEl.children, (d, k) => d.classList.toggle("on", k === mapIdx));

    // o cenário 3D atrás do painel troca junto (com um pequeno atraso)
    clearTimeout(mapTimer);
    mapTimer = setTimeout(() => {
      if (curTheme.id !== T.id) applyMap(T.id);
      sfx.setScene(T.id);
    }, 150);
  }

  document.getElementById("mapPrev").onclick = () => showMap(mapIdx - 1);
  document.getElementById("mapNext").onclick = () => showMap(mapIdx + 1);

  window.addEventListener("keydown", e => {
    if (mode !== "maps") return;
    if (e.code === "ArrowLeft") showMap(mapIdx - 1);
    else if (e.code === "ArrowRight") showMap(mapIdx + 1);
  });

  // COR → TUTORIAL → MAPA
  document.getElementById("go").onclick = () => startTutorial();

  document.getElementById("mapBack").onclick = () => {
    mode = "pick";
    mapsScreen.classList.add("hidden");
    pickerScreen.classList.remove("hidden");
  };

  // MAPA → MODO
  document.getElementById("mapOk").onclick = () => {
    sfx.swoosh();
    clearTimeout(mapTimer);
    const T = THEMES[MAP_ORDER[mapIdx]];
    if (curTheme.id !== T.id) applyMap(T.id);
    sfx.setScene(T.id);
    mode = "modes";
    mapsScreen.classList.add("hidden");
    modesScreen.classList.remove("hidden");
  };

  document.getElementById("modesBack").onclick = () => {
    mode = "maps";
    modesScreen.classList.add("hidden");
    mapsScreen.classList.remove("hidden");
  };

  // MODO → JOGO
  document.getElementById("modeTrain").onclick = () => startMatch("train", 1);

  document.querySelectorAll("#sizes button").forEach(btn => {
    btn.onclick = () => startMatch("comp", +btn.dataset.size);
  });

  document.getElementById("again").onclick = () => (match.type === "online" ? onlineBackToLobby() : startMatch(match.type, match.size));
  document.getElementById("toMenu").onclick = () => exitToModes();
  document.getElementById("quit").onclick = () => openPause();

  function startMatch(type, size) {
    const wasResult = mode === "result";

    match.type = type;
    match.size = size;
    match.over = false;
    match.time = MATCH_TIME;
    match.countdown = (type === "comp" || type === "online") ? 3.9 : 0;
    match.lastSec = 999;
    sfx.swoosh();

    if (type === "online") buildOnlineBoats(net.roster, net.myAid, size);
    else buildBoats(type, size);
    prevPos.set(state.x, 0, state.z);

    resetBall();
    score[0] = score[1] = 0;
    drawScore();

    goalMsg.classList.remove("show");
    goalMsg.textContent = "GOL!";

    modeLabelEl.textContent = (type === "online"
      ? "ONLINE · " + size + "x" + size
      : type === "comp"
        ? "COMPETITIVO · " + size + "x" + size
        : "MODO TREINO") + " · " + curTheme.short;

    resetMapState();
    MAP.obstacles.forEach((o, i) => {
      const def = curTheme.obstacles[i];
      o.x = def.x;
      o.z = def.z;
      o.vx = def.vx;
      o.vz = def.vz;
    });
    sfx.setScene(curTheme.id);

    modesScreen.classList.add("hidden");
    resultScreen.classList.add("hidden");
    lobbyScreen.classList.add("hidden");
    onlineScreen.classList.add("hidden");
    viewer.classList.add("playing");

    for (const k in input) input[k] = false;
    kickState.cd = 0;
    setCameraButtons(true);

    mode = "play";
    controls.autoRotate = false;
    controls.enableZoom = true;
    chase.dragging = false;
    tShiftX = 0;
    tShiftY = 0;

    if (wasResult) snapCamera();
  }

  function exitToModes() {
    netLeave();
    lobbyScreen.classList.add("hidden");
    onlineScreen.classList.add("hidden");
    paused = false;
    pauseScreen.classList.add("hidden");
    sfx.swoosh();
    match.type = "train";
    match.over = false;
    match.countdown = 0;

    buildBoats("train", 1);
    prevPos.set(state.x, 0, state.z);

    resetBall();
    score[0] = score[1] = 0;
    drawScore();

    goalMsg.classList.remove("show");
    goalMsg.textContent = "GOL!";
    for (const k in input) input[k] = false;

    resultScreen.classList.add("hidden");
    modesScreen.classList.remove("hidden");
    viewer.classList.remove("playing");
    setCameraButtons(false);

    mode = "modes";
    menuCamera();
    setPickerShift();
  }

  function endMatch() {
    match.over = true;
    mode = "result";
    for (const k in input) input[k] = false;
    goalMsg.classList.remove("show");

    const mine = score[playerAgent.team];
    const theirs = score[1 - playerAgent.team];

    resultTitle.textContent =
      mine > theirs ? "🏆 VITÓRIA!" : mine < theirs ? "DERROTA" : "EMPATE";
    resultScoreEl.textContent = "VOCÊ " + mine + "  ×  " + theirs + " ELES";
    resultSub.textContent = (match.type === "online" ? "ONLINE" : "COMPETITIVO") + " · " + match.size + "x" + match.size + " · " + curTheme.short;

    resultScreen.classList.remove("hidden");
    document.getElementById("again").textContent = match.type === "online" ? "☰ VOLTAR À SALA" : "↻ JOGAR DE NOVO";

    sfx.endWhistle();
    const outcome = mine > theirs ? "win" : mine < theirs ? "lose" : "draw";
    setTimeout(() => sfx.result(outcome), 1500);

    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;
  }

  function matchTick(dt) {
    if (!isComp() || mode !== "play") return;

    if (match.countdown > 0) {
      match.countdown -= dt;

      if (match.countdown > 0) {
        const n = Math.ceil(match.countdown - 0.9);
        const txt = n >= 1 ? String(n) : "JÁ!";
        if (goalMsg.textContent !== txt) {
          goalMsg.textContent = txt;
          if (n >= 1) sfx.count(n);
          else sfx.go();
        }
        goalMsg.classList.add("show");
      } else {
        goalMsg.classList.remove("show");
        goalMsg.textContent = "GOL!";
      }
      return;
    }

    if (match.over) return;

    match.time -= dt;

    const sec = Math.ceil(match.time);
    if (sec !== match.lastSec) {
      match.lastSec = sec;
      if (sec <= 10 && sec > 0) sfx.tick(sec <= 3);
    }

    if (match.time <= 0) {
      match.time = 0;
      if (net.role !== "guest") {
        endMatch();
        if (net.role === "host") netSend({ t: "end", sc: score.slice() });
      }
    }
  }

  function fmtTime(t) {
    const s = Math.ceil(t);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  const speedEl = document.getElementById("speed");
  const boostBar = document.getElementById("boostBar");
  const boostFill = document.getElementById("boostFill");
  const propGroups = motor.children.filter(o => o.isGroup);

  // ==================================================
  // TELA INICIAL: água, raios de luz e bolhas (canvas 2D)
  // ==================================================

  document.querySelectorAll("#logoTitle .word").forEach((w, wi) => {
    const txt = w.textContent;
    w.textContent = "";
    Array.from(txt).forEach((chr, i) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = chr;
      s.style.setProperty("--i", String(wi * 4 + i));
      w.appendChild(s);
    });
  });

  (function startFx() {
    const cv = document.getElementById("startFx");
    const g = cv.getContext("2d");
    let W = 0, H = 0;
    const bubbles = [];
    const pops = [];
    const sparks = [];
    const ripples = [];
    let t = 0;
    let last = performance.now();
    let hidAt = 0;
    let tick = 0;
    let nextRipple = 0.4;

    // cáusticas (luz refratada no fundo da piscina), calculadas em baixa resolução
    const cc = document.createElement("canvas");
    const cg = cc.getContext("2d");
    let cImg = null, cw = 0, ch = 0;

    function sizeCaustics() {
      cw = Math.max(80, Math.ceil(W / 9));
      ch = Math.max(50, Math.ceil(H / 9));
      cc.width = cw;
      cc.height = ch;
      cImg = cg.createImageData(cw, ch);
    }

    function paintCaustics(time) {
      const d = cImg.data;
      const aspect = W / H;
      const tiles = 1.6;
      const TAU = 6.28318;
      const inten = 0.005;
      const tt = time * 0.45 + 23;

      for (let y = 0; y < ch; y++) {
        const py = (((y / ch) * tiles * TAU) % TAU) - 250;
        for (let x = 0; x < cw; x++) {
          const px = (((x / cw) * aspect * tiles * TAU) % TAU) - 250;
          let ix = px, iy = py, c = 1;

          for (let n = 0; n < 5; n++) {
            const tn = tt * (1 - 3.5 / (n + 1));
            const nx = px + Math.cos(tn - ix) + Math.sin(tn + iy);
            const ny = py + Math.sin(tn - iy) + Math.cos(tn + ix);
            ix = nx;
            iy = ny;
            c += 1 / Math.hypot(px / (Math.sin(ix + tn) / inten), py / (Math.cos(iy + tn) / inten));
          }

          c /= 5;
          c = 1.17 - Math.pow(c, 1.4);
          let v = Math.pow(Math.abs(c), 8);
          if (v > 1) v = 1;

          const k = (y * cw + x) * 4;
          d[k] = 215;
          d[k + 1] = 250;
          d[k + 2] = 255;
          d[k + 3] = v * 215;
        }
      }
      cg.putImageData(cImg, 0, 0);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = innerWidth;
      H = innerHeight;
      cv.width = Math.floor(W * dpr);
      cv.height = Math.floor(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeCaustics();
      paintCaustics(t);
    }

    function targetCount() {
      return Math.max(28, Math.min(90, Math.floor((W * H) / 20000)));
    }

    function makeBubble(init, x, y, small) {
      const layer = Math.random();
      const r = small ? 3 + Math.random() * 7
        : 6 + Math.pow(Math.random(), 2.2) * 58 * (0.5 + layer * 0.7);
      return {
        bx: x !== undefined ? x : Math.random() * W,
        y: y !== undefined ? y : (init ? Math.random() * H : H + r + Math.random() * 60),
        r,
        vy: 22 + (1 - Math.min(1, r / 64)) * 46 + layer * 22,
        ph: Math.random() * 6.28,
        wob: 6 + Math.random() * 18,
        sp: 0.6 + Math.random() * 1.2,
        a: 0.4 + layer * 0.5,
        tmp: !!small
      };
    }

    function init() {
      resize();
      bubbles.length = 0;
      for (let i = 0; i < targetCount(); i++) bubbles.push(makeBubble(true));
      sparks.length = 0;
      for (let i = 0; i < 24; i++) {
        sparks.push({ x: Math.random(), y: Math.random(), s: 3 + Math.random() * 6, ph: Math.random() * 6.28, sp: 1 + Math.random() * 2 });
      }
    }

    function drawBubble(b, x, y) {
      const r = b.r;
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255," + (0.5 * b.a) + ")");
      gr.addColorStop(0.55, "rgba(190,236,255," + (0.12 * b.a) + ")");
      gr.addColorStop(0.9, "rgba(255,255,255," + (0.3 * b.a) + ")");
      gr.addColorStop(1, "rgba(255,255,255," + (0.75 * b.a) + ")");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, 6.2832);
      g.fill();

      g.fillStyle = "rgba(255,255,255," + (0.85 * b.a) + ")";
      g.beginPath();
      g.ellipse(x - r * 0.36, y - r * 0.4, r * 0.22, r * 0.12, -0.6, 0, 6.2832);
      g.fill();
    }

    function pent(cx, cy, r, rot) {
      g.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = rot + k * 1.2566 - 1.5708;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
    }

    function drawBall(x, y, r, rot) {
      g.save();
      g.translate(x, y);

      g.shadowColor = "rgba(8,70,120,0.35)";
      g.shadowBlur = r * 0.5;
      g.shadowOffsetY = r * 0.25;
      const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(1, "#cfe3ee");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r, 0, 6.2832);
      g.fill();
      g.shadowColor = "transparent";

      g.save();
      g.beginPath();
      g.arc(0, 0, r, 0, 6.2832);
      g.clip();
      g.fillStyle = "#1a2230";
      g.strokeStyle = "#1a2230";
      g.lineWidth = r * 0.05;
      pent(0, 0, r * 0.34, rot);
      g.fill();
      for (let k = 0; k < 5; k++) {
        const a = rot + k * 1.2566 - 1.5708;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34);
        g.lineTo(Math.cos(a) * r * 0.64, Math.sin(a) * r * 0.64);
        g.stroke();
        pent(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, r * 0.34, a + 4.7124);
        g.fill();
      }
      g.restore();

      g.strokeStyle = "rgba(10,60,100,0.35)";
      g.lineWidth = r * 0.04;
      g.beginPath();
      g.arc(0, 0, r, 0, 6.2832);
      g.stroke();

      g.fillStyle = "rgba(255,255,255,0.55)";
      g.beginPath();
      g.ellipse(-r * 0.4, -r * 0.45, r * 0.22, r * 0.11, -0.7, 0, 6.2832);
      g.fill();
      g.restore();
    }

    // raia de piscina: corda com boias vermelhas e brancas balançando
    function laneRope(y, time, dir) {
      const step = 38;
      const pts = [];
      for (let x = -step; x <= W + step; x += step) {
        pts.push([x, y + Math.sin(x * 0.018 + time * 1.5 * dir) * 5 + Math.sin(x * 0.043 - time) * 2]);
      }

      g.strokeStyle = "rgba(8,70,130,0.25)";
      g.lineWidth = 5;
      g.beginPath();
      pts.forEach(([x, yy], i) => { if (i) g.lineTo(x, yy + 5); else g.moveTo(x, yy + 5); });
      g.stroke();

      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.lineWidth = 3;
      g.beginPath();
      pts.forEach(([x, yy], i) => { if (i) g.lineTo(x, yy); else g.moveTo(x, yy); });
      g.stroke();

      pts.forEach(([x, yy], i) => {
        const red = i % 2 === 0;
        g.fillStyle = "rgba(8,70,130,0.22)";
        g.beginPath();
        g.ellipse(x, yy + 7, 13, 6, 0, 0, 6.2832);
        g.fill();

        const gr = g.createRadialGradient(x - 4, yy - 4, 1, x, yy, 13);
        gr.addColorStop(0, red ? "#ff8a8a" : "#ffffff");
        gr.addColorStop(1, red ? "#d7263d" : "#cfe3ee");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, yy, 12, 0, 6.2832);
        g.fill();
      });
    }

    function popAt(x, y) {
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        const bx = b.bx + Math.sin(t * b.sp + b.ph) * b.wob;
        if (Math.hypot(bx - x, b.y - y) < b.r + 6) {
          pops.push({ x: bx, y: b.y, r: b.r, t: 0 });
          if (b.tmp) bubbles.splice(i, 1);
          else Object.assign(b, makeBubble(false));
        }
      }
    }

    const startEl = document.getElementById("start");
    let lastSpawn = 0;

    startEl.addEventListener("pointerdown", e => {
      popAt(e.clientX, e.clientY);
      ripples.push({ x: e.clientX, y: e.clientY, t: 0, big: true });
    });

    startEl.addEventListener("pointermove", e => {
      const n = performance.now();
      if (n - lastSpawn > 70) {
        lastSpawn = n;
        if (bubbles.length < 170) bubbles.push(makeBubble(false, e.clientX + (Math.random() - 0.5) * 24, e.clientY + 10, true));
        if (ripples.length < 24) ripples.push({ x: e.clientX, y: e.clientY, t: 0 });
      }
    });

    window.addEventListener("resize", resize);

    function frame(now) {
      if (startScreen.classList.contains("hidden")) {
        if (!hidAt) hidAt = now;
        if (now - hidAt > 800) return;
      }
      requestAnimationFrame(frame);

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      if ((tick++ & 1) === 0) paintCaustics(t);

      // água da piscina
      const base = g.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0, "#58cdf6");
      base.addColorStop(0.55, "#2ea6e8");
      base.addColorStop(1, "#1a80d0");
      g.fillStyle = base;
      g.fillRect(0, 0, W, H);

      // azulejos no fundo, tremendo com a ondulação da água
      const ts = Math.max(70, Math.min(130, Math.min(W, H) / 6));
      g.lineWidth = 3;
      g.strokeStyle = "rgba(255,255,255,0.14)";
      g.beginPath();
      for (let x0 = -ts; x0 <= W + ts; x0 += ts) {
        for (let y = -30; y <= H + 30; y += 30) {
          const x = x0 + Math.sin(y * 0.012 + t * 0.9 + x0 * 0.01) * 8 + Math.sin(y * 0.031 - t * 0.6) * 3;
          if (y === -30) g.moveTo(x, y); else g.lineTo(x, y);
        }
      }
      for (let y0 = -ts; y0 <= H + ts; y0 += ts) {
        for (let x = -30; x <= W + 30; x += 30) {
          const y = y0 + Math.sin(x * 0.012 - t * 0.8 + y0 * 0.01) * 8 + Math.sin(x * 0.029 + t * 0.7) * 3;
          if (x === -30) g.moveTo(x, y); else g.lineTo(x, y);
        }
      }
      g.stroke();

      // cáusticas
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(cc, 0, 0, W, H);

      // raios de luz
      for (let i = 0; i < 6; i++) {
        g.save();
        g.translate(W * (0.04 + i * 0.18), -40);
        g.rotate(0.3 + Math.sin(t * 0.25 + i * 1.7) * 0.06);
        const w = 50 + (i % 3) * 45;
        const gr = g.createLinearGradient(0, 0, 0, H * 1.3);
        gr.addColorStop(0, "rgba(255,255,255," + (0.14 + 0.06 * Math.sin(t * 0.6 + i)) + ")");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.fillRect(-w / 2, 0, w, H * 1.4);
        g.restore();
      }

      // brilhos na superfície
      for (const s of sparks) {
        const a = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
        if (a < 0.25) continue;
        const x = s.x * W, y = s.y * H, k = s.s * a;
        g.fillStyle = "rgba(255,255,255," + (0.7 * a) + ")";
        g.beginPath();
        g.moveTo(x, y - k * 1.6); g.lineTo(x + k * 0.3, y - k * 0.3);
        g.lineTo(x + k * 1.6, y); g.lineTo(x + k * 0.3, y + k * 0.3);
        g.lineTo(x, y + k * 1.6); g.lineTo(x - k * 0.3, y + k * 0.3);
        g.lineTo(x - k * 1.6, y); g.lineTo(x - k * 0.3, y - k * 0.3);
        g.closePath();
        g.fill();
      }

      // marolinhas aleatórias
      nextRipple -= dt;
      if (nextRipple <= 0 && ripples.length < 24) {
        nextRipple = 0.5 + Math.random() * 0.9;
        ripples.push({ x: Math.random() * W, y: Math.random() * H, t: 0 });
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const p = ripples[i];
        p.t += dt * (p.big ? 0.7 : 0.5);
        if (p.t >= 1) { ripples.splice(i, 1); continue; }
        const R = (p.big ? 150 : 90) * p.t + 8;
        for (let k = 0; k < 3; k++) {
          const rr = R - k * 14;
          if (rr <= 2) continue;
          g.strokeStyle = "rgba(255,255,255," + (0.5 * (1 - p.t) * (1 - k * 0.3)) + ")";
          g.lineWidth = 2.4 - k * 0.5;
          g.beginPath();
          g.arc(p.x, p.y, rr, 0, 6.2832);
          g.stroke();
        }
      }

      // bolhas
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.y -= b.vy * dt;
        const x = b.bx + Math.sin(t * b.sp + b.ph) * b.wob;
        if (b.y < -b.r - 10) {
          if (b.tmp) { bubbles.splice(i, 1); continue; }
          Object.assign(b, makeBubble(false));
        }
        drawBubble(b, x, b.y);
      }
      while (bubbles.filter(b => !b.tmp).length < targetCount()) bubbles.push(makeBubble(false));

      // raias com boias e bolas boiando
      laneRope(H * 0.075, t, 1);
      laneRope(H * 0.925, t, -1);

      const br = Math.max(26, Math.min(W, H) * 0.07);
      [[0.11, 0.8, 0.3], [0.89, 0.78, -0.4]].forEach(([px, py, rs], i) => {
        const x = W * px;
        const y = H * py + Math.sin(t * 1.4 + i * 2) * 8;
        g.strokeStyle = "rgba(255,255,255,0.55)";
        g.lineWidth = 3;
        for (let k = 0; k < 2; k++) {
          const ph = (t * 0.6 + k * 0.5 + i * 0.3) % 1;
          g.globalAlpha = 1 - ph;
          g.beginPath();
          g.ellipse(x, H * py + br * 0.85, br * (1.1 + ph * 1.1), br * (0.22 + ph * 0.2), 0, 0, 6.2832);
          g.stroke();
        }
        g.globalAlpha = 1;
        drawBall(x, y, br, t * rs + i);
      });

      // vinheta azul nas bordas
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, "rgba(10,80,150,0)");
      vg.addColorStop(1, "rgba(10,80,150,0.38)");
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);

      // estouros de bolha
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i];
        p.t += dt * 2.6;
        if (p.t >= 1) { pops.splice(i, 1); continue; }
        g.strokeStyle = "rgba(255,255,255," + (0.9 * (1 - p.t)) + ")";
        g.lineWidth = 3 * (1 - p.t) + 0.5;
        g.beginPath();
        g.arc(p.x, p.y, p.r * (1 + p.t * 0.6), 0, 6.2832);
        g.stroke();
        for (let k = 0; k < 8; k++) {
          const a = k * 0.785 + 0.3;
          const d = p.r * (0.9 + p.t * 1.3);
          g.fillStyle = "rgba(255,255,255," + (0.85 * (1 - p.t)) + ")";
          g.beginPath();
          g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, Math.max(1, 3 * (1 - p.t)), 0, 6.2832);
          g.fill();
        }
      }
    }

    init();
    requestAnimationFrame(frame);
  })();

  // ==================================================
  // TUTORIAL: aprende jogando
  // ==================================================

  const TOUCH = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches);
  const tutEl = document.getElementById("tutorial");
  const tutStepEl = document.getElementById("tutStep");
  const tutDotsEl = document.getElementById("tutDots");
  const tutTitleEl = document.getElementById("tutTitle");
  const tutTextEl = document.getElementById("tutText");
  const tutBarEl = document.getElementById("tutBar");
  const tutFillEl = document.getElementById("tutFill");
  const tutDoneBtn = document.getElementById("tutDone");
  const tutSkipBtn = document.getElementById("tutSkip");

  const KB = t => "<kbd>" + t + "</kbd>";

  const TUT_STEPS = [
    {
      title: "PILOTE A LANCHA", bar: true,
      kb: "Acelere com " + KB("W") + " ou " + KB("↑") + " e vire com " + KB("A") + " " + KB("D") + " ou " + KB("←") + " " + KB("→") +
        ". A lancha só curva quando está em movimento, e " + KB("S") + " dá ré. Dê uma voltinha pela piscina!",
      tc: "Acelere no botão ▲, dê ré no ▼ e vire com ◀ ▶. A lancha só curva quando está em movimento. Dê uma voltinha pela piscina!"
    },
    {
      title: "FREIE NA ÁGUA", bar: true,
      kb: "Acelere e então segure " + KB("ESPAÇO") + " para frear. A água escorrega: freie antes de bater na parede!",
      tc: "Acelere e então segure o botão ▼ para frear. A água escorrega: freie antes de bater na parede!"
    },
    {
      title: "CHUTE A BOLA", bar: true,
      kb: "Chegue perto da bola e clique com o <b>botão esquerdo</b> do mouse (ou aperte " + KB("E") + ") para chutar. Quanto mais perto, mais forte! Dê 2 chutes.",
      tc: "Chegue perto da bola e toque no botão ⚽ para chutar. Quanto mais perto, mais forte! Dê 2 chutes."
    },
    {
      title: "LIGUE O BOOST", bar: true,
      kb: "Segure " + KB("SHIFT") + " para turbinar a lancha. Veja a barra <b>BOOST</b> no canto: ela esvazia enquanto você usa e recarrega quando solta. Segure por 2 segundos!",
      tc: "Segure o botão 🚀 para turbinar a lancha. Veja a barra <b>BOOST</b> no canto: ela esvazia enquanto você usa e recarrega quando solta. Segure por 2 segundos!"
    },
    {
      title: "FAÇA UM GOL", bar: false,
      kb: "Junte tudo e leve a bola até o gol! O <b>gol azul</b> é o que você ataca. Dica: a bola vai junto se estiver logo à frente da proa. Botão direito + arrastar gira a câmera e o scroll dá zoom.",
      tc: "Junte tudo e leve a bola até o gol! O <b>gol azul</b> é o que você ataca. Dica: a bola vai junto se estiver logo à frente da proa."
    },
    {
      title: "COMO É A PARTIDA", bar: false,
      kb: "<b>TREINO</b>: livre, sem tempo e sem adversários. <b>COMPETITIVO</b>: 3 minutos contra bots em 1x1, 2x2 ou 3x3. Marque no gol azul e defenda o vermelho! Cada <b>mapa</b> muda o jogo: ondas, gelo, correnteza, obstáculos... Bom jogo!"
    }
  ];

  const tut = { active: false, step: 0, wait: 0, dist: 0, turn: 0, t: 0, kicks: 0, goal: false, lastH: 0 };

  TUT_STEPS.forEach(() => tutDotsEl.appendChild(document.createElement("i")));

  function tutPlaceBall() {
    const fx = Math.cos(state.heading);
    const fz = -Math.sin(state.heading);
    ball.x = clampN(state.x + fx * 15, -HX + 4, HX - 4);
    ball.z = clampN(state.z + fz * 15, -GOAL_LINE + 8, GOAL_LINE - 8);
    ball.vx = 0;
    ball.vz = 0;
    ball.timer = 0;
    goalMsg.classList.remove("show");
    foamAt(ball.x, ball.z, 0.6, 2);
  }

  function tutShow(i) {
    tut.step = i;
    tut.wait = 0;
    tut.dist = 0;
    tut.turn = 0;
    tut.t = 0;
    tut.kicks = 0;
    tut.goal = false;
    tut.lastH = state.heading;

    const S = TUT_STEPS[i];
    tutEl.classList.remove("ok");
    tutStepEl.textContent = (i + 1) + "/" + TUT_STEPS.length;
    Array.prototype.forEach.call(tutDotsEl.children, (d, k) => {
      d.className = k < i ? "done" : k === i ? "on" : "";
    });
    tutTitleEl.textContent = S.title;
    tutTextEl.innerHTML = TOUCH && S.tc ? S.tc : S.kb;
    tutBarEl.classList.toggle("hidden", !S.bar);
    tutFillEl.style.width = "0%";
    tutDoneBtn.classList.toggle("hidden", i !== TUT_STEPS.length - 1);
    boostBar.classList.toggle("hl", i === 3);

    if (i === 2 || i === 4) tutPlaceBall();
    if (i > 0) sfx.swoosh();
  }

  function tutComplete() {
    tut.wait = 1.1;
    tutEl.classList.add("ok");
    tutFillEl.style.width = "100%";
    tutTitleEl.textContent = "✔ " + pick(["MUITO BEM!", "ISSO AÍ!", "MANDOU BEM!", "PERFEITO!"]);
    sfx.confirm();
  }

  function tutTick(dt) {
    if (!tut.active) return;

    if (tut.wait > 0) {
      tut.wait -= dt;
      if (tut.wait <= 0) tutShow(tut.step + 1);
      return;
    }

    const i = tut.step;
    const sp = Math.hypot(state.vx, state.vz);
    let p = 0;

    if (i === 0) {
      tut.dist += sp * dt;
      let d = state.heading - tut.lastH;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      tut.lastH = state.heading;
      if (input.left || input.right) tut.turn += Math.abs(d);
      p = 0.5 * Math.min(1, tut.dist / 45) + 0.5 * Math.min(1, tut.turn / 2.4);
    } else if (i === 1) {
      if ((input.brake || input.down) && sp > 2) tut.t += dt;
      p = tut.t / 0.7;
    } else if (i === 2) {
      p = tut.kicks / 2;
    } else if (i === 3) {
      if (state.boosting) tut.t += dt;
      p = tut.t / 2;
    } else if (i === 4) {
      p = tut.goal ? 1 : 0;
    } else {
      return;
    }

    tutFillEl.style.width = Math.min(100, p * 100).toFixed(0) + "%";
    if (p >= 1) tutComplete();
  }

  function tutEvent(name) {
    if (!tut.active || tut.wait > 0) return;
    if (name === "kick" && tut.step === 2) tut.kicks++;
    else if (name === "goal" && tut.step === 4) tut.goal = true;
  }

  function startTutorial(from) {
    sfx.swoosh();
    tut.from = from || "pick";
    tut.prevMap = curTheme.id;
    pickerScreen.classList.add("hidden");
    modesScreen.classList.add("hidden");

    if (curTheme.id !== "olimpica") applyMap("olimpica");
    sfx.setScene("olimpica");

    match.type = "train";
    match.size = 1;
    match.over = false;
    match.time = MATCH_TIME;
    match.countdown = 0;
    match.lastSec = 999;

    buildBoats("train", 1);
    prevPos.set(state.x, 0, state.z);

    resetBall();
    score[0] = score[1] = 0;
    drawScore();

    goalMsg.classList.remove("show");
    goalMsg.textContent = "GOL!";
    modeLabelEl.textContent = "TUTORIAL";
    resetMapState();

    viewer.classList.add("playing");
    for (const k in input) input[k] = false;
    kickState.cd = 0;
    setCameraButtons(true);

    mode = "play";
    controls.autoRotate = false;
    controls.enableZoom = true;
    chase.dragging = false;
    tShiftX = 0;
    tShiftY = 0;
    snapCamera();

    tut.active = true;
    tutEl.classList.remove("hidden");
    tutShow(0);
  }

  function endTutorial() {
    sfx.swoosh();
    tut.active = false;
    tutEl.classList.add("hidden");
    boostBar.classList.remove("hl");

    match.type = "train";
    match.over = false;
    match.countdown = 0;

    buildBoats("train", 1);
    prevPos.set(state.x, 0, state.z);

    resetBall();
    score[0] = score[1] = 0;
    drawScore();

    goalMsg.classList.remove("show");
    goalMsg.textContent = "GOL!";
    for (const k in input) input[k] = false;

    viewer.classList.remove("playing");
    setCameraButtons(false);

    menuCamera();
    setPickerShift();

    if (tut.from === "modes") {
      // veio do menu de modos: volta para lá, com o mapa que estava escolhido
      if (curTheme.id !== tut.prevMap) applyMap(tut.prevMap);
      sfx.setScene(tut.prevMap);
      mode = "modes";
      modesScreen.classList.remove("hidden");
    } else {
      mode = "maps";
      mapsScreen.classList.remove("hidden");
      showMap(mapIdx);
    }
  }

  tutSkipBtn.onclick = endTutorial;
  tutDoneBtn.onclick = endTutorial;
  document.getElementById("modeTut").onclick = () => startTutorial("modes");

  // ==================================================
  // MÚSICA DE FUNDO (sounds/music1.mp3 ... music5.mp3)
  // ==================================================

  const MUSIC_FILES = [1, 2, 3, 4, 5].map(i => "sounds/music" + i + ".mp3");
  const music = {
    el: new Audio(),
    order: [],
    pos: -1,
    vol: 0.5,
    fails: 0,
    started: false
  };
  const sfxSaved = { vol: 0.6 };
  try {
    const mv = localStorage.getItem("swimball-music-vol");
    const sv = localStorage.getItem("swimball-sfx-vol");
    if (mv !== null) music.vol = Math.max(0, Math.min(1, +mv));
    if (sv !== null) sfxSaved.vol = Math.max(0, Math.min(1, +sv));
  } catch (e) { /* ok */ }

  music.el.volume = music.vol;
  music.el.muted = sfx.isMuted();
  sfx.setVolume(sfxSaved.vol);

  function shuffleMusic(first) {
    const a = MUSIC_FILES.map((_, i) => i);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (first !== undefined) a.splice(a.indexOf(first), 1), a.push(first);
    music.order = a;
    music.pos = -1;
  }

  const musicNameEl = document.getElementById("pauseTrack");

  function playTrack(step) {
    if (!music.order.length) shuffleMusic();
    music.pos = (music.pos + step + music.order.length) % music.order.length;
    const idx = music.order[music.pos];
    music.el.src = MUSIC_FILES[idx];
    if (musicNameEl) musicNameEl.textContent = "♪ Música " + (idx + 1);
    const p = music.el.play();
    if (p && p.catch) p.catch(() => { /* aguardando gesto do usuário */ });
  }

  music.el.addEventListener("ended", () => { music.fails = 0; playTrack(1); });
  music.el.addEventListener("error", () => {
    // arquivo ausente: tenta a próxima, mas para se nenhuma existir
    console.warn("Não foi possível carregar a música:", music.el.src);
    if (++music.fails >= MUSIC_FILES.length) {
      if (musicNameEl) musicNameEl.textContent = "♪ (coloque os mp3 em /sounds)";
      showBanner("🎵 MP3 NÃO ENCONTRADO EM /sounds");
      return;
    }
    playTrack(1);
  });
  music.el.addEventListener("playing", () => { music.fails = 0; });

  function startMusic() {
    if (music.started) return;
    music.started = true;
    playTrack(1);
  }
  // navegadores só liberam áudio após um gesto do usuário (no celular, só no
  // toque solto): tenta destravar a cada gesto até realmente tocar
  function unlockAll() {
    sfx.init();
    if (!music.started) startMusic();
    else if (music.el.paused && !music.userPaused && !sfx.isMuted() && music.fails < MUSIC_FILES.length) {
      const p = music.el.play();
      if (p && p.catch) p.catch(() => {});
    }
  }
  ["pointerdown", "pointerup", "touchend", "click", "keydown"].forEach(ev =>
    window.addEventListener(ev, unlockAll, { capture: true, passive: true }));

  document.addEventListener("visibilitychange", () => {
    if (!music.started || music.fails >= MUSIC_FILES.length) return;
    if (document.hidden) music.el.pause();
    else if (!sfx.isMuted()) music.el.play().catch(() => {});
  });

  // o botão de som (🔊) também silencia a música
  muteBtn.addEventListener("click", () => { music.el.muted = sfx.isMuted(); });

  // ==================================================
  // MENU DE PAUSA
  // ==================================================

  const pauseScreen = document.getElementById("pause");
  const musicSlider = document.getElementById("musicVol");
  const sfxSlider = document.getElementById("sfxVol");
  const musicPct = document.getElementById("musicPct");
  const sfxPct = document.getElementById("sfxPct");

  function paintSlider(el, pctEl) {
    el.style.setProperty("--v", el.value + "%");
    pctEl.textContent = el.value + "%";
  }

  musicSlider.value = Math.round(music.vol * 100);
  sfxSlider.value = Math.round(sfxSaved.vol * 100);
  paintSlider(musicSlider, musicPct);
  paintSlider(sfxSlider, sfxPct);

  musicSlider.addEventListener("input", () => {
    music.vol = musicSlider.value / 100;
    music.el.volume = music.vol;
    paintSlider(musicSlider, musicPct);
    try { localStorage.setItem("swimball-music-vol", String(music.vol)); } catch (e) { /* ok */ }
  });

  let sfxDemo = 0;
  sfxSlider.addEventListener("input", () => {
    sfxSaved.vol = sfxSlider.value / 100;
    sfx.setVolume(sfxSaved.vol);
    paintSlider(sfxSlider, sfxPct);
    try { localStorage.setItem("swimball-sfx-vol", String(sfxSaved.vol)); } catch (e) { /* ok */ }
    const n = performance.now();
    if (n - sfxDemo > 180) { sfxDemo = n; sfx.click(); }
  });

  function openPause() {
    if (paused || (mode !== "play" && mode !== "result")) return;
    if (mode === "result") return;
    paused = true;
    for (const k in input) input[k] = false;
    pauseScreen.classList.remove("hidden");
    document.getElementById("pauseRestart").style.display = match.type === "online" ? "none" : "";
    document.getElementById("pauseRestart").textContent =
      tut.active ? "↻ REINICIAR TUTORIAL" : "↻ REINICIAR PARTIDA";
    document.getElementById("pauseQuit").textContent =
      tut.active ? "✖ SAIR DO TUTORIAL" : "✖ SAIR DA PARTIDA";
    if (ctxSuspendable()) sfx.back();
  }

  function ctxSuspendable() { return true; }

  function closePause() {
    if (!paused) return;
    paused = false;
    pauseScreen.classList.add("hidden");
    for (const k in input) input[k] = false;
  }

  document.getElementById("pauseResume").onclick = closePause;

  document.getElementById("pauseRestart").onclick = () => {
    closePause();
    if (tut.active) {
      const from = tut.from;
      tut.active = false;
      tutEl.classList.add("hidden");
      startTutorial(from);
    } else {
      startMatch(match.type, match.size);
    }
  };

  document.getElementById("pauseQuit").onclick = () => {
    closePause();
    if (tut.active) endTutorial();
    else exitToModes();
  };

  document.getElementById("pauseNext").onclick = () => {
    startMusic();
    if (music.started) { music.fails = 0; playTrack(1); }
  };

  document.getElementById("pauseMusicToggle").onclick = e => {
    if (!music.started) { startMusic(); return; }
    if (music.el.paused) { music.userPaused = false; music.el.play().catch(() => {}); e.currentTarget.textContent = "⏸"; }
    else { music.userPaused = true; music.el.pause(); e.currentTarget.textContent = "▶"; }
  };

  window.addEventListener("keydown", e => {
    if (e.code !== "Escape" && e.code !== "KeyP") return;
    if (e.repeat) return;
    if (paused) closePause();
    else if (mode === "play") openPause();
  });

  // ==================================================
  // MODO ONLINE (PeerJS): anfitrião manda na partida
  // ==================================================

  const onlineScreen = document.getElementById("online");
  const lobbyScreen = document.getElementById("lobby");
  const netStatusEl = document.getElementById("netStatus");
  const netNameEl = document.getElementById("netName");
  const netCodeEl = document.getElementById("netCode");
  try { netNameEl.value = localStorage.getItem("swimball-name") || ""; } catch (e) { /* ok */ }

  const r2 = v => Math.round(v * 100) / 100;
  const angDiff = d => Math.atan2(Math.sin(d), Math.cos(d));
  const myName = () => (netNameEl.value.trim().slice(0, 12) || "Jogador");
  const netStatus = t => { netStatusEl.textContent = t || ""; };

  function bitsOf(i) {
    return (i.up ? 1 : 0) | (i.down ? 2 : 0) | (i.left ? 4 : 0) | (i.right ? 8 : 0) | (i.brake ? 16 : 0) | (i.boost ? 32 : 0);
  }

  function setBits(i, b) {
    i.up = !!(b & 1); i.down = !!(b & 2); i.left = !!(b & 4);
    i.right = !!(b & 8); i.brake = !!(b & 16); i.boost = !!(b & 32);
  }

  function netSend(m) {
    try {
      if (net.role === "host") {
        for (const p of net.players) if (p.conn && p.conn.open) p.conn.send(m);
      } else if (net.role === "guest" && net.conn && net.conn.open) {
        net.conn.send(m);
      }
    } catch (e) { /* ok */ }
  }

  function netLeave() {
    const peer = net.peer;
    const conns = net.players.map(p => p.conn).filter(Boolean);
    if (net.conn) conns.push(net.conn);
    net.role = "off";
    net.peer = null;
    net.conn = null;
    net.players = [];
    net.inMatch = false;
    net.byAid = null;
    net.lobby = null;
    conns.forEach(c => { try { c.close(); } catch (e) { /* ok */ } });
    if (peer) { try { peer.destroy(); } catch (e) { /* ok */ } }
  }

  // ---------- montar os barcos da partida online ----------
  function buildOnlineBoats(roster, myAid, size) {
    botPool.forEach(v => { v.rig.visible = false; });
    allBoats.length = 0;
    marker.visible = false;
    net.byAid = {};
    let used = 0;

    roster.forEach(r => {
      const sp = spawnFor(r.team, r.slot, size);

      if (r.aid === myAid) {
        playerAgent.team = r.team;
        playerAgent.aid = r.aid;
        playerAgent.spawn = sp;
        playerAgent.role = "attack";
        Object.assign(state, newState(sp.x, sp.z, sp.h));
        allBoats.push(playerAgent);
        net.byAid[r.aid] = playerAgent;
        return;
      }

      if (botPool.length <= used) botPool.push(makeBotRig());
      const vis = botPool[used++];
      vis.hullM.color.set(r.color);
      vis.accM.color.copy(accentFor(r.color));
      vis.rig.visible = true;

      const agent = {
        isPlayer: false,
        aid: r.aid,
        team: r.team,
        name: r.name,
        remote: net.role === "guest" ? true : !r.bot,
        vis,
        st: newState(sp.x, sp.z, sp.h),
        inp: { up: false, down: false, left: false, right: false, brake: false, boost: false },
        spawn: sp,
        role: "defend",
        skill: 0.92 + Math.random() * 0.08,
        stuck: 0,
        rev: 0,
        cd: 0
      };
      allBoats.push(agent);
      net.byAid[r.aid] = agent;
    });
  }

  // ---------- anfitrião: foto do estado a 20 Hz ----------
  function sendSnapshot() {
    const m = {
      t: "s",
      b: allBoats.map(a => [a.aid, r2(a.st.x), r2(a.st.z), Math.round(a.st.heading * 1000) / 1000,
        r2(a.st.vx), r2(a.st.vz), bitsOf(a.inp)]),
      ball: [r2(ball.x), r2(ball.z), r2(ball.vx), r2(ball.vz)],
      sc: score.slice(),
      tm: r2(match.time),
      cd: r2(match.countdown),
      ob: MAP.obstacles.map(o => [r2(o.x), r2(o.z), r2(o.vx || 0), r2(o.vz || 0)])
    };
    if (MAP.force === "current") m.cur = [MAP.cur.on ? 1 : 0, r2(MAP.cur.x), r2(MAP.cur.z)];
    netSend(m);
  }

  // ---------- convidado: aplica a foto suavemente ----------
  function applySnapshot(m) {
    if (match.type !== "online" || !net.byAid) return;

    m.b.forEach(e => {
      const a = net.byAid[e[0]];
      if (!a) return;
      const st = a.st;
      const dx = e[1] - st.x;
      const dz = e[2] - st.z;
      const d = Math.hypot(dx, dz);

      if (d > 6) {
        st.x = e[1]; st.z = e[2]; st.heading = e[3]; st.vx = e[4]; st.vz = e[5];
      } else if (a.isPlayer) {
        st.x += dx * 0.12;
        st.z += dz * 0.12;
        st.vx += (e[4] - st.vx) * 0.08;
        st.vz += (e[5] - st.vz) * 0.08;
        st.heading += angDiff(e[3] - st.heading) * 0.08;
      } else {
        st.x += dx * 0.4;
        st.z += dz * 0.4;
        st.vx += (e[4] - st.vx) * 0.5;
        st.vz += (e[5] - st.vz) * 0.5;
        st.heading += angDiff(e[3] - st.heading) * 0.4;
      }
      if (!a.isPlayer) setBits(a.inp, e[6]);
    });

    const bx = m.ball[0] - ball.x;
    const bz = m.ball[1] - ball.z;
    if (Math.hypot(bx, bz) > 8) {
      ball.x = m.ball[0]; ball.z = m.ball[1]; ball.vx = m.ball[2]; ball.vz = m.ball[3];
    } else {
      ball.x += bx * 0.35;
      ball.z += bz * 0.35;
      ball.vx += (m.ball[2] - ball.vx) * 0.5;
      ball.vz += (m.ball[3] - ball.vz) * 0.5;
    }

    if (score[0] !== m.sc[0] || score[1] !== m.sc[1]) {
      score[0] = m.sc[0]; score[1] = m.sc[1];
      drawScore();
    }
    match.time = m.tm;
    match.countdown = m.cd;

    (m.ob || []).forEach((e, i) => {
      const o = MAP.obstacles[i];
      if (o && (e[2] || e[3])) { o.x = e[0]; o.z = e[1]; o.vx = e[2]; o.vz = e[3]; }
    });

    if (m.cur) {
      const was = MAP.cur.on;
      MAP.cur.on = !!m.cur[0];
      MAP.cur.x = m.cur[1];
      MAP.cur.z = m.cur[2];
      if (MAP.cur.on && !was) {
        showBanner("⚠ CORRENTEZA " + (MAP.cur.x > 0 ? "→" : "←"));
        sfx.warn();
      }
    }
  }

  function netTick(dt) {
    if (net.role === "off") return;
    if (match.type !== "online" || mode !== "play") { net.acc = 0; return; }
    net.acc += dt;
    if (net.acc < 0.05) return;
    net.acc = 0;

    if (net.role === "host") {
      sendSnapshot();
    } else {
      const bits = bitsOf(input);
      const now = performance.now();
      if (bits !== net.lastBits || now - net.lastSend > 250) {
        net.lastBits = bits;
        net.lastSend = now;
        netSend({ t: "i", b: bits });
      }
    }
  }

  // ---------- sala (lobby) ----------
  function lobbyData() {
    return { t: "lobby", size: net.size, code: net.code, players: net.players.map(p => ({ aid: p.aid, name: p.name, team: p.team })) };
  }

  function broadcastLobby() {
    const base = lobbyData();
    for (const p of net.players) {
      if (p.conn && p.conn.open) { try { p.conn.send(Object.assign({ you: p.aid }, base)); } catch (e) { /* ok */ } }
    }
    net.lobby = Object.assign({ you: 0 }, base);
    renderLobby();
  }

  function teamCount(t) { return net.players.filter(p => p.team === t).length; }

  function renderLobby() {
    const L = net.lobby;
    if (!L) return;
    const cap = L.size;
    document.getElementById("roomCode").textContent = L.code;
    document.getElementById("lobbyInfo").textContent =
      L.size + "x" + L.size + " · " + L.players.length + "/" + (2 * L.size) + " JOGADORES · VAGAS VAZIAS VIRAM BOTS";

    [0, 1].forEach(t => {
      const ul = document.getElementById("team" + t);
      ul.innerHTML = "";
      L.players.filter(p => p.team === t).forEach(p => {
        const li = document.createElement("li");
        li.textContent = p.name + (p.aid === L.you ? " (você)" : "") + (p.aid === 0 ? " ★" : "");
        if (p.aid === L.you) li.className = "me";
        ul.appendChild(li);
      });
      for (let i = L.players.filter(p => p.team === t).length; i < cap; i++) {
        const li = document.createElement("li");
        li.textContent = "🤖 bot";
        li.className = "bot";
        ul.appendChild(li);
      }
    });

    const host = net.role === "host";
    const startBtn = document.getElementById("lobbyStart");
    startBtn.style.display = host ? "" : "none";
    startBtn.disabled = L.players.length < 2;
    document.getElementById("lobbyHint").textContent = host
      ? (L.players.length < 2 ? "Passe o código para um amigo entrar." : "Tudo pronto! Inicie quando quiser.")
      : "Aguardando o anfitrião iniciar...";
  }

  function showLobby() {
    match.type = "train";
    match.over = false;
    match.countdown = 0;
    buildBoats("train", 1);
    prevPos.set(state.x, 0, state.z);
    resetBall();
    score[0] = score[1] = 0;
    drawScore();
    goalMsg.classList.remove("show");
    resultScreen.classList.add("hidden");
    onlineScreen.classList.add("hidden");
    modesScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");
    paused = false;
    for (const k in input) input[k] = false;
    viewer.classList.remove("playing");
    setCameraButtons(false);
    net.inMatch = false;
    mode = "lobby";
    menuCamera();
    setPickerShift();
    lobbyScreen.classList.remove("hidden");
    renderLobby();
  }

  function onlineBackToLobby() {
    if (net.role === "off") { exitToModes(); return; }
    showLobby();
    if (net.role === "host") broadcastLobby();
  }

  function autoTeam() {
    return teamCount(0) <= teamCount(1) ? (teamCount(0) < net.size ? 0 : 1) : 1;
  }

  function hostStart() {
    if (net.role !== "host" || net.players.length < 2) return;
    const roster = [];
    const cnt = [0, 0];
    net.players.forEach(p => {
      roster.push({ aid: p.aid, team: p.team, slot: cnt[p.team]++, name: p.name, color: p.color, bot: false });
    });
    [0, 1].forEach(t => {
      while (cnt[t] < net.size) {
        roster.push({ aid: 100 + roster.length, team: t, slot: cnt[t]++, name: "BOT", color: t ? 0xff7a1a : 0x2bb673, bot: true });
      }
    });
    net.roster = roster;
    net.myAid = 0;
    net.inMatch = true;
    for (const p of net.players) {
      if (p.conn && p.conn.open) p.conn.send({ t: "start", size: net.size, map: curTheme.id, roster, you: p.aid });
    }
    lobbyScreen.classList.add("hidden");
    startMatch("online", net.size);
  }

  function hostConn(conn) {
    conn.on("data", m => {
      if (net.role !== "host" || !m) return;

      if (m.t === "hello") {
        if (net.inMatch) { conn.send({ t: "busy" }); setTimeout(() => conn.close(), 300); return; }
        if (net.players.length >= 2 * net.size) { conn.send({ t: "full" }); setTimeout(() => conn.close(), 300); return; }
        const p = {
          aid: net.nextAid++,
          name: String(m.name || "Jogador").slice(0, 12),
          color: Number.isFinite(m.color) ? m.color : 0xf3f5f4,
          team: autoTeam(),
          conn
        };
        conn.player = p;
        net.players.push(p);
        broadcastLobby();
      } else if (!conn.player) {
        return;
      } else if (m.t === "team") {
        const t = m.team === 1 ? 1 : 0;
        if (!net.inMatch && conn.player.team !== t && teamCount(t) < net.size) {
          conn.player.team = t;
          broadcastLobby();
        }
      } else if (m.t === "i") {
        const a = net.byAid && net.byAid[conn.player.aid];
        if (a && a.remote) setBits(a.inp, m.b | 0);
      } else if (m.t === "k") {
        const a = net.byAid && net.byAid[conn.player.aid];
        if (a && a.remote) a.wantKick = true;
      }
    });

    const drop = () => {
      const p = conn.player;
      if (!p || net.role !== "host") return;
      conn.player = null;
      net.players = net.players.filter(x => x !== p);
      if (net.inMatch) {
        const a = net.byAid && net.byAid[p.aid];
        if (a) { a.remote = false; a.stuck = 0; a.rev = 0; }
        showBanner(p.name + " saiu");
      } else {
        broadcastLobby();
      }
    };
    conn.on("close", drop);
    conn.on("error", drop);
  }

  function createRoom(size, tries) {
    if (!window.Peer) { netStatus("PeerJS não carregou. Verifique a internet."); return; }
    netLeave();
    netStatus("Criando sala...");
    const code = (() => {
      const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let t = "";
      for (let i = 0; i < 5; i++) t += c[(Math.random() * c.length) | 0];
      return t;
    })();

    const peer = new Peer("swimball-" + code);
    net.peer = peer;

    peer.on("open", () => {
      net.role = "host";
      net.code = code;
      net.size = size;
      net.nextAid = 1;
      net.inMatch = false;
      net.players = [{ aid: 0, name: myName(), color: paintTarget.getHex(), team: 0, conn: null }];
      try { localStorage.setItem("swimball-name", netNameEl.value.trim()); } catch (e) { /* ok */ }
      net.lobby = Object.assign({ you: 0 }, lobbyData());
      showLobby();
    });
    peer.on("connection", hostConn);
    peer.on("error", err => {
      if (err.type === "unavailable-id" && (tries || 0) < 4) { createRoom(size, (tries || 0) + 1); return; }
      netLeave();
      netStatus("Erro ao criar sala: " + err.type);
    });
    peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) { /* ok */ } });
  }

  function guestMsg(m) {
    if (!m) return;

    if (m.t === "lobby") {
      net.size = m.size;
      net.lobby = m;
      if (mode === "online") showLobby();
      else renderLobby();
    } else if (m.t === "full" || m.t === "busy") {
      netLeave();
      netStatus(m.t === "full" ? "A sala está cheia." : "A partida já começou.");
    } else if (m.t === "start") {
      net.roster = m.roster;
      net.myAid = m.you;
      net.size = m.size;
      net.inMatch = true;
      if (curTheme.id !== m.map) applyMap(m.map);
      sfx.setScene(m.map);
      lobbyScreen.classList.add("hidden");
      startMatch("online", m.size);
    } else if (m.t === "s") {
      applySnapshot(m);
    } else if (m.t === "goal") {
      if (match.type !== "online") return;
      score[0] = m.sc[0]; score[1] = m.sc[1];
      drawScore();
      ball.timer = 2.4;
      goalMsg.textContent = "GOL!";
      goalMsg.classList.add("show");
      sfx.goal(m.team !== playerAgent.team);
    } else if (m.t === "end") {
      if (match.type !== "online" || match.over) return;
      score[0] = m.sc[0]; score[1] = m.sc[1];
      drawScore();
      endMatch();
    }
  }

  function joinRoom(code) {
    if (!window.Peer) { netStatus("PeerJS não carregou. Verifique a internet."); return; }
    code = code.trim().toUpperCase();
    if (code.length < 4) { netStatus("Digite o código da sala."); return; }
    netLeave();
    netStatus("Conectando...");

    const peer = new Peer();
    net.peer = peer;
    const fail = text => { netLeave(); netStatus(text); };
    const timer = setTimeout(() => fail("Não foi possível conectar. Confira o código."), 12000);

    peer.on("error", err => {
      clearTimeout(timer);
      fail(err.type === "peer-unavailable" ? "Sala não encontrada." : "Erro de conexão: " + err.type);
    });

    peer.on("open", () => {
      const conn = peer.connect("swimball-" + code, { reliable: true });
      net.conn = conn;

      conn.on("open", () => {
        clearTimeout(timer);
        net.role = "guest";
        net.code = code;
        try { localStorage.setItem("swimball-name", netNameEl.value.trim()); } catch (e) { /* ok */ }
        conn.send({ t: "hello", name: myName(), color: paintTarget.getHex() });
        netStatus("Entrando na sala...");
      });
      conn.on("data", guestMsg);
      conn.on("close", () => {
        if (net.role !== "guest") return;
        netLeave();
        exitToModes();
        showBanner("SALA ENCERRADA");
      });
    });
  }

  // ---------- botões ----------
  document.getElementById("modeOnline").onclick = () => {
    mode = "online";
    modesScreen.classList.add("hidden");
    onlineScreen.classList.remove("hidden");
    netStatus("");
  };
  document.getElementById("netBack").onclick = () => {
    mode = "modes";
    onlineScreen.classList.add("hidden");
    modesScreen.classList.remove("hidden");
  };
  document.querySelectorAll("#netSizes button").forEach(b => { b.onclick = () => createRoom(+b.dataset.size); });
  document.getElementById("netJoin").onclick = () => joinRoom(netCodeEl.value);
  netCodeEl.addEventListener("keydown", e => { if (e.code === "Enter") joinRoom(netCodeEl.value); });

  document.getElementById("lobbyStart").onclick = hostStart;
  document.getElementById("lobbyLeave").onclick = () => exitToModes();
  document.getElementById("lobbySwitch").onclick = () => {
    if (!net.lobby) return;
    const me = net.lobby.players.find(p => p.aid === net.lobby.you);
    if (!me) return;
    const t = 1 - me.team;
    if (net.role === "host") {
      if (teamCount(t) < net.size) { net.players[0].team = t; broadcastLobby(); }
    } else {
      netSend({ t: "team", team: t });
    }
  };
  document.getElementById("roomCode").onclick = () => {
    try { navigator.clipboard.writeText(net.code); showBanner("CÓDIGO COPIADO"); } catch (e) { /* ok */ }
  };


  // ==================================================
  // ANIMAÇÃO
  // ==================================================

  let waterFrame = 0;
  const fpsMon = { t: 0, n: 0 };
  const clock = new THREE.Clock();
  let acc = 0;

  function animate() {
    requestAnimationFrame(animate);

    // tela inicial é só 2D: não gasta GPU/CPU com a piscina
    if (mode === "start") { clock.getDelta(); return; }

    // se o FPS cair, reduz a resolução aos poucos (e nunca volta a subir)
    {
      const now = performance.now();
      if (!fpsMon.t) fpsMon.t = now;
      fpsMon.n++;
      if (now - fpsMon.t > 2500) {
        const fps = (fpsMon.n * 1000) / (now - fpsMon.t);
        fpsMon.t = now;
        fpsMon.n = 0;
        if (!document.hidden && !paused && mode === "play" && fps < 40 && curPR > 0.8) {
          curPR = Math.max(0.8, curPR - 0.25);
          renderer.setPixelRatio(curPR);
          renderer.setSize(innerWidth, innerHeight);
          updateBubbleScale();
        }
      }
    }

    const dt = (paused && match.type !== "online") ? (clock.getDelta(), 0) : Math.min(clock.getDelta(), 0.05);
    simTime += dt;
    acc += dt;

    matchTick(dt);
    tutTick(dt);

    while (acc >= STEP) {
      physicsStep(STEP);
      acc -= STEP;
    }

    if (!(paused && match.type !== "online") && (!LOW || (waterFrame++ & 1) === 0)) updateWaterMesh();

    // ---------- barco flutua nas ondas que ele mesmo criou ----------
    const hBow = heightAt(...Object.values(toWorldPair(3, 0)));
    const hStern = heightAt(...Object.values(toWorldPair(-3, 0)));
    const hPort = heightAt(...Object.values(toWorldPair(0, -0.9)));
    const hStar = heightAt(...Object.values(toWorldPair(0, 0.9)));
    const hMid = (hBow + hStern + hPort + hStar) * 0.25;

    const sp = Math.hypot(state.vx, state.vz);
    const n = Math.min(1, sp / 11);
    const k = Math.min(1, dt * 7);

    const targetPitch = Math.atan2(hBow - hStern, 6) * 0.9 + 0.05 * n * state.throttle;
    const targetRoll = Math.atan2(hPort - hStar, 1.8) * 0.9 + -state.steer * Math.min(1, sp / 5) * 0.3;

    state.pitch += (targetPitch - state.pitch) * k;
    state.roll += (targetRoll - state.roll) * k;
    state.heave += (hMid * 0.8 - state.heave) * k;

    ballMesh.position.set(
      ball.x,
      WATER_Y + heightAt(ball.x, ball.z) + 0.5 + Math.sin(simTime * 2.1) * 0.03,
      ball.z
    );

    // ---------- bolhas ----------
    {
      const spB = Math.hypot(state.vx, state.vz);
      const nB = Math.min(1, spB / 11);
      const washB = Math.max(Math.abs(state.throttle), state.boosting ? 1.6 : 0);

      bubbleAcc += dt * (washB * 110 + nB * 140);
      while (bubbleAcc >= 1) {
        bubbleAcc -= 1;
        const q = toWorld(-4.1, (Math.random() - 0.5) * 0.5);
        spawnBubble(q.x, q.z, 0.3 + Math.random() * 0.9);
      }

      // ---------- respingos ----------
      {
        const ch = Math.cos(state.heading);
        const sh = Math.sin(state.heading);
        const rnd = () => Math.random();

        function worldVel(lx, lz) {
          return [lx * ch + lz * sh, -lx * sh + lz * ch];
        }

        // rabo de galo atrás do motor
        sprayAcc += dt * (washB * 40 + nB * 160);
        while (sprayAcc >= 1) {
          sprayAcc -= 1;
          const q = toWorld(-4.0, (rnd() - 0.5) * 0.5);
          const [wx, wz] = worldVel(
            -(0.8 + rnd() * (1.5 + nB * 3 + washB * 1.5)),
            (rnd() - 0.5) * 2.6
          );
          spawnSpray(
            q.x, WATER_Y + heightAt(q.x, q.z) + 0.1, q.z,
            wx + state.vx * 0.7, 2.2 + rnd() * (1.5 + nB * 3.5), wz + state.vz * 0.7,
            0.06 + rnd() * 0.14
          );
        }

        // água esguichando pela proa e pelos lados do casco
        if (nB > 0.3) {
          bowAcc += dt * nB * nB * 110;
          while (bowAcc >= 1) {
            bowAcc -= 1;
            const side = rnd() < 0.5 ? -1 : 1;
            const q = toWorld(1.5 + rnd() * 1.8, side * (0.5 + rnd() * 0.45));
            const [wx, wz] = worldVel(0.5 + rnd() * 1.2, side * (1.8 + rnd() * 2.2));
            spawnSpray(
              q.x, WATER_Y + heightAt(q.x, q.z) + 0.08, q.z,
              wx + state.vx * 0.6, 2.0 + rnd() * 2.6 * nB, wz + state.vz * 0.6,
              0.05 + rnd() * 0.11
            );
          }
        }
      }

      updateBubbles(dt);
      updateSpray(dt);
    }

    boatRig.position.set(state.x, 0, state.z);
    boatRig.rotation.y = state.heading;

    boat.position.y = state.heave;
    boat.rotation.z = state.pitch;
    boat.rotation.x = state.roll;

    // bots
    for (const b of allBoats) {
      if (!b.isPlayer) updateBotVisual(b, dt);
    }

    marker.visible = isComp() && (mode === "play" || mode === "result");
    {
      const onl = match.type === "online" && (mode === "play" || mode === "result");
      teamMarks.forEach((m, i) => {
        const a = allBoats[i];
        if (onl && a) {
          m.visible = true;
          m.material.color.set(a.team === 0 ? 0xd7263d : 0x1f6fe0);
          m.position.set(a.st.x, 2.7 + Math.sin(simTime * 3 + i) * 0.1, a.st.z);
        } else m.visible = false;
      });
    }
    if (marker.visible) {
      marker.position.set(state.x, 3.4 + Math.sin(simTime * 3) * 0.15, state.z);
    }

    // hélice gira com o acelerador
    const spinTarget = sp > 0.4 ? 10 + sp * 5 : 0;
    state.propSpin += (spinTarget - state.propSpin) * Math.min(1, dt * 4);
    state.propAngle += state.propSpin * dt;
    propGroups.forEach((g, i) => {
      g.rotation.x = state.propAngle + i * Math.PI * 2 / 3;
    });

    // cáusticas se movem no fundo
    causticTex.offset.x = simTime * 0.035;
    causticTex.offset.y = simTime * 0.022;
    causticMat.opacity = causticBase * (0.8 + 0.2 * Math.sin(simTime * 1.3));

    // textura da água desliza devagar
    waterTexture.offset.x = simTime * 0.003;
    waterTexture.offset.y = simTime * 0.0015;

    updateMapVisuals(dt);

    // ---------- sol e céu acompanham o barco ----------
    sun.position.set(state.x + SUN_OFF.x, SUN_OFF.y, state.z + SUN_OFF.z);
    sun.target.position.set(state.x, 0, state.z);
    skyDome.position.copy(camera.position);
    cloudGroup.position.copy(camera.position);
    cloudGroup.position.y = 0;

    // ---------- câmera ----------
    const dxp = state.x - prevPos.x;
    const dzp = state.z - prevPos.z;
    camera.position.x += dxp;
    camera.position.z += dzp;
    controls.target.x += dxp;
    controls.target.z += dzp;
    prevPos.set(state.x, 0, state.z);

    if (mode === "play" && chase.on && !chase.dragging) {
      computeGoals();
      camera.position.lerp(camGoal, 1 - Math.exp(-dt * 2.4));
      controls.target.lerp(tgtGoal, 1 - Math.exp(-dt * 6));
    }

    // cor do barco muda suavemente
    hullMat.color.lerp(paintTarget, Math.min(1, dt * 8));
    accentMat.color.lerp(accentTarget, Math.min(1, dt * 8));

    // barra de boost + câmera "abre" o campo de visão durante o boost
    boostFill.style.width = (state.boost * 100).toFixed(1) + "%";
    boostBar.classList.toggle("active", state.boosting);
    boostBar.classList.toggle("locked", state.boostLock);

    const fovT = state.boosting ? 50 : 42;
    if (Math.abs(camera.fov - fovT) > 0.01) {
      camera.fov += (fovT - camera.fov) * Math.min(1, dt * 5);
      camera.updateProjectionMatrix();
    }

    // deslocamento da imagem (barco ao lado da paleta)
    shiftX += (tShiftX - shiftX) * Math.min(1, dt * 6);
    shiftY += (tShiftY - shiftY) * Math.min(1, dt * 6);

    if (Math.abs(shiftX) < 0.0005 && Math.abs(shiftY) < 0.0005 &&
        tShiftX === 0 && tShiftY === 0) {
      if (camera.view && camera.view.enabled) camera.clearViewOffset();
    } else {
      camera.setViewOffset(
        innerWidth, innerHeight,
        shiftX * innerWidth, shiftY * innerHeight,
        innerWidth, innerHeight
      );
    }

    speedEl.textContent = "VELOCIDADE  " + Math.round(sp * 3.6) + " km/h";

    sfx.update(dt);
    netTick(dt);

    if (isComp()) {
      timerEl.textContent = "TEMPO  " + fmtTime(match.time);
      timerEl.style.color = match.time < 10 && !match.over ? "#ff8a80" : "";
    } else {
      timerEl.textContent = "";
    }

    controls.update();
    renderer.render(scene, camera);
  }

  function toWorldPair(lx, lz) {
    const p = toWorld(lx, lz);
    return { x: p.x, z: p.z };
  }

  // ==================================================
  // RESPONSIVIDADE
  // ==================================================

  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(curPR);
  });

  menuCamera();
  loading.classList.add("hidden");
  animate();
})();