const canvas = document.getElementById('renderCanvas');

if (!canvas) {
  throw new Error('renderCanvas element missing from DOM');
}

const engine = new BABYLON.Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: false,
});

const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.05, 0.08, 0.16, 1);

const camera = new BABYLON.ArcRotateCamera(
  'orbitCamera',
  Math.PI / 4,
  Math.PI / 3,
  6,
  BABYLON.Vector3.Zero(),
  scene,
);
camera.attachControl(canvas, true);

const light = new BABYLON.HemisphericLight(
  'hemilight',
  new BABYLON.Vector3(0, 1, 0),
  scene,
);
light.intensity = 0.85;

const sphere = BABYLON.MeshBuilder.CreateSphere('sphere', { diameter: 2 }, scene);
const material = new BABYLON.StandardMaterial('sphereMaterial', scene);
material.diffuseColor = new BABYLON.Color3(0.1, 0.4, 0.95);
material.specularColor = new BABYLON.Color3(0.7, 0.7, 1.0);
sphere.material = material;

const ground = BABYLON.MeshBuilder.CreateGround(
  'ground',
  { width: 8, height: 8, subdivisions: 2 },
  scene,
);
const groundMaterial = new BABYLON.StandardMaterial('groundMaterial', scene);
groundMaterial.diffuseColor = new BABYLON.Color3(0.02, 0.08, 0.12);
groundMaterial.specularColor = new BABYLON.Color3(0.2, 0.2, 0.3);
ground.material = groundMaterial;

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener('resize', () => {
  engine.resize();
});
