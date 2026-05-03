let cropper;
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const cvsPreview = document.getElementById('cvsPreview');
const downloadBtn = document.getElementById('downloadBtn');
const guideOverlay = document.getElementById('guideOverlay');

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

async function initAI() {
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        document.getElementById('aiStatus').innerText = "AI System Ready";
    } catch (e) {
        document.getElementById('aiStatus').innerText = "AI Offline - Check Connection";
    }
}
initAI();

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            imagePreview.src = event.target.result;
            if (cropper) cropper.destroy();
            cropper = new Cropper(imagePreview, {
                aspectRatio: 1,
                viewMode: 1,
                ready: () => {
                    guideOverlay.style.display = 'block';
                    updateWorkflow();
                },
                cropend: updateWorkflow,
                zoom: updateWorkflow
            });
        };
        reader.readAsDataURL(file);
    }
});

async function updateWorkflow() {
    if (!cropper) return;
    
    // Fix for the 0 width/height error: Ensure canvas exists
    const croppedCanvas = cropper.getCroppedCanvas({ width: 600, height: 600 });
    if (!croppedCanvas || croppedCanvas.width === 0) return;

    // Optimization: willReadFrequently
    const ctx = croppedCanvas.getContext('2d', { willReadFrequently: true });

    // 1. Color Check (Reject B&W)
    const isColor = checkColor(ctx);
    
    // 2. Background Check
    const isWhiteBG = checkBackground(ctx);
    
    // 3. AI Analysis
    const detection = await faceapi.detectSingleFace(croppedCanvas, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
    
    let ratioPass = false;
    let posePass = false;

    if (detection) {
        const landmarks = detection.landmarks;
        const box = detection.detection.box;

        // USCIS: Head height must be 50-69% of image height
        const headH = box.height;
        ratioPass = (headH >= 300 && headH <= 414);

        // Strict Pose Check (Horizontal Symmetry)
        const nose = landmarks.getNose()[0].x;
        const leftEye = landmarks.getLeftEye()[0].x;
        const rightEye = landmarks.getRightEye()[3].x;
        const distL = nose - leftEye;
        const distR = rightEye - nose;
        const symmetryError = Math.abs(distL - distR);
        posePass = symmetryError < 15; // Strict threshold for "Looking Straight"
    }

    // Update Checklist UI
    updateUI('check-face', detection && posePass);
    updateUI('check-ratio', ratioPass);
    updateUI('check-color', isColor);
    updateUI('check-bg', isWhiteBG);

    // MASTER LOCK: Only enable download if ALL are true
    const allPassed = (!!detection && posePass && ratioPass && isColor && isWhiteBG);
    
    if (allPassed) {
        render4x6(croppedCanvas);
        downloadBtn.disabled = false;
    } else {
        downloadBtn.disabled = true;
    }
}

function checkColor(ctx) {
    const data = ctx.getImageData(250, 250, 100, 100).data;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        if (Math.abs(r - g) > 18 || Math.abs(r - b) > 18) return true;
    }
    return false;
}

function checkBackground(ctx) {
    const samples = [
        ctx.getImageData(10, 10, 1, 1).data,
        ctx.getImageData(580, 10, 1, 1).data
    ];
    return samples.every(s => s[0] > 190 && s[1] > 190 && s[2] > 190);
}

function updateUI(id, pass) {
    const el = document.getElementById(id);
    el.className = pass ? 'passed' : 'failed';
    const text = el.innerText.replace('✅ ', '').replace('❌ ', '');
    el.innerText = (pass ? '✅ ' : '❌ ') + text;
}

function render4x6(cropped) {
    cvsPreview.width = 1800; cvsPreview.height = 1200;
    const ctx = cvsPreview.getContext('2d');
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1800, 1200);

    // Layout with 80px gutter
    const gap = 80;
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            const x = 250 + (c * (600 + gap));
            const y = 50 + (r * (600 + gap));
            ctx.drawImage(cropped, x, y, 600, 600);
        }
    }
}

document.getElementById('zoomIn').onclick = () => cropper.zoom(0.1);
document.getElementById('zoomOut').onclick = () => cropper.zoom(-0.1);

downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = 'uscis_compliant_4x6.jpg';
    link.href = cvsPreview.toDataURL('image/jpeg', 0.95);
    link.click();
};
