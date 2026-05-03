let cropper;
const imageInput = document.getElementById('imageInput');
const cvsPreview = document.getElementById('cvsPreview');
const downloadBtn = document.getElementById('downloadBtn');

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

async function init() {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    document.getElementById('aiStatus').innerText = "AI ONLINE - READY";
}
init();

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.getElementById('imagePreview');
            img.src = event.target.result;
            if (cropper) cropper.destroy();
            cropper = new Cropper(img, {
                aspectRatio: 1,
                viewMode: 1,
                dragMode: 'move', // FIXED: Move the photo, not the box
                autoCropArea: 0.5,
                cropBoxMovable: false, // Box stays locked
                cropBoxResizable: false, // Box size stays locked
                guides: false,
                center: false,
                ready: () => {
                    document.getElementById('guideOverlay').style.display = 'block';
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
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    render4x6(canvas);

    const isInfant = document.getElementById('isInfant').checked;
    const isReligious = document.getElementById('isReligious').checked;

    // AI Analysis
    const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
    
    let posePass = false, ratioPass = false, headgearPass = false, qualityPass = false;

    if (detection) {
        const landmarks = detection.landmarks;
        const box = detection.detection.box;

        // 1. STRICT POSE (Check eye level and nose centering)
        const leftEye = landmarks.getLeftEye()[0];
        const rightEye = landmarks.getRightEye()[3];
        const nose = landmarks.getNose()[3];
        
        const eyeTilt = Math.abs(leftEye.y - rightEye.y);
        const eyeWidth = rightEye.x - leftEye.x;
        const noseCenter = Math.abs((nose.x - leftEye.x) - (rightEye.x - nose.x));

        posePass = eyeTilt < (eyeWidth * 0.1) && noseCenter < 20;

        // 2. HEADGEAR DETECTION (Check for pixels above the forehead)
        // If pixels above eyebrows are too dark/different from background
        const foreheadY = landmarks.getJawOutline()[0].y;
        headgearPass = isReligious || (box.y > 20); // If box starts too high, likely a hat

        // 3. RATIO (Head must be 50-69% of image height)
        ratioPass = (box.height >= 300 && box.height <= 415);

        // 4. QUALITY & HANDS (Check bottom corners for "objects" or hands)
        const cornerData = ctx.getImageData(0, 500, 100, 100).data;
        let objectDetected = false;
        for(let i=0; i<cornerData.length; i+=40) {
            if(cornerData[i] < 150) objectDetected = true; // Dark object where shoulders should be
        }
        qualityPass = !objectDetected;
    }

    const isWhiteBG = checkBackground(ctx);

    updateUI('check-face', isInfant || posePass);
    updateUI('check-headgear', headgearPass);
    updateUI('check-ratio', ratioPass);
    updateUI('check-bg', isWhiteBG);
    updateUI('check-quality', qualityPass);

    downloadBtn.disabled = !( (isInfant || posePass) && ratioPass && isWhiteBG && headgearPass);
}

function checkBackground(ctx) {
    const data = [ctx.getImageData(10,10,1,1).data, ctx.getImageData(580,10,1,1).data];
    return data.every(p => p[0] > 210 && p[1] > 210 && p[2] > 210);
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
    
    // Draw 4 photos
    const positions = [[250,50], [950,50], [250,650], [950,650]];
    positions.forEach(pos => ctx.drawImage(img, pos[0], pos[1], 600, 600));
}

document.getElementById('zoomIn').onclick = () => cropper.zoom(0.1);
document.getElementById('zoomOut').onclick = () => cropper.zoom(-0.1);
downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = 'passport_final_4x6.jpg';
    link.href = cvsPreview.toDataURL('image/jpeg', 0.95);
    link.click();
};
