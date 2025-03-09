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

// Add crypto polyfills
if (typeof window !== 'undefined') {
    (window as any).crypto = {
        ...(window as any).crypto,
        ...cryptoBrowserify,
    };

    // Explicitly add randomBytes
    (window as any).randomBytes = randomBytes;

    // Also add it to the global crypto object
    if (!(window as any).crypto.randomBytes) {
        (window as any).crypto.randomBytes = randomBytes;
    }
}

export default {}; 