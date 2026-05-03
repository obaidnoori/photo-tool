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
                dragMode: 'move', // FIXED: Allows moving photo behind stencil
                autoCropArea: 0.8,
                ready: () => {
                    guideOverlay.style.display = 'block';
                    updateWorkflow();
                },
                crop: updateWorkflow // Trigger on move/zoom
            });
        };
        reader.readAsDataURL(file);
    }
});

async function updateWorkflow() {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: 600, height: 600 });
    if (!canvas || canvas.width === 0) return;

    // Fix Console Warning: willReadFrequently
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Always render preview even if requirements fail
    render4x6(canvas);

    const isColor = checkColor(ctx);
    const isWhiteBG = checkBackground(ctx);
    const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();

    let ratioPass = false, posePass = false, headgearPass = true;

    if (detection) {
        const landmarks = detection.landmarks;
        const box = detection.detection.box;
        
        // Ratio Check
        ratioPass = (box.height >= 300 && box.height <= 414);

        // Pose Check
        const nose = landmarks.getNose()[0].x;
        const leftEye = landmarks.getLeftEye()[0].x;
        const rightEye = landmarks.getRightEye()[3].x;
        posePass = Math.abs((nose - leftEye) - (rightEye - nose)) < 15;

        // Headgear logic: Simple landmark check for forehead occlusion
        const foreheadY = landmarks.getJawOutline()[0].y;
        headgearPass = document.getElementById('isReligious').checked || box.y < foreheadY;
    }

    const isInfant = document.getElementById('isInfant').checked;

    updateUI('check-face', detection && (posePass || isInfant));
    updateUI('check-ratio', ratioPass);
    updateUI('check-color', isColor);
    updateUI('check-bg', isWhiteBG);
    updateUI('check-headgear', headgearPass);

    // Lock Download until all green
    downloadBtn.disabled = !(detection && ratioPass && isColor && isWhiteBG && headgearPass && (posePass || isInfant));
}

function checkColor(ctx) {
    const d = ctx.getImageData(250, 250, 100, 100).data;
    for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i]-d[i+1]) > 20 || Math.abs(d[i]-d[i+2]) > 20) return true;
    }
    return false;
}

function checkBackground(ctx) {
    const s = [ctx.getImageData(10,10,1,1).data, ctx.getImageData(580,10,1,1).data];
    return s.every(p => p[0] > 200 && p[1] > 200 && p[2] > 200);
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
    const gap = 80;
    for(let r=0; r<2; r++){
        for(let c=0; c<2; c++){
            ctx.drawImage(img, 250 + (c*(600+gap)), 50 + (r*(600+gap)), 600, 600);
        }
    }
}

document.getElementById('zoomIn').onclick = () => cropper.zoom(0.1);
document.getElementById('zoomOut').onclick = () => cropper.zoom(-0.1);
downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = 'passport_sheet.jpg';
    link.href = cvsPreview.toDataURL('image/jpeg', 0.95);
    link.click();
};
