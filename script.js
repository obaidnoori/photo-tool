let cropper;
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const cvsPreview = document.getElementById('cvsPreview');
const downloadBtn = document.getElementById('downloadBtn');
const guideOverlay = document.getElementById('guideOverlay');

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

async function init() {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    document.getElementById('aiStatus').innerText = "AI Online";
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
                ready: () => {
                    guideOverlay.style.display = 'block';
                    autoAlignFace();
                },
                crop: updateWorkflow
            });
        };
        reader.readAsDataURL(file);
    }
});

// AI Zoom/Align Feature
async function autoAlignFace() {
    const canvas = cropper.getCroppedCanvas();
    const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions());
    if (detection) {
        // Automatically adjust zoom to fit the face into the target ratio
        const box = detection.box;
        const targetScale = 0.6; // Target head taking 60% of height
        // This is a simplified auto-zoom
        cropper.zoomTo(targetScale / (box.height / canvas.height));
    }
}

async function updateWorkflow() {
    if (!cropper) return;
    const croppedCanvas = cropper.getCroppedCanvas({ width: 600, height: 600 });
    const ctx = croppedCanvas.getContext('2d');

    // 1. Color Check (Detect B&W)
    const isColor = checkIsColor(ctx);
    
    // 2. Background Check (Sampling)
    const isWhiteBG = checkBackground(ctx);
    
    // 3. AI Face & Pose Check
    const detection = await faceapi.detectSingleFace(croppedCanvas, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
    
    let ratioPass = false;
    let posePass = false;

    if (detection) {
        const landmarks = detection.landmarks;
        const box = detection.detection.box;

        // Ratio Check
        const headH = box.height;
        ratioPass = (headH >= 300 && headH <= 414); // 50-69% of 600px

        // Pose Check (Looking straight)
        const leftEye = landmarks.getLeftEye()[0].x;
        const rightEye = landmarks.getRightEye()[3].x;
        const nose = landmarks.getNose()[0].x;
        const symmetry = Math.abs((nose - leftEye) - (rightEye - nose));
        posePass = symmetry < 20; // Lower is straighter
    }

    updateUI('check-face', !!detection && posePass);
    updateUI('check-ratio', ratioPass);
    updateUI('check-color', isColor);
    updateUI('check-bg', isWhiteBG);
    
    render4x6(croppedCanvas);
    downloadBtn.disabled = !(detection && isColor && isWhiteBG);
    
    // Update guide color
    document.querySelector('.head-circle').style.borderColor = ratioPass ? 'var(--green)' : 'var(--red)';
}

function checkIsColor(ctx) {
    const data = ctx.getImageData(300, 300, 50, 50).data;
    for (let i = 0; i < data.length; i += 4) {
        const diff = Math.max(data[i], data[i+1], data[i+2]) - Math.min(data[i], data[i+1], data[i+2]);
        if (diff > 15) return true; // Found enough color saturation
    }
    return false;
}

function checkBackground(ctx) {
    const p = ctx.getImageData(10, 10, 1, 1).data;
    return (p[0] > 200 && p[1] > 200 && p[2] > 200);
}

function render4x6(cropped) {
    cvsPreview.width = 1800; cvsPreview.height = 1200;
    const ctx = cvsPreview.getContext('2d');
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1800, 1200);

    const gap = 100;
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
            const x = 250 + (c * (600 + gap));
            const y = 50 + (r * (600 + gap));
            ctx.drawImage(cropped, x, y, 600, 600);
            ctx.strokeStyle = "#ccc"; ctx.strokeRect(x, y, 600, 600);
        }
    }
}

function updateUI(id, pass) {
    const el = document.getElementById(id);
    el.className = pass ? 'passed' : 'failed';
    el.innerHTML = (pass ? '✅ ' : '❌ ') + el.innerText.replace('✅ ', '').replace('❌ ', '');
}

// Zoom Controls
document.getElementById('zoomIn').onclick = () => cropper.zoom(0.1);
document.getElementById('zoomOut').onclick = () => cropper.zoom(-0.1);

downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = 'passport_4x6_print.jpg';
    link.href = cvsPreview.toDataURL('image/jpeg', 0.95);
    link.click();
};
