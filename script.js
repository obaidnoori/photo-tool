let cropper;
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const cvsPreview = document.getElementById('cvsPreview');
const downloadBtn = document.getElementById('downloadBtn');
const guideOverlay = document.getElementById('guideOverlay');

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

async function init() {
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        document.getElementById('aiStatus').innerText = "AI ONLINE";
    } catch (e) { document.getElementById('aiStatus').innerText = "AI ERROR"; }
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
                dragMode: 'move',
                ready: () => {
                    guideOverlay.style.display = 'block';
                    updateWorkflow();
                },
                crop: updateWorkflow 
            });
        };
        reader.readAsDataURL(file);
    }
});

async function updateWorkflow() {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 600, height: 600 });
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    render4x6(canvas); // Unlocked live preview

    // 1. Quality Check (Resolution + Sharpness)
    const isSharp = checkSharpness(ctx);
    const isGoodRes = imagePreview.naturalWidth >= 600;

    // 2. Color & Background
    const isColor = checkColor(ctx);
    const isWhiteBG = checkBackground(ctx);

    // 3. AI Analysis
    const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
    
    let posePass = false, ratioPass = false;
    const isInfant = document.getElementById('isInfant').checked;
    const isReligious = document.getElementById('isReligious').checked;

    if (detection) {
        const box = detection.detection.box;
        const landmarks = detection.landmarks;

        // Ratio Check
        ratioPass = (box.height >= 300 && box.height <= 414);

        // Pose Check (Symmetry) - Skipped for Infants
        const nose = landmarks.getNose()[0].x;
        const leftEye = landmarks.getLeftEye()[0].x;
        const rightEye = landmarks.getRightEye()[3].x;
        const symmetry = Math.abs((nose - leftEye) - (rightEye - nose));
        
        // Pose pass if symmetry < 15 or if it's an infant
        posePass = isInfant || (symmetry < 15);
    }

    updateUI('check-face', isInfant || (detection && posePass));
    updateUI('check-ratio', ratioPass);
    updateUI('check-color', isColor);
    updateUI('check-bg', isWhiteBG);
    updateUI('check-quality', isSharp && isGoodRes);

    // Final Approval Logic
    const ready = (isInfant || (detection && posePass)) && ratioPass && isColor && isWhiteBG && isSharp;
    downloadBtn.disabled = !ready;
}

function checkSharpness(ctx) {
    const data = ctx.getImageData(200, 200, 200, 200).data;
    let diff = 0;
    for (let i = 0; i < data.length - 4; i += 4) {
        diff += Math.abs(data[i] - data[i+4]);
    }
    return diff > 50000; // Basic laplacian-style edge intensity check
}

function checkColor(ctx) {
    const d = ctx.getImageData(250, 250, 100, 100).data;
    for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i]-d[i+1]) > 15) return true;
    }
    return false;
}

function checkBackground(ctx) {
    const corners = [ctx.getImageData(10,10,1,1).data, ctx.getImageData(580,10,1,1).data];
    return corners.every(p => p[0] > 190 && p[1] > 190 && p[2] > 190);
}

function updateUI(id, pass) {
    const el = document.getElementById(id);
    el.className = pass ? 'passed' : 'failed';
    el.innerText = (pass ? '✅ ' : '❌ ') + el.innerText.replace('✅ ', '').replace('❌ ', '');
}

function render4x6(img) {
    cvsPreview.width = 1800; cvsPreview.height = 1200;
    const ctx = cvsPreview.getContext('2d');
    ctx.fillStyle = "white"; ctx.fillRect(0,0,1800,1200);
    const gap = 60;
    const startX = 280;
    const startY = 40;

    for(let r=0; r<2; r++){
        for(let c=0; c<2; c++){
            ctx.drawImage(img, startX + (c*(600+gap)), startY + (r*(600+gap)), 600, 600);
        }
    }
}

document.getElementById('zoomIn').onclick = () => cropper.zoom(0.1);
document.getElementById('zoomOut').onclick = () => cropper.zoom(-0.1);

downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = 'passport_4x6_sheet.jpg';
    link.href = cvsPreview.toDataURL('image/jpeg', 0.98);
    link.click();
};
