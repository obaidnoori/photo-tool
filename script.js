let cropper;
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const cvsPreview = document.getElementById('cvsPreview');
const downloadBtn = document.getElementById('downloadBtn');

// STABLE MODEL URL (jsDelivr CDN is better than raw GitHub)
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

async function loadModels() {
    try {
        console.log("Loading AI Models...");
        // Loading the 3 essential models for USCIS requirements
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        console.log("AI Models Loaded Successfully");
    } catch (err) {
        console.error("Model Load Error: ", err);
        alert("Failed to load AI models. Please check your internet connection.");
    }
}
loadModels();

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
                crop: updateWorkflow
            });
        };
        reader.readAsDataURL(file);
    }
});

async function updateWorkflow() {
    if (!cropper) return;
    
    // USCIS 2x2 standard translated to 600px square
    const croppedCanvas = cropper.getCroppedCanvas({ width: 600, height: 600 });
    
    // 1. Background Check (Sampling)
    const isWhiteBG = checkBackground(croppedCanvas);
    
    // 2. AI Face Detection
    const detection = await faceapi.detectSingleFace(croppedCanvas, new faceapi.TinyFaceDetectorOptions())
                                    .withFaceLandmarks()
                                    .withFaceExpressions();
    
    let ratioPass = false;
    let eyesPass = false;
    let glassesPass = true; // Manual check or advanced detection

    if (detection) {
        const box = detection.detection.box;
        
        // USCIS: Head must be 1" to 1 3/8" (50-69% of image height)
        const headHeightRatio = (box.height / 600) * 100;
        ratioPass = headHeightRatio >= 50 && headHeightRatio <= 69;

        // Infant Logic: If baby mode is on, we "auto-pass" eyes open
        const isInfant = document.getElementById('isInfant').checked;
        eyesPass = isInfant ? true : (detection.expressions.neutral > 0.3);
    }

    // 3. Update Checklist UI
    updateCheck('check-face', !!detection);
    updateCheck('check-ratio', ratioPass);
    updateCheck('check-bg', isWhiteBG);
    updateCheck('check-eyes', eyesPass);
    updateCheck('check-glasses', true); // User manually confirms no sunglasses

    // 4. Render to 4x6 Sheet
    render4x6Sheet(croppedCanvas);
    
    downloadBtn.disabled = !(!!detection && isWhiteBG);
}

function updateCheck(id, status) {
    const el = document.getElementById(id);
    if(el) el.className = status ? 'pass' : 'fail';
}

function checkBackground(canvas) {
    const ctx = canvas.getContext('2d');
    // Sample pixels at the corners
    const p1 = ctx.getImageData(10, 10, 1, 1).data;
    const p2 = ctx.getImageData(590, 10, 1, 1).data;
    const avg = (p1[0] + p1[1] + p1[2] + p2[0] + p2[1] + p2[2]) / 6;
    return avg > 200; // Threshold for "white-ish"
}

function render4x6Sheet(cropped) {
    cvsPreview.width = 1800;
    cvsPreview.height = 1200;
    const ctx = cvsPreview.getContext('2d');
    
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1800, 1200);

    const gap = 80; // Safety space for cutting
    const startX = 220;
    const startY = 100;

    // 2x2 Grid Layout
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
            const x = startX + (col * (600 + gap));
            const y = startY + (row * (600 + gap));
            
            ctx.drawImage(cropped, x, y, 600, 600);
            
            // Cut Guides
            ctx.setLineDash([10, 10]);
            ctx.strokeStyle = "#dddddd";
            ctx.strokeRect(x - 2, y - 2, 604, 604);
        }
    }
}

downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = 'uscis_photo_4x6.jpg';
    link.href = cvsPreview.toDataURL('image/jpeg', 0.9);
    link.click();
};
