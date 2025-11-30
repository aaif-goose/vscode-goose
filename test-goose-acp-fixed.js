#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');

console.log('Testing Goose ACP implementation...\n');

// Clean environment - remove any databricks configs
const cleanEnv = { ...process.env };
delete cleanEnv.DATABRICKS_HOST;
delete cleanEnv.DATABRICKS_TOKEN;
delete cleanEnv.DATABRICKS_WORKSPACE;

// Try to start goose in ACP mode with clean environment
const goose = spawn('goose', ['acp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        USER: process.env.USER,
        // Only include minimal environment
    }
});

let requestId = 1;

// Setup readline for stdout
const rl = readline.createInterface({
    input: goose.stdout,
    crlfDelay: Infinity
});

// Monitor stderr
goose.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('panic')) {
        console.error('ERROR: Goose panicked:', output);
        process.exit(1);
    } else if (output.includes('Goose ACP agent started')) {
        console.log('✓ Goose ACP agent started successfully\n');
        runTests();
    } else {
        console.log('Goose stderr:', output);
    }
});

// Monitor stdout for JSON-RPC responses
rl.on('line', (line) => {
    try {
        const msg = JSON.parse(line);
        console.log('← Response:', JSON.stringify(msg, null, 2), '\n');
    } catch (e) {
        if (line.trim()) {
            console.log('← Raw:', line);
        }
    }
});

// Handle exit
goose.on('close', (code) => {
    console.log(`\nGoose exited with code ${code}`);
    process.exit(code);
});

function sendRequest(method, params = {}) {
    const req = {
        jsonrpc: '2.0',
        id: requestId++,
        method: method,
        params: params
    };
    console.log(`→ ${method}:`, JSON.stringify(params, null, 2));
    goose.stdin.write(JSON.stringify(req) + '\n');
}

async function runTests() {
    try {
        // Test 1: Initialize
        console.log('=== Test 1: Initialize ===');
        sendRequest('initialize', {
            protocolVersion: 'v1',
            capabilities: {
                streaming: true
            }
        });

        await wait(1500);

        // Test 2: New Session
        console.log('\n=== Test 2: New Session ===');
        sendRequest('newSession', {
            cwd: process.cwd()
        });

        await wait(1500);

        // Test 3: Simple prompt
        console.log('\n=== Test 3: Prompt ===');
        sendRequest('prompt', {
            sessionId: 'test-1',
            prompt: [{
                type: 'text',
                text: 'Say hello'
            }]
        });

        await wait(3000);

        // End tests
        console.log('\n=== Tests Complete ===');
        goose.stdin.end();

    } catch (error) {
        console.error('Test error:', error);
        goose.kill();
    }
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start by waiting for agent to initialize
console.log('Starting Goose ACP agent...');