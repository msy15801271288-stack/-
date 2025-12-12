import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Particle, PhotoObject, GestureType, ParticleType } from '../types';

interface ChristmasTreeProps {
  isExploded: boolean;
  onToggleExplode: (exploded: boolean) => void;
  photos: HTMLImageElement[];
  gestureCursor: { x: number; y: number } | null;
  currentGesture: GestureType;
}

// --- Asset Generation Helpers ---

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// 1. Premium Golden Sprite (Glowing & 3D)
const createGoldenSprite = (color: string): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const size = 64; 
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  
  // Core radius (smaller than canvas to allow glow)
  const r = size / 2 * 0.6; 

  // A. Outer Glow (Soft Halo) - Adds the "Luminous" feel
  const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, size/2);
  glow.addColorStop(0, hexToRgba(color, 0.4));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, size/2, 0, Math.PI * 2);
  ctx.fill();

  // B. Core Sphere (3D Shading) - Adds "Solid/Premium" feel
  const grad = ctx.createRadialGradient(cx - r/3, cy - r/3, 0, cx, cy, r);
  grad.addColorStop(0, '#FFFFFF');         // Specular highlight center
  grad.addColorStop(0.2, color);           // Main body color
  grad.addColorStop(0.8, hexToRgba(color, 1)); // Saturated edge
  grad.addColorStop(1, '#3e2723');         // Dark rim for contrast (Dark Brown)
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // C. Sharp Specular Highlight (The "Glassy" look)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.ellipse(cx - r/3, cy - r/3, r/3.5, r/5, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
};

// 2. Gift Box Sprite
const createGiftSprite = (boxColor: string, ribbonColor: string): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;
  const boxSize = size * 0.7;

  // Box Body
  ctx.fillStyle = boxColor;
  ctx.fillRect(cx - boxSize/2, cy - boxSize/2, boxSize, boxSize);

  // Shading (Bottom Right)
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(cx - boxSize/2, cy, boxSize, boxSize/2);

  // Ribbon Vertical
  ctx.fillStyle = ribbonColor;
  ctx.fillRect(cx - boxSize/6, cy - boxSize/2, boxSize/3, boxSize);
  
  // Ribbon Horizontal
  ctx.fillRect(cx - boxSize/2, cy - boxSize/6, boxSize, boxSize/3);

  // Bow (Simple knot)
  ctx.fillStyle = ribbonColor;
  ctx.beginPath();
  ctx.arc(cx, cy - boxSize/2, boxSize/5, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
};

// --- Config ---

// Updated to Premium Golden Palette (Rich, Warm, Champagne)
const GOLDEN_PALETTE = [
  '#FFD700', // Gold
  '#FDB931', // Rich Gold
  '#E5E4E2', // Platinum/Champagne (adds elegant contrast)
  '#DAA520', // Goldenrod
  '#CD7F32', // Bronze/Copper
  '#FFF8DC', // Cornsilk (Light light gold)
];

const GIFT_PAIRS = [
  { box: '#c0392b', ribbon: '#f1c40f' }, // Red/Gold
  { box: '#166534', ribbon: '#dc2626' }, // Dark Green/Red
  { box: '#ecf0f1', ribbon: '#d35400' }, // White/Pumpkin
  { box: '#6b21a8', ribbon: '#f3e8ff' }, // Purple/Lavender
];

// 3D Star Model
const STAR_RADIUS = 35;
const STAR_DEPTH = 10;
const createStarModel = () => {
    const vertices = [];
    const faces = [];
    vertices.push({x:0, y:0, z:STAR_DEPTH}); 
    vertices.push({x:0, y:0, z:-STAR_DEPTH});
    const innerRadius = STAR_RADIUS * 0.4;
    for(let i=0; i<5; i++) {
        const angle = (i * 72 - 18) * Math.PI / 180; 
        const angleInner = (i * 72 + 18) * Math.PI / 180;
        vertices.push({x: Math.cos(angle)*STAR_RADIUS, y: Math.sin(angle)*STAR_RADIUS, z: 0});
        vertices.push({x: Math.cos(angleInner)*innerRadius, y: Math.sin(angleInner)*innerRadius, z: 0});
    }
    for(let i=0; i<5; i++) {
        const outer = 2 + i*2;
        const inner = 2 + i*2 + 1;
        const nextOuter = 2 + ((i+1)%5)*2;
        faces.push([0, outer, inner]); faces.push([0, inner, nextOuter]);
        faces.push([1, inner, outer]); faces.push([1, nextOuter, inner]);
    }
    return { vertices, faces };
};
const STAR_MODEL = createStarModel();

const ChristmasTree: React.FC<ChristmasTreeProps> = ({ 
  isExploded, 
  onToggleExplode, 
  photos,
  gestureCursor,
  currentGesture
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  
  const particlesRef = useRef<Particle[]>([]);
  const photoObjectsRef = useRef<PhotoObject[]>([]);
  const rotationRef = useRef(0);
  const zoomedPhotoIdRef = useRef<string | null>(null);
  const spritesRef = useRef<Record<string, HTMLCanvasElement>>({});
  
  // Dynamic dimensions state
  const [dimensions, setDimensions] = useState({ height: 600, radius: 220 });
  const [isMobile, setIsMobile] = useState(false);

  // Constants
  const PARTICLE_COUNT = isMobile ? 1200 : 1500;
  const FOCAL_LENGTH = 800;

  // Handle Resize for Responsive Tree Size
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setDimensions({
        // Adjusted sizes for better fit
        height: mobile ? 400 : 600,
        radius: mobile ? 140 : 220
      });
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Initialize Assets
  useEffect(() => {
    const map: Record<string, HTMLCanvasElement> = {};
    
    // Golden Orbs
    GOLDEN_PALETTE.forEach(c => {
      map[`gold-${c}`] = createGoldenSprite(c);
    });
    
    // Gifts
    GIFT_PAIRS.forEach((pair, idx) => {
      map[`gift-${idx}`] = createGiftSprite(pair.box, pair.ribbon);
    });

    spritesRef.current = map;
  }, []);

  // Initialize Particles (Re-run when dimensions change)
  useEffect(() => {
    const newParticles: Particle[] = [];
    const { height: treeHeight, radius: treeRadius } = dimensions;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = i / PARTICLE_COUNT;
      const angle = t * 60 * Math.PI; // Spiral tightness
      
      const y = (t * treeHeight) - (treeHeight / 2); 
      const radius = Math.pow(t, 0.9) * treeRadius; 
      
      // Slightly looser scatter for "ethereal" look, but controlled
      const r = radius + (Math.random() - 0.5) * (isMobile ? 25 : 45);
      
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);

      // Explosion target
      const targetDist = (isMobile ? 250 : 450) + Math.random() * (isMobile ? 200 : 300);
      const targetTheta = Math.random() * Math.PI * 2;
      const targetPhi = Math.acos((Math.random() * 2) - 1);
      
      // Type Logic: 10% Stars, 8% Gifts, 82% Gold Orbs
      const rand = Math.random();
      let type: ParticleType = 'FLOWER'; 
      let color = GOLDEN_PALETTE[Math.floor(Math.random() * GOLDEN_PALETTE.length)];
      let size = 0.5 + Math.random() * 0.5;
      let variant = 0;

      if (rand < 0.10) {
        type = 'SPARKLE';
        color = '#FFFFFF';
        size = 0.3 + Math.random() * 0.5;
      } else if (rand < 0.18) {
        type = 'GIFT';
        variant = Math.floor(Math.random() * GIFT_PAIRS.length);
        size = isMobile ? 0.7 : 0.9;
      } else {
        // Gold Orbs
        // Vary sizes more for visual interest
        size = isMobile ? (0.35 + Math.random() * 0.5) : (0.4 + Math.random() * 0.6);
      }

      newParticles.push({
        id: i,
        type,
        x, y, z,
        baseX: x, baseY: y, baseZ: z,
        targetX: targetDist * Math.sin(targetPhi) * Math.cos(targetTheta),
        targetY: targetDist * Math.sin(targetPhi) * Math.sin(targetTheta),
        targetZ: targetDist * Math.cos(targetPhi),
        color,
        size,
        variant,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.003 + Math.random() * 0.004
      });
    }
    particlesRef.current = newParticles;
  }, [dimensions, isMobile]);

  // Sync Photos
  useEffect(() => {
    if (photos.length === 0) {
      photoObjectsRef.current = [];
      zoomedPhotoIdRef.current = null;
      return;
    }
    if (photos.length > photoObjectsRef.current.length) {
      const newImgs = photos.slice(photoObjectsRef.current.length);
      newImgs.forEach((img) => {
         const targetDist = 200 + Math.random() * 150;
         const theta = Math.random() * Math.PI * 2;
         const phi = Math.acos((Math.random() * 2) - 1);

         photoObjectsRef.current.push({
           id: Math.random().toString(36).substr(2, 9),
           img,
           width: 120,
           height: 120 * (img.height / img.width),
           aspectRatio: img.width / img.height,
           x: 0, y: 0, z: 0,
           baseX: 0, baseY: 0, baseZ: 0,
           targetX: targetDist * Math.sin(phi) * Math.cos(theta),
           targetY: targetDist * Math.sin(phi) * Math.sin(theta),
           targetZ: targetDist * Math.cos(phi),
           opacity: 0
         });
      });
    }
  }, [photos]);

  const updatePhysics = () => {
    const ease = 0.05;
    if (!zoomedPhotoIdRef.current) {
        rotationRef.current += isExploded ? 0.001 : 0.003; 
    }

    // Particles
    particlesRef.current.forEach(p => {
      const tx = isExploded ? p.targetX : p.baseX;
      const ty = isExploded ? p.targetY : p.baseY;
      const tz = isExploded ? p.targetZ : p.baseZ;

      p.x += (tx - p.x) * ease;
      p.y += (ty - p.y) * ease;
      p.z += (tz - p.z) * ease;
    });

    // Photos
    photoObjectsRef.current.forEach(p => {
      let tx, ty, tz, targetOpacity;
      if (zoomedPhotoIdRef.current === p.id) {
        tx = 0; ty = 0; tz = -FOCAL_LENGTH + 250; targetOpacity = 1;
      } else if (zoomedPhotoIdRef.current) {
        tx = p.targetX * 3; ty = p.targetY * 3; tz = p.targetZ; targetOpacity = 0;
      } else {
        tx = isExploded ? p.targetX : p.baseX;
        ty = isExploded ? p.targetY : p.baseY;
        tz = isExploded ? p.targetZ : p.baseZ;
        targetOpacity = isExploded ? 1 : 0;
      }
      p.x += (tx - p.x) * ease;
      p.y += (ty - p.y) * ease;
      p.z += (tz - p.z) * ease;
      p.opacity += (targetOpacity - p.opacity) * ease;
    });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    const cos = Math.cos(rotationRef.current);
    const sin = Math.sin(rotationRef.current);
    const time = Date.now();

    const allObjects: any[] = [];

    // 1. Particles
    particlesRef.current.forEach(p => {
        const rx = p.x * cos - p.z * sin;
        const rz = p.z * cos + p.x * sin;
        allObjects.push({ type: 'particle', obj: p, rx, ry: p.y, rz, sortZ: rz });
    });

    // 2. Photos
    photoObjectsRef.current.forEach(p => {
        let rx, ry, rz;
        if (zoomedPhotoIdRef.current === p.id) {
            rx = p.x; ry = p.y; rz = p.z;
        } else {
            rx = p.x * cos - p.z * sin;
            rz = p.z * cos + p.x * sin;
            ry = p.y;
        }
        allObjects.push({ type: 'photo', obj: p, rx, ry, rz, sortZ: rz });
    });

    // 3. Star
    if (!zoomedPhotoIdRef.current) {
        const starY = -dimensions.height / 2 - 20; 
        const transformedVerts = STAR_MODEL.vertices.map(v => {
            const rvx = v.x * cos - v.z * sin;
            const rvz = v.z * cos + v.x * sin;
            const rvy = v.y + starY; 
            return { x: rvx, y: rvy, z: rvz };
        });

        STAR_MODEL.faces.forEach(face => {
            const v0 = transformedVerts[face[0]];
            const v1 = transformedVerts[face[1]];
            const v2 = transformedVerts[face[2]];
            
            // Basic lighting
            const ux = v1.x - v0.x; const uy = v1.y - v0.y; const uz = v1.z - v0.z;
            const vx = v2.x - v0.x; const vy = v2.y - v0.y; const vz = v2.z - v0.z;
            const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx;
            const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            const nxn = nx/len; const nyn = ny/len; const nzn = nz/len;
            const dot = (nxn * -0.5 + nyn * -0.5 + nzn * -0.8) / Math.sqrt(0.5*0.5 + 0.5*0.5 + 0.8*0.8);
            const brightness = Math.max(0.4, (dot + 1) / 2);
            
            const r = Math.floor(255 * brightness);
            const g = Math.floor(215 * brightness);
            const avgZ = (v0.z + v1.z + v2.z) / 3;

            allObjects.push({
                type: 'starFace', v0, v1, v2,
                color: `rgb(${r},${g},0)`, sortZ: avgZ
            });
        });
    }

    allObjects.sort((a, b) => b.sortZ - a.sortZ);

    allObjects.forEach(item => {
      const { rx, ry, rz, type, obj } = item;
      const scale = FOCAL_LENGTH / (FOCAL_LENGTH + (type === 'starFace' ? item.sortZ : rz));
      if (scale <= 0) return;
      const x2d = (type === 'starFace' ? 0 : rx) * scale + cx;
      const y2d = (type === 'starFace' ? 0 : ry) * scale + cy;

      if (type === 'particle') {
         const p = obj as Particle;
         
         if (p.type === 'FLOWER') {
             const sprite = spritesRef.current[`gold-${p.color}`];
             if (sprite) {
                 // Slightly larger to show off glow details
                 const size = 32 * p.size * scale;
                 
                 // Use additive blending for the glow effect
                 // This makes overlapping orbs brighter, creating a magical feel
                 ctx.globalCompositeOperation = 'lighter'; 
                 ctx.drawImage(sprite, x2d - size/2, y2d - size/2, size, size);
                 ctx.globalCompositeOperation = 'source-over'; // Reset immediately
             }
         } 
         else if (p.type === 'GIFT') {
             const sprite = spritesRef.current[`gift-${p.variant}`];
             if (sprite) {
                 const size = 36 * p.size * scale;
                 // Gifts are solid, no special blending
                 ctx.drawImage(sprite, x2d - size/2, y2d - size/2, size, size);
             }
         }
         else if (p.type === 'SPARKLE') {
             const opacity = 0.3 + 0.7 * Math.sin(time * p.twinkleSpeed + p.twinklePhase);
             if (opacity > 0) {
                 const size = 8 * p.size * scale;
                 ctx.globalAlpha = opacity;
                 
                 // Diamond shape sparkle
                 ctx.fillStyle = '#FFFFFF';
                 ctx.beginPath();
                 ctx.moveTo(x2d, y2d - size);
                 ctx.lineTo(x2d + size/2, y2d);
                 ctx.lineTo(x2d, y2d + size);
                 ctx.lineTo(x2d - size/2, y2d);
                 ctx.fill();
                 
                 // Glow core
                 ctx.shadowBlur = 15 * scale;
                 ctx.shadowColor = 'white';
                 ctx.beginPath();
                 ctx.arc(x2d, y2d, size/3, 0, Math.PI * 2);
                 ctx.fill();
                 ctx.shadowBlur = 0;
                 
                 ctx.globalAlpha = 1;
             }
         }

      } else if (type === 'starFace') {
          const project = (v: any) => ({ x: v.x * (FOCAL_LENGTH/(FOCAL_LENGTH+v.z)) + cx, y: v.y * (FOCAL_LENGTH/(FOCAL_LENGTH+v.z)) + cy });
          const p0 = project(item.v0); const p1 = project(item.v1); const p2 = project(item.v2);
          
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.closePath();
          
          // Add a subtle glow to the star faces too
          ctx.shadowBlur = 20;
          ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
          ctx.fillStyle = item.color; 
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // Star edges
          ctx.strokeStyle = 'rgba(255, 255, 200, 0.5)';
          ctx.lineWidth = 0.5;
          ctx.stroke();

      } else if (type === 'photo') {
         const p = obj as PhotoObject;
         if (p.opacity < 0.01) return;
         const isZoomed = zoomedPhotoIdRef.current === p.id;
         const w = p.width * scale * (isZoomed ? 1.5 : 1); 
         const h = p.height * scale * (isZoomed ? 1.5 : 1);
         
         ctx.globalAlpha = p.opacity;
         
         // Photo frame styling
         ctx.strokeStyle = isZoomed ? '#fbbf24' : '#e2e8f0'; // Amber when zoomed
         ctx.lineWidth = isZoomed ? 6 : 2 * scale;
         
         // Shadow for depth
         ctx.shadowColor = 'rgba(0,0,0,0.5)';
         ctx.shadowBlur = 20 * scale;
         
         ctx.strokeRect(x2d - w/2, y2d - h/2, w, h);
         
         // Clip image to rect
         ctx.save();
         ctx.beginPath();
         ctx.rect(x2d - w/2, y2d - h/2, w, h);
         ctx.clip();
         try { ctx.drawImage(p.img, x2d - w/2, y2d - h/2, w, h); } catch (e) {}
         ctx.restore();
         
         ctx.shadowBlur = 0;
         ctx.globalAlpha = 1;
      }
    });

    if (gestureCursor) {
        const gx = (1 - gestureCursor.x) * canvas.width;
        const gy = gestureCursor.y * canvas.height;
        ctx.beginPath(); ctx.arc(gx, gy, 8, 0, Math.PI * 2);
        ctx.fillStyle = currentGesture === GestureType.PINCH ? '#fbbf24' : currentGesture === GestureType.OPEN_PALM ? '#22c55e' : 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        ctx.beginPath(); ctx.arc(gx, gy, 14, 0, Math.PI * 2);
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2; ctx.stroke();
    }
  };

  const tick = useCallback(() => {
    updatePhysics();
    draw();
    requestRef.current = requestAnimationFrame(tick);
  }, [isExploded, gestureCursor, currentGesture, dimensions]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(tick);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [tick]);

  const handleInteraction = (inputX: number, inputY: number, isRightClick: boolean = false) => {
      if (isRightClick) {
          onToggleExplode(false);
          zoomedPhotoIdRef.current = null;
          return;
      }
      if (!isExploded) {
          onToggleExplode(true);
      } else {
          if (zoomedPhotoIdRef.current) { zoomedPhotoIdRef.current = null; return; }
          const canvas = canvasRef.current; if(!canvas) return;
          const cx = canvas.width / 2; const cy = canvas.height / 2;
          const cos = Math.cos(rotationRef.current); const sin = Math.sin(rotationRef.current);

          const candidates = photoObjectsRef.current.filter(p => p.opacity > 0.5);
          candidates.sort((a, b) => (a.z * cos + a.x * sin) - (b.z * cos + b.x * sin));
          
          let clickedId = null;
          for (const p of candidates) {
               const rx = p.x * cos - p.z * sin; const ry = p.y; const rz = p.z * cos + p.x * sin;
               const scale = FOCAL_LENGTH / (FOCAL_LENGTH + rz);
               if (scale <= 0) continue;
               const x2d = rx * scale + cx; const y2d = ry * scale + cy;
               const w = p.width * scale; const h = p.height * scale;
               if (inputX >= x2d - w/2 && inputX <= x2d + w/2 && inputY >= y2d - h/2 && inputY <= y2d + h/2) {
                   clickedId = p.id; break;
               }
           }
           if (clickedId) zoomedPhotoIdRef.current = clickedId;
      }
  };

  const onMouseDown = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      handleInteraction(e.clientX - rect.left, e.clientY - rect.top, e.button === 2);
  };

  useEffect(() => {
    if (currentGesture === GestureType.OPEN_PALM && !isExploded) onToggleExplode(true);
    if (currentGesture === GestureType.CLOSED_FIST) { onToggleExplode(false); zoomedPhotoIdRef.current = null; }
    if (currentGesture === GestureType.PINCH && gestureCursor && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        handleInteraction((1 - gestureCursor.x) * rect.width, gestureCursor.y * rect.height, false);
    }
  }, [currentGesture, gestureCursor, isExploded]);

  useEffect(() => {
      const handleResize = () => {
          if (containerRef.current && canvasRef.current) {
              canvasRef.current.width = containerRef.current.clientWidth;
              canvasRef.current.height = containerRef.current.clientHeight;
          }
      };
      window.addEventListener('resize', handleResize);
      handleResize();
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <canvas ref={canvasRef} onMouseDown={onMouseDown} onContextMenu={(e) => e.preventDefault()} className="block cursor-pointer touch-none" />
    </div>
  );
};

export default ChristmasTree;