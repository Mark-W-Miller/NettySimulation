// src/k1p2-figure8.ts
export function k1p2Figure8Chunk(cycleTicStart, ticsPerBeat, cycleTics, R, a = 1) {
    const points = [];
    const cosR = Math.cos(R);
    const sinR = Math.sin(R);
    for (let i = 0; i < ticsPerBeat; i++) {
        const t = 2 * Math.PI * ((cycleTicStart + i) % cycleTics) / cycleTics;
        let x = a * Math.cos(t);
        let y = (a / 2) * Math.sin(2 * t);
        // Apply CW rotation
        const xRot = x * cosR + y * sinR;
        const yRot = -x * sinR + y * cosR;
        points.push({ x: xRot, y: yRot });
    }
    return points;
}
export class K1P2Figure8 {
    constructor(cycleTics, ticsPerBeat, cycleTicStart = 0, a = 1, initialRotation = 0) {
        this.cycleTics = cycleTics;
        this.ticsPerBeat = ticsPerBeat;
        this.a = a;
        this.cycleTicStart = ((cycleTicStart % cycleTics) + cycleTics) % cycleTics;
        this.rotation = initialRotation;
    }
    nextBeat() {
        const points = k1p2Figure8Chunk(this.cycleTicStart, this.ticsPerBeat, this.cycleTics, this.rotation, this.a);
        this.cycleTicStart = (this.cycleTicStart + this.ticsPerBeat) % this.cycleTics;
        return points;
    }
    rotateCW(delta) {
        this.rotation += delta;
    }
    getRotation() {
        return this.rotation;
    }
    setRotation(rotation) {
        this.rotation = rotation;
    }
}
export function isCenterCross(sampleIndex0Based, cycleTics) {
    return sampleIndex0Based % (cycleTics / 2) === 0;
}
