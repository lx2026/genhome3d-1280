import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { USDLoader } from "three/addons/loaders/USDLoader.js";

const disposeMaterial = (material) => {
  Object.values(material).forEach((value) => {
    if (value?.isTexture) value.dispose();
  });
  material.dispose();
};

const disposeObject = (object) => {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach(disposeMaterial);
    } else if (child.material) {
      disposeMaterial(child.material);
    }
  });
};

export class AssetViewer {
  constructor({ canvas, container }) {
    this.canvas = canvas;
    this.container = container;
    this.model = null;
    this.ground = null;
    this.loadSequence = 0;
    this.initialView = null;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe7e0d3);

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.01, 1000);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(environment, 0.04).texture;
    this.scene.environmentIntensity = 0.85;
    environment.dispose();
    pmrem.dispose();

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = !this.reducedMotion.matches;
    this.controls.autoRotateSpeed = 0.8;
    this.controls.minPolarAngle = Math.PI * 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.88;

    const hemisphere = new THREE.HemisphereLight(0xfff9ed, 0x47645d, 2.35);
    this.scene.add(hemisphere);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
    this.keyLight.position.set(3, 5, 4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.bias = -0.0002;
    this.scene.add(this.keyLight);

    const fillLight = new THREE.DirectionalLight(0xd8ffef, 1.25);
    fillLight.position.set(-4, 2, -3);
    this.scene.add(fillLight);

    this.loader = new USDLoader();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  async load(url, onProgress = () => {}) {
    const sequence = ++this.loadSequence;
    this.clear();

    const model = await this.loader.loadAsync(url, (event) => {
      if (sequence !== this.loadSequence) return;
      onProgress(event.loaded, event.total);
    });

    if (sequence !== this.loadSequence) {
      disposeObject(model);
      return false;
    }

    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    if (bounds.isEmpty()) {
      disposeObject(model);
      throw new Error("The USDZ package did not contain displayable geometry.");
    }

    this.model = model;
    this.model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    this.scene.add(model);
    this.frame(bounds);
    this.start();
    return true;
  }

  frame(bounds) {
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 0.1);
    const radius = Math.max(size.length() * 0.5, 0.05);

    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(maxDimension * 1.15, 64),
      new THREE.ShadowMaterial({ color: 0x17352e, opacity: 0.16 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set(center.x, bounds.min.y - maxDimension * 0.006, center.z);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    const halfFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    const distance = (radius * 1.2) / Math.sin(halfFov);
    const direction = new THREE.Vector3(1.15, 0.72, 1.35).normalize();

    this.camera.near = Math.max(maxDimension / 200, 0.001);
    this.camera.far = Math.max(maxDimension * 100, 100);
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.camera.updateProjectionMatrix();

    this.controls.target.copy(center);
    this.controls.minDistance = maxDimension * 0.55;
    this.controls.maxDistance = maxDimension * 8;
    this.controls.update();

    this.keyLight.position.copy(center).add(
      new THREE.Vector3(maxDimension * 2.4, maxDimension * 4, maxDimension * 3),
    );
    const shadowExtent = maxDimension * 1.1;
    this.keyLight.shadow.camera.left = -shadowExtent;
    this.keyLight.shadow.camera.right = shadowExtent;
    this.keyLight.shadow.camera.top = shadowExtent;
    this.keyLight.shadow.camera.bottom = -shadowExtent;
    this.keyLight.shadow.camera.near = 0.01;
    this.keyLight.shadow.camera.far = maxDimension * 12;
    this.keyLight.shadow.camera.updateProjectionMatrix();

    this.initialView = {
      position: this.camera.position.clone(),
      target: center.clone(),
    };
  }

  reset() {
    if (!this.initialView) return;
    this.camera.position.copy(this.initialView.position);
    this.controls.target.copy(this.initialView.target);
    this.controls.update();
  }

  start() {
    this.controls.autoRotate = !this.reducedMotion.matches;
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }

  clear() {
    this.stop();
    if (this.model) {
      this.scene.remove(this.model);
      disposeObject(this.model);
      this.model = null;
    }
    if (this.ground) {
      this.scene.remove(this.ground);
      disposeObject(this.ground);
      this.ground = null;
    }
    this.initialView = null;
    this.renderer.render(this.scene, this.camera);
  }

  cancel() {
    this.loadSequence += 1;
    this.clear();
  }

  resize() {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
}
