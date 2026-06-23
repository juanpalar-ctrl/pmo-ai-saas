import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

interface DetectionInput {
  headers: string[];
  sampleRows: Record<string, any>[];
}

interface ColumnMapping {
  projectName: string | null;
  budget: string | null;
  spent: string | null;
  startDate: string | null;
  endDate: string | null;
  progress: string | null;
  confidence: number;
  explanation: string;
}

export async function detectColumnMapping(
  input: DetectionInput
): Promise<ColumnMapping> {
  const systemPrompt = `Eres un experto en normalización de datos y análisis de estructuras de proyectos.

Tu tarea es analizar las cabeceras y filas de un Excel/CSV y DEDUCIR qué columna representa cada campo estándar de un proyecto PMO.

CAMPOS ESTÁNDAR QUE BUSCAS:
- projectName: Nombre del proyecto/tarea (strings descriptivos)
- budget: Presupuesto planificado (números)
- spent: Gasto real/costo actual (números)
- startDate: Fecha de inicio (dates)
- endDate: Fecha de finalización (dates)
- progress: Avance/% completado (números 0-100)

RESPONDE SOLO EN JSON, sin explicación adicional. Formato:
{
  "projectName": "nombre_columna_detectada",
  "budget": "nombre_columna_detectada",
  "spent": "nombre_columna_detectada",
  "startDate": "nombre_columna_detectada",
  "endDate": "nombre_columna_detectada",
  "progress": "nombre_columna_detectada",
  "confidence": 0.85,
  "explanation": "Motivo breve del mapeo"
}

Si no encuentras una columna, usa null.`;

  const userPrompt = `CABECERAS: ${JSON.stringify(input.headers)}

MUESTRA DE DATOS (primeras 3 filas):
${JSON.stringify(input.sampleRows, null, 2)}

Detecta el mapeo de columnas y responde SOLO JSON.`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON response
    const mapping = JSON.parse(responseText) as ColumnMapping;
    return mapping;
  } catch (error: any) {
    console.error("❌ Error en detección de columnas:", error.message);
    throw error;
  }
}
