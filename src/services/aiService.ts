import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ValidationResult {
  isValid: boolean;
  warning?: string;
}

export const validateTicketContent = async (subject: string, description: string): Promise<ValidationResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following IT support ticket and determine if it contains meaningful information or if it's "non-sense", gibberish, or clearly invalid.
      
      Subject: ${subject}
      Description: ${description}
      
      If it's invalid, provide a brief, helpful warning message for the user.
      A ticket is invalid if:
      - It's just random characters (e.g. "asdfasdf").
      - It's too short to be meaningful (e.g. "help").
      - It's clearly not related to IT support.
      - It's offensive or inappropriate.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: {
              type: Type.BOOLEAN,
              description: "True if the ticket content is meaningful and valid, false if it's non-sense or gibberish."
            },
            warning: {
              type: Type.STRING,
              description: "A brief, helpful warning message if the ticket is invalid. Empty if valid."
            }
          },
          required: ["isValid", "warning"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      isValid: result.isValid ?? true,
      warning: result.warning || undefined
    };
  } catch (error) {
    console.error("AI Validation Error:", error);
    // Fallback to valid if AI fails
    return { isValid: true };
  }
};
