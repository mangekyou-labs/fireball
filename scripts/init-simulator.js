const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * This script initializes the trading simulator with our token addresses and configurations
 */

// Path to simulator directory
const SIMULATOR_DIR = path.join(__dirname, '..', 'trading-simulator');

// Check if simulator directory exists
if (!fs.existsSync(SIMULATOR_DIR)) {
    console.error(`Error: Trading simulator directory not found at ${SIMULATOR_DIR}`);
    console.error('Please make sure you have the trading-simulator folder in the project root.');
    process.exit(1);
}

// Function to run a command in the simulator directory
function runSimulatorCommand(command, args) {
    return new Promise((resolve, reject) => {
        console.log(`Running: ${command} ${args.join(' ')}`);

        const child = spawn(command, args, {
            cwd: SIMULATOR_DIR,
            stdio: 'inherit',
            shell: true
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });
    });
}

// Function to check if environment file exists
function checkEnvFile() {
    const envPath = path.join(SIMULATOR_DIR, '.env');
    if (!fs.existsSync(envPath)) {
        console.log('Creating .env file from .env.example...');
        const envExamplePath = path.join(SIMULATOR_DIR, '.env.example');
        if (!fs.existsSync(envExamplePath)) {
            console.error('Error: .env.example not found in trading-simulator directory.');
            process.exit(1);
        }
        fs.copyFileSync(envExamplePath, envPath);
    }
    return true;
}

// Main function to initialize the simulator
async function initializeSimulator() {
    try {
        console.log('=== Initializing Trading Simulator ===');

        // Step 1: Check for environment file
        checkEnvFile();

        // Step 2: Install dependencies
        console.log('\nInstalling simulator dependencies...');
        await runSimulatorCommand('npm', ['install']);

        // Step 3: Initialize database
        console.log('\nInitializing simulator database...');
        await runSimulatorCommand('npm', ['run', 'db:init']);

        // Step 4: Set up admin account
        console.log('\nSetting up admin account...');
        await runSimulatorCommand('npm', ['run', 'setup:admin']);

        // Step 5: Create a test team for development
        console.log('\nCreating test team...');
        await runSimulatorCommand('npm', ['run', 'register:team', 'Fireball-Dev-Team', 'dev@fireball.ai']);

        console.log('\n=== Initialization Complete ===');
        console.log('\nYou can now:');
        console.log('1. Start the simulator with: cd trading-simulator && npm run dev');
        console.log('2. Visit http://localhost:3000/admin to access the admin panel');
        console.log('3. Configure the client to use the simulator in the Trading Simulator tab');

    } catch (error) {
        console.error('Error initializing simulator:', error);
        process.exit(1);
    }
}

// Run the initialization
initializeSimulator(); 