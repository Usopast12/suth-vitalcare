import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import {
  callTyphoon,
  callTyphoonVisionAction,
  callTyphoonOCR,
  analyzeImageWithSmartAI,
} from "../lib/typhoon.js";
import rateLimit from "express-rate-limit";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const router = express.Router();

// AI API Rate Limiter: Prevent abuse and protect API budget
// NOTE: Internal bot calls from localhost bypass this limiter automatically
const aiLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20, // 20 requests per IP per day for external users
  message: {
    error:
      "ใช้งานระบบ AI เกินขีดจำกัดประจำวัน (20 ครั้ง/วัน) กรุณาลองใหม่ในวันถัดไป หรือพิมพ์ข้อมูลด้วยตนเองหากมีความจำเป็นเร่งด่วน",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limit for internal server calls (bot uses localhost)
  skip: (req) => {
    const ip = req.ip || req.socket?.remoteAddress || "";
    const isInternal = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
    if (isInternal) {
      console.log("[AI] Internal bot request — skipping rate limit");
    }
    return isInternal;
  },
});

const typhoonApiKey = process.env.TYPHOON_API_KEY;

/**
 * Helper to fetch image buffer, trying local filesystem first if URL is local
 */
async function getImageBuffer(imageUrl: string): Promise<any> {
  // Handle Base64 Data URLs
  if (imageUrl.startsWith("data:image/")) {
    const base64Data = imageUrl.split(",")[1];
    return Buffer.from(base64Data, "base64");
  }

  // Handle local filesystem paths in /uploads (current storage location)
  if (imageUrl.includes("/uploads/")) {
    try {
      let uploadRelativePath = imageUrl;

      // If absolute URL, extract only pathname
      if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        uploadRelativePath = new URL(imageUrl).pathname;
      }

      const uploadsIndex = uploadRelativePath.indexOf("/uploads/");
      const relativeFromUploads = uploadRelativePath.substring(
        uploadsIndex + "/uploads/".length,
      );

      const fullPath = path.join(
        __dirname,
        "../../public/uploads",
        relativeFromUploads,
      );
      return await fs.readFile(fullPath);
    } catch (err) {
      console.warn(
        `[AI] Local file fetch failed for ${imageUrl}, falling back to axios:`,
        err,
      );
    }
  }

  // Relative URL that is not absolute cannot be fetched by axios in Node.
  if (imageUrl.startsWith("/")) {
    throw new Error(`INVALID_LOCAL_URL:${imageUrl}`);
  }

  // Fallback for external URLs (LINE, Google, or old absolute ngrok links)
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
  return (Buffer as any).from(response.data);
}

// OCR for distance (Using Typhoon Vision)
router.post("/ocr/distance", async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl)
    return res.status(400).json({ error: "Image URL is required" });

  try {
    const buffer = await getImageBuffer(imageUrl);
    const result = await callTyphoonOCR(buffer);
    res.json({ text: result });
  } catch (error: any) {
    console.error("OCR error:", error);
    res.status(500).json({ error: "Typhoon OCR failed" });
  }
});

// Typhoon AI / OpenAI compatible interface
router.post("/typhoon", async (req, res) => {
  const { prompt } = req.body;

  if (!typhoonApiKey)
    return res.status(500).json({ error: "Typhoon API Key missing" });

  try {
    const url = "https://api.opentyphoon.ai/v1/chat/completions";
    const body = {
      // ใช้ 30b-a3b-instruct ตามที่กำหนด
      model: "typhoon-v2.5-30b-a3b-instruct",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10000,
      temperature: 0.1,
    };
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${typhoonApiKey}`,
        "Content-Type": "application/json",
      },
    });

    res.json({ text: response.data.choices[0].message.content });
  } catch (error: any) {
    console.error("Typhoon error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to call Typhoon AI" });
  }
});

// Emotion Support (using Typhoon)
router.post("/emotion/support", async (req, res) => {
  const { emotion, message } = req.body;
  const prompt = `The user is feeling ${emotion}. Their message is: "${message}". Provide a short, comforting, and encouraging message in Thai (max 2 sentences).`;

  if (!typhoonApiKey)
    return res.status(500).json({ error: "Typhoon API Key missing" });

  try {
    const url = "https://api.opentyphoon.ai/v1/chat/completions";
    const body = {
      // ตามที่ user กำหนด: ใช้ตัว 30b-a3b-instruct
      model: "typhoon-v2.5-30b-a3b-instruct",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 10000,
      temperature: 0.1,
    };
    const response = await axios.post(url, body, {
      headers: { Authorization: `Bearer ${typhoonApiKey}` },
    });
    res.json({ supportMessage: response.data.choices[0].message.content });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to get support message from Typhoon" });
  }
});

router.post("/analyze-mission", aiLimiter, async (req, res) => {
  const { imageUrl, taskTitle, metricUnit, metricType, userId } = req.body;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!imageUrl) return res.status(400).json({ error: "Image is required" });

  try {
    const rawBuffer = await getImageBuffer(imageUrl);

    // ── Pre-process for better OCR accuracy ──
    const buffer = await sharp(rawBuffer)
      .resize({ width: 1600 }) // Upscale if needed to reach readable resolution for OCR
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.8, m1: 1.5, m2: 0.7 })
      .linear(1.25, -20)
      .toBuffer();

    console.log(
      `[AI-MISSION] Starting Smart Analysis for user ${userId} | Task: ${taskTitle}`,
    );

    const brainPrompt = `You are a precise health and fitness data extractor. You MUST follow all rules strictly.

TARGET TASK: "${taskTitle}"
TARGET UNIT: "${metricUnit || 'STANDARD METRIC (km, minutes, kcal, steps)'}" ← You MUST return a value in this unit. Convert if the image uses Imperial (e.g., miles to km).

════════════════════════════════════════
MANDATORY EXTRACTION MAPPING (Based on Target Unit):
════════════════════════════════════════
You must extract ONLY the value that corresponds to the TARGET UNIT:
- If TARGET UNIT is "km", "กิโลเมตร", "m", or "STANDARD METRIC":
  LOOK FOR DISTANCE (ระยะทาง). DO NOT extract calories or duration. (e.g., 3.02)
- If TARGET UNIT is "นาที", "ชั่วโมง", "min", "hour":
  LOOK FOR DURATION/TIME (เวลา, ระยะเวลา). DO NOT extract distance or calories.
- If TARGET UNIT is "kcal", "แคลอรี", "cal", "แคลอรี่":
  LOOK FOR CALORIES BURNED (พลังงาน). DO NOT extract distance or time.
- If TARGET UNIT is "ก้าว", "steps":
  LOOK FOR STEP COUNT (จำนวนก้าว).

════════════════════════════════════════
OCR MISALIGNMENT WARNING:
════════════════════════════════════════
OCR data is often misaligned or nested incorrectly (e.g., {"กิโลเมตร": [{"208": "แคลอรี"}]}).
IGNORE the JSON grouping. Rely ONLY on the semantic meaning of the numbers and their adjacent words:
- "3.02" is distance.
- "38:52" is time.
- "208 แคลอรี" is calories.
DO NOT assign a calorie value to distance just because OCR grouped them incorrectly!

════════════════════════════════════════
EXTRACTION RULES (follow in order):
════════════════════════════════════════

1. DISTANCE tasks:
   - Extract the distance shown. 
   - CONVERT IMPERIAL TO METRIC: If the image shows miles (mi) and the target unit is km (or STANDARD METRIC), you MUST convert it to km (1 mi = 1.60934 km).
   - Convert meters to km (1 m = 0.001 km).

2. SLEEP tasks:
   - First, check if a total duration like "Time Asleep", "TIME ASLEEP", "Sleep", or "เวลาที่นอนหลับ" is explicitly provided (e.g. "7 hr 38 min").
   - If a total is found, DO NOT calculate. Just convert it to minutes. (e.g. 7 hr + 38 min = 458 minutes).
   - If there is NO total, check if Sleep Stages are visible. For Apple Watch Thai/English:
       English: SUM only (REM + Core + Deep). Exclude "Awake".
       Thai: SUM only (หลับฝัน + หลับจริง + หลับลึก). Exclude "หลับตื้น" (Awake/Orange dot).
   - If neither total nor stages are found, fallback to finding bedtime (เวลาเข้านอน) and wake time/นาฬิกาปลุก (เวลาตื่น), then calculate duration (wake - bedtime).
   - CRITICAL: Use EXACT arithmetic result without second-guessing!

3. STEPS tasks:
   - Extract integer step count directly. No conversion needed.

4. CALORIES tasks:
   - Extract energy burned value.

5. WORKOUT/EXERCISE tasks:
   - Extract total duration. If format is MM:SS (e.g. 38:52), convert to minutes correctly (38 + 52/60 = 38.87).

6. UNIT CONVERSION — MANDATORY:
   - The final "value" output MUST be in unit: "${metricUnit}".
   - Show your arithmetic in the "reason" field.

════════════════════════════════════════
CRITICAL RULES:
════════════════════════════════════════
- NEVER second-guess or "adjust" a correctly calculated value.
- NEVER pick a "plausible" or "typical" value. Use EXACTLY what the image shows.
- NEVER refuse to answer if start/end times are visible — calculate them.
- If the image is unrelated, set isRelated=false and value="0".

Output ONLY valid JSON — no extra text:
{
  "isRelated": boolean,
  "value": number,
  "reason": "show your extraction logic step-by-step. e.g. Target unit is km. Found distance 3.02.",
  "debug_context": "raw values found in image"
}`;

    const llmResult = await analyzeImageWithSmartAI(buffer, brainPrompt);
    console.log(`[AI-MISSION] LLM Result:\n${llmResult}`);

    const jsonStart = llmResult.indexOf("{");
    const jsonEnd = llmResult.lastIndexOf("}") + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error("AI parsing failed. No JSON returned from LLM.");
    }

    const data = JSON.parse(llmResult.substring(jsonStart, jsonEnd));

    console.log(`[AI-MISSION] Final Parsed Data:`, data);
    res.json({
      isRelated: data.isRelated !== false && data.value !== "0",
      value: data.value || "0",
      reason: data.reason || "",
      unit_found: data.unit_found_in_image || "",
      conversion_applied: !!data.conversion_applied,
    });
  } catch (error: any) {
    console.error("Mission analysis error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/analyze-tanita", aiLimiter, async (req, res) => {
  const { imageUrl, imageBase64, userId } = req.body;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!imageUrl && !imageBase64)
    return res.status(400).json({ error: "Image is required" });

  try {
    console.log(
      `[AI-TANITA] User ${userId} — Direct typhoon-ocr single-shot JSON extraction`,
    );

    let fileBuffer: Buffer;
    if (imageBase64) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      fileBuffer = Buffer.from(base64Data, "base64");
    } else {
      fileBuffer = await getImageBuffer(imageUrl!);
    }

    // ── Pre-processing: Enhanced for small digits and pale text ──
    const enhancedBuffer = await sharp(fileBuffer)
      .resize({ width: 1600 }) // Ensure minimum resolution for OCR accuracy
      .grayscale() // remove color noise
      .normalize() // stretch contrast
      .sharpen({ sigma: 1.8, m1: 1.5, m2: 0.7 }) // crisp edges for small digits
      .linear(1.25, -20) // boost contrast: brighten whites, darken text
      .toBuffer();

    const metadata = await sharp(enhancedBuffer).metadata();
    const width = metadata.width || 1000;
    const height = metadata.height || 1000;
    const isLongSlip = height > width * 1.8;

    // ── Stage 1: Smart Dual-Pass Extraction (different perspectives) ──
    console.log(
      `[AI-TANITA] Stage 1: ${isLongSlip ? "Long Slip Detected. Sectioning..." : "Standard Analysis..."}`,
    );

    // Two different prompts so each pass catches what the other may miss
    const ocrPromptLabels = `You are a strict OCR engine. Extract all text from this image exactly as it is written.
CRITICAL RULES:
1. DO NOT make up, guess, or hallucinate any numbers or words.
2. ONLY output text that is visibly written in the image.
3. If the image contains no text, or is just an object/animal/person without measurement data, output ONLY the word "INVALID_IMAGE".
Output raw text only — no markdown, no tables.`;

    const ocrPromptNumbers = `You are a strict OCR engine focused on numbers. Extract all numbers and their adjacent units/labels from this image exactly as written.
CRITICAL RULES:
1. DO NOT make up, guess, or hallucinate any numbers.
2. ONLY output numbers that are visibly written in the image.
3. If there are no numbers, output ONLY the word "NO_NUMBERS".
Output raw text only — no markdown, no tables.`;

    const getOcrOutput = async (buf: Buffer) => {
      console.log(`[AI-TANITA] Starting Parallel OCR Passes...`);
      // Run both OCR passes in parallel to cut processing time in half
      const [o1, o2] = await Promise.all([
        callTyphoonVisionAction(buf, ocrPromptLabels, "typhoon-ocr"),
        callTyphoonVisionAction(buf, ocrPromptNumbers, "typhoon-ocr"),
      ]);

      // RELEVANCY CHECK (EARLY EXIT):
      if (o1.includes("INVALID_IMAGE")) return "INVALID_IMAGE";

      // STRICT CHECK: Look for 'value+unit' patterns typical of a personal measurement slip
      // e.g. "59.4kg", "166cm", "16.0%", not just keywords in an infographic
      const hasValueUnit = /\d+\.?\d*\s*(kg|cm|%|kcal|kj)/i.test(o1);

      // Also check for measurement slip headers (Tanita, InBody, BC-xxx, DC-xxx, or common Thai headers)
      const hasSlipHeader =
        /(tanita|inbody|bc-|dc-|body\s*composition|analyzer|องค์ประกอบ|ไขมัน|มวล|น้ำหนัก|bmi|bmr)/i.test(
          o1,
        );

      // Count actual data numbers (decimal or multi-digit)
      const numbersCount = (o1.match(/\d+\.\d+|\d{2,}/g) || []).length;

      // Must have EITHER: a value+unit pattern OR a slip header, AND at least 5 numbers
      const isValid = (hasValueUnit || hasSlipHeader) && numbersCount >= 5;

      if (!isValid) {
        console.log(
          `[AI-TANITA] Relevancy Check Failed: ValueUnit=${hasValueUnit}, SlipHeader=${hasSlipHeader}, Numbers=${numbersCount}`,
        );
        return "INVALID_IMAGE";
      }

      return `[Label+Value Reading]:\n${o1}\n\n[Number Focus Reading]:\n${o2}`;
    };

    let fullOcrData = await getOcrOutput(enhancedBuffer);

    if (fullOcrData === "INVALID_IMAGE") {
      const err: any = new Error("INVALID_IMAGE");
      err.status = 422;
      throw err;
    }

    console.log(`[AI-TANITA] Multi-Pass Smart Extraction completed.`);

    // ── Stage 2: Supreme Auditor (Consensus + Mathematical Reconstruction) ──
    console.log(
      `[AI-TANITA] Stage 2: Supreme Auditor with anatomical reasoning`,
    );

    const brainPrompt = `You are the Supreme Tanita Auditor. You have multiple OCR passes of a health slip.
Your goal is to reach a CONSENSUS and extract every value with maximum accuracy.

### ANATOMICAL RECONSTRUCTION (Mandatory Math Checks):
Use these formulas to cross-check if a digit was misread (e.g. 1 read as 8, or 6 read as 8):
1. Fat Mass = Weight * (Fat Percentage / 100)
2. FFM (Fat Free Mass) = Muscle Mass + Bone Mass
3. Weight = FFM + Fat Mass
4. BMI = Weight / (Height_in_meters)^2

### HEIGHT SANITY CHECK (use ONLY when OCR height looks suspicious):
DO NOT recalculate height for every slip. Only use this check if the OCR height seems physically impossible (e.g., 186cm for someone with BMI=21.6 and weight=59.4 is impossible — real height must be ~166cm).
Formula to verify: expected_height_cm = sqrt(Weight / BMI) * 100
Rule: Use OCR height by default. Only override if OCR height is CLEARLY wrong (>10cm off from expected).

### YOUR TASK:
Cross-reference the OCR data chunks and reconstruct the perfect JSON.
CRITICAL: Rely ONLY on the numbers found in the text below. DO NOT make up data. If a value is genuinely missing, set it to null. Always include "is_valid": true in your output.

---
[OCR DATA START]
${fullOcrData}
[OCR DATA END]
---

JSON Keys required:
{
  "is_valid": true,
  "body_type": "STANDARD", "gender": "MALE" or "FEMALE", "age": number, "height": number, "clothes_weight": number,
  "weight": number, "fat_pc": number, "fat_mass": number, "ffm": number, "muscle_mass": number,
  "tbw_mass": number, "tbw_pc": number, "bone_mass": number, "bmr_kj": number, "bmr_kcal": number,
  "metabolic_age": number, "visceral_fat": number, "bmi": number, "ideal_weight": number, "obesity_degree": number, "physique_rating": string or null
}

// ⚠️ CRITICAL WARNING FOR FUTURE AI AGENTS ⚠️
// DO NOT remove or alter the Anatomical Reconstruction math checking rule!
// Tanita slips often cause OCR alignment shifts (values drift up/down by 1 row).
// This specific instruction forces the LLM to mathematically prove row alignment before outputting JSON.
Instructions:
- HEIGHT SANITY: Use the OCR height as the primary value. ONLY recalculate and override if the OCR height is clearly impossible — e.g. if OCR says 186cm but Weight/BMI math gives ~166cm, correct it to 166cm. Do NOT recalculate and override height when the OCR reading already makes mathematical sense.
- BMR/Metabolic Age WARNING: Tanita slips often show BMR in TWO units (kJ and kcal) on separate lines. BMR kJ is usually a large number (4000-8000), while BMR kcal is smaller (1000-2000). Metabolic Age is a small number (usually 12-90). DO NOT confuse the BMR kcal value with Metabolic Age!
- CRITICAL SHIFT FIX: You MUST use the Anatomical Reconstruction formulas to verify your mappings. For example, if Weight is 120.2 and Fat% is 40, Fat Mass MUST be ~48.1. If you assigned 72.1 to Fat Mass, your rows are shifted!
- Do not output strings like "null" for numbers. If genuinely missing, use null (JSON null).
- Output ONLY valid JSON format. Remove any unit strings from numbers.`;

    const llmResult = await callTyphoon(
      [
        {
          role: "system",
          content:
            "You are the Supreme Auditor. You use mathematical formulas (FFM, BMI) to fix misread digits across multiple OCR segments. Output only JSON.",
        },
        { role: "user", content: brainPrompt },
      ],
      "typhoon-v2.5-30b-a3b-instruct",
    );

    console.log(`[AI-TANITA] Brain Output:\n${llmResult}`);

    // ── JSON Sanitizer & Resolution ──
    const jsonStart = llmResult.indexOf("{");
    const jsonEnd = llmResult.lastIndexOf("}") + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error("Brain model failed to produce valid JSON.");
    }

    const data = JSON.parse(llmResult.substring(jsonStart, jsonEnd));

    // Check validation flag from Auditor
    if (data.is_valid === false) {
      const err: any = new Error("INVALID_IMAGE");
      err.status = 422;
      throw err;
    }

    console.log(`[AI-TANITA] Final Processed Data:`, data);
    res.json(data);
  } catch (error: any) {
    console.error("[AI-TANITA] Error:", error.message);

    const silentHeader = req.headers["x-client-silent-errors"];
    const shouldSilenceClientError =
      silentHeader === "1" || req.query.silent === "1";

    if (error.message === "INVALID_IMAGE" || error.status === 422) {
      const msg =
        "รูปภาพที่ส่งมาไม่ใช่ใบตรวจสุขภาพ (ไม่มีค่าน้ำหนักหรือไขมัน) กรุณาลองใหม่อีกครั้ง หรือกรอกข้อมูลด้วยตนเองครับ";

      if (shouldSilenceClientError) {
        return res.status(200).json({
          ok: false,
          code: "INVALID_IMAGE",
          error: msg,
        });
      }

      return res.status(422).json({ error: msg });
    }

    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
