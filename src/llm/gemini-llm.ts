/**
 * LLM Integration for CratePilot
 * 
 * Handles AI-powered crate planning using Google's Gemini API.
 * Provides flexible configuration for model selection, temperature, and token limits.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

/**
 * Configuration for API access
 */
export interface Config {
    apiKey: string;
}

/**
 * LLM execution options
 */
export interface LLMOptions {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
}

/**
 * LLM response with metadata
 */
export interface LLMResponse {
    text: string;
    model: string;
    tokensUsed?: number;
    finishReason?: string;
}

/**
 * GeminiLLM class - wrapper for Google's Gemini API
 */
export class GeminiLLM {
    private apiKey: string;
    private genAI: GoogleGenerativeAI;
    private defaultOptions: LLMOptions;

    constructor(config: Config, options?: LLMOptions) {
        this.apiKey = config.apiKey;
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.defaultOptions = {
            model: 'gemini-2.0-flash-exp',
            temperature: 0.7,
            maxOutputTokens: 2000,
            topP: 0.95,
            topK: 40,
            ...options
        };
    }

    /**
     * Execute LLM with a prompt (simple interface for backwards compatibility)
     * 
     * @param prompt - The prompt to send to the LLM
     * @param options - Optional execution parameters
     * @returns The LLM response text
     */
    async executeLLM(prompt: string, options?: LLMOptions): Promise<string> {
        const response = await this.execute(prompt, options);
        return response.text;
    }

    /**
     * Execute LLM with full response metadata
     * 
     * @param prompt - The prompt to send to the LLM
     * @param options - Optional execution parameters
     * @returns Full LLM response with metadata
     */
    async execute(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
        const mergedOptions = { ...this.defaultOptions, ...options };

        try {
            const model = this.genAI.getGenerativeModel({
                model: mergedOptions.model!,
                generationConfig: {
                    temperature: mergedOptions.temperature,
                    maxOutputTokens: mergedOptions.maxOutputTokens,
                    topP: mergedOptions.topP,
                    topK: mergedOptions.topK,
                }
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return {
                text,
                model: mergedOptions.model!,
                finishReason: response.candidates?.[0]?.finishReason
            };
        } catch (error) {
            console.error('❌ Error calling Gemini API:', (error as Error).message);
            throw new Error(`Gemini API error: ${(error as Error).message}`);
        }
    }

    /**
     * Execute LLM with JSON parsing
     * Attempts to extract and parse JSON from the response
     * 
     * @param prompt - The prompt to send to the LLM
     * @param options - Optional execution parameters
     * @returns Parsed JSON object
     */
    async executeJSON<T = any>(prompt: string, options?: LLMOptions): Promise<T> {
        const response = await this.executeLLM(prompt, options);

        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in LLM response');
            }

            return JSON.parse(jsonMatch[0]) as T;
        } catch (error) {
            throw new Error(`Failed to parse JSON from LLM response: ${(error as Error).message}`);
        }
    }

    /**
     * Update default options
     * 
     * @param options - New default options
     */
    setDefaultOptions(options: Partial<LLMOptions>): void {
        this.defaultOptions = { ...this.defaultOptions, ...options };
    }

    /**
     * Get current default options
     * 
     * @returns Current default options
     */
    getDefaultOptions(): LLMOptions {
        return { ...this.defaultOptions };
    }

    /**
     * Test connection to Gemini API
     * 
     * @returns true if connection successful
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.executeLLM('Test connection. Respond with "OK".');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get available models (informational)
     * 
     * @returns Array of recommended model names
     */
    static getAvailableModels(): string[] {
        return [
            'gemini-2.0-flash-exp',
            'gemini-1.5-flash',
            'gemini-1.5-flash-8b',
            'gemini-1.5-pro'
        ];
    }
}
