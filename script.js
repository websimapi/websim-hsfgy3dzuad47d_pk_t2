import * as THREE from 'three';

document.addEventListener('DOMContentLoaded', () => {
    // --- Audio setup ---
    let audioContext;
    let audioBuffer;
    let sourceNode;
    let gainNode;

    async function initAudio() {
        if (audioContext) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const response = await fetch('ambient_sound.mp3');
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            playSound();
        } catch (e) {
            console.error("Audio initialization failed.", e);
        }
    }

    function playSound() {
        if (!audioContext || !audioBuffer) return;
        if (sourceNode) {
            sourceNode.stop();
        }
        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.loop = true;
        gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 3);
        sourceNode.connect(gainNode).connect(audioContext.destination);
        sourceNode.start();
    }

    function handleUserInteraction() {
        if (!audioContext) {
            initAudio();
        } else if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }
    
    document.body.addEventListener('click', handleUserInteraction, { once: true });


    // --- WebGL Mist Shader ---
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('mist-canvas'), alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const clock = new THREE.Clock();

    const mistMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec2 uResolution;
            uniform float uTime;
            varying vec2 vUv;

            // 2D Random function
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
            }

            // 2D Noise function
            float noise(vec2 st) {
                vec2 i = floor(st);
                vec2 f = fract(st);
                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.y * u.x;
            }

            void main() {
                vec2 st = vUv;
                st.x *= uResolution.x / uResolution.y;

                float speed = uTime * 0.05;
                float mist = noise(st * 3.0 - speed) * 0.4;
                mist += noise(st * 6.0 + speed) * 0.2;
                
                gl_FragColor = vec4(1.0, 1.0, 1.0, mist * 0.4);
            }
        `,
        transparent: true,
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mistMaterial);
    scene.add(plane);

    function animateMist() {
        mistMaterial.uniforms.uTime.value = clock.getElapsedTime();
        renderer.render(scene, camera);
        requestAnimationFrame(animateMist);
    }
    animateMist();
    
    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        mistMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    // --- Generative Slideshow Logic ---
    const imageElements = [document.getElementById('image-1'), document.getElementById('image-2')];
    const poemElements = [document.getElementById('poem-1'), document.getElementById('poem-2')];
    const loadingIndicator = document.getElementById('loading-indicator');
    let currentSlide = 0;
    const slideDuration = 10000; // 10 seconds per slide

    const imageVariations = [
        "featuring a solitary fisherman on a small boat",
        "with a flock of distant geese flying across the sky",
        "with a hidden temple nestled in the mountainside",
        "showing a narrow stone bridge over the river",
        "with a few blooming cherry blossom trees on the bank",
        "where the river forks into smaller streams",
        "with a small, elegant pagoda on a distant hill",
        "showcasing a majestic waterfall cascading down the cliffs"
    ];

    async function generateSlideContent() {
        const randomVariation = imageVariations[Math.floor(Math.random() * imageVariations.length)];
        const imagePrompt = `A high-quality digital artwork in the style of a traditional Chinese ink wash painting (水墨画). In the distance, layers of dark, jade-like mountains are shrouded in swirling mist. In the mid-ground, a serene river flows gently. In the foreground, several ancient, vigorous pine trees stand tall on a rocky outcrop. The color palette is subtle ink grays, light ochre, and pale cyan. The overall atmosphere is elegant, ethereal, and deeply serene. The scene is ${randomVariation}.`;

        const poemPrompt = `Create a short, two-line, seven-character classical Chinese poem. The theme should be serene landscapes: mountains, rivers, mist, or nature's tranquility. Respond ONLY with JSON, following this schema: {"line1": "string", "line2": "string"}`;
        
        try {
            const [imageResult, poemCompletion] = await Promise.all([
                websim.imageGen({ prompt: imagePrompt, aspect_ratio: "16:9" }),
                websim.chat.completions.create({
                    messages: [{ role: "user", content: poemPrompt }],
                    json: true,
                }),
            ]);

            const poem = JSON.parse(poemCompletion.content);
            return { imageUrl: imageResult.url, poem };

        } catch (error) {
            console.error("Failed to generate slide content:", error);
            // Retry on failure
            await new Promise(res => setTimeout(res, 2000));
            return generateSlideContent();
        }
    }
    
    function formatPoem(poemContainer, poem) {
        poemContainer.innerHTML = '';
        const line1 = document.createElement('p');
        line1.textContent = poem.line1;
        const line2 = document.createElement('p');
        line2.textContent = poem.line2;
        poemContainer.appendChild(line1);
        poemContainer.appendChild(line2);
    }

    async function preloadNextSlide(slideIndex) {
        const { imageUrl, poem } = await generateSlideContent();
        
        return new Promise((resolve) => {
            const image = imageElements[slideIndex];
            image.onload = () => {
                 formatPoem(poemElements[slideIndex], poem);
                 resolve();
            };
            image.src = imageUrl;
        });
    }

    async function transitionToNextSlide() {
        const nextSlideIndex = (currentSlide + 1) % 2;

        // Preload the content for the upcoming slide
        await preloadNextSlide(nextSlideIndex);

        // Fade out current slide
        imageElements[currentSlide].classList.remove('active');
        poemElements[currentSlide].classList.remove('active');

        // Fade in next slide
        imageElements[nextSlideIndex].classList.add('active');
        poemElements[nextSlideIndex].classList.add('active');
        
        currentSlide = nextSlideIndex;

        // Schedule the next transition
        setTimeout(transitionToNextSlide, slideDuration);
    }
    
    async function startSlideshow() {
        loadingIndicator.style.display = 'block';
        await preloadNextSlide(0);
        loadingIndicator.style.display = 'none';
        
        imageElements[0].classList.add('active');
        poemElements[0].classList.add('active');

        setTimeout(transitionToNextSlide, slideDuration);
    }

    startSlideshow();
});