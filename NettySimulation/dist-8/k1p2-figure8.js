// src/k1p2-figure8.ts
export function k1p2Figure8Chunk(cycleTicStart, ticsPerBeat, cycleTics, R, scaleX = 1, scaleY = 0.5) {
    const points = [];
    const cosR = Math.cos(R);
    const sinR = Math.sin(R);
    for (let i = 0; i < ticsPerBeat; i++) {
        const t = 2 * Math.PI * ((cycleTicStart + i) % cycleTics) / cycleTics;
        const x = scaleX * Math.cos(t);
        const y = scaleY * Math.sin(2 * t);
        // Apply CW rotation
        const xRot = x * cosR + y * sinR;
        const yRot = -x * sinR + y * cosR;
        points.push({ x: xRot, y: yRot });
    }
    return points;
}
export class K1P2Figure8 {
    constructor(cycleTics, ticsPerBeat, cycleTicStart = 0, scaleX = 1, scaleY = 0.5, initialRotation = 0) {
        Object.defineProperty(this, "cycleTics", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: cycleTics
        });
        Object.defineProperty(this, "ticsPerBeat", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ticsPerBeat
        });
        Object.defineProperty(this, "scaleX", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: scaleX
        });
        Object.defineProperty(this, "scaleY", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: scaleY
        });
        Object.defineProperty(this, "cycleTicStart", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rotation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.cycleTicStart = ((cycleTicStart % cycleTics) + cycleTics) % cycleTics;
        this.rotation = initialRotation;
    }
    nextBeat() {
        const points = k1p2Figure8Chunk(this.cycleTicStart, this.ticsPerBeat, this.cycleTics, this.rotation, this.scaleX, this.scaleY);
        this.cycleTicStart = (this.cycleTicStart + this.ticsPerBeat) % this.cycleTics;
        return points;
    }
    rotateCW(delta) {
        this.rotation += delta;
    }
    setScale(scaleX, scaleY) {
        this.scaleX = scaleX;
        this.scaleY = scaleY ?? this.scaleY;
    }
    getScale() {
        return { scaleX: this.scaleX, scaleY: this.scaleY };
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
