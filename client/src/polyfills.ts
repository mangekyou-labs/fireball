// Polyfill for Node.js globals and modules in browser environment

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
if (typeof window !== 'undefined' && typeof (window as any).Buffer === 'undefined') {
    (window as any).Buffer = {
        isBuffer: () => false,
    };
}

export default {}; 