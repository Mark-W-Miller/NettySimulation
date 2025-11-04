// src/k1p2-figure8.ts

export function k1p2Figure8Chunk(
    cycleTicStart: number,
    ticsPerBeat: number,
    cycleTics: number,
    R: number,
    scaleX: number = 1,
    scaleY: number = 0.5,
): { x: number, y: number }[] {
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
    private cycleTicStart: number;
    private rotation: number;

    constructor(
        private readonly cycleTics: number,
        private readonly ticsPerBeat: number,
        cycleTicStart: number = 0,
        private scaleX: number = 1,
        private scaleY: number = 0.5,
        initialRotation: number = 0,
    ) {
        this.cycleTicStart = ((cycleTicStart % cycleTics) + cycleTics) % cycleTics;
        this.rotation = initialRotation;
    }

    nextBeat(): { x: number, y: number }[] {
        const points = k1p2Figure8Chunk(
            this.cycleTicStart,
            this.ticsPerBeat,
            this.cycleTics,
            this.rotation,
            this.scaleX,
            this.scaleY,
        );
        this.cycleTicStart = (this.cycleTicStart + this.ticsPerBeat) % this.cycleTics;
        return points;
    }

    rotateCW(delta: number): void {
        this.rotation += delta;
    }

    setScale(scaleX: number, scaleY?: number): void {
        this.scaleX = scaleX;
        this.scaleY = scaleY ?? this.scaleY;
    }

    getScale(): { scaleX: number; scaleY: number } {
        return { scaleX: this.scaleX, scaleY: this.scaleY };
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
