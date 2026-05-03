const imageInput = document.getElementById('imageInput');
const generateBtn = document.getElementById('generateBtn');
const canvas = document.createElement('canvas'); // Hidden canvas for tiling

// Constants for 4x6 sheet at 300 DPI
const DPI = 300;
const PHOTO_SIZE = 2 * DPI; // 600px
const SHEET_W = 6 * DPI;    // 1800px
const SHEET_H = 4 * DPI;    // 1200px

let userImage = new Image();

imageInput.addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        userImage.src = event.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
});

generateBtn.addEventListener('click', () => {
    if (!userImage.src) return alert("Please select a photo first!");

    // Set high-res canvas dimensions
    canvas.width = SHEET_W;
    canvas.height = SHEET_H;
    const ctx = canvas.getContext('2d');

    // Fill background white
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, SHEET_W, SHEET_H);

    // Grid layout for 6 photos (3 columns, 2 rows)
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
            const x = col * PHOTO_SIZE;
            const y = row * PHOTO_SIZE;
            
            // Draw the 2x2 photo
            ctx.drawImage(userImage, x, y, PHOTO_SIZE, PHOTO_SIZE);
            
            // Draw very faint cut-lines
            ctx.strokeStyle = "#eeeeee";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, PHOTO_SIZE, PHOTO_SIZE);
        }
    }

    // Download as High-Quality JPEG
    const link = document.createElement('a');
    link.download = 'passport_4x6_ready_to_print.jpg';
    link.href = canvas.toDataURL('image/jpeg', 1.0);
    link.click();
});
