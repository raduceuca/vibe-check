import Lenis from 'https://unpkg.com/lenis@1.3.23/dist/lenis.mjs';
  import * as THREE from 'three';
  import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
  import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
  import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
  import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
  import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
  import { BloomPass } from 'three/addons/postprocessing/BloomPass.js';
  import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
  import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

  // #region Helpers

  const wrap = (value, min, max) => {
    const size = max - min;
    value = value % size;
    if (value < 0) value += size;
    return value + min;
  };

  const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  };

  const lerp = (a, b, t) => {
    return a + (b - a) * t;
  };

  const round = (value, step) => {
    return Math.round(value / step) * step;
  };

  const toArray = (item) => {
    if (Array.isArray(item)) return item;
    if (item instanceof NodeList || item instanceof HTMLCollection) return Array.from(item);
    else return [item];
  };

  const on = (els, events, callback) => {
    if (typeof els === 'string' || els instanceof String) {
      els = document.querySelectorAll(els);
    }
    toArray(els).forEach((el, i) => {
      events.split(' ').forEach((event) => {
        if (typeof el === 'object' && el.hasOwnProperty(event) && el[event].connect) el[event].connect(callback);
        else el.addEventListener(event, callback);
      });
    });
  };

  const off = (els, events, callback) => {
    if (typeof els === 'string' || els instanceof String) {
      els = document.querySelectorAll(els);
    }
    toArray(els).forEach((el, i) => {
      events.split(' ').forEach((event) => {
        if (typeof el === 'object' && el.hasOwnProperty(event) && el[event].disconnect) el[event].disconnect(callback);
        el.removeEventListener(event, callback);
      });
    });
  };

  const signal = () => {
    const callbacks = [];
    const connect = (callback) => callbacks.push(callback);
    const disconnect = (callback) => callbacks.splice(callbacks.indexOf(callback), 1);
    const emit = (data) => callbacks.forEach((callback) => callback(data));
    return { connect, disconnect, emit };
  };

  function debounce(callback, limit, isImmediate = false) {
    var timeout;
    return function () {
      var context = this,
        args = arguments;
      var later = function () {
        timeout = null;
        if (!isImmediate) callback.apply(context, args);
      };
      var callNow = isImmediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, limit);
      if (callNow) callback.apply(context, args);
    };
  }

  const closest = (items, goal, map, check) => {
    let dist = Infinity;
    let index = -1;
    if (!check) check = (goal, value, dist) => Math.abs(value - goal) < Math.abs(dist - goal);
    items.forEach((value, i) => {
      if (map) {
        value = map(value);
      }
      if (check(goal, value, dist)) {
        dist = value;
        index = i;
      }
    });
    return {
      diff: Math.abs(goal - dist),
      index,
    };
  };

  // #endregion Helpers
  // #region Device Profile

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const lowPower = isIOS || window.innerWidth < 1024;

  // #endregion Device Profile
  // #region Setup

  const app = {
    ready: signal(),
  };

  const lenis = new Lenis({
    autoRaf: false,
    infinite: true,
    syncTouch: true,
  });

  window.lenis = lenis;

  // #endregion Setup
  // #region Scroll

  const scroll = {
    position: 0,
  };

  scroll.wrapped = (position) => {
    return wrap(position, 0, lenis.dimensions.scrollHeight - lenis.dimensions.height);
  };

  scroll.to = (pos, options) => {
    if (pos !== 0) pos -= 10;
    lenis.scrollTo(pos, options);
  };

  scroll.distanceTo = (target, position = scroll.position) => {
    const min = position;
    const max = position - lenis.dimensions.scrollHeight + lenis.dimensions.height;
    if (Math.abs(max - target) < Math.abs(min - target)) return Math.abs(max - target);
    else return Math.abs(min - target);
  };

  lenis.on('scroll', (e) => {
    scroll.position = scroll.wrapped(lenis.animatedScroll);
  });

  scroll.snap = (position = scroll.position) => {
    if (window.innerWidth < 1024) return;
    const found = closest(section.items, position, (item) => item.top);
    if (found.index >= 0 && section.items[found.index].snap) scroll.to(section.items[found.index].top);
    else if (scroll.distanceTo(section.items[0].top, position) < section.items[0].height / 2) {
      scroll.to(section.items[0].top);
    }
  };

  on(
    window,
    'scroll',
    debounce(() => scroll.snap(), 250),
  );
  on(
    window,
    'scrollend',
    debounce(() => scroll.snap(), 50),
  );

  // #endregion Scroll
  // #region Carousel State

  const canLabels = ['assets/textures/V4/ciao-energy_texture_double-litchi.avif', 'assets/textures/V4/ciao-energy_texture_coco-citron-vert.avif', 'assets/textures/V4/ciao-energy_texture_Kiwi-Concombre.avif', 'assets/textures/V4/ciao-energy_texture_peche-blanche.avif', 'assets/textures/V4/ciao-energy_texture_pomme-rhubarbe.avif', 'assets/textures/V4/ciao-energy_texture_abricot_framboise.avif'];

  const cans = [];

  let carousel = {
    spacing: 3.5,
    target: -1.5,
    position: -1.5,
    index: 0,
    lastIndex: 0,
    lastPosition: -1.5,
    delta: 0,
    offset: canLabels.length % 2 === 0 ? 0 : 1.5,
  };

  carousel.getRounded = () => {
    return round(carousel.target + carousel.offset, carousel.spacing) - carousel.offset;
  };

  carousel.getIndex = (wrapped = true) => {
    const index = round((carousel.position + carousel.offset) / carousel.spacing, 1);
    if (wrapped) return wrap(index, 0, canLabels.length);
    return index;
  };

  carousel.goTo = (index) => {
    const target = index * carousel.spacing - carousel.offset;
    carousel.target = target;
  };

  carousel.previous = () => {
    carousel.goTo(carousel.getIndex(false) - 1);
  };

  carousel.next = () => {
    carousel.goTo(carousel.getIndex(false) + 1);
  };

  carousel.changed = signal();
  carousel.indexChanged = carousel.changed;

  window.carousel = carousel;

  // #endregion Carousel State
  // #region Camera

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);

  // #endregion Camera
  // #region Renderer

  const mainEl = document.querySelector('main');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  // DPR 2 sur mobile : net (le crénelage venait du DPR 1 + SMAA coupé), tout en restant ~44% des pixels natifs.
  let pixelRatio = lowPower ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.5);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);

  THREE.ColorManagement.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  mainEl.appendChild(renderer.domElement);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  // #endregion Renderer
  // #region Environment

  const pink = new THREE.Color(0xffffff);
  const white = new THREE.Color(0xffffff);

  const tint = {
    color: { value: pink },
    strength: { value: 1 },
  };

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const hdriLoader = new RGBELoader();
  hdriLoader.load('assets/webgl/hdri2.hdr', function (texture) {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    texture.dispose();
    scene.environment = envMap;
  });

  const environment = {
    setColor: async (color1, color2) => {
      tint.color.value = new THREE.Color(color1);
      document.documentElement.style.setProperty('--tint1', color1);
      if (color2) document.documentElement.style.setProperty('--tint2', color2);
    },
  };

  function applyEnvironmentTint(material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.tintColor = tint.color;
      shader.uniforms.tintStrength = tint.strength;
      shader.fragmentShader =
        `
		uniform vec3 tintColor;
		uniform float tintStrength;
		` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        `
		#include <lights_fragment_end>
		reflectedLight.indirectDiffuse *= tintColor * tintStrength;
		reflectedLight.indirectSpecular *= tintColor * tintStrength;
		`,
      );
      material.userData.shader = shader;
    };
  }

  // #endregion Environment
  // #region Material Factory

  // Sur mobile : Standard (pas de clearcoat/sheen) → fragment shader bien plus léger.
  const makeMaterial = (params) => {
    if (lowPower) {
      const { clearcoat, clearcoatRoughness, sheen, sheenRoughness, sheenColor, ior, reflectivity, ...std } = params;
      return new THREE.MeshStandardMaterial(std);
    }
    return new THREE.MeshPhysicalMaterial(params);
  };

  // #endregion Material Factory
  // #region Lights

  const color = white;

  const spot1Intensity = 50;
  const spot1Distance = 8;
  const spot1 = new THREE.SpotLight(white, spot1Intensity, spot1Distance, Math.PI / 4, 1, 0.1);
  spot1.position.set(0, 3.5, 0);
  spot1.target.position.set(0, 0, 1);
  scene.add(spot1);
  scene.add(spot1.target);

  const spot2Intensity = 50;
  const spot2Distance = 8;
  const spot2 = new THREE.SpotLight(white, spot2Intensity, spot2Distance, Math.PI / 3, 1, 0.1);
  spot2.position.set(0, -3, 2);
  spot2.target.position.set(0, 0, 1.8);
  scene.add(spot2);
  scene.add(spot2.target);

  const spot3Intensity = 0;
  const spot3Distance = 15;
  const spot3 = new THREE.SpotLight(white, spot3Intensity, spot3Distance, Math.PI / 8, 1, 0.1);
  spot3.map = new THREE.TextureLoader().load('https://cdn.prod.website-files.com/69fb53371d5b8e9c3f4e4c69/6a0dda5d7623b3bbf4dd327a_72448b0503e6054a4c92df14f52d7eef_spot-mask.avif');
  spot3.position.set(0, 3, 5);
  spot3.target.position.set(0, 0.5, 0);
  scene.add(spot3);
  scene.add(spot3.target);

  const renderPass = new RenderPass(scene, camera);

  // #endregion Lights
  // #region Passes

  const resolution = new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5);
  const bloomPass = new UnrealBloomPass(resolution, 0.1, 0.1, 1);
  const smaaPass = new SMAAPass();
  const outputPass = new OutputPass();

  // #endregion Passes
  // #region Composers

  const finalRenderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth * pixelRatio,
    window.innerHeight * pixelRatio,
    {
      type: lowPower ? THREE.UnsignedByteType : THREE.HalfFloatType,
      samples: 0,
    },
  );
  const finalComposer = new EffectComposer(renderer, finalRenderTarget);
  finalComposer.addPass(renderPass);
  if (!lowPower) finalComposer.addPass(bloomPass);
  finalComposer.addPass(outputPass);
  if (!lowPower) finalComposer.addPass(smaaPass);

  // #endregion Composers
  // #region Base

  const gltfLoader = new GLTFLoader();

  const darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
  const baseMaterial = makeMaterial({
    color: 0xababab,
    metalness: 0.9,
    roughness: 0.3,
    sheen: 0.3,
    sheenRoughness: 0.2,
    sheenColor: 0xffffff,
    reflectivity: 1,
    ior: 2,
    envMapIntensity: 0.1,
  });
  applyEnvironmentTint(baseMaterial);

  const baseGltf = await gltfLoader.loadAsync('assets/webgl/base.glb');
  baseGltf.scene.traverse((child) => {
    if (!child.isMesh) return;
    child.material = baseMaterial;
  });
  const base = baseGltf.scene;
  scene.add(base);

  // #endregion Base
  // #region Cans

  const canGltf = await gltfLoader.loadAsync('assets/webgl/can.glb');

  const canMetallic = new THREE.TextureLoader().load('https://cdn.prod.website-files.com/69fb53371d5b8e9c3f4e4c69/6a0edb0e83db8ea830f2875d_5b37bb5107a2849b546a7b5d4bd06ef4_can-metallic-2.avif');

  const canMaterial = makeMaterial({
    color: 0x555555,
    metalness: 0.9,
    roughness: 0.2,
    sheen: 0.8,
    sheenRoughness: 0.2,
    sheenColor: 0xffffff,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    reflectivity: 1,
    ior: 2,
    metalnessMap: canMetallic,
    envMapIntensity: 3,
  });

  canGltf.scene.traverse((child) => {
    if (!child.isMesh) return;
    if (child.name != 'Shell') {
      child.material = canMaterial;
    }
    applyEnvironmentTint(child.material);
  });

  const createCan = async (image, index) => {
    const can = canGltf.scene.clone();
    const texture = await new THREE.TextureLoader().loadAsync(image);
    texture.colorSpace = THREE.SRGBColorSpace;

    const labelMaterial = makeMaterial({
      color: 0xababab,
      metalness: 0.9,
      roughness: 0.2,
      sheen: 0.05,
      sheenRoughness: 0.125,
      sheenColor: 0xffffff,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
      reflectivity: 1,
      ior: 2,
      map: texture,
      metalnessMap: canMetallic,
      envMapIntensity: 1,
    });

    applyEnvironmentTint(labelMaterial);

    can.traverse((child) => {
      if (!child.isMesh) return;
      if (child.name == 'Shell') {
        child.material = labelMaterial;
        child.material.needsUpdate = true;
      }
    });

    scene.add(can);
    can.rotation.z = (Math.PI / 360) * 45;
    return can;
  };

  const duplicateCan = (item) => {
    const can = item.clone();
    scene.add(can);
    return can;
  };

  const promises = [];
  canLabels.forEach((image, i) => {
    promises.push(createCan(image, i));
  });

  await Promise.all(promises).then((items) => {
    items.forEach((item) => {
      cans.push(item);
    });

    const targetCount = lowPower ? 12 : 24;
    let i = 0;
    if (cans.length !== 0) {
      while (cans.length < targetCount) {
        cans.push(duplicateCan(cans[i % canLabels.length]));
        i++;
      }
    }
  });

  // #endregion Cans
  // #region Raycaster

  const raycast = new THREE.Raycaster();
  on(window, 'click', (e) => {
    if (pointer.prevent || swipe.direction != 0 || scroll.position > section.items[1].top) return;
    const mouse = new THREE.Vector2();
    mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1;

    raycast.setFromCamera(mouse, camera);

    cans.forEach((can, i) => {
      if (raycast.intersectObject(can).length > 0) {
        const delta = Math.round(can.position.x / carousel.spacing);

        if (delta > 0) carousel.next();
        if (delta < 0) carousel.previous();
        if (delta == 0)
          scroll.to(section.items[1].top, {
            duration: wheelPager.slowIndexes.includes(0) ? wheelPager.durationSlow : wheelPager.durationFast,
            easing: (t) => 1 - Math.pow(1 - t, 3),
          });
      }
    });
  });

  // #endregion Raycaster
  // #region Cursor

  const isInGamme = () => {
    return scroll.position < section.items[1].top;
  };

  on(window, 'mousemove', (e) => {
    if (!isInGamme()) {
      document.body.style.cursor = '';
      return;
    }

    if (swipe.holding && swipe.direction === 1) {
      document.body.style.cursor = 'grabbing';
      return;
    }

    const mouse = new THREE.Vector2();
    mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1;
    raycast.setFromCamera(mouse, camera);

    let hoverActive = false;
    cans.forEach((can, i) => {
      if (raycast.intersectObject(can).length > 0) {
        const canIndex = i % canLabels.length;
        if (canIndex === carousel.index) hoverActive = true;
      }
    });

    document.body.style.cursor = hoverActive ? 'pointer' : 'grab';
  });

  on(window, 'mouseup touchend', () => {
    if (isInGamme()) document.body.style.cursor = 'grab';
  });

  // #endregion Cursor
  // #region Sections

  const section = {
    items: [],
  };

  section.getIndex = () => {
    return closest(section.items, scroll.position, (item) => item.top).index;
  };

  section.previous = () => {
    const index = section.getIndex();
    section.goTo(index - 1);
  };

  section.next = () => {
    const index = section.getIndex();
    section.goTo(index + 1);
  };

  section.goTo = (index) => {
    scroll.to(section.items[index % (section.items.length - 1)].top);
  };

  section.resize = () => {
    section.items.length = 0;
    let top = 0;
    document.querySelectorAll('section').forEach((el, i) => {
      const height = el.clientHeight;
      let snap = i < 2;
      if (window.innerWidth < 1024) {
        snap = i < 6;
      }
      section.items.push({
        el: el,
        top: top,
        height: height,
        snap: snap,
      });
      top += height;
    });
  };

  section.resize();

  // #endregion Sections
  // #region Swipe State
  // IMPORTANT : `swipe` doit être déclaré AVANT createTimeline(), car la timeline
  // référence `swipe` via tl.set(swipe, {active}). Sinon :
  // ReferenceError: Cannot access 'swipe' before initialization.
  // swipe.active est piloté par la timeline (mécanisme du collègue) ; pas de listener scroll concurrent.

  const swipe = {
    active: true,
    holding: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    deltaX: 0,
    deltaY: 0,
    direction: 0,
  };

  // #endregion Swipe State
  // #region Timeline

  const data = {
    camPosX: 0,
    camPosY: 0,
    camPosZ: 29,
    camRotX: 0,
    camRotY: 0,
    camRotZ: 0,
    fov: 20,
    canScale: 1,
    canPosX: 0,
    canPosY: 0,
    canPosZ: 0,
    canRotX: 0,
    canRotY: 0,
    canRotZ: 0,
    canSpin: 0,
    spacing: 1,
    wave: 1,
    swirl: 0,
    baseOffset: 0,
    lightIntensity: 50,
    lightWidth: 1,
    tintStrength: 1,
    spotIntensity: 0,
    spotY: 3,
    pointerInfluence: 0.2,
    swipeSpeed: 1,
  };

  const startData = JSON.parse(JSON.stringify(data));

  const createTimeline = () => {
    let i = 0;
    const tl = gsap.timeline({
      defaults: {
        ease: 'power1.inOut',
      },
    });

    // Taste
    tl.to(data, {
      camPosX: 0,
      camPosY: 0,
      camPosZ: 6,
      camRotX: 0,
      camRotY: 0,
      camRotZ: 0,
      fov: 40,
      canScale: 1,
      canPosX: 0.5,
      canPosY: -0.5,
      canPosZ: 0,
      canRotX: (Math.PI / 180) * -37.5,
      canRotY: (Math.PI / 180) * 15,
      canRotZ: (Math.PI / 180) * 22.5,
      canSpin: 0,
      spacing: 3.5,
      wave: 0,
      swirl: 0,
      baseOffset: 3,
      lightIntensity: 30,
      lightWidth: 1,
      tintStrength: 1,
      spotIntensity: 0,
      spotY: 3,
      pointerInfluence: 0.2,
      swipeSpeed: 1,
      duration: section.items[i].height / lenis.dimensions.scrollHeight,
    });
    i += 1;

    tl.set(swipe, { active: false });

    // Advantage 1
    tl.to(data, {
      camPosX: 0,
      camPosY: -2,
      camPosZ: 12,
      camRotX: (Math.PI / 180) * 10,
      camRotY: 0,
      camRotZ: (Math.PI / 180) * -10,
      fov: 20,
      canScale: 1,
      canPosX: 0,
      canPosY: -0.8,
      canPosZ: 0,
      canRotX: 0,
      canRotY: 0,
      canRotZ: 0,
      canSpin: (Math.PI / 180) * 120,
      spacing: 2.2,
      wave: 0,
      swirl: 0,
      baseOffset: 3,
      lightIntensity: 0,
      lightWidth: 1,
      tintStrength: 0.2,
      spotIntensity: 35,
      spotY: 2.2,
      pointerInfluence: 0,
      swipeSpeed: 1,
      duration: section.items[i].height / lenis.dimensions.scrollHeight,
    });
    i += 1;

    // Advantage 2
    tl.to(data, {
      camPosX: 0,
      camPosY: -2,
      camPosZ: 12,
      camRotX: (Math.PI / 180) * 10,
      camRotY: 0,
      camRotZ: (Math.PI / 180) * 5,
      fov: 20,
      canScale: 1,
      canPosX: 0,
      canPosY: -0.48,
      canPosZ: 0,
      canRotX: 0,
      canRotY: 0,
      canRotZ: 0,
      canSpin: (Math.PI / 180) * 130,
      spacing: 2.2,
      wave: 0,
      swirl: 0,
      baseOffset: 3,
      lightIntensity: 0,
      lightWidth: 1,
      tintStrength: 0.2,
      spotIntensity: 35,
      spotY: 2.2,
      pointerInfluence: 0,
      swipeSpeed: 1,
      duration: section.items[i].height / lenis.dimensions.scrollHeight,
    });
    i += 1;

    // Advantage 3
    tl.to(data, {
      camPosX: 0,
      camPosY: -2,
      camPosZ: 12,
      camRotX: (Math.PI / 180) * 10,
      camRotY: 0,
      camRotZ: (Math.PI / 180) * -10,
      fov: 20,
      canScale: 1,
      canPosX: 0,
      canPosY: 0.02,
      canPosZ: 0,
      canRotX: 0,
      canRotY: 0,
      canRotZ: 0,
      canSpin: (Math.PI / 180) * 120,
      spacing: 2.2,
      wave: 0,
      swirl: 0,
      baseOffset: 3,
      lightIntensity: 0,
      lightWidth: 1,
      tintStrength: 0.2,
      spotIntensity: 35,
      spotY: 2.2,
      pointerInfluence: 0,
      swipeSpeed: 1,
      duration: section.items[i].height / lenis.dimensions.scrollHeight,
    });
    i += 1;

    // Advantage 4
    tl.to(data, {
      camPosX: 0,
      camPosY: -2,
      camPosZ: 12,
      camRotX: (Math.PI / 180) * 10,
      camRotY: 0,
      camRotZ: (Math.PI / 180) * 5,
      fov: 20,
      canScale: 1,
      canPosX: 0,
      canPosY: 0.5,
      canPosZ: 0,
      canRotX: 0,
      canRotY: 0,
      canRotZ: 0,
      canSpin: (Math.PI / 180) * 130,
      spacing: 2.2,
      wave: 0,
      swirl: 0,
      baseOffset: 3,
      lightIntensity: 0,
      lightWidth: 1,
      tintStrength: 0.2,
      spotIntensity: 35,
      spotY: 2.2,
      pointerInfluence: 0,
      swipeSpeed: 1,
      duration: section.items[i].height / lenis.dimensions.scrollHeight,
    });
    i += 1;

    // No bullshit
    tl.to(data, {
      camPosX: 0,
      camPosY: 0,
      camPosZ: 8,
      camRotX: 0,
      camRotY: 0,
      camRotZ: 0,
      fov: 45,
      canScale: 1,
      canPosX: 0,
      canPosY: 0,
      canPosZ: -0.5,
      canRotX: (Math.PI / 180) * -20,
      canRotY: 0,
      canRotZ: (Math.PI / 180) * -5,
      canSpin: 0,
      spacing: 5,
      wave: 0,
      swirl: 0,
      baseOffset: 3,
      lightIntensity: 45,
      lightWidth: 1.5,
      tintStrength: 2,
      spotIntensity: 0,
      spotY: 3,
      pointerInfluence: 0.2,
      swipeSpeed: 1,
      duration: section.items[i].height / lenis.dimensions.scrollHeight,
    });
    i += 1;

    tl.set(swipe, { active: true });

    // Packshot
    tl.to(data, {
      camPosX: -3,
      camPosY: -3.5,
      camPosZ: 20,
      camRotX: (Math.PI / 180) * 10,
      camRotY: (Math.PI / 180) * -9,
      camRotZ: (Math.PI / 180) * -10,
      fov: 30,
      canScale: 1,
      canPosX: 0,
      canPosY: 0,
      canPosZ: -0.4,
      canRotX: 0,
      canRotY: 0,
      canRotZ: 0,
      canSpin: 0,
      spacing: 0.47,
      wave: 0,
      swirl: 1,
      baseOffset: 20,
      lightIntensity: 10,
      lightWidth: 3,
      tintStrength: 2,
      spotIntensity: 0,
      spotY: 3,
      pointerInfluence: 0,
      swipeSpeed: 2,
      duration: section.items[i].height / lenis.dimensions.scrollHeight,
    });
    i += 1;

    // Move offscreen
    tl.to(data, {
      camPosX: 0,
      camPosY: -5.5,
      camPosZ: 10,
      camRotX: 0,
      camRotY: 0,
      camRotZ: 0,
      fov: 30,
      canScale: 1,
      canPosX: 0,
      canPosY: 0,
      canPosZ: -0.4,
      canRotX: 0,
      canRotY: 0,
      canRotZ: 0,
      canSpin: 0,
      spacing: 0.6,
      wave: 0,
      swirl: 1,
      baseOffset: 20,
      lightIntensity: 0,
      lightWidth: 3,
      spotIntensity: 0,
      spotY: 3,
      pointerInfluence: 0,
      swipeSpeed: 1,
      duration: section.items[i].height / lenis.dimensions.scrollHeight,
    });
    i += 1;

    tl.set(swipe, { active: false });

    // Téléport : cam saute en haut
    tl.set(data, {
      camPosX: 0,
      camPosY: 8,
      camPosZ: 10,
      camRotX: 0,
      camRotY: 0,
      camRotZ: 0,
      fov: 20,
      spacing: 5,
      swirl: 0,
    });

    // Return on screen
    tl.to(data, {
      camPosX: 0,
      camPosY: 0,
      camPosZ: 29,
      camRotX: 0,
      camRotY: 0,
      camRotZ: 0,
      fov: 20,
      canScale: 1,
      canPosX: 0,
      canPosY: 0,
      canPosZ: 0.5,
      canRotX: 0,
      canRotY: 0,
      canRotZ: 0,
      canSpin: (Math.PI / 180) * 20,
      spacing: 5,
      wave: 0,
      swirl: 0,
      baseOffset: 10,
      lightIntensity: 50,
      lightWidth: 1,
      tintStrength: 1,
      spotIntensity: 0,
      spotY: 3,
      pointerInfluence: 0.2,
      swipeSpeed: 1,
      duration: section.items[i].height / lenis.dimensions.scrollHeight,
    });
    i += 1;

    // Loop : retour aux valeurs initiales pour boucle infinie
    tl.to(data, {
      ...startData,
      duration: section.items[i] ? section.items[i].height / lenis.dimensions.scrollHeight : 1,
    });

    tl.pause();
    return tl;
  };

  let timeline = createTimeline();

  // #endregion Timeline
  // #region Loader

  const loader = {
    complete: false,
    timeline: null,
    callbacks: [],
    ended: signal(),
  };

  loader.play = async () => {
    if (loader.timeline) loader.timeline.kill();

    lenis.scrollTo(0, { immediate: true });
    lenis.stop();
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    animation.paused = true;
    swipe.active = false;
    pointer.prevent = true;

    const tl = gsap.timeline({
      defaults: {
        ease: 'power4.out',
        duration: 2.5,
      },
    });

    carousel.target = carousel.offset;
    carousel.position = carousel.offset;

    tl.set(data, {
      camPosZ: 25,
      spacing: 10,
      baseOffset: 3,
      wave: 0,
      swirl: 0,
      lightWidth: 2,
      lightIntensity: 0,
      canSpin: (Math.PI / 180) * 20,
      pointerInfluence: 0,
    });

    tl.to(
      data,
      {
        lightIntensity: 30,
      },
      0,
    );

    tl.to(
      data,
      {
        camPosZ: 29,
      },
      1,
    );

    tl.to(data, startData, 2);

    loader.timeline = tl;

    // Attente robuste : durée effective + plancher de sécurité (await tl direct est peu fiable).
    const animMs = Math.max(tl.duration() * 1000, 2500);
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      tl.eventCallback('onComplete', finish);
      setTimeout(finish, animMs);
    });

    lenis.start();
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    pointer.prevent = false;
    swipe.active = true;
    animation.paused = false;

    // resync du garde-fou pour éviter un faux déclenchement juste après le loader
    loopGuard.lastPos = scroll.position;
    loopGuard.snapping = false;

    loader.ended.emit();
  };

  // #endregion Loader
  // #region Animation

  const animation = {
    paused: false,
  };

  // Flag DÉDIÉ à la perte de contexte WebGL — distinct de animation.paused.
  // animation.paused fige le lerp carousel pendant le loader, mais le rendu doit
  // CONTINUER pour qu'on voie l'anim d'intro. Seul contextLost coupe le render.
  let contextLost = false;

  // Gestion de la perte/restauration du contexte WebGL (crucial sur iOS, mémoire limitée)
  renderer.domElement.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      console.warn('WebGL context lost — pause du rendu');
      contextLost = true;
    },
    false,
  );
  renderer.domElement.addEventListener(
    'webglcontextrestored',
    () => {
      console.warn('WebGL context restored — reprise');
      contextLost = false;
    },
    false,
  );

  const loopGuard = {
    lastPos: 0,
    snapping: false,
    timer: null,
  };

  let time = 0;
  function animate(tick = 0) {
    var delta = tick / 1000 - time;
    requestAnimationFrame(animate);
    time = tick / 1000;

    // Clamp Lenis (empêche scroll vers le haut au-delà de 0)
    if (lenis.targetScroll < 0) {
      lenis.targetScroll = 0;
      lenis.animatedScroll = 0;
      if (lenis.animate) lenis.animate.to = 0;
    }

    lenis.raf(time * 1000);

    // Garde-fou de bouclage (scroll infini : fin -> début), arrêt net sur la gamme.
    {
      const total = lenis.dimensions.scrollHeight - lenis.dimensions.height;
      const prev = loopGuard.lastPos;
      const cur = scroll.position;
      if (pointer.prevent) {
        loopGuard.lastPos = cur;
      } else {
        if (total > 0 && prev - cur > total * 0.6 && !loopGuard.snapping) {
          loopGuard.snapping = true;
          scroll.to(section.items[0].top, {
            duration: 1.2,
            lock: true,
            easing: (t) => 1 - Math.pow(1 - t, 3),
          });
          clearTimeout(loopGuard.timer);
          loopGuard.timer = setTimeout(() => (loopGuard.snapping = false), 1300);
        }
        loopGuard.lastPos = cur;
      }
    }

    const minX = cans.length * -0.5 * carousel.spacing;
    const maxX = cans.length * 0.5 * carousel.spacing;
    const size = maxX - minX;

    carousel.target -= swipe.deltaX * 0.02 * data.swipeSpeed;
    swipe.deltaX = 0;

    // Pointer smoothing
    pointer.smoothX = lerp(pointer.smoothX, pointer.x, delta * 10);
    pointer.smoothY = lerp(pointer.smoothY, pointer.y, delta * 10);

    if (!animation.paused) {
      if (!swipe.holding) carousel.target = carousel.getRounded(carousel.target);
      carousel.position = lerp(carousel.position, carousel.target, delta * 10);
    }

    camera.fov = data.fov;
    camera.updateProjectionMatrix();

    carousel.delta = carousel.position - carousel.lastPosition;
    const index = carousel.getIndex();
    if (index !== carousel.lastIndex) {
      carousel.changed.emit({ index, previous: carousel.lastIndex });
      carousel.lastIndex = index;
    }
    carousel.index = index;

    const p0 = clamp(scroll.distanceTo(0) / section.items[0].height, 0, 1);
    timeline.seek(scroll.position / lenis.dimensions.scrollHeight);

    // ====== ANIM CANNETTES ======
    const windowRatio = clamp(1440 / lenis.dimensions.scrollWidth, 1, 2.4);
    const wave = windowRatio * 0.25 * (1 - p0) * data.wave;

    cans.forEach((can, i) => {
      var target = i * carousel.spacing - carousel.position;
      const x = wrap(target, minX, maxX);

      // Carousel
      let p = clamp(1 - Math.abs(x) / carousel.spacing, 0, 1);
      const p1 = Math.min(p, p0);
      let canScale = 1.2;
      let canPosX = x * data.spacing;
      let canPosY = Math.sin(canPosX * wave);
      let canPosZ = (Math.abs(x) * -1 - 0.2) * data.wave;
      let canRotX = (-Math.PI / 180) * 20 * data.wave;
      let canRotY = (canPosX * 0.5 - (Math.PI / 180) * 20) * data.wave;
      let canRotZ = (Math.PI / 360) * 22.5 * data.wave;

      // Packshot (swirl)
      canRotX = lerp(canRotX, x * 0.06 * windowRatio + 0.2, data.swirl);

      // Lerp to data
      canScale = lerp(canScale, data.canScale, p0);
      canPosY = lerp(canPosY, data.canPosY, p0);
      canPosZ = lerp(canPosZ, data.canPosZ, p0);
      canRotX = canRotX + data.canRotX;
      canRotY = lerp(canRotY, data.canRotY, p1);
      canRotZ = lerp(canRotZ, data.canRotZ, p1);

      // Apply
      can.position.x = canPosX;
      can.position.y = canPosY;
      can.position.z = canPosZ;
      can.rotation.x = canRotX;
      can.rotation.y = canRotY;
      can.rotation.z = canRotZ;
      can.scale.set(canScale, canScale, canScale);

      // Mouse interaction
      can.rotation.y += (pointer.smoothX / 1280) * data.pointerInfluence * p;
      can.rotation.x += (pointer.smoothY / 1280) * data.pointerInfluence * p;

      can.material = canMaterial;

      can.children.forEach((child, i) => {
        if (child.isMesh) {
          child.rotation.z = can.rotation.y * 0.6 + data.canSpin * p;
        }
      });
    });
    // ====== FIN ANIM CANNETTES ======

    base.children[0].position.y = -1 * data.baseOffset;
    base.children[1].position.y = 1 * data.baseOffset;

    camera.position.x = data.camPosX;
    camera.position.y = data.camPosY;
    camera.position.z = data.camPosZ;
    camera.rotation.x = data.camRotX;
    camera.rotation.y = data.camRotY;
    camera.rotation.z = data.camRotZ;

    spot1.intensity = data.lightIntensity;
    spot1.angle = (Math.PI / 4) * data.lightWidth;
    spot2.intensity = data.lightIntensity;
    spot2.angle = (Math.PI / 4) * data.lightWidth;
    spot3.intensity = data.spotIntensity;

    spot3.position.set(0, data.spotY, 2);
    spot3.target.position.set(0, data.spotY - 2.5, 0);

    tint.strength.value = data.tintStrength;

    // Ne pas rendre UNIQUEMENT si le contexte WebGL est perdu (pas pendant le loader).
    if (!contextLost) finalComposer.render();

    carousel.lastPosition = carousel.position;
  }

  // #endregion Animation
  // #region Pointer

  const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    smoothX: window.innerWidth / 2,
    smoothY: window.innerHeight / 2,
    prevent: true,
  };

  // Blocage dur du scroll pendant le loader (wheel + touchmove coupés à la source).
  const blockScrollWhilePrevented = (e) => {
    if (pointer.prevent) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  window.addEventListener('wheel', blockScrollWhilePrevented, { passive: false, capture: true });
  window.addEventListener('touchmove', blockScrollWhilePrevented, { passive: false, capture: true });

  on(window, 'mousemove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });

  // #endregion Pointer
  // #region Swipe

  on(renderer.domElement, 'mousedown touchstart', (e) => {
    if (!swipe.active || pointer.prevent) return;
    swipe.holding = true;
    swipe.deltaX = 0;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    swipe.startX = x;
    swipe.lastX = x;
    swipe.startY = y;
    swipe.lastY = y;
  });

  on(window, 'mousemove touchmove', (e) => {
    if (!swipe.active || !swipe.holding || pointer.prevent) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = x - swipe.lastX;
    const deltaY = y - swipe.lastY;
    if (swipe.direction == 0) {
      if (Math.abs(swipe.startX - x) > 2 || Math.abs(swipe.startY - y) > 2) {
        swipe.direction = Math.abs(deltaX) > Math.abs(deltaY) ? 1 : 2;
      }
    }
    if (swipe.direction == 1) {
      swipe.lastX = x;
      swipe.deltaX += deltaX;
      lenis.stop();
      if (e.touches) {
        document.body.style.overflow = 'hidden';
      }
    }
  });

  on(window, 'mouseup touchend', (e) => {
    if (!swipe.holding) return;
    setTimeout(() => {
      swipe.deltaX *= 8;
      swipe.holding = false;
      swipe.direction = 0;
      lenis.start();
      document.body.style.overflow = '';
    });
  });

  // #endregion Swipe
  // #region Mobile Paging

  const paging = {
    startX: 0,
    startY: 0,
    anchor: 0,
    axis: 0,
    active: false,
    threshold: 24,
    lastSnap: 7,
  };

  const isMobile = () => window.innerWidth < 1024;

  on(window, 'touchstart', (e) => {
    if (!isMobile() || pointer.prevent) return;
    paging.startX = e.touches[0].clientX;
    paging.startY = e.touches[0].clientY;
    paging.axis = 0;
    paging.anchor = closest(section.items, scroll.position, (item) => item.top).index;
    paging.active = paging.anchor <= paging.lastSnap;
  });

  window.addEventListener(
    'touchmove',
    (e) => {
      if (!isMobile() || pointer.prevent || !paging.active) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      if (paging.axis === 0) {
        const dx = Math.abs(x - paging.startX);
        const dy = Math.abs(y - paging.startY);
        if (dx > 2 || dy > 2) paging.axis = dx > dy ? 1 : 2;
      }
      if (paging.axis === 2) {
        e.preventDefault();
        lenis.stop();
      }
    },
    { passive: false },
  );

  on(window, 'touchend', (e) => {
    if (!isMobile() || pointer.prevent || !paging.active || paging.axis !== 2) return;
    const endY = (e.changedTouches && e.changedTouches[0].clientY) || paging.startY;
    const delta = endY - paging.startY;

    let target = paging.anchor;
    if (Math.abs(delta) > paging.threshold) {
      target = paging.anchor + (delta < 0 ? 1 : -1);
    }
    target = clamp(target, 0, section.items.length - 1);

    lenis.start();
    scroll.to(section.items[target].top, {
      duration: 1.5,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });

    paging.active = false;
    paging.axis = 0;
  });

  // #endregion Mobile Paging
  // #region Desktop Paging

  const ENABLE_DESKTOP_PAGING = true;

  const wheelPager = {
    locked: false,
    lastSnap: 6,
    durationSlow: 1.5,
    durationFast: 1,
    slowIndexes: [0, 1, 5, 6],
    cooldown: 0,
  };

  let wheelTimer;
  window.addEventListener(
    'wheel',
    (e) => {
      if (!ENABLE_DESKTOP_PAGING || pointer.prevent) return;

      const anchor = closest(section.items, scroll.position, (item) => item.top).index;
      if (anchor > wheelPager.lastSnap) return;
      e.preventDefault();
      if (wheelPager.locked) return;
      if (Math.abs(e.deltaY) < 4) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const target = clamp(anchor + dir, 0, section.items.length - 1);
      if (target === anchor) return;
      const duration = wheelPager.slowIndexes.includes(anchor) ? wheelPager.durationSlow : wheelPager.durationFast;
      wheelPager.locked = true;
      scroll.to(section.items[target].top, {
        duration,
        lock: true,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => (wheelPager.locked = false), duration * 1000 + wheelPager.cooldown);
    },
    { passive: false },
  );

  // #endregion Desktop Paging
  // #region Resize

  animate();

  let lastResizeWidth = window.innerWidth;

  on(window, 'resize', () => {
    if (window.innerWidth === lastResizeWidth) return;
    lastResizeWidth = window.innerWidth;

    console.log(`resize`);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    finalComposer.setSize(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);

    section.resize();
    timeline = createTimeline();
  });

  lenis.scrollTo(0, { immediate: true });

  window.loader = loader;

  // #endregion Resize
  // #region Scroll Indicator

  const indicator = {
    el: document.querySelector('.scroll_indicator'),
    set: null,
  };

  if (indicator.el) {
    gsap.set(indicator.el, { '--p': 0 });

    indicator.set = gsap.quickTo(indicator.el, '--p', {
      duration: 0.3,
      ease: 'power3.out',
    });

    lenis.on('scroll', () => {
      const max = lenis.dimensions.scrollHeight - lenis.dimensions.height;
      const progress = max > 0 ? scroll.position / max : 0;
      indicator.set(progress);
    });
  }

  // Signal pour ton code Webflow externe
  window.__sceneReady = true;
  window.dispatchEvent(new CustomEvent('carousel:ready', { detail: carousel }));

  // #endregion Scroll Indicator
