declare module "gif.js" {
  interface GIFOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    background?: string;
    transparent?: string | number | null;
    repeat?: number;
    debug?: boolean;
  }
  interface AddFrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  }
  export default class GIF {
    constructor(opts?: GIFOptions);
    addFrame(image: CanvasImageSource | HTMLCanvasElement, opts?: AddFrameOptions): void;
    on(event: "progress", cb: (p: number) => void): void;
    on(event: "finished", cb: (blob: Blob) => void): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
    render(): void;
    abort(): void;
  }
}
