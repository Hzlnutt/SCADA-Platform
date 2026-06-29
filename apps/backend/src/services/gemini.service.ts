import { env } from "../config/env.config";
import { logger } from "../config/logger.config";

interface GeminiResponse {
  valid: boolean;
  confidence: number;
  reason: string;
}

function parseBase64Image(dataUrl: string) {
  // Regex to extract base64 data and mimeType from data URL
  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return {
      mimeType: matches[1],
      data: matches[2]
    };
  }
  // Default fallback if it's already just the raw base64 string
  return {
    mimeType: "image/jpeg",
    data: dataUrl
  };
}

export const compareFacesWithGemini = async (
  scannedImageBase64: string,
  referenceImagesBase64: string[]
): Promise<GeminiResponse> => {
  const apiKey = env.geminiApiKey;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const scanned = parseBase64Image(scannedImageBase64);
  const references = referenceImagesBase64.map((img) => parseBase64Image(img));

  const promptText = `
You are a secure, high-precision biometric face verification system for an industrial SCADA platform.
Compare the "Scanned Face" (Image 0) against the registered "Reference Faces" (Image 1, and optionally Image 2 and 3).
Determine if the Scanned Face belongs to the same person as the Reference Faces.

Guidelines:
1. Ignore variations in camera angles (e.g., sitting vs standing), lighting, background environment, and minor facial expression differences.
2. Focus on core facial structure (e.g., eye shape and distance, nose structure, mouth shape, chin line, overall facial proportions).
3. If the Scanned Face clearly matches the reference person, set "valid" to true.
4. Output your response ONLY as a JSON object matching this schema:
{
  "valid": boolean,
  "confidence": number (between 0.0 and 1.0),
  "reason": "short explanation of the match or mismatch"
}
`;

  const contents = [
    {
      parts: [
        { text: promptText },
        { text: "Image 0 (Scanned Face from Webcam):" },
        {
          inlineData: {
            mimeType: scanned.mimeType,
            data: scanned.data
          }
        },
        ...references.flatMap((ref, index) => [
          { text: `Image ${index + 1} (Registered Reference Face):` },
          {
            inlineData: {
              mimeType: ref.mimeType,
              data: ref.data
            }
          }
        ])
      ]
    }
  ];

  try {
    logger.info("Sending biometrics face verification request to Gemini API...");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "Gemini API request failed");
      throw new Error(`Gemini API error: ${response.statusText} (${response.status})`);
    }

    const result = await response.json();
    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error("Invalid response format from Gemini API");
    }

    const parsedJson = JSON.parse(textResponse.trim()) as GeminiResponse;
    logger.info(
      { valid: parsedJson.valid, confidence: parsedJson.confidence },
      "Gemini face verification complete"
    );
    return parsedJson;
  } catch (error) {
    logger.error({ error }, "Error calling Gemini face verification API");
    throw error;
  }
};
