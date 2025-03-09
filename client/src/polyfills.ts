// Polyfill for Node.js globals and modules in browser environment
import cryptoBrowserify from 'crypto-browserify';
import randomBytes from 'randombytes';
import { Buffer } from 'buffer';

// Define global if it doesn't exist
if (typeof window !== 'undefined' && typeof window.global === 'undefined') {
    (window as any).global = window;
}

// Define process if it doesn't exist
if (typeof window !== 'undefined' && typeof (window as any).process === 'undefined') {
    (window as any).process = {
        env: {},
        browser: true,
        version: '',
        nextTick: (callback: Function, ...args: any[]) => setTimeout(() => callback(...args), 0),
    };
}

// Define Buffer if it doesn't exist
if (typeof window !== 'undefined') {
    (window as any).Buffer = Buffer;
}

// Add randomBytes to window - don't try to modify crypto directly
if (typeof window !== 'undefined') {
    // Expose randomBytes globally
    (window as any).randomBytes = randomBytes;

    // Create a global crypto module for Node.js compatibility
    (window as any).cryptoModule = cryptoBrowserify;
}

// Add some utilities to help debug
console.log('Polyfills loaded');
console.log('randomBytes available:', typeof (window as any).randomBytes === 'function');
console.log('Buffer available:', typeof (window as any).Buffer !== 'undefined');
console.log('cryptoModule available:', typeof (window as any).cryptoModule !== 'undefined');

export default {}; 