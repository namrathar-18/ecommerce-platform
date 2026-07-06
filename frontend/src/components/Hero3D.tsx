import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Animated Three.js hero: a slowly rotating torus-knot + floating particle field,
 * rendered with a transparent background over the page gradient.
 */
export default function Hero3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const width = mount.clientWidth;
    const height = 260;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 7;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1); // keep GPU/CPU cost low; fine for a decorative hero
    mount.appendChild(renderer.domElement);

    // Torus knot — glossy, colorful centerpiece
    const knot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.6, 0.45, 100, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.75, roughness: 0.2 })
    );
    scene.add(knot);

    // Floating particles
    const count = 200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) positions[i] = (Math.random() - 0.5) * 22;
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.8 })
    );
    scene.add(particles);

    // Colored lights orbiting the knot give the "vibrant" look
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const pink = new THREE.PointLight(0xec4899, 60);
    const cyan = new THREE.PointLight(0x22d3ee, 60);
    const amber = new THREE.PointLight(0xf59e0b, 40);
    scene.add(pink, cyan, amber);

    // Throttled to ~30fps and paused when the tab is hidden — the hero is
    // decorative and must never starve the rest of the page.
    let raf = 0;
    let last = 0;
    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      if (now - last < 33) return;
      last = now;
      const t = now * 0.001;
      knot.rotation.x = t * 0.35;
      knot.rotation.y = t * 0.5;
      particles.rotation.y = t * 0.03;
      pink.position.set(Math.sin(t) * 6, 2, Math.cos(t) * 6);
      cyan.position.set(Math.sin(t + Math.PI) * 6, -2, Math.cos(t + Math.PI) * 6);
      amber.position.set(0, Math.sin(t * 0.7) * 5, 4);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(animate);
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onResize = () => {
      const w = mount.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      knot.geometry.dispose();
      (knot.material as THREE.Material).dispose();
      particleGeo.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500">
      <div ref={mountRef} className="w-full" style={{ height: 260 }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
        <h1 className="text-3xl md:text-4xl font-extrabold text-white drop-shadow-lg">
          ShopMesh
        </h1>
        <p className="mt-2 text-white/90 text-sm md:text-base max-w-md">
          A multi-vendor marketplace — one cart, many stores, atomic checkout.
        </p>
      </div>
    </div>
  );
}
