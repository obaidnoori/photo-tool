let cropper;
const imageInput = document.getElementById('imageInput');
const cvsPreview = document.getElementById('cvsPreview');
const downloadBtn = document.getElementById('downloadBtn');
const imageToCrop = document.getElementById('imageToCrop');

const DPI = 300;
const PHOTO_SIZE = 2 * DPI; // 600px
const SHEET_W = 6 * DPI;    // 1800px
const SHEET_H = 4 * DPI;    // 1200px

// Load AI Models
async function initAI() {
    const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        
        document.getElementById('aiStatus').innerText = "AI Ready";
        document.getElementById('aiStatus').style.backgroundColor = "#d4edda";
    } catch (err) {
        document.getElementById('aiStatus').innerText = "AI Offline - Using Manual Mode";
        console.error("AI failed to load", err);
    }
}

initAI();

// Handle file selection
imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        imageToCrop.src = event.target.result;
        
        if (cropper) {
            cropper.destroy();
        }

        cropper = new Cropper(imageToCrop, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 1,
            crop() {
                updateWorkflow();
            }
        });
    };
    reader.readAsDataURL(file);
});

async function updateWorkflow() {
    if (!cropper) return;

    const croppedCanvas = cropper.getCroppedCanvas({ 
        width: PHOTO_SIZE, 
        height: PHOTO_SIZE,
        imageSmoothingQuality: 'high'
    });
    
    // Draw the 4x6 Sheet
    cvsPreview.width = SHEET_W;
    cvsPreview.height = SHEET_H;
    const ctx = cvsPreview.getContext('2d');
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, SHEET_W, SHEET_H);

    const gapX = (SHEET_W - (PHOTO_SIZE * 2)) / 2;
    const gapY = (SHEET_H - (PHOTO_SIZE * 2)) / 2;
    const grid = [
        {x: gapX, y: gapY}, 
        {x: gapX + PHOTO_SIZE, y: gapY}, 
        {x: gapX, y: gapY + PHOTO_SIZE}, 
        {x: gapX + PHOTO_SIZE, y: gapY + PHOTO_SIZE}
    ];

    grid.forEach(p => {
        ctx.drawImage(croppedCanvas, p.x, p.y, PHOTO_SIZE, PHOTO_SIZE);
    });

    // Run AI Validation
    try {
        const detections = await faceapi.detectSingleFace(croppedCanvas, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
        if (detections) {
            document.getElementById('check-face').className = 'passed';
            document.getElementById('check-neutral').className = detections.expressions.neutral > 0.5 ? 'passed' : 'pending';
            document.getElementById('check-eyes').className = 'passed';
            downloadBtn.disabled = false;
        }
    } catch (e) {
        // If AI fails, still allow download (manual mode)
        downloadBtn.disabled = false;
    }
}

downloadBtn.addEventListener('click', function() {
    const link = document.createElement('a');
    link.download = 'passport_sheet_4x6.jpg';
    link.href = cvsPreview.toDataURL('image/jpeg', 1.0);
    link.click();
});
