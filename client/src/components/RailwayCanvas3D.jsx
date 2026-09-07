import { useEffect, useRef, useState } from 'react';

/**
 * RailwayCanvas3D
 * ---------------
 * Pure Three.js scene strictly using Blue, Black, and White palette.
 * Renders an animated futuristic railway environment with floating locomotive.
 */
export default function RailwayCanvas3D({ className = '', height = '100%' }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [error, setError] = useState(false);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReduced) return;
    if (!mountRef.current) return;

    let renderer, camera, scene, frameId;
    let mounted = true;

    const init = async () => {
      try {
        const THREE = await import('three');

        const container = mountRef.current;
        const W = container.clientWidth || 800;
        const H = container.clientHeight || 500;

        // ── Renderer ──────────────────────────────────────────────────
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(W, H);
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        // ── Scene ──────────────────────────────────────────────────────
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000000, 0.035);
        sceneRef.current = scene;

        // ── Camera ─────────────────────────────────────────────────────
        camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 200);
        camera.position.set(0, 4, 12);
        camera.lookAt(0, 0, 0);

        // ── Ambient Light (Deep Midnight Blue) ─────────────────────────
        const ambientLight = new THREE.AmbientLight(0x0f172a, 3.0);
        scene.add(ambientLight);

        // ── Blue & Pure White Point Lights ─────────────────────────────
        const blueLight1 = new THREE.PointLight(0x2563eb, 5, 35);
        blueLight1.position.set(-8, 6, 4);
        scene.add(blueLight1);

        const blueLight2 = new THREE.PointLight(0x3b82f6, 4, 30);
        blueLight2.position.set(8, 4, -4);
        scene.add(blueLight2);

        const whiteLight = new THREE.PointLight(0xffffff, 2.5, 20);
        whiteLight.position.set(0, 3, 8);
        scene.add(whiteLight);

        // ── Rail Tracks ────────────────────────────────────────────────
        const trackGroup = new THREE.Group();

        // Two steel rails
        const railGeo = new THREE.BoxGeometry(0.12, 0.1, 40);
        const railMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          metalness: 0.95,
          roughness: 0.15,
        });

        [-0.9, 0.9].forEach((x) => {
          const rail = new THREE.Mesh(railGeo, railMat);
          rail.position.set(x, 0, 0);
          rail.receiveShadow = true;
          trackGroup.add(rail);
        });

        // Sleepers (Black & Blue tinted ties)
        const sleeperGeo = new THREE.BoxGeometry(2.4, 0.08, 0.25);
        const sleeperMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.8,
          metalness: 0.2,
        });

        for (let i = -18; i <= 18; i += 1.2) {
          const sleeper = new THREE.Mesh(sleeperGeo, sleeperMat);
          sleeper.position.set(0, -0.06, i);
          sleeper.receiveShadow = true;
          trackGroup.add(sleeper);
        }

        trackGroup.position.y = -1.2;
        scene.add(trackGroup);

        // ── Ground Plane (Deep Black) ──────────────────────────────────
        const groundGeo = new THREE.PlaneGeometry(20, 50);
        const groundMat = new THREE.MeshStandardMaterial({
          color: 0x000000,
          roughness: 0.95,
          metalness: 0.05,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1.28;
        ground.receiveShadow = true;
        scene.add(ground);

        // ── Train (Stylized Locomotive in Royal Blue, Black & White) ────
        const trainGroup = new THREE.Group();

        // Main body (Deep Cobalt Blue)
        const bodyGeo = new THREE.BoxGeometry(1.8, 1.1, 5);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x1d4ed8,
          metalness: 0.8,
          roughness: 0.2,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.55;
        body.castShadow = true;
        trainGroup.add(body);

        // Cab (Front cab section in Jet Black)
        const cabGeo = new THREE.BoxGeometry(1.8, 0.9, 1.4);
        const cabMat = new THREE.MeshStandardMaterial({
          color: 0x09090b,
          metalness: 0.7,
          roughness: 0.3,
        });
        const cab = new THREE.Mesh(cabGeo, cabMat);
        cab.position.set(0, 1.05, -1.7);
        cab.castShadow = true;
        trainGroup.add(cab);

        // Windshield (Bright Electric Blue)
        const windshieldGeo = new THREE.PlaneGeometry(1.4, 0.7);
        const windshieldMat = new THREE.MeshStandardMaterial({
          color: 0x60a5fa,
          metalness: 0.2,
          roughness: 0.0,
          transparent: true,
          opacity: 0.8,
          emissive: 0x2563eb,
          emissiveIntensity: 0.5,
        });
        const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
        windshield.position.set(0, 1.05, -2.38);
        trainGroup.add(windshield);

        // Front headlights (Pure White)
        const headlightGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
        const headlightMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 2.0,
        });

        [-0.55, 0.55].forEach((x) => {
          const hl = new THREE.Mesh(headlightGeo, headlightMat);
          hl.rotation.x = Math.PI / 2;
          hl.position.set(x, 0.5, -2.52);
          trainGroup.add(hl);

          // Headlight cone
          const spotLight = new THREE.SpotLight(0xffffff, 4, 18, Math.PI / 8, 0.3);
          spotLight.position.set(x, 0.5, -2.5);
          spotLight.target.position.set(x, 0, -20);
          scene.add(spotLight);
          scene.add(spotLight.target);
        });

        // Roof structures (Jet Black)
        const roofDetailGeo = new THREE.BoxGeometry(1.5, 0.18, 3.5);
        const roofMat = new THREE.MeshStandardMaterial({
          color: 0x000000,
          metalness: 0.8,
          roughness: 0.2,
        });
        const roofDetail = new THREE.Mesh(roofDetailGeo, roofMat);
        roofDetail.position.set(0, 1.17, 0);
        trainGroup.add(roofDetail);

        // Wheels (Black & White rim)
        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 24);
        const wheelMat = new THREE.MeshStandardMaterial({
          color: 0x000000,
          metalness: 0.95,
          roughness: 0.1,
        });

        [[-0.95, -1.2], [0.95, -1.2], [-0.95, 0.4], [0.95, 0.4], [-0.95, 1.8], [0.95, 1.8]].forEach(([x, z]) => {
          const wheel = new THREE.Mesh(wheelGeo, wheelMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x, -0.12, z);
          wheel.castShadow = true;
          trainGroup.add(wheel);
        });

        // Pure White Accent Stripe
        const stripeGeo = new THREE.BoxGeometry(1.82, 0.08, 5.02);
        const stripeMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 0.6,
        });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(0, 0.38, 0);
        trainGroup.add(stripe);

        // Locomotive plate (Electric Blue)
        const numPlateMat = new THREE.MeshStandardMaterial({
          color: 0x2563eb,
          emissive: 0x2563eb,
          emissiveIntensity: 0.8,
        });
        const numPlate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.04), numPlateMat);
        numPlate.position.set(0, 0.7, -2.52);
        trainGroup.add(numPlate);

        trainGroup.position.set(0, -0.55, 2);
        trainGroup.rotation.y = Math.PI; // facing camera
        scene.add(trainGroup);

        // ── Floating White/Blue Star Particles ────────────────────────
        const particlesGeo = new THREE.BufferGeometry();
        const particleCount = 400;
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i++) {
          positions[i] = (Math.random() - 0.5) * 60;
        }
        particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const particlesMat = new THREE.PointsMaterial({
          color: 0x60a5fa,
          size: 0.12,
          transparent: true,
          opacity: 0.75,
        });
        const particles = new THREE.Points(particlesGeo, particlesMat);
        scene.add(particles);

        // ── Animation Loop ─────────────────────────────────────────────
        let clock = new THREE.Clock();

        const animate = () => {
          if (!mounted) return;
          frameId = requestAnimationFrame(animate);

          const elapsed = clock.getElapsedTime();

          // Float the train slightly
          trainGroup.position.y = -0.55 + Math.sin(elapsed * 1.5) * 0.04;
          trainGroup.rotation.z = Math.sin(elapsed * 1.2) * 0.015;

          // Slowly rotate particles
          particles.rotation.y = elapsed * 0.02;

          // Camera subtle sway
          camera.position.x = Math.sin(elapsed * 0.4) * 0.4;
          camera.position.y = 4 + Math.cos(elapsed * 0.5) * 0.2;
          camera.lookAt(0, 0, 0);

          renderer.render(scene, camera);
        };

        animate();

        // ── Resize handler ─────────────────────────────────────────────
        const handleResize = () => {
          if (!container || !renderer || !camera) return;
          const newW = container.clientWidth;
          const newH = container.clientHeight;
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        };

        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
          cancelAnimationFrame(frameId);
          if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
          }
          renderer?.dispose();
        };
      } catch (err) {
        console.warn('Three.js failed to initialize, using fallback:', err);
        setError(true);
      }
    };

    const cleanupPromise = init();

    return () => {
      mounted = false;
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, [prefersReduced]);

  if (error || prefersReduced) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-3xl ${className}`}
        style={{
          height,
          background: 'linear-gradient(135deg, #000000 0%, #0f172a 50%, #000000 100%)',
          border: '1px solid rgba(37, 99, 235, 0.2)',
        }}
      >
        <div
          className="text-8xl select-none"
          style={{ filter: 'drop-shadow(0 0 40px rgba(37,99,235,0.4))' }}
        >
          🚆
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height, minHeight: '380px', pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
}
