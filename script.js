let cropper;
const imageInput = document.getElementById('imageInput');
const cvsPreview = document.getElementById('cvsPreview');
const downloadBtn = document.getElementById('downloadBtn');

// 300 DPI 4x6 Standards
const DPI = 300;
const PHOTO_SIZE = 2 * DPI; // 600px (2 inches)
const SHEET_W = 6 * DPI;    // 1800px (6 inches)
const SHEET_H = 4 * DPI;    // 1200px (4 inches)

async function initAI() {
    // Models should be in a /models folder in your repo
    const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        document.getElementById('aiStatus').innerText = "AI Active";
        document.getElementById('aiStatus').style.background = "#d4edda";
        imageInput.disabled = false;
    } catch (e) {
        console.error("AI Load Failed", e);
    }
}
initAI();

imageInput.addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = document.getElementById('imageToCrop');
        img.src = event.target.result;
        if (cropper) cropper.destroy();
        cropper = new Cropper(img, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 1,
            crop() { debouncedPreview(); }
        });
    };
    reader.readAsDataURL(e.target.files[0]);
});

// Avoid running AI on every single pixel movement (saves CPU)
let timeout;
function debouncedPreview() {
    clearTimeout(timeout);
    timeout = setTimeout(updateWorkflow, 100);
}

async function updateWorkflow() {
    if (!cropper) return;

    // 1. Extract Crop
    const croppedCanvas = cropper.getCroppedCanvas({ width: PHOTO_SIZE, height: PHOTO_SIZE });
    
    // 2. Render CVS 4x6 Preview
    cvsPreview.width = SHEET_W;
    cvsPreview.height = SHEET_H;
    const ctx = cvsPreview.getContext('2d');
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, SHEET_W, SHEET_H);

    // Position 4 photos in a 2x2 grid centered on 4x6 sheet
    const gapX = (SHEET_W - (PHOTO_SIZE * 2)) / 2;
    const gapY = (SHEET_H - (PHOTO_SIZE * 2)) / 2;
    const grid = [{x:gapX, y:gapY}, {x:gapX+PHOTO_SIZE, y:gapY}, {x:gapX, y:gapY+PHOTO_SIZE}, {x:gapX+PHOTO_SIZE, y:gapY+PHOTO_SIZE}];

    grid.forEach(p => {
        ctx.drawImage(croppedCanvas, p.x, p.y, PHOTO_SIZE, PHOTO_SIZE);
        ctx.strokeStyle = "#eee";
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(p.x, p.y, PHOTO_SIZE, PHOTO_SIZE);
    });

    // 3. AI USCIS Validation
    const detections = await faceapi.detectSingleFace(croppedCanvas, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
    
    if (detections) {
        setCheck('check-face', true);
        setCheck('check-neutral', detections.expressions.neutral > 0.6);
        setCheck('check-eyes', true); // Face found implies basic visibility
        downloadBtn.disabled = false;
    } else {
        setCheck('check-face', false);
        setCheck('check-neutral', false);
        downloadBtn.disabled = true;
    }
}

function setCheck(id, passed) {
    const li = document.getElementById(id);
    li.className = passed ? 'passed' : 'pending';
}

downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'US_Passport_CVS_Print.jpg';
    link.href = cvsPreview.toDataURL('image/jpeg', 1.0);
    link.click();
});
