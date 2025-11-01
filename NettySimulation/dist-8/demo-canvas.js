// src/demo-canvas.ts
import { K1P2Figure8 } from './k1p2-figure8.js';
const canvas = document.createElement('canvas');
canvas.width = 640;
canvas.height = 640;
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');
const figure8 = new K1P2Figure8(100, 10, 0, 2, 0.5);
function draw() {
    if (ctx) {
        ctx.fillStyle = 'rgba(28, 99, 241, 1)';
        const points = figure8.nextBeat();
        ctx.strokeStyle = `100%, 100%, 50%)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        points.forEach((point, index) => {
            const x = canvas.width / 2 + point.x * 100;
            const y = canvas.height / 2 - point.y * 100;
            if (index === 0) {
                ctx.moveTo(x, y);
            }
            else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        figure8.rotateCW(0.01);
    }
}
setInterval(draw, 120);
