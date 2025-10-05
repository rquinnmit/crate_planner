/**
 * Interactive Chat with LLM
 * 
 * Real-time chat where you can type your own prompts and get immediate responses
 */

import { GeminiLLM, Config } from './src/llm/gemini-llm';
import * as readline from 'readline';

function loadConfig(): Config {
    try {
        const config = require('./config/config.json');
        return config;
    } catch (error) {
        console.error('❌ Error loading config/config.json');
        process.exit(1);
    }
}

async function startChat() {
    console.log('🤖 Interactive LLM Chat');
    console.log('========================\n');
    
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    
    // Test connection
    console.log('🔌 Testing connection...');
    try {
        const connected = await llm.testConnection();
        if (!connected) {
            console.log('❌ Connection failed');
            return;
        }
        console.log('✅ Connected!\n');
    } catch (error) {
        console.log('❌ Connection error:', (error as Error).message);
        return;
    }
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log('💬 Type your prompts below. Type "exit" to quit.\n');
    
    const chat = () => {
        rl.question('You: ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                console.log('\n👋 Goodbye!');
                rl.close();
                return;
            }
            
            if (input.trim() === '') {
                chat();
                return;
            }
            
            try {
                console.log('\n🤖 Thinking...');
                const response = await llm.executeLLM(input);
                console.log(`\n🤖 LLM: ${response}\n`);
            } catch (error) {
                console.log(`\n❌ Error: ${(error as Error).message}\n`);
            }
            
            chat();
        });
    };
    
    chat();
}

startChat().catch(console.error);
