const webpack = require('webpack');

module.exports = function override(config) {
    const fallback = config.resolve.fallback || {};
    Object.assign(fallback, {
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "os": require.resolve("os-browserify"),
        "url": require.resolve("url"),
        "buffer": require.resolve("buffer"),
        "path": require.resolve("path-browserify"),
        "fs": false,
        "net": false,
        "tls": false,
        "zlib": false
    });
    config.resolve.fallback = fallback;

    // Add alias for brotli
    config.resolve.alias = {
        ...config.resolve.alias,
        "brotli": "pako"
    };

    config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer']
        }),
        new webpack.DefinePlugin({
            'Browser': JSON.stringify(true)
        })
    ]);
    
    // Ignore warnings about source maps
    config.ignoreWarnings = [/Failed to parse source map/];
    
    return config;
} 