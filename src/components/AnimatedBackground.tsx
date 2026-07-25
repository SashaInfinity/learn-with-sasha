import { useEffect, useRef } from 'react';

// Decorative full-screen particle network. The previous `theme` prop was
// vestigial (the app has a single static "solar-flare" theme) and is removed.
const AnimatedBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Bind to a non-null const so the narrowing holds inside the nested
        // class methods below (TS doesn't carry narrowing into class closures).
        const canvasEl: HTMLCanvasElement = canvas;

        const ctx = canvasEl.getContext('2d');
        if (!ctx) return;
        const ctx2d: CanvasRenderingContext2D = ctx;

        let animationFrameId: number;
        let particles: Particle[] = [];
        const particleCount = 70;
        const mouse = { x: -1000, y: -1000, radius: 150 };

        // Read colors from CSS variables
        const computedStyles = getComputedStyle(document.documentElement);
        const particleColor = computedStyles.getPropertyValue('--color-particle').trim();
        const lineRgb = computedStyles.getPropertyValue('--color-line-rgb').trim();
        const mouseLineRgb = computedStyles.getPropertyValue('--color-mouse-line-rgb').trim();

        const resizeCanvas = () => {
            canvasEl.width = window.innerWidth;
            canvasEl.height = window.innerHeight;
            initParticles();
        };

        class Particle {
            x: number;
            y: number;
            size: number;
            speedX: number;
            speedY: number;

            constructor() {
                this.x = Math.random() * canvasEl.width;
                this.y = Math.random() * canvasEl.height;
                this.size = Math.random() * 2 + 1;
                this.speedX = (Math.random() * 2 - 1) * 0.3;
                this.speedY = (Math.random() * 2 - 1) * 0.3;
            }

            update() {
                if (this.x > canvasEl.width || this.x < 0) this.speedX *= -1;
                if (this.y > canvasEl.height || this.y < 0) this.speedY *= -1;
                this.x += this.speedX;
                this.y += this.speedY;
            }

            draw() {
                ctx2d.fillStyle = particleColor;
                ctx2d.beginPath();
                ctx2d.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx2d.fill();
            }
        }

        const initParticles = () => {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };
        
        const handleMouseMove = (event: MouseEvent) => {
            mouse.x = event.x;
            mouse.y = event.y;
        };
        
        const connectParticles = () => {
            for (let a = 0; a < particles.length; a++) {
                // Connect to mouse
                const dxMouse = particles[a].x - mouse.x;
                const dyMouse = particles[a].y - mouse.y;
                const distanceMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
                if (distanceMouse < mouse.radius) {
                    ctx2d.strokeStyle = `rgba(${mouseLineRgb}, ${1 - distanceMouse / mouse.radius})`;
                    ctx2d.lineWidth = 0.5;
                    ctx2d.beginPath();
                    ctx2d.moveTo(particles[a].x, particles[a].y);
                    ctx2d.lineTo(mouse.x, mouse.y);
                    ctx2d.stroke();
                }

                // Connect to other particles
                for (let b = a; b < particles.length; b++) {
                    const dx = particles[a].x - particles[b].x;
                    const dy = particles[a].y - particles[b].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 120) {
                        ctx2d.strokeStyle = `rgba(${lineRgb}, ${1 - distance / 120})`;
                        ctx2d.lineWidth = 0.3;
                        ctx2d.beginPath();
                        ctx2d.moveTo(particles[a].x, particles[a].y);
                        ctx2d.lineTo(particles[b].x, particles[b].y);
                        ctx2d.stroke();
                    }
                }
            }
        };

        const animate = () => {
            ctx2d.clearRect(0, 0, canvasEl.width, canvasEl.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            connectParticles();
            animationFrameId = requestAnimationFrame(animate);
        };

        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('mousemove', handleMouseMove);
        resizeCanvas();
        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []); // Static theme — colors come from CSS variables that don't change.

    return (
        <canvas
            ref={canvasRef}
            id="particle-canvas"
            aria-hidden="true"
            role="presentation"
        />
    );
};

export default AnimatedBackground;