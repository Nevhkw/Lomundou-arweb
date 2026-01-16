import { DRACOLoader } from "./libs/three.js-r132/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "./libs/three.js-r132/examples/jsm/loaders/GLTFLoader.js";

const THREE = window.MINDAR.IMAGE.THREE;

// 1. Initialize MindAR with the correct container ID
const initializeMindAR = () => {
  const container = document.querySelector("#ar-container"); 
  return new window.MINDAR.IMAGE.MindARThree({
    container: container,
    imageTargetSrc: './assets/targets/Lomundou.mind',
  });
};

// 2. Configure GLTFLoader with the correct relative path for Draco
const configureGLTFLoader = () => {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  // Using './' ensures it works in the root directory
  dracoLoader.setDecoderPath('./libs/draco/'); 
  loader.setDRACOLoader(dracoLoader);
  return loader;
};

const setupLighting = (scene) => {
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);
};

const loadModel = async (path, scale = { x: 0.15, y: 0.15, z: 0.15 }, position = { x: 0, y: -0.4, z: 0 }) => {
  const loader = configureGLTFLoader();
  const model = await loader.loadAsync(path);
  model.scene.scale.set(scale.x, scale.y, scale.z);
  model.scene.position.set(position.x, position.y, position.z);
  return model;
};

const enableZoomAndRotation = (camera, model) => {
  let scaleFactor = 1.0;
  let isDragging = false;
  let previousPosition = { x: 0, y: 0 };
  let initialDistance = null;
  
  const handleStart = (event) => {
    if (event.touches && event.touches.length === 1) {
      isDragging = true;
      previousPosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    } else if (event.touches && event.touches.length === 2) {
      isDragging = false;
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      initialDistance = Math.sqrt(dx * dx + dy * dy);
    } else if (event.type === 'mousedown') {
      isDragging = true;
      previousPosition = { x: event.clientX, y: event.clientY };
    }
  };

  const handleMove = (event) => {
    if (isDragging && (event.type === 'mousemove' || (event.touches && event.touches.length === 1))) {
      const currentPosition = event.touches ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : { x: event.clientX, y: event.clientY };
      const deltaMove = { x: currentPosition.x - previousPosition.x, y: currentPosition.y - previousPosition.y };
      model.scene.rotation.y += deltaMove.x * 0.01;
      model.scene.rotation.x += deltaMove.y * 0.01;
      previousPosition = currentPosition;
    } else if (event.touches && event.touches.length === 2 && initialDistance) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const zoomDelta = (currentDistance - initialDistance) * 0.005;
      scaleFactor = Math.min(Math.max(scaleFactor + zoomDelta, 0.5), 2);
      model.scene.scale.set(scaleFactor, scaleFactor, scaleFactor);
      initialDistance = currentDistance;
    }
  };

  const handleEnd = () => { isDragging = false; initialDistance = null; };

  window.addEventListener('mousedown', handleStart);
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);
  window.addEventListener('touchstart', handleStart);
  window.addEventListener('touchmove', handleMove);
  window.addEventListener('touchend', handleEnd);
};

const setupAnchorWithAutoAnimationAndAudio = async (mindarThree, model, anchorId, audioPath) => {
  const anchor = mindarThree.addAnchor(anchorId);
  anchor.group.add(model.scene);
  const mixer = new THREE.AnimationMixer(model.scene);
  const actions = [];

  if (model.animations.length > 0) {
    model.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.play();
      actions.push(action);
    });
  }

  const audio = new Audio(audioPath);
  audio.loop = true;

  anchor.onTargetFound = () => {
    model.scene.visible = true;
    actions.forEach(a => { a.paused = false; if (!a.isRunning()) a.play(); });
    audio.currentTime = 0;
    audio.play();
  };

  anchor.onTargetLost = () => {
    model.scene.visible = false;
    actions.forEach(a => a.paused = true);
    audio.pause();
  };

  return mixer;
};

const enablePlayOnInteraction = (renderer, scene, camera, model, mixer) => {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const handleInteraction = (event) => {
    if (event.touches) {
      pointer.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    } else {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(model.scene.children, true);
    if (intersects.length > 0) {
      mixer._actions.forEach(action => { action.paused = !action.paused; });
    }
  };
  window.addEventListener("pointerdown", handleInteraction);
  window.addEventListener("touchstart", handleInteraction);
};

// 3. Main Start Function with User Gesture Trigger
document.addEventListener('DOMContentLoaded', () => {
  const start = async () => {
    const mindarThree = initializeMindAR();
    const { renderer, scene, camera } = mindarThree;
    renderer.clock = new THREE.Clock();
    setupLighting(scene);

    // Load all models
    const m1 = await loadModel('./assets/models/scene1.glb', { x: 0.04, y: 0.04, z: 0.04 });
    const m2 = await loadModel('./assets/models/scene2.glb', { x: 0.08, y: 0.08, z: 0.08 });
    const m3 = await loadModel('./assets/models/scene3.glb', { x: 0.08, y: 0.08, z: 0.08 });
    const m4 = await loadModel('./assets/models/scene4.glb', { x: 0.04, y: 0.04, z: 0.04 }, { x: -0.1, y: -0.4, z: -1.0 });
    const m5 = await loadModel('./assets/models/scene5.glb', { x: 0.04, y: 0.04, z: 0.04 });
    const m6 = await loadModel('./assets/models/scene6.glb', { x: 0.06, y: 0.06, z: 0.06 }, { x: 0, y: -1.0, z: 0 });
    const m7 = await loadModel('./assets/models/scene7.glb', { x: 0.02, y: 0.02, z: 0.02 }, { x: 0, y: -0.6, z: 0 });
    const m8 = await loadModel('./assets/models/scene8.glb', { x: 0.02, y: 0.02, z: 0.02 }, { x: 0, y: -0.5, z: 0 });
    const m9 = await loadModel('./assets/models/scene9.glb', { x: 0.02, y: 0.02, z: 0.02 }, { x: 0, y: -0.3, z: 0 });
    const m10 = await loadModel('./assets/models/scene10.glb', { x: 0.06, y: 0.06, z: 0.06 });

    // Set up all anchors
    const mix1 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m1, 0, './assets/audio/dusun/page1.mp3');
    const mix2 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m2, 1, './assets/audio/dusun/page2.mp3');
    const mix3 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m3, 2, './assets/audio/dusun/page3.mp3');
    const mix4 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m4, 3, './assets/audio/dusun/page4.mp3');
    const mix5 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m5, 4, './assets/audio/dusun/page5.mp3');
    const mix6 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m6, 5, './assets/audio/dusun/page6.mp3');
    const mix7 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m7, 6, './assets/audio/dusun/page7.mp3');
    const mix8 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m8, 7, './assets/audio/dusun/page8.mp3');
    const mix9 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m9, 8, './assets/audio/dusun/page9.mp3');
    const mix10 = await setupAnchorWithAutoAnimationAndAudio(mindarThree, m10, 9, './assets/audio/dusun/page10.mp3');

    const models = [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10];
    const mixers = [mix1, mix2, mix3, mix4, mix5, mix6, mix7, mix8, mix9, mix10];

    models.forEach((m, i) => {
        enableZoomAndRotation(camera, m);
        enablePlayOnInteraction(renderer, scene, camera, m, mixers[i]);
    });

    const startButton = document.querySelector("#startButton");
    
    // THE CAMERA TRIGGER: Wait for user click
    startButton.addEventListener("click", async () => {
      startButton.style.display = "none";
      try {
        await mindarThree.start(); // Triggers the permission prompt
        renderer.setAnimationLoop(() => {
          const delta = renderer.clock.getDelta();
          mixers.forEach(mix => mix.update(delta)); // Update all animations
          renderer.render(scene, camera);
        });
      } catch (err) {
        console.error("Camera failed:", err);
        alert("Camera access denied. Please allow camera in settings.");
      }
    });
  };
  start();
});