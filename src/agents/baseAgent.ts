// ============================================
// CLASE BASE PARA TODOS LOS AGENTES
// Define interfaz común, logging, manejo de errores
// ============================================

import { anthropicClient, aiConfig } from '../config/anthropic';
import { AgentInput, AgentOutput, IAgent } from '../types/agents';

export abstract class BaseAgent implements IAgent {
  
  // Cada agente implementa estos
  abstract name: string;
  abstract version: string;
  
  // Métodos que cada agente DEBE implementar
  abstract buildPrompt(input: AgentInput): string;
  abstract parseResponse(response: string): any;
  abstract validateInput(input: AgentInput): boolean;
  
  // Método analizar (igual para todos)
  async analyze(input: AgentInput): Promise<AgentOutput> {
    try {
      // 1. Validar entrada
      if (!this.validateInput(input)) {
        throw new Error(`Input inválido para ${this.name}`);
      }
      
      console.log(`\n🤖 [${this.name}] Iniciando análisis...`);
      const startTime = Date.now();
      
      // 2. Construir prompt
      const prompt = this.buildPrompt(input);
      
      // 3. Llamar a Claude
      console.log(`📤 Enviando a Claude API...`);
      const response = await anthropicClient.messages.create({
        model: aiConfig.model,
        max_tokens: aiConfig.maxTokens,
        temperature: aiConfig.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });
      
      // 4. Extraer respuesta
      const responseText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';
      
      // 5. Parsear JSON
      // 5. Parsear JSON
      console.log(`📋 Raw Response (primeros 500 chars):`);
      console.log(responseText.substring(0, 500));
      const analysis = this.parseResponse(responseText);
      
      const executionTimeMs = Date.now() - startTime;
      
      // 6. Retornar output estructurado
      const output: AgentOutput = {
        agentName: this.name,
        timestamp: new Date().toISOString(),
        projectId: input.projectId,
        analysis,
        confidence: 0.92,
        tokensUsed: response.usage.output_tokens + response.usage.input_tokens,
        executionTimeMs,
      };
      
      console.log(`✅ [${this.name}] Análisis completado en ${executionTimeMs}ms`);
      
      return output;
      
    } catch (error: any) {
      console.error(`❌ [${this.name}] Error:`, error.message);
      throw error;
    }
  }
}