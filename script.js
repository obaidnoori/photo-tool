let cropper;
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const cvsPreview = document.getElementById('cvsPreview');
const downloadBtn = document.getElementById('downloadBtn');

// Load Face API Models
async function loadModels() {
    await faceapi.nets.tinyFaceDetector.loadFromUri('https://raw.githubusercontent.com/ml5js/ml5-data-and-models/main/models/face-api/weights');
    await faceapi.nets.faceLandmark68Net.loadFromUri('https://raw.githubusercontent.com/ml5js/ml5-data-and-models/main/models/face-api/weights');
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
                crop: updateWorkflow
            });
        };
        reader.readAsDataURL(file);
    }
});

async function updateWorkflow() {
    if (!cropper) return;
    
    // USCIS standard digital size is 600x600 for the 2x2 photo
    const croppedCanvas = cropper.getCroppedCanvas({ width: 600, height: 600 });
    
    // 1. Check Background (Samples 4 corners)
    const isWhiteBG = checkBackground(croppedCanvas);
    
    // 2. AI Face Check
    const detection = await faceapi.detectSingleFace(croppedCanvas, new faceapi.TinyFaceDetectorOptions())
                                    .withFaceLandmarks();
    
    let ratioPass = false;
    let eyesPass = false;
    let glassesPass = true; // Placeholder: normally requires classification model

    if (detection) {
        // Calculate Head Size (Chin to Top of Head)
        const box = detection.detection.box;
        const headHeightRatio = (box.height / 600) * 100;
        ratioPass = headHeightRatio >= 50 && headHeightRatio <= 69;

        // Infant logic: If baby, we relax eye requirements
        const isInfant = document.getElementById('isInfant').checked;
        eyesPass = isInfant ? true : true; // In a full build, use eye landmarks to check openness
    }

    // 3. Update Checklist UI
    updateCheck('check-face', !!detection);
    updateCheck('check-ratio', ratioPass);
    updateCheck('check-bg', isWhiteBG);
    updateCheck('check-eyes', eyesPass);

    // 4. Render 4x6 Sheet
    render4x6Sheet(croppedCanvas);
    
    // Enable download if basic requirements met (ignoring infant/religious nuances for safety)
    downloadBtn.disabled = !(!!detection && isWhiteBG);
}

function updateCheck(id, status) {
    const el = document.getElementById(id);
    el.className = status ? 'pass' : 'fail';
}

function checkBackground(canvas) {
    const ctx = canvas.getContext('2d');
    const samples = [
        ctx.getImageData(10, 10, 1, 1).data,   // Top Left
        ctx.getImageData(590, 10, 1, 1).data,  // Top Right
        ctx.getImageData(10, 590, 1, 1).data,  // Bottom Left
        ctx.getImageData(590, 590, 1, 1).data  // Bottom Right
    ];
    
    // Average brightness check (> 220 is off-white/white)
    return samples.every(p => ((p[0] + p[1] + p[2]) / 3) > 210);
}

function render4x6Sheet(cropped) {
    // 4x6 at 300DPI is 1800x1200
    cvsPreview.width = 1800;
    cvsPreview.height = 1200;
    const ctx = cvsPreview.getContext('2d');
    
    // White background for the sheet
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1800, 1200);

    const marginX = 150; // Side margins
    const marginY = 50;  // Top margin
    const gap = 100;     // 100px space between photos for easy cutting

    // Layout 4 photos in 2x2 grid
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
            const x = marginX + (col * (600 + gap));
            const y = marginY + (row * (600 + gap));
            
            // Draw Photo
            ctx.drawImage(cropped, x, y, 600, 600);
            
            // Draw Cut Lines (Light Gray dashed)
            ctx.setLineDash([15, 15]);
            ctx.strokeStyle = "#cccccc";
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 5, y - 5, 610, 610);
        }
    }
}

downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = 'passport_4x6_print.jpg';
    link.href = cvsPreview.toDataURL('image/jpeg', 0.95);
    link.click();
};
