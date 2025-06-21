document.addEventListener('DOMContentLoaded', () => {
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
            console.error("Web Audio API is not supported or could not initialize.", e);
        }
    }

    function playSound() {
        if (!audioContext || !audioBuffer) return;

        // Stop any existing sound
        if (sourceNode) {
            sourceNode.stop();
        }

        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.loop = true;

        gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 3); // Fade in over 3 seconds

        sourceNode.connect(gainNode).connect(audioContext.destination);
        sourceNode.start();
    }

    function resumeAudio() {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }

    // Start audio on the first user interaction
    document.body.addEventListener('click', () => {
        if (!audioContext) {
            initAudio();
        } else {
            resumeAudio();
        }
    }, { once: true });

    document.body.addEventListener('mousemove', () => {
        if (!audioContext) {
            initAudio();
        } else {
            resumeAudio();
        }
    }, { once: true });
});

