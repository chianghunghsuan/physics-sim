import * as THREE from './vendor/three.module.js';

const stages = new Map();

function metal(color, roughness = .38, metalness = .68) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(parent, size, position, material, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function bevelBox(parent, size, position, material, bevel) {
  const [width, height, depth] = size;
  const radius = Math.min(bevel, width / 4, height / 4, depth / 4);
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + radius, -height / 2 + radius);
  shape.lineTo(width / 2 - radius, -height / 2 + radius);
  shape.lineTo(width / 2 - radius, height / 2 - radius);
  shape.lineTo(-width / 2 + radius, height / 2 - radius);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * radius, bevelEnabled: true, bevelSize: radius,
    bevelThickness: radius, bevelSegments: 3, steps: 1
  });
  geometry.translate(0, 0, -depth / 2 + radius);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function tube(parent, points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), closed, 'centripetal');
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, points.length * 12), radius, 9, closed), material);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function coilCurve(halfWidth, halfHeight, corner, depth) {
  const curve = new THREE.CurvePath();
  const p = (x, y) => new THREE.Vector3(x, y, depth);
  const line = (a, b) => curve.add(new THREE.LineCurve3(p(...a), p(...b)));
  const bend = (a, control, b) => curve.add(new THREE.QuadraticBezierCurve3(p(...a), p(...control), p(...b)));
  const w = halfWidth, h = halfHeight, r = corner;
  line([-.18, -h], [-w + r, -h]);
  bend([-w + r, -h], [-w, -h], [-w, -h + r]);
  line([-w, -h + r], [-w, h - r]);
  bend([-w, h - r], [-w, h], [-w + r, h]);
  line([-w + r, h], [w - r, h]);
  bend([w - r, h], [w, h], [w, h - r]);
  line([w, h - r], [w, -h + r]);
  bend([w, -h + r], [w, -h], [w - r, -h]);
  line([w - r, -h], [.18, -h]);
  return curve;
}

function coilTube(parent, curve, radius, material) {
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 128, radius, 10, false), material);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function label(parent, text, position, width = .5) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f7f7f2';
  context.font = 'bold 175px "Times New Roman", serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 128, 137);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  mesh.position.set(...position);
  parent.add(mesh);
}

function ammeter(scene, housingMaterial) {
  bevelBox(scene, [.96, .74, .29], [1.12, -1.57, 1.55], housingMaterial, .045);
  for (const x of [.75, 1.49]) {
    const terminal = new THREE.Mesh(new THREE.SphereGeometry(.065, 16, 12), metal('#b9794f', .3, .75));
    terminal.position.set(x, -1.18, 1.55); scene.add(terminal);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.68, .68),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  face.position.set(1.12, -1.57, 1.705);
  scene.add(face);
  return { canvas, texture, previous: NaN };
}

function paintAmmeter(meter, ratio) {
  const value = THREE.MathUtils.clamp(ratio, -1, 1);
  if (Math.abs(value - meter.previous) < .008) return;
  meter.previous = value;
  const ctx = meter.canvas.getContext('2d');
  ctx.fillStyle = '#f5f2e8'; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#86969a'; ctx.lineWidth = 5; ctx.strokeRect(4, 4, 248, 248);
  ctx.strokeStyle = '#31434b'; ctx.lineWidth = 3;
  for (let i = 0; i <= 10; i += 1) {
    const angle = (-150 + i * 12) * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(128 + 85 * Math.cos(angle), 174 + 85 * Math.sin(angle));
    ctx.lineTo(128 + (i % 5 ? 97 : 105) * Math.cos(angle), 174 + (i % 5 ? 97 : 105) * Math.sin(angle));
    ctx.stroke();
  }
  ctx.font = 'bold 27px "Times New Roman", serif';
  ctx.textAlign = 'center'; ctx.fillStyle = '#273941';
  ctx.fillText('A', 128, 227);
  ctx.font = 'bold 19px "Times New Roman", serif';
  ctx.fillText('-0.5', 37, 161);
  ctx.fillText('0', 128, 56);
  ctx.fillText('+0.5', 219, 161);
  const needle = (-90 + value * 60) * Math.PI / 180;
  ctx.strokeStyle = '#b74c3d'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(128, 174);
  ctx.lineTo(128 + 92 * Math.cos(needle), 174 + 92 * Math.sin(needle)); ctx.stroke();
  ctx.fillStyle = '#34434a'; ctx.beginPath(); ctx.arc(128, 174, 9, 0, 2 * Math.PI); ctx.fill();
  meter.texture.needsUpdate = true;
}

function createStage(host, kind) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.55;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.replaceChildren(renderer.domElement);
  const expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'stage-expand';
  expand.textContent = '全螢幕';
  expand.setAttribute('aria-label', '放大立體裝置畫面');
  expand.addEventListener('click', () => {
    if (document.fullscreenElement === host) document.exitFullscreen();
    else host.requestFullscreen();
  });
  host.appendChild(expand);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f2f6f5');
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb6bdc0, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 3.3);
  key.position.set(-3, 8, 7); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -7; key.shadow.camera.right = 7;
  key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc8e9f2, 1.3);
  rim.position.set(3, 5, -6); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#eef3f1', roughness: .96 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2.28; floor.receiveShadow = true; scene.add(floor);
  bevelBox(scene, [6.9, .24, 4.0], [0, -2.13, 0], metal('#69777a', .76, .25), .10);
  box(scene, [6.6, .07, 3.7], [0, -1.97, 0], metal('#d2d9d8', .72, .2));

  const magnetBody = metal('#52616a', .49, .63);
  const northFace = metal('#a5473e', .45, .5);
  const southFace = metal('#3d7290', .45, .5);
  for (const side of [-1, 1]) {
    bevelBox(scene, [.77, 2.95, 2.45], [side * 2.48, -.05, 0], magnetBody, .065);
    bevelBox(scene, [.19, 2.43, 2.0], [side * 2.02, -.05, 0], side < 0 ? northFace : southFace, .028);
    box(scene, [.75, .16, 2.48], [side * 2.48, -1.64, 0], metal('#738185'));
    label(scene, side < 0 ? 'N' : 'S', [side * 2.48, .06, 1.26], .50);
  }

  const frameMetal = metal('#74858a', .38, .75);
  const frameFoot = metal('#53666d', .54, .55);
  for (const side of [-1, 1]) {
    box(scene, [.16, 3.68, .17], [side * 1.42, -.08, -1.39], frameMetal);
    box(scene, [.39, .10, .42], [side * 1.42, -1.89, -1.39], frameFoot);
  }
  box(scene, [3.0, .16, .18], [0, 1.74, -1.39], frameMetal);
  box(scene, [.18, .14, 1.38], [0, 1.74, -.69], frameMetal);

  const copper = metal('#b87343', .25, .82);
  const brightCopper = metal('#da965d', .23, .78);
  const darkMetal = metal('#34424b', .39, .76);
  const rotor = new THREE.Group();
  scene.add(rotor);
  const halfWidth = .96, halfHeight = 1.12;
  const pathCurve = coilCurve(halfWidth, halfHeight, .14, 0);
  coilTube(rotor, pathCurve, .055, copper);
  for (const depth of [-.095, .095]) {
    coilTube(rotor, coilCurve(halfWidth, halfHeight, .14, depth), .014, brightCopper);
  }
  for (const y of [-.84, .84]) box(rotor, [1.91, .075, .11], [0, y, 0], darkMetal);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, kind === 'generator' ? 4.15 : 3.65, 24), darkMetal);
  if (kind === 'generator') shaft.position.y = .25;
  shaft.castShadow = true; rotor.add(shaft);
  if (kind === 'generator') {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.63, .055, 12, 72), darkMetal);
    wheel.rotation.x = Math.PI / 2; wheel.position.y = 2.10; wheel.castShadow = true; rotor.add(wheel);
    box(rotor, [1.20, .075, .075], [0, 2.10, 0], darkMetal);
    box(rotor, [.075, .075, 1.20], [0, 2.10, 0], darkMetal);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .32, 20), copper);
    handle.position.set(.61, 2.28, 0); handle.castShadow = true; rotor.add(handle);
  } else {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .18, 32), metal('#b66b40', .28, .7));
    hub.position.y = 1.94; hub.castShadow = true; rotor.add(hub);
    const fanMaterial = metal('#69838b', .34, .62);
    for (let index = 0; index < 3; index += 1) {
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(-.105, .12);
      bladeShape.bezierCurveTo(-.19, .40, -.27, .67, -.08, .83);
      bladeShape.bezierCurveTo(.08, .92, .22, .73, .16, .55);
      bladeShape.bezierCurveTo(.13, .34, .11, .20, .105, .12);
      bladeShape.closePath();
      const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, {
        depth: .045, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 2
      }), fanMaterial);
      const bladePivot = new THREE.Group();
      bladePivot.rotation.y = index * 2 * Math.PI / 3;
      rotor.add(bladePivot);
      blade.rotation.x = -Math.PI / 2;
      blade.position.y = 1.93;
      blade.castShadow = true; bladePivot.add(blade);
    }
  }
  for (const y of [1.74, -1.79]) {
    const bearing = new THREE.Mesh(new THREE.CylinderGeometry(.20, .20, .20, 32), metal('#879499', .32, .75));
    bearing.position.y = y; bearing.castShadow = true; scene.add(bearing);
  }
  const currentMarkers = [];
  const electronMarkers = [];
  for (let index = 0; index < 12; index += 1) {
    const current = new THREE.Mesh(new THREE.SphereGeometry(.066, 14, 10), new THREE.MeshBasicMaterial({ color: '#f26a27' }));
    const electron = new THREE.Mesh(new THREE.SphereGeometry(.039, 10, 8), new THREE.MeshBasicMaterial({ color: '#7951cb' }));
    rotor.add(current, electron); currentMarkers.push(current); electronMarkers.push(electron);
  }

  const brushes = [];
  const rings = [];
  let externalPaths = [];
  const externalMarkers = [];
  if (kind === 'motor') {
    const insulator = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .23, 32), metal('#24333a', .65, .12));
    insulator.position.y = -1.47; rotor.add(insulator);
    for (const side of [-1, 1]) {
      const points = [];
      for (let i = 0; i <= 30; i += 1) {
        const a = Math.PI / 2 + (side < 0 ? .08 : Math.PI + .08) + (Math.PI - .16) * i / 30;
        points.push([.34 * Math.cos(a), -1.47, .34 * Math.sin(a)]);
      }
      tube(rotor, points, .06, side < 0 ? copper : brightCopper);
      box(scene, [.28, .17, .29], [side * .48, -1.47, 0], metal('#313d43', .8, .23));
      box(scene, [.18, .38, .20], [side * .52, -1.74, 0], metal('#d1d9d7', .75, .12));
      tube(scene, [[side * .48, -1.47, 0], [side * .72, -1.55, .15], [side * .72, -1.62, 1.12], [side * .40, -1.53, 1.49]], .025, darkMetal);
    }
    tube(rotor, [[-.18, -halfHeight, 0], [-.32, -1.30, 0], [-.34, -1.47, 0]], .035, copper);
    tube(rotor, [[.18, -halfHeight, 0], [.32, -1.30, 0], [.34, -1.47, 0]], .035, brightCopper);
    externalPaths = [-1, 1].map(side => new THREE.CatmullRomCurve3([
      [side * .40, -1.52, 1.49], [side * .72, -1.62, 1.12],
      [side * .72, -1.55, .15], [side * .48, -1.47, 0]
    ].map(point => new THREE.Vector3(...point)), false, 'centripetal'));
    for (let i = 0; i < 10; i += 1) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.06, 12, 9), new THREE.MeshBasicMaterial({ color: '#f26a27' }));
      scene.add(marker); externalMarkers.push(marker);
    }
  } else {
    const insulator = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .50, 32), metal('#24333a', .65, .12));
    insulator.position.y = -1.50; rotor.add(insulator);
    for (const [index, y] of [-1.37, -1.64].entries()) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.33, .055, 10, 64), index ? brightCopper : copper);
      ring.rotation.x = Math.PI / 2; ring.position.y = y; rotor.add(ring); rings.push(ring);
      const side = index ? 1 : -1;
      box(scene, [.29, .18, .23], [side * .46, y, 0], metal('#303e47', .79, .29));
      const supportHeight = y + 1.93;
      box(scene, [.18, supportHeight, .20], [side * .52, (y - 1.93) / 2, 0], metal('#d1d9d7', .75, .12));
      brushes.push([side * .46, y, 0]);
    }
    tube(rotor, [[-.18, -halfHeight, 0], [-.31, -1.2, 0], [-.31, -1.37, 0]], .036, copper);
    tube(rotor, [[.18, -halfHeight, 0], [.31, -1.47, 0], [.31, -1.64, 0]], .036, brightCopper);
    const lampY = -1.15;
    tube(scene, [[-.46, -1.37, 0], [-.9, -1.65, .4], [-.9, -1.65, 1.65], [-.22, -1.65, 2.03], [-.22, lampY, 2.03]], .024, darkMetal);
    tube(scene, [[.46, -1.64, 0], [.9, -1.75, .7], [1.49, -1.18, 1.55]], .024, darkMetal);
    tube(scene, [[.75, -1.18, 1.55], [.64, -1.73, 1.88], [.22, -1.65, 2.03], [.22, lampY, 2.03]], .024, darkMetal);
    externalPaths = [new THREE.CatmullRomCurve3([
      [-.46, -1.37, 0], [-.9, -1.65, .4], [-.9, -1.65, 1.65], [-.22, -1.65, 2.03],
      [0, -1.15, 2.03], [.22, -1.65, 2.03], [.64, -1.73, 1.88], [.75, -1.18, 1.55],
      [1.12, -1.18, 1.55], [1.49, -1.18, 1.55], [.9, -1.75, .7], [.46, -1.64, 0]
    ].map(point => new THREE.Vector3(...point)), false, 'centripetal')];
    for (let i = 0; i < 9; i += 1) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.06, 12, 9), new THREE.MeshBasicMaterial({ color: '#f26a27' }));
      scene.add(marker); externalMarkers.push(marker);
    }
  }

  let bulb = null;
  let bulbLight = null;
  let filament = null;
  let meter = null;
  if (kind === 'generator') {
    const glass = new THREE.MeshPhysicalMaterial({ color: '#cbd8d9', emissive: '#e8a249', emissiveIntensity: .03,
      roughness: .13, transmission: .55, thickness: .25, transparent: true, opacity: .48, depthWrite: false });
    bulb = new THREE.Mesh(new THREE.SphereGeometry(.25, 24, 16), glass);
    bulb.position.set(0, -1.15, 2.03); bulb.castShadow = true; scene.add(bulb);
    box(scene, [.24, .18, .24], [0, -1.43, 2.03], darkMetal);
    filament = tube(scene, [[-.10, -1.25, 2.05], [-.07, -1.12, 2.05], [0, -1.04, 2.05],
      [.07, -1.12, 2.05], [.10, -1.25, 2.05]], .016,
    new THREE.MeshBasicMaterial({ color: '#ffa43e' }));
    bulbLight = new THREE.PointLight(0xffc783, 0, 3.2);
    bulbLight.position.copy(bulb.position); scene.add(bulbLight);
    meter = ammeter(scene, metal('#495a61', .62, .3));
  } else {
    const battery = bevelBox(scene, [1.06, .36, .55], [0, -1.76, 1.49], darkMetal, .055);
    battery.castShadow = true;
    for (const side of [-1, 1]) {
      const terminal = new THREE.Mesh(new THREE.CylinderGeometry(.10, .10, .13, 20), metal(side < 0 ? '#bd5141' : '#8ca4ab', .34, .55));
      terminal.position.set(side * .40, -1.52, 1.49);
      terminal.castShadow = true; scene.add(terminal);
      label(scene, side < 0 ? '+' : '−', [side * .40, -1.70, 1.78], .18);
    }
  }

  const fieldArrows = [];
  for (const z of [-.7, 0, .7]) {
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1.7, .18, z), 3.4, 0x477e98, .18, .085);
    scene.add(arrow); fieldArrows.push(arrow);
  }
  const forceArrows = [];
  if (kind === 'motor') for (let i = 0; i < 2; i += 1) {
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), .75, 0xc54b51, .19, .09);
    scene.add(arrow); forceArrows.push(arrow);
  }

  const control = { azimuth: .65, elevation: .39, distance: kind === 'generator' ? 11.3 : 10.4, dragging: false, x: 0, y: 0 };
  renderer.domElement.addEventListener('pointerdown', event => {
    control.dragging = true; control.x = event.clientX; control.y = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', event => {
    if (!control.dragging) return;
    control.azimuth += (event.clientX - control.x) * .006;
    control.elevation = THREE.MathUtils.clamp(control.elevation + (event.clientY - control.y) * .004, .10, 1.15);
    control.x = event.clientX; control.y = event.clientY;
  });
  renderer.domElement.addEventListener('pointerup', () => { control.dragging = false; });
  renderer.domElement.addEventListener('wheel', event => {
    event.preventDefault(); control.distance = THREE.MathUtils.clamp(control.distance + event.deltaY * .008, 7.6, 13);
  }, { passive: false });

  const stage = { kind, host, renderer, scene, camera, rotor, pathCurve, currentMarkers, electronMarkers, externalPaths, externalMarkers, fieldArrows, forceArrows, bulb, bulbLight, filament, meter, control, chargePhase: 0, supplyPhase: 0, lastTime: NaN };
  stages.set(kind, stage);
  return stage;
}

function render(kind, state) {
  const host = document.getElementById(`${kind}-three`);
  if (!host || host.hidden) return;
  let stage = stages.get(kind);
  try {
    stage ||= createStage(host, kind);
  } catch (error) {
    host.textContent = '此裝置無法啟動 3D；請切換到 2D 圖。';
    console.warn('WebGL unavailable', error);
    return;
  }
  const { renderer, scene, camera, rotor, pathCurve, currentMarkers, electronMarkers, externalPaths, externalMarkers, fieldArrows, forceArrows, bulb, bulbLight, filament, meter, control } = stage;
  const width = host.clientWidth, height = host.clientHeight;
  if (!width || !height) return;
  if (renderer.domElement.width !== Math.round(width * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 620 ? 46 : 37;
    camera.updateProjectionMatrix();
  }
  const distance = control.distance * (width < 620 ? (kind === 'generator' ? .88 : .94) : 1);
  camera.position.set(Math.sin(control.azimuth) * Math.cos(control.elevation) * distance,
    Math.sin(control.elevation) * distance,
    Math.cos(control.azimuth) * Math.cos(control.elevation) * distance);
  camera.lookAt(0, -.60, 0);
  rotor.rotation.y = state.angle + (kind === 'generator' ? Math.PI / 2 : 0);
  for (const arrow of fieldArrows) arrow.visible = state.showField && state.B > .001;
  const reverse = kind === 'motor' ? state.halfTurn === 0 : state.current < 0;
  const elapsed = Number.isFinite(stage.lastTime) && state.time >= stage.lastTime
    ? Math.min(.1, state.time - stage.lastTime) : 0;
  if (state.time < stage.lastTime) {
    stage.chargePhase = 0;
    stage.supplyPhase = 0;
  }
  stage.lastTime = state.time;
  const signedCurrent = kind === 'motor' && reverse ? -state.current : state.current;
  stage.chargePhase += elapsed * .42 * signedCurrent / Math.max(.001, state.maxCurrent);
  stage.supplyPhase += elapsed * .42 * Math.abs(state.current) / Math.max(.001, state.maxCurrent);
  for (let i = 0; i < currentMarkers.length; i += 1) {
    const fraction = ((i / currentMarkers.length + stage.chargePhase) % 1 + 1) % 1;
    currentMarkers[i].position.copy(pathCurve.getPoint(fraction));
    currentMarkers[i].visible = state.showCurrent && Math.abs(state.current) > .01;
    const electronFraction = ((i / electronMarkers.length - stage.chargePhase) % 1 + 1) % 1;
    electronMarkers[i].position.copy(pathCurve.getPoint(electronFraction));
    electronMarkers[i].position.z += .085;
    electronMarkers[i].visible = state.showElectrons && Math.abs(state.current) > .01;
  }
  for (let i = 0; i < externalMarkers.length; i += 1) {
    const motor = kind === 'motor';
    const path = externalPaths[motor ? i % 2 : 0];
    const phase = motor ? (i % 2 ? -stage.supplyPhase : stage.supplyPhase) : -stage.chargePhase;
    const fraction = (((motor ? Math.floor(i / 2) / 5 : i / externalMarkers.length) + phase) % 1 + 1) % 1;
    externalMarkers[i].position.copy(path.getPoint(fraction));
    externalMarkers[i].visible = state.showCurrent && Math.abs(state.current) > .04;
  }
  if (forceArrows.length) for (const [index, arrow] of forceArrows.entries()) {
    const side = index ? 1 : -1;
    const x = side * .96 * Math.cos(state.angle), z = -side * .96 * Math.sin(state.angle);
    const sign = (index ? 1 : -1) * (reverse ? -1 : 1);
    arrow.position.set(x, 0, z);
    arrow.setDirection(new THREE.Vector3(0, 0, sign));
    arrow.visible = state.showForce && state.B > .001 && Math.abs(state.current) > .01;
  }
  if (bulb) {
    const brightness = Math.min(1, Math.abs(state.current) / Math.max(.001, state.maxCurrent));
    bulb.material.color.set(brightness > .08 ? '#f4c26b' : '#cbd8d9');
    bulb.material.emissiveIntensity = .03 + brightness * .8;
    filament.visible = brightness > .06;
    bulbLight.intensity = brightness * brightness * 4;
    paintAmmeter(meter, state.current / Math.max(.001, state.maxCurrent));
  }
  renderer.render(scene, camera);
}

window.emThree = { renderMotor: state => render('motor', state), renderGenerator: state => render('generator', state) };
