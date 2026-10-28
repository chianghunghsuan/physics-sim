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

function tube(parent, points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)), closed, 'centripetal');
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, points.length * 12), radius, 9, closed), material);
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
  box(scene, [6.9, .24, 4.0], [0, -2.13, 0], metal('#69777a', .76, .25));
  box(scene, [6.6, .07, 3.7], [0, -1.97, 0], metal('#d2d9d8', .72, .2));

  const magnetBody = metal('#52616a', .49, .63);
  const northFace = metal('#a5473e', .45, .5);
  const southFace = metal('#3d7290', .45, .5);
  for (const side of [-1, 1]) {
    box(scene, [.77, 2.95, 2.45], [side * 2.48, -.05, 0], magnetBody);
    box(scene, [.19, 2.43, 2.0], [side * 2.02, -.05, 0], side < 0 ? northFace : southFace);
    box(scene, [.75, .16, 2.48], [side * 2.48, -1.64, 0], metal('#738185'));
    label(scene, side < 0 ? 'N' : 'S', [side * 2.48, .06, 1.26], .50);
  }

  const copper = metal('#b87343', .25, .82);
  const brightCopper = metal('#da965d', .23, .78);
  const darkMetal = metal('#34424b', .39, .76);
  const rotor = new THREE.Group();
  scene.add(rotor);
  const halfWidth = .96, halfHeight = 1.12;
  const path = kind === 'motor'
    ? [[-halfWidth, halfHeight, 0], [halfWidth, halfHeight, 0], [halfWidth, -halfHeight, 0], [-halfWidth, -halfHeight, 0]]
    : [[-halfWidth, -halfHeight, 0], [-halfWidth, halfHeight, 0], [halfWidth, halfHeight, 0], [halfWidth, -halfHeight, 0]];
  const pathCurve = new THREE.CatmullRomCurve3(path.map(point => new THREE.Vector3(...point)), true, 'centripetal');
  tube(rotor, path, .055, copper, true);
  for (const depth of [-.095, .095]) {
    tube(rotor, path.map(([x, y]) => [x, y, depth]), .014, brightCopper, true);
  }
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, kind === 'generator' ? 4.55 : 3.65, 24), darkMetal);
  if (kind === 'generator') shaft.position.y = .45;
  shaft.castShadow = true; rotor.add(shaft);
  if (kind === 'generator') {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.63, .055, 12, 72), darkMetal);
    wheel.rotation.x = Math.PI / 2; wheel.position.y = 2.43; wheel.castShadow = true; rotor.add(wheel);
    box(rotor, [1.20, .075, .075], [0, 2.43, 0], darkMetal);
    box(rotor, [.075, .075, 1.20], [0, 2.43, 0], darkMetal);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .32, 20), copper);
    handle.position.set(.61, 2.61, 0); handle.castShadow = true; rotor.add(handle);
  }
  for (const y of [1.74, -1.79]) {
    const bearing = new THREE.Mesh(new THREE.CylinderGeometry(.20, .20, .20, 32), metal('#879499', .32, .75));
    bearing.position.y = y; bearing.castShadow = true; scene.add(bearing);
  }
  const currentMarkers = [];
  const electronMarkers = [];
  for (let index = 0; index < 12; index += 1) {
    const current = new THREE.Mesh(new THREE.SphereGeometry(.043, 12, 9), new THREE.MeshBasicMaterial({ color: '#ffb461' }));
    const electron = new THREE.Mesh(new THREE.SphereGeometry(.028, 10, 7), new THREE.MeshBasicMaterial({ color: '#a597dc' }));
    rotor.add(current, electron); currentMarkers.push(current); electronMarkers.push(electron);
  }

  const brushes = [];
  const rings = [];
  let externalPath = null;
  const externalMarkers = [];
  if (kind === 'motor') {
    for (const side of [-1, 1]) {
      const points = [];
      for (let i = 0; i <= 30; i += 1) {
        const a = Math.PI / 2 + (side < 0 ? .08 : Math.PI + .08) + (Math.PI - .16) * i / 30;
        points.push([.34 * Math.cos(a), -1.47, .34 * Math.sin(a)]);
      }
      tube(rotor, points, .06, side < 0 ? copper : brightCopper);
      box(scene, [.28, .17, .29], [side * .48, -1.47, 0], metal('#313d43', .8, .23));
      tube(scene, [[side * .48, -1.47, 0], [side * .72, -1.55, .15], [side * .72, -1.62, 1.12], [side * .40, -1.53, 1.49]], .025, darkMetal);
    }
  } else {
    for (const [index, y] of [-1.37, -1.64].entries()) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.33, .055, 10, 64), index ? brightCopper : copper);
      ring.rotation.x = Math.PI / 2; ring.position.y = y; rotor.add(ring); rings.push(ring);
      const side = index ? 1 : -1;
      box(scene, [.29, .18, .23], [side * .46, y, 0], metal('#303e47', .79, .29));
      brushes.push([side * .46, y, 0]);
    }
    tube(rotor, [[-halfWidth, -halfHeight, 0], [-.31, -1.2, 0], [-.31, -1.37, 0]], .036, copper);
    tube(rotor, [[halfWidth, -halfHeight, 0], [.31, -1.47, 0], [.31, -1.64, 0]], .036, brightCopper);
    const lampY = -1.15;
    tube(scene, [[-.46, -1.37, 0], [-.9, -1.65, .4], [-.9, -1.65, 1.65], [-.22, -1.65, 2.03], [-.22, lampY, 2.03]], .024, darkMetal);
    tube(scene, [[.46, -1.64, 0], [.9, -1.75, .7], [.9, -1.75, 1.65], [.22, -1.65, 2.03], [.22, lampY, 2.03]], .024, darkMetal);
    externalPath = new THREE.CatmullRomCurve3([
      [-.46, -1.37, 0], [-.9, -1.65, .4], [-.9, -1.65, 1.65], [-.22, -1.65, 2.03],
      [0, -1.15, 2.03], [.22, -1.65, 2.03], [.9, -1.75, 1.65], [.9, -1.75, .7], [.46, -1.64, 0]
    ].map(point => new THREE.Vector3(...point)), false, 'centripetal');
    for (let i = 0; i < 9; i += 1) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.046, 12, 9), new THREE.MeshBasicMaterial({ color: '#ed9a39' }));
      scene.add(marker); externalMarkers.push(marker);
    }
  }

  let bulb = null;
  if (kind === 'generator') {
    const glass = new THREE.MeshPhysicalMaterial({ color: '#f8ddb3', emissive: '#f2a641', emissiveIntensity: .15, roughness: .12, transmission: .48, thickness: .45 });
    bulb = new THREE.Mesh(new THREE.SphereGeometry(.25, 24, 16), glass);
    bulb.position.set(0, -1.15, 2.03); bulb.castShadow = true; scene.add(bulb);
    box(scene, [.24, .18, .24], [0, -1.43, 2.03], darkMetal);
  } else {
    const battery = box(scene, [1.06, .36, .55], [0, -1.76, 1.49], darkMetal);
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

  const control = { azimuth: .65, elevation: .39, distance: 10.4, dragging: false, x: 0, y: 0 };
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

  const stage = { kind, host, renderer, scene, camera, rotor, pathCurve, currentMarkers, electronMarkers, externalPath, externalMarkers, fieldArrows, forceArrows, bulb, control };
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
  const { renderer, scene, camera, rotor, pathCurve, currentMarkers, electronMarkers, externalPath, externalMarkers, fieldArrows, forceArrows, bulb, control } = stage;
  const width = host.clientWidth, height = host.clientHeight;
  if (!width || !height) return;
  if (renderer.domElement.width !== Math.round(width * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 620 ? 46 : 37;
    camera.updateProjectionMatrix();
  }
  const distance = control.distance * (width < 620 ? 1.10 : 1);
  camera.position.set(Math.sin(control.azimuth) * Math.cos(control.elevation) * distance,
    Math.sin(control.elevation) * distance,
    Math.cos(control.azimuth) * Math.cos(control.elevation) * distance);
  camera.lookAt(0, -.60, 0);
  rotor.rotation.y = state.angle + (kind === 'generator' ? Math.PI / 2 : 0);
  for (const arrow of fieldArrows) arrow.visible = state.showField;
  const reverse = kind === 'motor' ? state.halfTurn === 0 : state.current < 0;
  for (let i = 0; i < currentMarkers.length; i += 1) {
    const fraction = ((i / currentMarkers.length + state.time * .36) % 1 + 1) % 1;
    currentMarkers[i].position.copy(pathCurve.getPoint(reverse ? 1 - fraction : fraction));
    currentMarkers[i].visible = state.showCurrent && Math.abs(state.current) > .01;
    electronMarkers[i].position.copy(pathCurve.getPoint(reverse ? fraction : 1 - fraction));
    electronMarkers[i].position.z += .085;
    electronMarkers[i].visible = state.showElectrons && Math.abs(state.current) > .01;
  }
  for (let i = 0; i < externalMarkers.length; i += 1) {
    const fraction = (i / externalMarkers.length + state.time * Math.max(.2, Math.abs(state.current) * .17)) % 1;
    externalMarkers[i].position.copy(externalPath.getPoint(state.current < 0 ? 1 - fraction : fraction));
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
  if (bulb) bulb.material.emissiveIntensity = Math.min(3.5, .12 + Math.abs(state.current) * 2.8);
  renderer.render(scene, camera);
}

window.emThree = { renderMotor: state => render('motor', state), renderGenerator: state => render('generator', state) };
