#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');

// Spawn goose in ACP mode
console.log('Starting Goose in ACP mode...');
const gooseProcess = spawn('goose', ['acp'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Create interface for reading responses
const rl = readline.createInterface({
  input: gooseProcess.stdout,
  crlfDelay: Infinity
});

// Track request IDs
let requestId = 1;

// Helper to send JSON-RPC request
function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method: method,
    params: params
  };

  console.log('\n→ Sending:', JSON.stringify(request, null, 2));
  gooseProcess.stdin.write(JSON.stringify(request) + '\n');
}

// Helper to send notification (no id)
function sendNotification(method, params = {}) {
  const notification = {
    jsonrpc: '2.0',
    method: method,
    params: params
  };

  console.log('\n→ Sending notification:', JSON.stringify(notification, null, 2));
  gooseProcess.stdin.write(JSON.stringify(notification) + '\n');
}

// Listen for responses
rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    console.log('← Received:', JSON.stringify(response, null, 2));
  } catch (e) {
    console.log('← Raw output:', line);
  }
});

// Handle process events
gooseProcess.on('error', (err) => {
  console.error('Failed to start Goose:', err);
  process.exit(1);
});

gooseProcess.on('close', (code) => {
  console.log(`Goose process exited with code ${code}`);
  process.exit(code);
});

// Test sequence
async function runTests() {
  console.log('\n=== Testing ACP Protocol with Goose ===\n');

  // Wait a bit for process to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 1: Initialize
  console.log('\n1. Testing initialize...');
  sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {
      experimental: {},
      prompts: {},
      resources: {},
      tools: {},
      logging: {}
    },
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  });

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: List resources
  console.log('\n2. Testing resources/list...');
  sendRequest('resources/list', {});

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: List prompts
  console.log('\n3. Testing prompts/list...');
  sendRequest('prompts/list', {});

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 4: List tools
  console.log('\n4. Testing tools/list...');
  sendRequest('tools/list', {});

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 5: Try a prompt
  console.log('\n5. Testing prompts/get (if any prompts exist)...');
  sendRequest('prompts/get', {
    name: 'test'
  });

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 6: Completion request (new format for ACP)
  console.log('\n6. Testing completion...');
  sendRequest('completion', {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'Hello! Can you respond with a simple greeting?'
        }
      }
    ],
    includeContext: 'none',
    modelPreferences: {
      hints: [
        {
          name: 'claude-3-5-sonnet-latest'
        }
      ]
    }
  });

  // Wait longer for completion
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n\nTests complete. Waiting 3 seconds before exit...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Clean exit
  gooseProcess.stdin.end();
}

// Run tests
runTests().catch(console.error);