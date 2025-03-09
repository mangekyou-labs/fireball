// Type definitions for modules without their own type declarations

declare module 'crypto-browserify' {
    const crypto: any;
    export default crypto;
}

declare module 'randombytes' {
    function randomBytes(size: number): Buffer;
    function randomBytes(size: number, callback: (err: Error | null, buf: Buffer) => void): void;
    export default randomBytes;
} 