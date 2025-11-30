#!/usr/bin/env node
/**
 * Simple JavaScript test for Goose ACP - no TypeScript complexity
 */

const { spawn } = require('child_process');

console.log('=== Simple Goose ACP Test ===\n');

// Start Goose in ACP mode
const goose = spawn('goose', ['acp'], {
    stdio: ['pipe', 'pipe', 'pipe']
});

let requestId = 1;

// Monitor stderr
goose.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('panic')) {
        console.error('❌ PANIC DETECTED:');
        console.error(output);
        process.exit(1);
    } else if (output.includes('Goose ACP agent started')) {
        console.log('✓ Goose agent started\n');
        // Send initialize request after agent starts
        sendInitialize();
    } else if (output.trim()) {
        console.error('Stderr:', output);
    }
});

// Monitor stdout for responses
goose.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
        try {
            const msg = JSON.parse(line);
            console.log('✓ Response received:');
            console.log(JSON.stringify(msg, null, 2));

            if (msg.result) {
                console.log('\n🎉 SUCCESS: Initialize worked without panic!');
                console.log('Protocol version:', msg.result.protocolVersion);
                goose.kill();
                process.exit(0);
            }
        } catch (e) {
            // Not JSON, ignore
        }
    });
});

// Handle process exit
goose.on('close', (code) => {
    console.log(`\nGoose exited with code ${code}`);
    if (code !== 0) {
        console.log('❌ Test failed');
    }
    process.exit(code || 0);
});

function sendInitialize() {
    console.log('Sending initialize request...');
    const request = {
        jsonrpc: '2.0',
        id: requestId++,
        method: 'initialize',
        params: {
            protocolVersion: 1  // uint16
        }
    };

    console.log('Request:', JSON.stringify(request, null, 2));
    goose.stdin.write(JSON.stringify(request) + '\n');

    // Set timeout for response
    setTimeout(() => {
        console.error('\n❌ Timeout: No response received after 5 seconds');
        goose.kill();
        process.exit(1);
    }, 5000);
}

// Handle errors
goose.on('error', (err) => {
    console.error('Failed to start Goose:', err);
    process.exit(1);
});