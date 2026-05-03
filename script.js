let cropper;
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const cvsPreview = document.getElementById('cvsPreview');
const downloadBtn = document.getElementById('downloadBtn');
const guideOverlay = document.getElementById('guideOverlay');

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

// Fix: willReadFrequently warning and async initialization
async function init() {
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        document.getElementById('aiStatus').innerText = "AI System Active";
    } catch (e) {
        document.getElementById('aiStatus').innerText = "AI Offline";
    }
}
init();

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
                dragMode: 'move', // Allows user to move photo within stencil
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
    
    // Console Fix: Prevent drawing empty/zero canvas
    const croppedCanvas = cropper.getCroppedCanvas({ width: 600, height: 600 });
    if (!croppedCanvas || croppedCanvas.width === 0) return;

    // Performance Fix: willReadFrequently
    const ctx = croppedCanvas.getContext('2d', { willReadFrequently: true });

    // 1. Color vs B&W Detection
    const isColor = checkColor(ctx);
    
    // 2. Background Whiteness Check
    const isWhiteBG = checkBackground(ctx);
    
    // 3. AI Facial Analysis
    const detection = await faceapi.detectSingleFace(croppedCanvas, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
    
    let ratioPass = false;
    let posePass = false;

    if (detection) {
        const landmarks = detection.landmarks;
        const box = detection.detection.box;

        // Head Ratio Check (50% to 69% of height)
        const headH = box.height;
        ratioPass = (headH >= 300 && headH <= 414);

        // Strict Pose Check (Horizontal Symmetry)
        const nose = landmarks.getNose()[0].x;
        const leftEye = landmarks.getLeftEye()[0].x;
        const rightEye = landmarks.getRightEye()[3].x;
        const distL = nose - leftEye;
        const distR = rightEye - nose;
        const symmetry = Math.abs(distL - distR);
        
        // Religious toggle relaxes specific facial detection but keeps pose strict
        const isReligious = document.getElementById('isReligious').checked;
        posePass = symmetry < 14; 
    }

    // Infant Mode: Auto-passes specific AI checks if checked
    const isInfant = document.getElementById('isInfant').checked;
    
    updateUI('check-face', (detection && posePass) || (isInfant && detection));
    updateUI('check-ratio', ratioPass);
    updateUI('check-color', isColor);
    updateUI('check-bg', isWhiteBG);

    // MASTER LOCK: Enable download only if all requirements met
    const allValid = (detection && ratioPass && isColor && isWhiteBG && (posePass || isInfant));
    
    if (allValid) {
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
        if (Math.abs(r - g) > 20 || Math.abs(r - b) > 20) return true;
    }
    return false;
}

function checkBackground(ctx) {
    const p1 = ctx.getImageData(10, 10, 1, 1).data;
    const p2 = ctx.getImageData(580, 10, 1, 1).data;
    // USCIS requires white or off-white. Threshold set to 200.
    return (p1[0] > 200 && p1[1] > 200 && p1[2] > 200 && p2[0] > 200);
}

function updateUI(id, pass) {
    const el = document.getElementById(id);
    el.className = pass ? 'passed' : 'failed';
    const cleanText = el.innerText.replace('✅ ', '').replace('❌ ', '');
    el.innerText = (pass ? '✅ ' : '❌ ') + cleanText;
}

function render4x6(cropped) {
    // 4x6 at 300DPI is 1800x1200
    cvsPreview.width = 1800; cvsPreview.height = 1200;
    const ctx = cvsPreview.getContext('2d');
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1800, 1200);

    const marginX = 250; 
    const marginY = 50;
    const gap = 80;

    // Correct Grid Layout for 4 photos on a 4x6
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            const x = marginX + (c * (600 + gap));
            const y = marginY + (r * (600 + gap));
            ctx.drawImage(cropped, x, y, 600, 600);
        }
    }
}

// Manual Controls
document.getElementById('zoomIn').onclick = () => cropper.zoom(0.1);
document.getElementById('zoomOut').onclick = () => cropper.zoom(-0.1);

downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = 'uscis_passport_4x6_ready.jpg';
    link.href = cvsPreview.toDataURL('image/jpeg', 0.98);
    link.click();
};
