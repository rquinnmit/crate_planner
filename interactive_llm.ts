/**
 * Interactive LLM Chat
 * 
 * Simple interactive chat with the Gemini LLM for testing and experimentation
 */

import { GeminiLLM, Config } from './src/llm/gemini-llm';
import * as readline from 'readline';

/**
 * Load configuration from config/config.json
 */
function loadConfig(): Config {
    try {
        const config = require('./config/config.json');
        return config;
    } catch (error) {
        console.error('❌ Error loading config/config.json. Please ensure it exists with your API key.');
        console.error('Error details:', (error as Error).message);
        process.exit(1);
    }
}

/**
 * Main interactive chat function
 */
async function startInteractiveChat(): Promise<void> {
    console.log('🤖 Interactive LLM Chat');
    console.log('========================\n');
    
    const config = loadConfig();
    const llm = new GeminiLLM(config);
    
    // Test connection first
    console.log('🔌 Testing connection to Gemini API...');
    try {
        const isConnected = await llm.testConnection();
        if (!isConnected) {
            console.log('❌ Connection failed. Please check your API key.');
            return;
        }
        console.log('✅ Connected successfully!\n');
    } catch (error) {
        console.log('❌ Connection error:', (error as Error).message);
        return;
    }
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log('💬 Start chatting! Type "exit" to quit.\n');
    
    const askQuestion = (): void => {
        rl.question('You: ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                console.log('\n👋 Goodbye!');
                rl.close();
                return;
            }
            
            if (input.trim() === '') {
                askQuestion();
                return;
            }
            
            try {
                console.log('\n🤖 Thinking...');
                const response = await llm.executeLLM(input);
                console.log(`\n🤖 LLM: ${response}\n`);
            } catch (error) {
                console.log(`\n❌ Error: ${(error as Error).message}\n`);
            }
            
            askQuestion();
        });
    };
    
    askQuestion();
}

// Run the interactive chat
if (require.main === module) {
    startInteractiveChat().catch(console.error);
}
