// Import crypto-browserify
import cryptoBrowserify from 'crypto-browserify';
import randomBytesFunc from 'randombytes';

// Export randomBytes explicitly as a named export
export const randomBytes = randomBytesFunc;

// Create a wrapper function to keep native crypto functionality
// but add Node.js crypto functionality where it's missing
const createCryptoPolyfill = () => {
    // Start with the crypto-browserify implementation
    const cryptoPolyfill = { ...cryptoBrowserify };

    // Add randomBytes explicitly
    if (!cryptoPolyfill.randomBytes) {
        cryptoPolyfill.randomBytes = randomBytesFunc;
    }

    // Return the enhanced crypto object
    return cryptoPolyfill;
};

// Export a crypto implementation with all Node.js methods
export default createCryptoPolyfill(); 