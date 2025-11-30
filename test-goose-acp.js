"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const readline = require("readline");
// Simple ACP test client for Goose
class GooseACPClient {
    constructor() {
        this.requestId = 1;
    }
    async start() {
        console.log('Starting Goose in ACP mode...');
        // Set environment to avoid the databricks panic
        const env = { ...process.env };
        delete env.DATABRICKS_HOST;
        delete env.DATABRICKS_TOKEN;
        this.process = (0, child_process_1.spawn)('goose', ['acp'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: env
        });
        this.rl = readline.createInterface({
            input: this.process.stdout,
            crlfDelay: Infinity
        });
        // Handle stderr
        this.process.stderr.on('data', (data) => {
            console.error('STDERR:', data.toString());
        });
        // Handle stdout
        this.rl.on('line', (line) => {
            if (line.startsWith('Goose ACP agent started')) {
                console.log('Agent started successfully');
                return;
            }
            try {
                const response = JSON.parse(line);
                console.log('← Response:', JSON.stringify(response, null, 2));
            }
            catch (e) {
                console.log('← Output:', line);
            }
        });
        // Handle process exit
        this.process.on('close', (code) => {
            console.log(`Goose process exited with code ${code}`);
            process.exit(code);
        });
        // Wait for startup
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    sendRequest(method, params = {}) {
        const request = {
            jsonrpc: '2.0',
            id: this.requestId++,
            method: method,
            params: params
        };
        console.log('\n→ Request:', method);
        console.log(JSON.stringify(request, null, 2));
        this.process.stdin.write(JSON.stringify(request) + '\n');
    }
    async test() {
        // 1. Initialize
        console.log('\n=== 1. Initialize ===');
        this.sendRequest('initialize', {
            protocolVersion: 'v1',
            capabilities: {
                streaming: true
            }
        });
        await this.wait(2000);
        // 2. Create session
        console.log('\n=== 2. New Session ===');
        this.sendRequest('newSession', {
            cwd: process.cwd(),
            mcpServers: []
        });
        await this.wait(2000);
        // 3. Send a prompt
        console.log('\n=== 3. Send Prompt ===');
        this.sendRequest('prompt', {
            sessionId: 'test-session',
            prompt: [
                {
                    type: 'text',
                    text: 'Hello! Please respond with a simple greeting.'
                }
            ]
        });
        await this.wait(5000);
        // 4. Clean shutdown
        console.log('\n=== Shutting down ===');
        this.process.stdin.end();
        await this.wait(1000);
    }
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
// Run the test
async function main() {
    const client = new GooseACPClient();
    await client.start();
    await client.test();
}
main().catch(console.error);
