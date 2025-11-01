// src/k1p2-figure8.ts

export function k1p2Figure8Chunk(cycleTicStart: number, ticsPerBeat: number, cycleTics: number, R: number, a: number = 1): { x: number, y: number }[] {
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
    private cycleTicStart: number;
    private rotation: number;

    constructor(
        private readonly cycleTics: number,
        private readonly ticsPerBeat: number,
        cycleTicStart: number = 0,
        private readonly a: number = 1,
        initialRotation: number = 0,
    ) {
        this.cycleTicStart = ((cycleTicStart % cycleTics) + cycleTics) % cycleTics;
        this.rotation = initialRotation;
    }

    nextBeat(): { x: number, y: number }[] {
        const points = k1p2Figure8Chunk(this.cycleTicStart, this.ticsPerBeat, this.cycleTics, this.rotation, this.a);
        this.cycleTicStart = (this.cycleTicStart + this.ticsPerBeat) % this.cycleTics;
        return points;
    }

    rotateCW(delta: number): void {
        this.rotation += delta;
    }

    getRotation(): number {
        return this.rotation;
    }

    setRotation(rotation: number): void {
        this.rotation = rotation;
    }
}

export function isCenterCross(sampleIndex0Based: number, cycleTics: number): boolean {
    return sampleIndex0Based % (cycleTics / 2) === 0;
}
