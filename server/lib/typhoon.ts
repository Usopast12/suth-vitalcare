import dotenv from "dotenv";
import sharp from "sharp";
dotenv.config();

/**
 * [The Flagship Brain] - Typhoon 2.5-30B
 * (ใช้สำหรับงานที่ไม่มีรูปภาพเกี่ยวข้องเท่านั้น เช่น จัดการข้อความหรือตรรกะล้วน)
 */
// Helper for exponential backoff retry when hitting 429 (Too Many Requests), 5xx, or Network Errors
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Determine if it's a network/connection error (fetch failed, ECONNRESET, ETIMEDOUT)
    const isNetworkError = 
      error.message === "fetch failed" || 
      error.cause?.code === "ECONNRESET" || 
      error.cause?.code === "ETIMEDOUT" ||
      error.code === "ECONNRESET" ||
      error.message.includes("socket hang up");

    // Determine if it's a rate limit or server-side error (5xx)
    const isRateLimitOrServerErr = 
      error.status === 429 || 
      (error.status >= 500 && error.status < 600) || 
      error.message.includes("429") ||
      error.message.includes("502");

    if (retries > 0 && (isNetworkError || isRateLimitOrServerErr)) {
      const reason = isNetworkError ? `Network Error (${error.cause?.code || error.message})` : `API Error (${error.status || error.message})`;
      console.warn(`[Typhoon] ${reason}. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function callTyphoon(
  messages: any[],
  modelName = "typhoon-v2.5-30b-a3b-instruct",
) {
  const apiKey = process.env.TYPHOON_API_KEY;
  if (!apiKey) throw new Error("TYPHOON_API_KEY is missing");

  const url = "https://api.opentyphoon.ai/v1/chat/completions";
  const body = {
    model: modelName,
    messages: messages,
    max_tokens: 10000,
    temperature: 0.1,
  };

  return withRetry(async () => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const err: any = new Error(`Typhoon Chat API error: ${response.status} - ${errorText}`);
      err.status = response.status;
      throw err;
    }

    const data: any = await response.json();
    return data.choices[0].message.content;
  });
}

/**
 * [The Only Vision-Capable Model] - Typhoon OCR
 * จากเอกสาร https://docs.opentyphoon.ai/en/models/
 * โมเดลรุ่นนี้เป็นรุ่นเดียวที่รองรับ input เป็นภาพ (typhoon-ocr)
 */
export async function callTyphoonVisionAction(
  imageBuffer: Buffer,
  prompt: string,
  modelName = "typhoon-ocr"
) {
  const apiKey = process.env.TYPHOON_API_KEY;
  if (!apiKey) throw new Error("TYPHOON_API_KEY is missing");

  const base64Image = imageBuffer.toString("base64");
  const url = "https://api.opentyphoon.ai/v1/chat/completions";

  // Detect actual MIME type from buffer magic bytes (not hardcoded!)
  // PNG: 0x89 0x50 0x4E 0x47 | JPEG: 0xFF 0xD8 | WEBP: 52 49 46 46 ... 57 45 42 50
  let mimeType = "image/jpeg"; // default fallback
  if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
    mimeType = "image/png";
  } else if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
    mimeType = "image/jpeg";
  } else if (imageBuffer.slice(8, 12).toString("ascii") === "WEBP") {
    mimeType = "image/webp";
  }
  console.log(`[Typhoon Vision] Detected MIME type: ${mimeType} (buffer size: ${imageBuffer.length} bytes)`);

  const body = {
    model: modelName,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Image}` }
          }
        ]
      }
    ],
    max_tokens: 4096,
    temperature: 0.1
  };

  return withRetry(async () => {
    // Hard 60-second timeout per OCR call (increased for long images)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err: any = new Error(`Typhoon Vision API error: ${response.status} - ${errorText}`);
        err.status = response.status;
        throw err;
      }

      const data: any = await response.json();
      return data.choices[0].message.content;
    } finally {
      clearTimeout(timeoutId);
    }
  }, 0); // No retries for vision — fail fast so LINE reply token doesn't expire
}

/**
 * [Advanced Typhoon Pipeline] - 3-Stage Process
 * 1. Stage 1 & 2: Typhoon OCR - The Eyes (Long-Strip Support)
 * 2. Stage 3: Typhoon 2.5-30B - The Brain (Synthesis)
 */
export async function analyzeImageWithSmartAI(
  imageBuffer: Buffer,
  logicPrompt: string
) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1;
    const height = metadata.height || 1;
    const isLongStrip = height > width * 1.5; // ปรับให้หั่นรูปได้ง่ายขึ้นเพื่อความคมชัด

    let visualAnalysis = "";

    if (isLongStrip) {
      console.log(`[Smart AI] Long image detected (${width}x${height}). Splitting into 3 parts...`);
      
      // หั่นเป็น 3 ส่วน (ทับซ้อนกันเพื่อกันข้อมูลขาด)
      const partHeight = Math.floor(height * 0.45);
      
      const [topPart, midPart, bottomPart] = await Promise.all([
        sharp(imageBuffer).extract({ left: 0, top: 0, width: width, height: partHeight }).toBuffer(),
        sharp(imageBuffer).extract({ left: 0, top: Math.floor(height * 0.27), width: width, height: partHeight }).toBuffer(),
        sharp(imageBuffer).extract({ left: 0, top: height - partHeight, width: width, height: partHeight }).toBuffer()
      ]);

      console.log(`[Smart AI] Scanning Section 1, 2, and 3 concurrently...`);
      const [res1, res2, res3] = await Promise.all([
        callTyphoonVisionAction(topPart, "Extract all text and numerical data from the TOP section of this image. Label clearly."),
        callTyphoonVisionAction(midPart, "Extract all text and numerical data from the MIDDLE section of this image. Label clearly."),
        callTyphoonVisionAction(bottomPart, "Extract all text and numerical data from the BOTTOM section of this image. Label clearly.")
      ]);

      visualAnalysis = `[Top Data]:\n${res1}\n\n[Middle Data]:\n${res2}\n\n[Bottom Data]:\n${res3}`;
    } else {
      console.log(`[Smart AI] Standard image size. Scanning once...`);
      visualAnalysis = await callTyphoonVisionAction(imageBuffer, "Extract all numerical health data and metrics from this image. Structure it clearly.");
    }

    // Stage 3: The Brain (Typhoon 2.5-30B)
    console.log(`[Smart AI] Stage 3: Expert Reasoning via 'typhoon-v2.5-30b-a3b-instruct'...`);

    const brainPrompt = `Visual Data Context (from Typhoon OCR):
---
${visualAnalysis}
---

Action Request (Mission Logic):
${logicPrompt}

Instructions:
1. You are the 'Master Brain'. Based on the visual analysis from all parts of the image, choose the MOST accurate numerical value.
2. BIOLOGICAL VALIDATION:
   - Metabolic Age: 12-95. (If you see >1000, it is likely BMR).
   - Percentages: usually 5-60.
3. CROSS-CHECK: Ensure values are consistent.
4. Output ONLY valid JSON:
   {
     "isRelated": boolean,
     "value": "string or number",
     "reason": "short explanation of your synthesis"
   }`;

    return await callTyphoon(
      [
        { role: "system", content: "You are the primary intelligence of the VitalCare system." },
        { role: "user", content: brainPrompt },
      ],
      "typhoon-v2.5-30b-a3b-instruct"
    );
  } catch (err: any) {
    console.error(`[Smart AI] Pipeline Error:`, err.message);
    throw err;
  }
}

/**
 * Legacy Helpers
 */
export async function callTyphoonOCR(imageBuffer: Buffer) {
  return await callTyphoonVisionAction(
    imageBuffer,
    `You are an OCR engine processing a health or fitness data slip (e.g., Tanita body composition, exercise app screenshot, running app result).
Extract ALL visible text and numbers precisely, line by line.
Pay special attention to: weight (kg/lb), fat %, BMI, BMR (kcal/kJ), visceral fat, metabolic age, muscle mass, bone mass, FFM, TBW, distance (km/mi), steps, calories.
Numbers MUST be exact — do not round or approximate. If a value has a decimal point, include it.
Output raw text only — no formatting, no tables, no markdown.`
  );
}

/**
 * [Direct Vision] - Send image DIRECTLY to typhoon-v2.5-30b-a3b-instruct
 * Bypasses the OCR middleware for higher accuracy on structured slips like Tanita.
 * typhoon-v2.5-30b-a3b-instruct supports multimodal (image + text) natively.
 */
export async function callTyphoonVisionDirect(
  imageBuffer: Buffer,
  prompt: string
): Promise<string> {
  const apiKey = process.env.TYPHOON_API_KEY;
  if (!apiKey) throw new Error("TYPHOON_API_KEY is missing");

  const base64Image = imageBuffer.toString("base64");
  const url = "https://api.opentyphoon.ai/v1/chat/completions";

  // Try vision-capable models in order of preference
  const visionModels = [
    "typhoon-v2.5-30b-a3b-instruct",  // User-confirmed vision support
    "typhoon-ocr-preview",
    "typhoon-ocr",
  ];

  for (const modelName of visionModels) {
    const body = {
      model: modelName,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            },
            { type: "text", text: prompt }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.1
    };

    console.log(`[Vision Direct] Trying model: ${modelName}...`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const data: any = await response.json();
      console.log(`[Vision Direct] Success with model: ${modelName}`);
      return data.choices[0].message.content;
    }

    const errText = await response.text();
    console.warn(`[Vision Direct] Model ${modelName} failed (${response.status}): ${errText.slice(0, 100)}`);
  }

  throw new Error("All vision models failed. Cannot analyze image.");
}
