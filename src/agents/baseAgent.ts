// ============================================
// CLASE BASE PARA TODOS LOS AGENTES
// Define interfaz común, logging, manejo de errores
// ============================================

import { anthropicClient, aiConfig } from '../config/anthropic';
import { AgentInput, AgentOutput, IAgent } from '../types/agents';
import { agentLogger } from '../core/logger';

export abstract class BaseAgent implements IAgent {
  
  // Cada agente implementa estos
  abstract name: string;
  abstract version: string;

  // Override en subclases que necesiten más espacio que aiConfig.maxTokens
  // (ej. reportingAgent genera dos reportes markdown completos en una respuesta).
  protected maxTokens: number = aiConfig.maxTokens;

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
      
      agentLogger.info({ agent: this.name, projectId: input.projectId }, 'Iniciando análisis');
      const startTime = Date.now();

      const prompt = this.buildPrompt(input);
      const response = await anthropicClient.messages.create({
        model: aiConfig.model,
        max_tokens: this.maxTokens,
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
      
      agentLogger.debug({ agent: this.name, preview: responseText.substring(0, 200) }, 'Raw API response');
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
      
      agentLogger.info({ agent: this.name, ms: executionTimeMs, tokens: output.tokensUsed }, 'Análisis completado');

      return output;

    } catch (error: any) {
      agentLogger.error({ agent: this.name, err: error.message }, 'Error en análisis');
      throw error;
    }
  }
}