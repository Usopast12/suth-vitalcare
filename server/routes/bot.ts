import express from "express";
import dns from "node:dns";
import { middleware, messagingApi } from "@line/bot-sdk";

// Force IPv4 prioritize (Fixes Connect Timeout on some Windows systems)
dns.setDefaultResultOrder("ipv4first");
import sharp from "sharp";
import { callTyphoon } from "../lib/typhoon.js";
import dotenv from "dotenv";
import { pool } from "../mysql.js";
import {
  encrypt,
  decrypt,
  encryptFields,
  TANITA_ENCRYPTED_FIELDS,
} from "../lib/crypto.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const router = express.Router();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.LINE_CHANNEL_SECRET || "",
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

const blobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: config.channelAccessToken,
});

// ─── User State Detection ────────────────────────────────────────────────────
interface UserState {
  hasProfile: boolean; // กรอกข้อมูลส่วนตัวครบ (มีเบอร์โทรหรือ fname_th จากการลงทะเบียนจริง)
  hasActivity: boolean; // สมัครกิจกรรมอย่างน้อย 1 รายการ
}

// ─── Helper for AI Processing Timeouts ───────────────────────────────────────
async function safeReplyMessage(
  client: any,
  replyToken: string,
  lineUserId: string | undefined,
  messages: any[],
) {
  try {
    return await client.replyMessage({ replyToken, messages });
  } catch (err: any) {
    if (
      err.message &&
      err.message.toLowerCase().includes("expire") &&
      lineUserId
    ) {
      console.warn(
        `[BOT] Reply token expired for ${lineUserId}, falling back to pushMessage!`,
      );
      return await client.pushMessage({ to: lineUserId, messages });
    }
    throw err;
  }
}

async function getUserState(userId: number): Promise<UserState> {
  try {
    const [[userRow]]: any = await pool.query(
      "SELECT phone, fname_th FROM users WHERE id = ?",
      [userId],
    );
    const [[regRow]]: any = await pool.query(
      "SELECT COUNT(*) as cnt FROM registrations WHERE user_id = ?",
      [userId],
    );
    // hasProfile: ถือว่าครบถ้าเบอร์โทรถูกเก็บไว้ (เก็บในรูป encrypted แต่ไม่ว่าง)
    const hasProfile = !!userRow?.phone;
    const hasActivity = (regRow?.cnt ?? 0) > 0;
    return { hasProfile, hasActivity };
  } catch {
    return { hasProfile: false, hasActivity: false };
  }
}

// ─── Dynamic Quick Reply (ปรับตามสถานะผู้ใช้) ────────────────────────────────
// isGroup = true → แสดงเฉพาะปุ่ม Add Friend เพื่อให้ user ไปคุยกับบอท 1:1
async function getMainQuickReply(userId: number | null, isGroup = false) {
  const liffId = process.env.VITE_LIFF_ID;
  const loginUrl = `https://liff.line.me/${liffId}/login`;
  const actUrl = `https://liff.line.me/${liffId}/`;
  const botBasicId = process.env.LINE_BOT_BASIC_ID || "";
  const addFriendUrl = botBasicId
    ? `https://line.me/R/ti/p/@${botBasicId}`
    : loginUrl;

  // ถ้าอยู่ใน Group/Room — Quick Reply จะถูก share กับทุกคน ใช้เฉพาะปุ่มเชิญไปคุย 1:1
  if (isGroup) {
    return {
      items: [
        {
          type: "action" as const,
          action: {
            type: "uri" as const,
            label: "💬 VitalCare Bot",
            uri: addFriendUrl,
          },
        },
      ],
    };
  }

  if (!userId) {
    // ยังไม่มี userId (ผู้ใช้ใหม่มาก) — ชวนสมัคร
    return {
      items: [
        {
          type: "action" as const,
          action: {
            type: "uri" as const,
            label: "📝 ลงทะเบียน",
            uri: loginUrl,
          },
        },
        {
          type: "action" as const,
          action: {
            type: "message" as const,
            label: "วิธีใช้งาน",
            text: "วิธีใช้งาน",
          },
        },
      ],
    };
  }

  const state = await getUserState(userId);

  if (!state.hasProfile) {
    // สมัครผ่าน LINE แต่ยังไม่กรอกข้อมูลส่วนตัว — ชวนไปกรอกโปรไฟล์
    return {
      items: [
        {
          type: "action" as const,
          action: {
            type: "uri" as const,
            label: "📝 ลงทะเบียนให้ครบ",
            uri: loginUrl,
          },
        },
        {
          type: "action" as const,
          action: {
            type: "message" as const,
            label: "วิธีใช้งาน",
            text: "วิธีใช้งาน",
          },
        },
      ],
    };
  }

  if (!state.hasActivity) {
    // ลงทะเบียนครบแล้ว แต่ยังไม่สมัครกิจกรรม
    return {
      items: [
        {
          type: "action" as const,
          action: {
            type: "uri" as const,
            label: "🎯 เลือกกิจกรรม",
            uri: actUrl,
          },
        },
        {
          type: "action" as const,
          action: {
            type: "message" as const,
            label: "องค์ประกอบร่างกาย",
            text: "ส่งข้อมูล องค์ประกอบของร่างกาย",
          },
        },
        {
          type: "action" as const,
          action: {
            type: "message" as const,
            label: "วิธีใช้งาน",
            text: "วิธีใช้งาน",
          },
        },
      ],
    };
  }

  // ผู้ใช้ Active ปกติ — เมนูเต็ม
  return {
    items: [
      {
        type: "action" as const,
        action: {
          type: "message" as const,
          label: "ส่งภารกิจ",
          text: "ส่งภารกิจ",
        },
      },
      {
        type: "action" as const,
        action: {
          type: "message" as const,
          label: "ภารกิจวันนี้",
          text: "ภารกิจวันนี้",
        },
      },
      {
        type: "action" as const,
        action: {
          type: "message" as const,
          label: "องค์ประกอบร่างกาย",
          text: "ส่งข้อมูล องค์ประกอบของร่างกาย",
        },
      },
      {
        type: "action" as const,
        action: {
          type: "message" as const,
          label: "วิธีใช้งาน",
          text: "วิธีใช้งาน",
        },
      },
    ],
  };
}

// ─── Quick Reply สำหรับอัปโหลดรูป (Camera/Gallery) ──────────────────────────
async function getPhotoUploadQuickReply(userId: number, isGroupChat: boolean) {
  return {
    items: [
      {
        type: "action" as const,
        action: { type: "camera" as const, label: " ถ่ายรูป" },
      },
      {
        type: "action" as const,
        action: { type: "cameraRoll" as const, label: " เลือกจากอัลบั้ม" },
      },
      {
        type: "action" as const,
        action: {
          type: "message" as const,
          label: "❌ ยกเลิก",
          text: "ยกเลิก",
        },
      },
    ],
  };
}

// Quick Reply สำหรับสถานะรอยืนยัน (หลังส่งรูป)
const getConfirmQuickReply = (
  taskId: number | null = null,
  result: any = null,
  ownerId: number,
) => {
  const liffId = process.env.VITE_LIFF_ID;
  let path = "/missions";
  const params = new URLSearchParams();

  if (result && result.type === "TANITA") {
    path = "/body-composition";
  } else if (taskId) {
    params.append("taskId", String(taskId));
  }

  // ปิดการส่งข้อมูลผ่าน URL เพื่อความปลอดภัย (Data Privacy)
  // โดยให้หน้าเว็บ LIFF มาดึงข้อมูลจาก Database ผ่าน API /api/bot/pending-result แทน
  params.append("fromBot", "true");

  const queryString = params.toString();
  const uri = `https://liff.line.me/${liffId}${path}${queryString ? "?" + queryString : ""}`;

  return {
    items: [
      {
        type: "action" as const,
        action: { type: "camera" as const, label: "ถ่ายรูปใหม่" },
      },
      {
        type: "action" as const,
        action: { type: "cameraRoll" as const, label: "เลือกรูปใหม่" },
      },
      {
        type: "action" as const,
        action: {
          type: "message" as const,
          label: "ส่งภารกิจ",
          text: "ส่งภารกิจ",
        },
      },
    ],
  };
};

const streamToBuffer = (stream: any): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });

// ─── Shared Helpers ──────────────────────────────────────────────────────────

/**
 * ดึงภารกิจที่ valid ของ user วันนี้
 * เงื่อนไข: สมัครกิจกรรมแล้ว + event active + task active + ยังไม่ส่งวันนี้ + วันที่อนุญาต
 */
async function getValidTasksForUser(userId: number) {
  const now = new Date();
  const targetDay = now.getDay();
  const todayTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  const [allTasks]: any = await pool.query(
    `SELECT
      t.id as taskId, t.note, t.type, t.points, t.allowed_days, t.metric_unit,
       e.id as eventId, e.title as eventTitle, e.poster as eventPoster, e.status as eventStatus, e.start_date, e.end_date
     FROM tasks t
     JOIN events e ON t.event_id = e.id
     JOIN registrations r ON e.id = r.event_id
     WHERE r.user_id = ? AND t.is_active = 1`,
    [userId],
  );

  const [todaySubs]: any = await pool.query(
    `SELECT task_id FROM submissions
     WHERE user_id = ? AND status != 'rejected' AND task_id IS NOT NULL AND DATE(created_at) = CURDATE()`,
    [userId],
  );
  const completedIds = todaySubs.map((s: any) => s.task_id);

  return allTasks.filter((t: any) => {
    // 1. Event status (Allow NULL just like activity.ts)
    if (
      t.eventStatus &&
      !["open", "ongoing", "published"].includes(t.eventStatus)
    ) {
      return false;
    }

    // 2. Date range
    if (t.start_date) {
      const sd = new Date(t.start_date);
      if (
        todayTime <
        new Date(sd.getFullYear(), sd.getMonth(), sd.getDate()).getTime()
      )
        return false;
    }
    if (t.end_date) {
      const ed = new Date(t.end_date);
      if (
        todayTime >
        new Date(
          ed.getFullYear(),
          ed.getMonth(),
          ed.getDate(),
          23,
          59,
          59,
        ).getTime()
      )
        return false;
    }

    // 3. Check if submitted today, we STILL INCLUDE IT so user can click it.
    // Instead of hiding it, we'll mark the note.
    if (completedIds.includes(t.taskId)) {
      t.note = `${t.note || t.type} (ส่งแล้ว)`;
    }

    // 4. Allowed days logic (matching mission.ts / activity.ts)
    if (t.allowed_days) {
      try {
        const allowed =
          typeof t.allowed_days === "string"
            ? JSON.parse(t.allowed_days)
            : t.allowed_days;
        if (Array.isArray(allowed) && allowed.length > 0) {
          const isAllowed =
            allowed.length === 7 ||
            allowed.includes(targetDay) ||
            (targetDay === 0 && allowed.includes(7));
          if (!isAllowed) return false;
        }
      } catch {}
    }

    return true;
  });
}

/** สร้าง Flex Carousel items สำหรับให้ user เลือกกิจกรรมก่อน */
function buildEventCarousel(validTasks: any[], ownerId: number): any[] {
  const eventsMap = new Map();
  validTasks.forEach((t: any) => {
    if (!eventsMap.has(t.eventId)) {
      eventsMap.set(t.eventId, {
        eventId: t.eventId,
        eventTitle: t.eventTitle,
        eventPoster: t.eventPoster,
        taskCount: 0,
      });
    }
    eventsMap.get(t.eventId).taskCount++;
  });

  const events = Array.from(eventsMap.values());
  const apiBase = process.env.VITE_API_URL || "";
  const tunnelUrl = process.env.TUNNEL_URL || "http://localhost:3000";

  return events.slice(0, 10).map((e: any) => {
    let heroUrl = null;
    if (e.eventPoster) {
      if (e.eventPoster.startsWith("data:image")) {
        heroUrl = null;
      } else if (e.eventPoster.startsWith("http")) {
        heroUrl = e.eventPoster;
      } else {
        const base = apiBase.startsWith("http")
          ? apiBase.replace(/\/api\/?$/, "")
          : tunnelUrl;
        heroUrl = `${base}${e.eventPoster.startsWith("/") ? "" : "/"}${e.eventPoster}`;
      }
    }

    if (heroUrl && heroUrl.length > 2000) {
      heroUrl = null;
    }

    if (
      heroUrl &&
      heroUrl.startsWith("http://") &&
      !heroUrl.includes("localhost")
    ) {
      heroUrl = heroUrl.replace("http://", "https://");
    }

    const bubble: any = {
      type: "bubble" as const,
      size: "mega",
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        contents: [
          {
            type: "text" as const,
            text: e.eventTitle,
            weight: "bold",
            size: "md",
            color: "#111827",
            wrap: true,
            maxLines: 1,
          },
          {
            type: "text" as const,
            text: `${e.taskCount} ภารกิจรอส่ง`,
            size: "xs",
            color: "#666666",
            margin: "sm",
          },
        ],
      },
      footer: {
        type: "box" as const,
        layout: "vertical" as const,
        contents: [
          {
            type: "button" as const,
            style: "primary" as const,
            color: "#EA580C",
            height: "sm",
            action: {
              type: "postback" as const,
              label: "เปิดดูภารกิจ",
              data: `action=select_bot_event&eventId=${e.eventId}&ownerId=${ownerId}`,
            },
          },
        ],
      },
    };

    if (heroUrl) {
      bubble.hero = {
        type: "image",
        url: heroUrl,
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
      };
    }

    return bubble;
  });
}

/** สร้าง Flex Carousel items สำหรับให้ user เลือกภารกิจ */
function buildMissionCarousel(validTasks: any[], ownerId: number): any[] {
  return validTasks.slice(0, 10).map((t: any) => ({
    type: "bubble" as const,
    size: "kilo",
    body: {
      type: "box" as const,
      layout: "vertical" as const,
      paddingAll: "16px",
      contents: [
        {
          type: "text" as const,
          text: t.note || t.type,
          weight: "bold",
          size: "sm",
          color: "#111827",
          wrap: true,
          maxLines: 2,
        },
        {
          type: "text" as const,
          text: `คะแนนรางวัล +${t.points} pts`,
          size: "xs",
          color: "#6B7280",
          margin: "xs",
        },
      ],
    },
    footer: {
      type: "box" as const,
      layout: "vertical" as const,
      paddingAll: "8px",
      contents: [
        {
          type: "button" as const,
          style: "primary" as const,
          color: "#EA580C",
          height: "sm",
          action: {
            type: "postback" as const,
            label: "เลือกภารกิจนี้",
            data: `action=select_mission&taskId=${t.taskId}&ownerId=${ownerId}`,
          },
        },
      ],
    },
  }));
}

/** สร้าง Flex สำหรับยืนยันข้อมูลก่อนบันทึก */
function buildConfirmationFlex(
  result: any,
  fullUrl: string,
  lastBotTaskId: any,
  ownerId: number,
): any {
  // ─── Helper: สร้างแถวข้อมูล label | value ───────────────────────────────
  const row = (
    label: string,
    value: string | number | null | undefined,
    unit = "",
    color = "#111827",
  ) => {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === "0" ||
      Number(value) === 0
    )
      return null;
    return {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: label, color: "#6B7280", size: "sm", flex: 4 },
        {
          type: "text",
          text: `${value}${unit ? " " + unit : ""}`,
          color,
          size: "sm",
          flex: 5,
          weight: "bold",
          align: "end" as const,
        },
      ],
      paddingTop: "2px",
      paddingBottom: "2px",
    };
  };

  // ─── Helper: สร้าง Header ของ Section ──────────────────────────────────
  const sectionHeader = (title: string) => ({
    type: "box",
    layout: "vertical",
    margin: "md",
    paddingBottom: "4px",
    contents: [
      {
        type: "text",
        text: title,
        size: "sm",
        weight: "bold",
        color: "#EA580C",
      },
    ],
  });

  // ─── Helper: separator ──────────────────────────────────────────────────
  const sep = () => ({ type: "separator", margin: "sm" }) as const;

  // ─── สร้าง Body Contents ตาม type ───────────────────────────────────────
  let bodyContents: any[] = [];

  if (result.type === "TANITA") {
    const genderLabel =
      result.gender === "MALE"
        ? "ชาย"
        : result.gender === "FEMALE"
          ? "หญิง"
          : null;

    // Helper: สร้าง section พร้อม filter — ถ้า contents ว่างทั้งหมดให้ return null
    const safeSection = (items: any[]) => {
      const filtered = items.filter(Boolean);
      if (filtered.length === 0) return null;
      return {
        type: "box",
        layout: "vertical" as const,
        margin: "sm" as const,
        contents: filtered,
      };
    };

    const personalSection = safeSection([
      row("เพศ", genderLabel),
      row("อายุ", result.age, "ปี"),
      row("ส่วนสูง", result.height, "cm"),
      row("น้ำหนักเสื้อผ้า", result.clothes_weight, "kg"),
    ]);

    const bodySection = safeSection([
      row("ไขมัน (%)", result.fat_pc, "%", "#111827"),
      row("มวลไขมัน", result.fat_mass, "kg"),
      row("FFM (ไร้ไขมัน)", result.ffm, "kg"),
      row("มวลกล้ามเนื้อ", result.muscle_mass, "kg", "#111827"),
      row("มวลน้ำ", result.tbw_mass, "kg"),
      row("น้ำในร่างกาย (%)", result.tbw_pc, "%"),
      row("มวลกระดูก", result.bone_mass, "kg"),
    ]);

    const metaSection = safeSection([
      row("BMR", result.bmr_kcal, "kcal"),
      row("BMR", result.bmr_kj, "kJ"),
      row("BMI", result.bmi, ""),
      row("น้ำหนักเหมาะสม", result.ideal_weight, "kg"),
      row("ไขมันช่องท้อง", result.visceral_fat, "ระดับ", "#111827"),
      row("อายุเผาผลาญ", result.metabolic_age, "ปี"),
      row("Physique", result.physique_rating, ""),
      row("ระดับความอ้วน", result.obesity_degree, "%"),
    ]);

    // สร้าง header box — ถ้ามี gender ให้แสดง 2 คอลัมน์, ถ้าไม่มีให้แสดง 1 คอลัมน์
    const headerBox = {
      type: "text",
      text: "สรุปองค์ประกอบร่างกาย",
      weight: "bold" as const,
      size: "md" as const,
      color: "#111827",
    };

    bodyContents = [
      headerBox,
      {
        type: "text",
        text: "กรุณาตรวจสอบความถูกต้องของข้อมูล",
        size: "xs",
        color: "#9CA3AF",
        margin: "xs",
        wrap: true,
      },

      ...(personalSection
        ? [sectionHeader("ข้อมูลส่วนตัว"), personalSection]
        : []),

      sep(),
      sectionHeader("องค์ประกอบร่างกาย"),
      {
        type: "box",
        layout: "vertical" as const,
        margin: "sm" as const,
        contents: [
          {
            type: "box",
            layout: "horizontal" as const,
            contents: [
              {
                type: "text",
                text: "น้ำหนัก",
                color: "#6B7280",
                size: "sm" as const,
                flex: 4,
              },
              {
                type: "text",
                text: `${result.weight} kg`,
                color: "#111827",
                size: "sm" as const,
                weight: "bold" as const,
                flex: 5,
                align: "end" as const,
              },
            ],
            paddingBottom: "6px",
          },
          ...(bodySection ? bodySection.contents : []),
        ],
      },

      ...(metaSection
        ? [sep(), sectionHeader("อัตราเผาผลาญและดัชนี"), metaSection]
        : []),
    ].filter(Boolean);
  } else {
    // ─── กิจกรรมอื่น (RUNNING, CYCLING, SWIMMING, WALKING, STEPS, CALORIES, WORKOUT, FOOD) ────
    const rows: { name: string; value: string }[] = [];
    const distanceTypes = ["RUNNING", "CYCLING", "SWIMMING", "WALKING"];

    // ── Safe scalar extractor: ป้องกัน [object Object] ────────────────────
    const safeNum = (v: any): number | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === "object") {
        // AI บางครั้งส่งกลับมาเป็น { value: 3.6 } หรือ { distance: 3.6 }
        const n = parseFloat(
          v?.value ?? v?.distance ?? v?.km ?? JSON.stringify(v),
        );
        return isNaN(n) ? null : n;
      }
      const n = parseFloat(String(v));
      return isNaN(n) ? null : n;
    };
    const safeStr = (v: any): string | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === "object") return safeNum(v)?.toString() ?? null;
      return String(v);
    };

    if (result.type === "PHOTO_PROOF") {
      rows.push({ name: "ประเภทการส่ง", value: "รูปภาพหลักฐานภารกิจ" });
      rows.push({ name: "สถานะการส่ง", value: "พร้อมบันทึก (ไม่ต้องตรวจ OCR)" });
    } else if (distanceTypes.includes(result.type)) {
      const dist = safeNum(result.value) ?? safeNum(result.distance);
      if (dist !== null)
        rows.push({ name: "ระยะทาง", value: `${dist.toFixed(2)} km` });
      const dur = safeNum(result.duration);
      if (dur !== null) rows.push({ name: "เวลา", value: `${dur} นาที` });
      const cal = safeNum(result.calories);
      if (cal !== null) rows.push({ name: "แคลอรี่", value: `${cal} kcal` });
      const pace = safeStr(result.pace);
      if (pace) rows.push({ name: "Pace", value: pace });
      const hr = safeNum(result.heart_rate_avg);
      if (hr !== null) rows.push({ name: "Heart Rate", value: `${hr} bpm` });
    } else if (result.type === "STEPS") {
      const steps = safeNum(result.value) ?? safeNum(result.steps);
      if (steps !== null)
        rows.push({
          name: "จำนวนก้าว",
          value: `${Math.round(steps).toLocaleString()} ก้าว`,
        });
      const cal = safeNum(result.calories);
      if (cal !== null) rows.push({ name: "แคลอรี่", value: `${cal} kcal` });
    } else if (result.type === "CALORIES") {
      const cal = safeNum(result.value) ?? safeNum(result.calories);
      if (cal !== null)
        rows.push({ name: "พลังงานที่เผาผลาญ", value: `${cal} kcal` });
    } else if (result.type === "WORKOUT") {
      const dur = safeNum(result.value) ?? safeNum(result.duration);
      if (dur !== null) rows.push({ name: "ระยะเวลา", value: `${dur} นาที` });
      const name = safeStr(result.exercise_name);
      if (name) rows.push({ name: "กิจกรรม", value: name });
      const cal = safeNum(result.calories);
      if (cal !== null) rows.push({ name: "แคลอรี่", value: `${cal} kcal` });
    } else if (result.type === "FOOD") {
      const cal = safeNum(result.value) ?? safeNum(result.calories);
      if (cal !== null)
        rows.push({ name: "แคลอรี่ (ประมาณ)", value: `${cal} kcal` });
      const food = safeStr(result.food_name);
      if (food) rows.push({ name: "อาหาร", value: food });
    } else {
      const v = safeNum(result.value);
      if (v !== null) rows.push({ name: "ค่าที่วัด", value: String(v) });
    }

    const titleMap: Record<string, string> = {
      RUNNING: "ผลการวิ่ง",
      CYCLING: "ผลการปั่นจักรยาน",
      SWIMMING: "ผลการว่ายน้ำ",
      WALKING: "ผลการเดิน",
      STEPS: "จำนวนก้าวเดิน",
      CALORIES: "แคลอรี่",
      WORKOUT: "การออกกำลังกาย",
      FOOD: "บันทึกอาหาร",
      PHOTO_PROOF: "รูปภาพหลักฐานภารกิจ",
    };

    bodyContents = [
      {
        type: "text",
        text: titleMap[result.type] || "ผลวิเคราะห์กิจกรรม",
        weight: "bold" as const,
        size: "lg" as const,
        color: "#111827",
      },
      {
        type: "text",
        text: "ตรวจสอบข้อมูลกิจกรรมของคุณ",
        size: "xs" as const,
        color: "#9CA3AF",
        margin: "xs" as const,
        wrap: true,
      },
      {
        type: "box",
        layout: "vertical" as const,
        margin: "lg" as const,
        spacing: "sm" as const,
        contents: rows.map((r) => ({
          type: "box",
          layout: "horizontal" as const,
          contents: [
            {
              type: "text",
              text: r.name,
              color: "#888888",
              size: "sm" as const,
              flex: 4,
            },
            {
              type: "text",
              text: r.value,
              wrap: true,
              color: "#222222",
              size: "sm" as const,
              flex: 5,
              weight: "bold" as const,
              align: "end" as const,
            },
          ],
          paddingTop: "2px",
          paddingBottom: "2px",
        })),
      },
    ];
  }

  const liffId = process.env.VITE_LIFF_ID;
  let path = "/missions";
  const params = new URLSearchParams();

  if (result && result.type === "TANITA") {
    path = "/body-composition";
  } else if (lastBotTaskId) {
    params.append("taskId", String(lastBotTaskId));
  }
  params.append("fromBot", "true");
  const queryString = params.toString();
  const uri = `https://liff.line.me/${liffId}${path}${queryString ? "?" + queryString : ""}`;

  return {
    type: "bubble",
    size: "kilo",
    hero: {
      type: "image",
      url: fullUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      spacing: "none",
      contents: bodyContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#06C755",
          height: "sm",
          action: {
            type: "postback",
            label: "ยืนยันส่งผล",
            data: `action=confirm_submit&ownerId=${ownerId}`,
            displayText: "ส่ง",
          },
        },
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "secondary",
              height: "sm",
              flex: 1,
              action: {
                type: "uri",
                label: "✏️ แก้ไขค่า",
                uri: uri,
              },
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              flex: 1,
              action: {
                type: "postback",
                label: "❌ ยกเลิก",
                data: `action=cancel_submit&ownerId=${ownerId}`,
                displayText: "ยกเลิก",
              },
            },
          ],
        },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function handleEvent(event: any) {
  console.log(
    `[LINE] Incoming event: ${event.type}`,
    event.message ? `(${event.message.type})` : "",
  );
  const lineUserId = event.source.userId;
  if (!lineUserId) return;

  // ตรวจสอบว่าเป็น Group/Room chat หรือไม่
  // Quick Reply ใน Group จะ shared กับทุกคน → ใช้เฉพาะปุ่ม Add Friend
  const isGroupChat =
    event.source.type === "group" || event.source.type === "room";

  try {
    // 0. Handle follow event (Someone adds the bot)
    if (event.type === "follow") {
      // ดึงชื่อจาก LINE Profile ก่อน เพื่อทักทายส่วนตัว
      let followName = "คุณ";
      try {
        const lp = await client.getProfile(lineUserId);
        followName = lp.displayName || "คุณ";
      } catch {}

      // เช็คว่ามีในระบบแล้วหรือยัง (กรณี unfollow แล้ว follow ใหม่)
      const [existingRows]: any = await pool.query(
        "SELECT id, phone FROM users WHERE line_id = ?",
        [lineUserId],
      );
      const existingUser = existingRows[0] ?? null;
      const liffId = process.env.VITE_LIFF_ID;
      const loginUrl = `https://liff.line.me/${liffId}/login`;

      if (!existingUser) {
        // ผู้ใช้ใหม่จริงๆ — ชวนลงทะเบียน
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: `สวัสดีครับ ${followName}! ยินดีต้อนรับสู่ VitalCare 🎉\n\nก่อนเริ่มต้นบันทึกกิจกรรม กรุณาลงทะเบียนข้อมูลส่วนตัวก่อนนะครับ ใช้เวลาเพียงไม่กี่นาที 📝`,
              quickReply: {
                items: [
                  {
                    type: "action" as const,
                    action: {
                      type: "uri" as const,
                      label: "📝 ลงทะเบียนเลย",
                      uri: loginUrl,
                    },
                  },
                  {
                    type: "action" as const,
                    action: {
                      type: "message" as const,
                      label: "วิธีใช้งาน",
                      text: "วิธีใช้งาน",
                    },
                  },
                ],
              },
            },
          ],
        });
      } else if (!existingUser.phone) {
        // เคย follow แต่ยังไม่กรอกโปรไฟล์
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: `ยินดีต้อนรับกลับมานะครับ ${followName}! 👋\n\nดูเหมือนข้อมูลส่วนตัวของคุณยังไม่ครบ กรุณากรอกให้ครบก่อนเพื่อใช้งานได้เต็มที่ครับ`,
              quickReply: {
                items: [
                  {
                    type: "action" as const,
                    action: {
                      type: "uri" as const,
                      label: "📝 กรอกข้อมูล",
                      uri: loginUrl,
                    },
                  },
                  {
                    type: "action" as const,
                    action: {
                      type: "message" as const,
                      label: "วิธีใช้งาน",
                      text: "วิธีใช้งาน",
                    },
                  },
                ],
              },
            },
          ],
        });
      } else {
        // กลับมาใหม่ และข้อมูลครบแล้ว
        const mainQR = await getMainQuickReply(existingUser.id, isGroupChat);
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: `ยินดีต้อนรับกลับมาครับ ${followName}! 💪\n\nคุณสามารถส่งรูปภาพผลการวิ่ง / สลิปองค์ประกอบร่างกาย หรือกดปุ่มด้านล่างได้เลยครับ`,
              quickReply: mainQR,
            },
          ],
        });
      }
    }

    // 1. Get or Create Profile (Shared for all event types)
    let [userRows]: any = await pool.query(
      "SELECT id, fname_th, last_bot_task_id, pending_bot_result FROM users WHERE line_id = ?",
      [lineUserId],
    );

    let userId;
    let displayName = "Runner";
    let lastBotTaskId = null;
    let pendingBotResult = null;

    if (userRows.length > 0) {
      const profile = userRows[0];
      userId = profile.id;
      lastBotTaskId = profile.last_bot_task_id;
      pendingBotResult = profile.pending_bot_result;
      displayName = decrypt(profile.fname_th) || "Runner";
    } else {
      try {
        const lineProfile = await client.getProfile(lineUserId);
        displayName = lineProfile.displayName;
      } catch {}

      const encryptedName = encrypt(displayName);
      const [insertResult]: any = await pool.query(
        "INSERT INTO users (line_id, fname_th) VALUES (?, ?)",
        [lineUserId, encryptedName],
      );
      userId = insertResult.insertId;
    }

    // ─── 0.1 Handle Postback (Selection from Flex Message) ───────────────────
    if (event.type === "postback") {
      const data = new URLSearchParams(event.postback.data);
      const action = data.get("action");
      const taskId = data.get("taskId");
      const taskName = data.get("taskName") || "ภารกิจ";
      const ownerId = data.get("ownerId");

      // Verify owner to prevent cross-user interaction in LINE groups
      if (ownerId && ownerId !== String(userId)) {
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: "⚠️ ปุ่มนี้สำหรับเจ้าของข้อมูลที่เรียกคำสั่งเท่านั้นครับ ไม่สามารถกดแทนกันได้",
              quickReply: await getMainQuickReply(userId, isGroupChat),
            },
          ],
        });
      }

      if (action === "confirm_submit") {
        event.type = "message";
        event.message = { type: "text", text: "ส่ง", id: "dummy" };
      } else if (action === "cancel_submit") {
        event.type = "message";
        event.message = { type: "text", text: "ยกเลิก", id: "dummy" };
      } else if (action === "select_mission" && taskId) {
        // Fetch task name for display
        const [taskData]: any = await pool.query(
          "SELECT note, type FROM tasks WHERE id = ?",
          [taskId],
        );
        const taskName =
          taskData.length > 0 ? taskData[0].note || taskData[0].type : "ภารกิจ";

        await pool.query(
          "UPDATE users SET last_bot_task_id = ? WHERE line_id = ?",
          [taskId, lineUserId],
        );

        if (pendingBotResult) {
          const result =
            typeof pendingBotResult === "string"
              ? JSON.parse(pendingBotResult)
              : pendingBotResult;

          // ตรวจสอบความสอดคล้องกัน (Mismatch) ระหว่างประเภทของภารกิจที่เลือกกับประเภทของรูปภาพที่ค้างอยู่
          const isTaskTanita =
            Number(taskId) === 0 ||
            (taskData.length > 0 &&
              ((taskData[0].type || "").toLowerCase().includes("tanita") ||
                (taskData[0].type || "").toLowerCase().includes("weight")));
          const isResultTanita = result && result.type === "TANITA";

          if (isTaskTanita !== isResultTanita) {
            // เกิดความไม่สอดคล้องกัน: ล้างรูปค้างเก่าทิ้ง และขอรูปภาพที่ถูกต้องสำหรับภารกิจใหม่
            await pool.query(
              "UPDATE users SET pending_bot_result = NULL WHERE line_id = ?",
              [lineUserId],
            );
            return client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                {
                  type: "text",
                  text: `✅ คุณ ${displayName} เลือก "${taskName}"\n📸 กรุณาส่งรูปภาพหลักฐานใหม่สำหรับภารกิจนี้ได้เลยครับ`,
                  quickReply: await getPhotoUploadQuickReply(userId, isGroupChat),
                },
              ],
            });
          }

          if (result && result.publicUrl) {
            const tunnelUrl = process.env.TUNNEL_URL || "http://localhost:3000";
            const apiBase = process.env.VITE_API_URL || "";
            const host = apiBase.startsWith("http")
              ? apiBase.replace(/\/api\/?$/, "")
              : tunnelUrl;

            const fullUrl = result.publicUrl.startsWith("data:")
              ? `${host}/api/bot/image-preview/${userId}?t=${Date.now()}`
              : result.publicUrl.startsWith("http")
                ? result.publicUrl
                : `${host}${result.publicUrl}`;

            return client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                {
                  type: "text",
                  text: `✅ คุณ ${displayName} เลือก "${taskName}"\n📊 ระบบนำข้อมูลจากรูปที่คุณส่งมาเชื่อมกับภารกิจนี้ให้ทันทีครับ`,
                },
                {
                  type: "flex",
                  altText: `ยืนยันข้อมูลการส่งผลของคุณ ${displayName}`,
                  contents: buildConfirmationFlex(
                    result,
                    fullUrl,
                    taskId,
                    userId,
                  ),
                  quickReply: getConfirmQuickReply(
                    Number(taskId),
                    result,
                    userId,
                  ),
                },
              ],
            });
          }
        }

        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: `✅ คุณ ${displayName} เลือก "${taskName}"\n📸 กรุณาส่งรูปภาพหลักฐานลงในแชทได้เลยครับ`,
              quickReply: await getPhotoUploadQuickReply(userId, isGroupChat),
            },
          ],
        });
      } else if (action === "select_bot_event" && data.get("eventId")) {
        const eventId = Number(data.get("eventId"));

        // Fetch event name for display
        const [eventData]: any = await pool.query(
          "SELECT title FROM events WHERE id = ?",
          [eventId],
        );
        const eventName = eventData.length > 0 ? eventData[0].title : "กิจกรรม";

        const userValidTasks = await getValidTasksForUser(userId);
        const filteredTasks = userValidTasks.filter(
          (t: any) => Number(t.eventId) === eventId,
        );

        if (filteredTasks.length === 0) {
          return client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: `ไม่พบภารกิจจากกิจกรรม "${eventName}" ที่ต้องส่งในวันนี้ครับ`,
                quickReply: await getMainQuickReply(userId, isGroupChat),
              },
            ],
          });
        }

        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            { type: "text", text: `📂 ภารกิจของกิจกรรม "${eventName}"` },
            {
              type: "flex",
              altText: `ภารกิจของ ${eventName}`,
              contents: {
                type: "carousel",
                contents: buildMissionCarousel(filteredTasks, userId),
              },
              quickReply: await getMainQuickReply(userId, isGroupChat),
            },
          ],
        });
      } else {
        return; // End postback handling for unknown actions
      }
    }

    if (event.type !== "message") return;

    // 2. Image Message
    if (event.message.type === "image") {
      // ─── STEP 0: ตรวจสอบความต้องการ (Intent) เผื่อประหยัด Token ─────────────────
      if (lastBotTaskId === null) {
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: "🤖 กรุณาเลือกส่งภารกิจ หรือ เลือกบันทึกองค์ประกอบของร่างกาย ก่อนที่จะส่งรูปภาพ เพื่อให้บอทช่วยบันทึกข้อมูลได้อย่างถูกต้องครับ",
              quickReply: await getMainQuickReply(userId, isGroupChat),
            },
          ],
        });
      }

      // ─── STEP 0.1: ตรวจสอบความถูกต้องของ lastBotTaskId ─────────────────────────
      if (lastBotTaskId > 0) {
        const [taskCheck]: any = await pool.query(
          `SELECT t.id FROM tasks t
           JOIN events e ON t.event_id = e.id
           JOIN registrations r ON e.id = r.event_id AND r.user_id = ?
           WHERE t.id = ? AND (e.status IS NULL OR e.status IN ('open','ongoing','published')) AND t.is_active = 1`,
          [userId, lastBotTaskId],
        );
        if (taskCheck.length === 0) {
          await pool.query(
            "UPDATE users SET last_bot_task_id = NULL WHERE id = ?",
            [userId],
          );
          lastBotTaskId = null;
          return client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: "⚠️ ภารกิจที่เลือกไว้ไม่ถูกต้อง หรือกิจกรรมสิ้นสุดแล้ว\n\nกรุณากด 'ส่งภารกิจ' เพื่อเลือกภารกิจใหม่ก่อนส่งรูปภาพครับ",
                quickReply: await getMainQuickReply(userId, isGroupChat),
              },
            ],
          });
        }
      }

      // ─── STEP 1: รับและประมวลผลรูปภาพ ─────────────────────────────────────────
      const messageId = event.message.id;
      try {
        await client.showLoadingAnimation({
          chatId: lineUserId,
          loadingSeconds: 60,
        });
      } catch {}

      const stream = await blobClient.getMessageContent(messageId);
      const rawBuf = await streamToBuffer(stream);

      // Process with Sharp to optimize for Database (PNG, max 1280px)
      const sharp = (await import("sharp")).default;
      const optimizedBuf = await sharp(rawBuf)
        .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();

      const getBangkokDateString = () => {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
      };
      
      const dateStr = getBangkokDateString();
      const uniqueSuffix = Math.random().toString(36).substring(2, 8);
      const filename = `bot-${userId}-${dateStr}-${uniqueSuffix}.png`;
      const uploadDir = path.join(__dirname, "../../public/uploads/submissions");
      
      await fs.mkdir(uploadDir, { recursive: true });
      const destPath = path.join(uploadDir, filename);
      await fs.writeFile(destPath, optimizedBuf);
      
      const publicUrl = `/uploads/submissions/${filename}`;

      const apiBase = process.env.VITE_API_URL || "";
      const tunnelUrl = process.env.TUNNEL_URL || "http://localhost:3000";
      const host = apiBase.startsWith("http")
        ? apiBase.replace(/\/api\/?$/, "")
        : tunnelUrl;

      // For LINE Hero, we MUST use a real URL that serves from DB
      const fullUrl = `${host}/api/bot/image-preview/${userId}?t=${Date.now()}`;
      console.log("DEBUG: Final URL for LINE Hero (DB-served):", fullUrl);

      // ─── STEP 2: ดึงหน่วยและคุณสมบัติ OCR ของ task ─────────────────────────────────────────────
      let targetUnit = "km";
      let useOcr = true; // default: always try AI OCR
      if (lastBotTaskId) {
        try {
          const [taskInfo]: any = await pool.query(
            "SELECT metric_unit, use_ocr FROM tasks WHERE id = ?",
            [lastBotTaskId],
          );
          if (taskInfo.length > 0) {
            if (taskInfo[0].metric_unit) targetUnit = taskInfo[0].metric_unit.toLowerCase();
            // use_ocr: 1/true/null = enabled, 0/false = photo-proof only
            const rawUseOcr = taskInfo[0].use_ocr;
            useOcr = rawUseOcr === 1 || rawUseOcr === true || rawUseOcr === null || rawUseOcr === undefined;
          }
        } catch (dbErr: any) {
          // Fallback: use_ocr column might not exist in schema yet — default to enabled
          console.warn("[BOT] use_ocr column not found or DB error, defaulting useOcr=true:", dbErr.message);
          try {
            const [taskFallback]: any = await pool.query(
              "SELECT metric_unit FROM tasks WHERE id = ?",
              [lastBotTaskId],
            );
            if (taskFallback.length > 0 && taskFallback[0].metric_unit) {
              targetUnit = taskFallback[0].metric_unit.toLowerCase();
            }
          } catch {}
          useOcr = true;
        }
      }

      // ─── STEP 3: เรียก /api/ai เหมือน frontend ────────────────────────────────
      const internalBase = `http://localhost:${process.env.PORT || 3000}/api`;
      let result: any = { type: "NOT_FOUND" };

      if (lastBotTaskId && !useOcr) {
        console.log(`[BOT] Task ${lastBotTaskId} has use_ocr = false. Bypassing AI OCR analysis.`);
        result = {
          type: "PHOTO_PROOF",
          value: 1,
          publicUrl,
        };
      } else {
        try {
          const ax = (await import("axios")).default;

          // ดึง task metadata เพิ่มเติม
          let taskTitle = "";
          let metricType = "";
          if (lastBotTaskId) {
            const [taskExtra]: any = await pool.query(
              "SELECT note, type FROM tasks WHERE id = ?",
              [lastBotTaskId],
            );
            if (taskExtra.length > 0) {
              taskTitle = taskExtra[0].note || taskExtra[0].type || "";
              metricType = taskExtra[0].type || "";
            }
          }

          const isTanitaTask =
            lastBotTaskId === 0 ||
            (lastBotTaskId > 0 && (
              targetUnit === "kg" ||
              metricType?.toLowerCase().includes("tanita") ||
              metricType?.toLowerCase().includes("weight")
            ));

          if (isTanitaTask) {
            // Path A: analyze-tanita
            try {
              const tRes = await ax.post(`${internalBase}/ai/analyze-tanita`, {
                imageUrl: publicUrl,
                userId,
              });
              if (tRes.data?.weight) {
                console.log(`[BOT] Tanita analysis OK:`, tRes.data);
                const td = tRes.data;
                result = {
                  type: "TANITA",
                  value: parseFloat(td.weight) || 0,
                  weight: td.weight,
                  fat_pc: td.fat_pc,
                  fat_mass: td.fat_mass,
                  ffm: td.ffm,
                  muscle_mass: td.muscle_mass,
                  tbw_mass: td.tbw_mass,
                  tbw_pc: td.tbw_pc,
                  bone_mass: td.bone_mass,
                  bmr_kcal: td.bmr_kcal,
                  bmr_kj: td.bmr_kj,
                  metabolic_age: td.metabolic_age,
                  visceral_fat: td.visceral_fat,
                  bmi: td.bmi,
                  ideal_weight: td.ideal_weight,
                  obesity_degree: td.obesity_degree,
                  physique_rating: td.physique_rating,
                  body_type: td.body_type,
                  age: td.age,
                  height: td.height,
                  gender: td.gender,
                  publicUrl,
                };
              }
            } catch (tanitaErr: any) {
              console.warn(`[BOT] analyze-tanita failed:`, tanitaErr.message);

              // ถ้าเป็นโหมดบันทึกร่างกายโดยเฉพาะ (lastBotTaskId === 0) แล้วรูปผิด หรือ AI ขัดข้อง -> แจ้งเตือนด้วย Flex Message ทันที
              if (lastBotTaskId === 0) {
                const isInvalidImage = tanitaErr.response?.status === 422;

                // อัปเดต DB ด้วยรูปนี้ก่อน เพื่อให้ปุ่ม 'แก้ไข' บนเว็บเห็นรูปที่พึ่งส่งมาล่าสุด
                await pool.query(
                  "UPDATE users SET pending_bot_result = ? WHERE id = ?",
                  [JSON.stringify({ type: "TANITA", publicUrl }), userId],
                );

                const errMsg = isInvalidImage
                  ? tanitaErr.response?.data?.error ||
                    "รูปภาพที่ส่งมาไม่ใช่ใบวัดองค์ประกอบร่างกาย"
                  : "เกิดข้อผิดพลาดในการวิเคราะห์ภาพจากระบบ AI หรือระบบประมวลผลไม่ทันเวลา (Timeout)\n\nระบบยังคงบันทึกรูปของคุณไว้ คุณสามารถกดปุ่มเพื่อกรอกข้อมูลด้วยตนเองผ่านเว็บไซต์ได้เลยครับ";

                const headerText = isInvalidImage
                  ? "ไม่พบข้อมูลสุขภาพในรูป"
                  : "ระบบวิเคราะห์ภาพขัดข้อง";
                const bodyCompUrl = `${host}/body-composition`;

                return client.replyMessage({
                  replyToken: event.replyToken,
                  messages: [
                    {
                      type: "flex",
                      altText: `${headerText} — กรอกข้อมูลที่เว็บไซต์`,
                      contents: {
                        type: "bubble",
                        size: "mega",
                        header: {
                          type: "box",
                          layout: "vertical",
                          backgroundColor: "#FEF3C7",
                          paddingAll: "16px",
                          contents: [
                            {
                              type: "box",
                              layout: "horizontal",
                              contents: [
                                { type: "text", text: "⚠️", size: "xl", flex: 0 },
                                {
                                  type: "text",
                                  text: headerText,
                                  weight: "bold",
                                  size: "md",
                                  color: "#92400E",
                                  flex: 1,
                                  margin: "sm",
                                  wrap: true,
                                },
                              ],
                            },
                          ],
                        },
                        body: {
                          type: "box",
                          layout: "vertical",
                          paddingAll: "16px",
                          spacing: "md",
                          contents: [
                            {
                              type: "text",
                              text: errMsg,
                              wrap: true,
                              color: "#374151",
                              size: "sm",
                            },
                          ],
                        },
                        footer: {
                          type: "box",
                          layout: "vertical",
                          spacing: "sm",
                          paddingAll: "12px",
                          contents: [
                            {
                              type: "button",
                              style: "primary",
                              color: "#EA580C",
                              action: {
                                type: "uri",
                                label: "📝 กรอกข้อมูลที่เว็บไซต์",
                                uri: bodyCompUrl,
                              },
                            },
                          ],
                        },
                      },
                      quickReply: await getMainQuickReply(userId, isGroupChat),
                    },
                  ],
                });
              }

              // ถ้าเป็น Mission (>0) แล้ว analyze-tanita พลาด ไม่ต้อง return
              // ปล่อยให้ flow ไหลไปที่ analyze-mission ด้านล่างแทน
              if (lastBotTaskId > 0) {
                console.log(
                  `[BOT] Tanita analysis skipped or failed for mission, falling back to mission analysis...`,
                );
              }
            }
          }

          if (result.type === "NOT_FOUND" && lastBotTaskId) {
            // Path B: analyze-mission
            console.log(
              `[BOT] Calling analyze-mission: title=${taskTitle}, unit=${targetUnit}`,
            );
            const mRes = await ax.post(`${internalBase}/ai/analyze-mission`, {
              imageUrl: publicUrl,
              taskTitle,
              metricUnit: targetUnit,
              metricType,
              userId,
            });
            const md = mRes.data;
            console.log(`[BOT] Mission analysis result:`, md);
            if (md.isRelated && md.value && parseFloat(md.value) > 0) {
              const val = parseFloat(md.value);
              const dU = ["km", "m", "miles"];
              const sU = ["steps", "ก้าว"];
              const cU = ["kcal", "calories", "cal"];
              const tU = ["min", "minute", "minutes", "นาที", "ชั่วโมง", "hour"];
              let type = "RUNNING";
              if (sU.includes(targetUnit)) type = "STEPS";
              else if (cU.includes(targetUnit)) type = "CALORIES";
              else if (tU.includes(targetUnit)) type = "WORKOUT";
              result = {
                type,
                value: val,
                distance: dU.includes(targetUnit) ? val : undefined,
                steps: sU.includes(targetUnit) ? Math.round(val) : undefined,
                calories: cU.includes(targetUnit) ? val : undefined,
                duration: tU.includes(targetUnit) ? val : undefined,
                note: md.reason || "",
                publicUrl,
              };
            }
          }
        } catch (aiErr: any) {
          console.error("[BOT] AI API call failed:", aiErr.message);

          // ดักจับกรณี Rate Limit (AI ใช้งานไม่ได้ชั่วคราว)
          const isRateLimit =
            aiErr.response?.status === 429 ||
            aiErr.message?.toLowerCase().includes("rate limit") ||
            aiErr.response?.data?.error?.toLowerCase().includes("rate limit");

          if (isRateLimit) {
            // บันทึก URL รูปไว้เพื่อให้ไปแก้ไขเองได้ แม้ AI จะล่ม
            const rateLimitResult = {
              type: lastBotTaskId === 0 ? "TANITA" : "MISSION",
              publicUrl,
              isRateLimited: true,
            };
            await pool.query(
              "UPDATE users SET pending_bot_result = ? WHERE id = ?",
              [JSON.stringify(rateLimitResult), userId],
            );

            return client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                {
                  type: "text",
                  text: "ขออภัยครับ ขณะนี้ระบบ AI มีผู้ใช้งานเป็นจำนวนมากจนเกินขีดจำกัด (Rate Limit)\n\nบอทไม่สามารถวิเคราะห์รูปภาพให้ได้ในขณะนี้ แต่คุณยังสามารถดูรูปที่ส่งมา และกดปุ่ม 'แก้ไขค่า' เพื่อกรอกข้อมูลด้วยตนเองผ่านทางหน้าเว็บไซต์ได้ทันที ขออภัยในความไม่สะดวกด้วยครับ 🙏",
                },
                {
                  type: "flex",
                  altText: "ยืนยันข้อมูลการส่งผล (กรอกเอง)",
                  contents: buildConfirmationFlex(
                    { type: "NOT_FOUND", publicUrl },
                    fullUrl,
                    lastBotTaskId,
                    userId,
                  ),
                  quickReply: getConfirmQuickReply(
                    lastBotTaskId,
                    lastBotTaskId === 0 ? { type: "TANITA" } : null,
                    userId,
                  ),
                },
              ],
            });
          }

          result = { type: "NOT_FOUND" };
        }
      }

      if (result.type === "INVALID" || result.type === "NOT_FOUND") {
        if (!lastBotTaskId) {
          // User sent an image without selecting a task, and it's not a Tanita slip.
          return client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: "❌ บอทไม่สามารถระบุได้ว่ารูปภาพนี้คือผลของกิจกรรมใด\n\nกรุณากดเลือกภารกิจจากเมนู หรือกด 'บันทึกร่างกาย' ก่อนส่งรูปภาพหลักฐานครับ",
                quickReply: await getMainQuickReply(userId, isGroupChat),
              },
            ],
          });
        }

        const reason =
          result.type === "NOT_FOUND"
            ? `หาค่า [${targetUnit}] ไม่พบในรูปภาพนี้`
            : "รูปภาพไม่ชัดเจนหรือข้อมูลไม่ถูกต้อง";
        const liffId = process.env.VITE_LIFF_ID;
        const path = lastBotTaskId === 0 ? "/body-composition" : "/missions";
        const webUrl = `https://liff.line.me/${liffId}${path}?fromBot=true${lastBotTaskId ? `&taskId=${lastBotTaskId}` : ""}`;

        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: `❌ ${reason}\n\nกรุณาส่งรูปสรุปผลที่มีค่า ${targetUnit} ที่ชัดเจน หรือเลือกภารกิจที่ตรงกับรูปภาพครับ`,
              quickReply: {
                items: [
                  {
                    type: "action",
                    action: {
                      type: "uri",
                      label: "📝 เข้าทำที่ website",
                      uri: webUrl,
                    },
                  },
                  {
                    type: "action",
                    action: {
                      type: "message",
                      label: "ยกเลิก",
                      text: "ยกเลิก",
                    },
                  },
                ],
              },
            },
          ],
        });
      }

      // Store pending result
      const cleanedResult = { ...result, publicUrl };
      await pool.query("UPDATE users SET pending_bot_result = ? WHERE id = ?", [
        JSON.stringify(cleanedResult),
        userId,
      ]);

      // ─── STEP 3: ตรวจสอบภารกิจ (ข้ามถ้าเป็น TANITA) ─────────────────────────
      if (!lastBotTaskId && result.type !== "TANITA") {
        const validTasks = await getValidTasksForUser(userId);
        if (validTasks.length > 0) {
          // บันทึกผลไว้แล้ว รอยืนยันหลังเลือกภารกิจ
          return client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: `📋 บอทวิเคราะห์พบว่าเป็นข้อมูลกิจกรรม\nแต่คุณ ${displayName} ยังมีภารกิจที่รอส่งอยู่! กรุณาเลือกกิจกรรมที่ต้องการบันทึกผลครับ 👇`,
              },
              {
                type: "flex",
                altText: `เลือกกิจกรรมของคุณ ${displayName}`,
                contents: {
                  type: "carousel",
                  contents: buildEventCarousel(validTasks, userId),
                },
                quickReply: await getMainQuickReply(userId, isGroupChat),
              },
            ],
          });
        }
      }

      // Generate Confirmation Flex Message
      const flexMsg = buildConfirmationFlex(
        result,
        fullUrl,
        lastBotTaskId,
        userId,
      );

      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: "flex",
            altText: `ยืนยันข้อมูลการส่งผลของคุณ ${displayName}`,
            contents: flexMsg,
            quickReply: getConfirmQuickReply(lastBotTaskId, result, userId),
          },
        ],
      });
    }

    // 3. Text Message
    if (event.message.type === "text") {
      const userMessage = event.message.text.trim();

      // Show loading animation while AI is thinking
      try {
        await client.showLoadingAnimation({
          chatId: lineUserId,
          loadingSeconds: 60,
        });
      } catch (e) {
        console.warn("[BOT] Failed to show loading animation:", e);
      }

      // ─── ตรวจจับตัวเลขจาก user (กรณีแก้ไขค่าด้วยตนเอง) ──────────────────
      if (pendingBotResult && /^\d+(\.\d+)?$/.test(userMessage)) {
        const newVal = parseFloat(userMessage);
        let pending: any;
        try {
          pending =
            typeof pendingBotResult === "string"
              ? JSON.parse(pendingBotResult)
              : pendingBotResult;
        } catch {
          pending = {};
        }
        // อัปเดต value และ distance/steps/calories ตาม type
        pending.value = newVal;
        if (
          ["RUNNING", "CYCLING", "SWIMMING", "WALKING"].includes(pending.type)
        )
          pending.distance = newVal;
        else if (pending.type === "STEPS") pending.steps = newVal;
        else if (["CALORIES", "FOOD"].includes(pending.type))
          pending.calories = newVal;
        else if (pending.type === "WORKOUT") pending.duration = newVal;
        else if (pending.type === "TANITA") pending.weight = String(newVal);

        await pool.query(
          "UPDATE users SET pending_bot_result = ? WHERE id = ?",
          [JSON.stringify(pending), userId],
        );

        // rebuild image URL
        const apiBase = process.env.VITE_API_URL || "";
        const tunnelUrl = process.env.TUNNEL_URL || "http://localhost:3000";
        const host = apiBase.startsWith("http")
          ? apiBase.replace(/\/api\/?$/, "")
          : tunnelUrl;

        const fullUrl2 = pending.publicUrl
          ? pending.publicUrl.startsWith("data:")
            ? `${host}/api/bot/image-preview/${userId}?t=${Date.now()}`
            : pending.publicUrl.startsWith("http")
              ? pending.publicUrl
              : `${host}${pending.publicUrl}`
          : "";

        const updatedFlex = buildConfirmationFlex(
          pending,
          fullUrl2,
          lastBotTaskId,
          userId,
        );
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: `✏️ อัปเดตค่าเป็น ${newVal} เรียบร้อยครับ กรุณาตรวจสอบแล้วยืนยันได้เลย`,
            },
            {
              type: "flex",
              altText: "ยืนยันข้อมูลที่แก้ไข",
              contents: updatedFlex,
              quickReply: getConfirmQuickReply(lastBotTaskId, pending, userId),
            },
          ],
        });
      }

      // Handle Confirmation
      if (userMessage === "ส่ง" && pendingBotResult) {
        let result: any;
        try {
          result =
            typeof pendingBotResult === "string"
              ? JSON.parse(pendingBotResult)
              : pendingBotResult;
        } catch (e) {
          console.error("Failed to parse pending result:", e);
          return client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: "❌ ข้อมูลเสียหาย กรุณาส่งรูปภาพใหม่อีกครั้งครับ",
              },
            ],
          });
        }

        const publicUrl = result.publicUrl;

        // Save logic (copied and adjusted from previous state)
        if (lastBotTaskId) {
          const [taskInfo]: any = await pool.query(
            "SELECT t.*, e.title as event_title FROM tasks t JOIN events e ON t.event_id = e.id WHERE t.id = ?",
            [lastBotTaskId],
          );
          if (taskInfo.length > 0) {
            const task = taskInfo[0];
            const val =
              result.type === "TANITA"
                ? parseFloat(result.weight)
                : parseFloat(result.distance) || 1;

            // ตรวจสอบว่าวันนี้เคยส่งภารกิจนี้ไปหรือยัง (เพื่อเลือกระหว่าง INSERT หรือ UPDATE)
            const [existingSubs]: any = await pool.query(
              "SELECT id FROM submissions WHERE user_id = ? AND task_id = ? AND DATE(created_at) = CURDATE() AND status != 'rejected' LIMIT 1",
              [userId, lastBotTaskId],
            );

            let subId: number;
            let isNewSubmission = false;

            if (existingSubs.length > 0) {
              subId = existingSubs[0].id;
              console.log(
                `[BOT] Updating existing submission ${subId} for task ${lastBotTaskId}`,
              );
              await pool.query(
                "UPDATE submissions SET value = ?, img_url = ?, created_at = NOW() WHERE id = ?",
                [val, publicUrl, subId],
              );
            } else {
              isNewSubmission = true;
              console.log(
                `[BOT] Creating new submission for task ${lastBotTaskId}`,
              );
              const [insResult]: any = await pool.query(
                `INSERT INTO submissions (user_id, task_id, value, img_url, status, activity_type, proof_type, created_at)
                 VALUES (?, ?, ?, ?, 'approved', ?, 'image', NOW())`,
                [
                  userId,
                  lastBotTaskId,
                  val,
                  publicUrl,
                  result.type === "TANITA" ? "health" : "exercise",
                ],
              );
              subId = insResult.insertId;
            }

            // ถ้าเป็น Tanita ให้ลงตาราง tanita ด้วย
            if (result.type === "TANITA") {
              const tanitaData = {
                body_type: String(result.body_type || ""),
                age: Number(result.age) || null,
                height: Number(result.height) || null,
                weight: result.weight ? String(result.weight) : null,
                fat_pc: result.fat_pc ? String(result.fat_pc) : null,
                fat_mass: result.fat_mass ? String(result.fat_mass) : null,
                ffm: result.ffm ? String(result.ffm) : null,
                muscle_mass: result.muscle_mass
                  ? String(result.muscle_mass)
                  : null,
                tbw_mass: result.tbw_mass ? String(result.tbw_mass) : null,
                tbw_pc: result.tbw_pc ? String(result.tbw_pc) : null,
                bone_mass: result.bone_mass ? String(result.bone_mass) : null,
                bmr_kcal: Number(result.bmr_kcal) || null,
                metabolic_age: result.metabolic_age
                  ? String(result.metabolic_age)
                  : null,
                visceral_fat: result.visceral_fat
                  ? String(result.visceral_fat)
                  : null,
                bmi: result.bmi ? String(result.bmi) : null,
                ideal_weight: result.ideal_weight
                  ? String(result.ideal_weight)
                  : null,
                obesity_degree: result.obesity_degree
                  ? String(result.obesity_degree)
                  : null,
                physique_rating: String(result.physique_rating || ""),
              };
              const encryptedTanita = encryptFields(
                tanitaData,
                TANITA_ENCRYPTED_FIELDS,
              );

              if (isNewSubmission) {
                await pool.query(
                  `INSERT INTO tanita (user_id, submission_id, recorded_at, body_type, age, height, weight, fat_pc, fat_mass, ffm, muscle_mass, tbw_mass, tbw_pc, bone_mass, bmr_kcal, metabolic_age, visceral_fat, bmi, ideal_weight, obesity_degree, physique_rating, event_id)
                   VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    userId,
                    subId,
                    encryptedTanita.body_type,
                    encryptedTanita.age,
                    encryptedTanita.height,
                    encryptedTanita.weight,
                    encryptedTanita.fat_pc,
                    encryptedTanita.fat_mass,
                    encryptedTanita.ffm,
                    encryptedTanita.muscle_mass,
                    encryptedTanita.tbw_mass,
                    encryptedTanita.tbw_pc,
                    encryptedTanita.bone_mass,
                    encryptedTanita.bmr_kcal,
                    encryptedTanita.metabolic_age,
                    encryptedTanita.visceral_fat,
                    encryptedTanita.bmi,
                    encryptedTanita.ideal_weight,
                    encryptedTanita.obesity_degree,
                    encryptedTanita.physique_rating,
                    task.event_id,
                  ],
                );
              } else {
                await pool.query(
                  `UPDATE tanita SET
                    recorded_at = NOW(), body_type = ?, age = ?, height = ?, weight = ?, fat_pc = ?, fat_mass = ?,
                    ffm = ?, muscle_mass = ?, tbw_mass = ?, tbw_pc = ?, bone_mass = ?, bmr_kcal = ?,
                    metabolic_age = ?, visceral_fat = ?, bmi = ?, ideal_weight = ?, obesity_degree = ?,
                    physique_rating = ?
                   WHERE submission_id = ?`,
                  [
                    encryptedTanita.body_type,
                    encryptedTanita.age,
                    encryptedTanita.height,
                    encryptedTanita.weight,
                    encryptedTanita.fat_pc,
                    encryptedTanita.fat_mass,
                    encryptedTanita.ffm,
                    encryptedTanita.muscle_mass,
                    encryptedTanita.tbw_mass,
                    encryptedTanita.tbw_pc,
                    encryptedTanita.bone_mass,
                    encryptedTanita.bmr_kcal,
                    encryptedTanita.metabolic_age,
                    encryptedTanita.visceral_fat,
                    encryptedTanita.bmi,
                    encryptedTanita.ideal_weight,
                    encryptedTanita.obesity_degree,
                    encryptedTanita.physique_rating,
                    subId,
                  ],
                );
              }
            }

            // จัดการเรื่องคะแนน (ให้เฉพาะกรณีที่เป็นการส่งครั้งแรกของวันเท่านั้น)
            if (task.points && isNewSubmission) {
              console.log(
                `[BOT Points] Awarding ${task.points} to user ${userId} for task ${lastBotTaskId}. SubID: ${subId}`,
              );
              await pool.query(
                "UPDATE users SET points = points + ?, total_score = total_score + ? WHERE id = ?",
                [task.points, task.points, userId],
              );
              const [lb]: any = await pool.query(
                "SELECT id FROM event_leaderboards WHERE event_id = ? AND user_id = ?",
                [task.event_id, userId],
              );
              if (lb.length > 0) {
                await pool.query(
                  "UPDATE event_leaderboards SET score = score + ? WHERE id = ?",
                  [task.points, lb[0].id],
                );
              } else {
                await pool.query(
                  "INSERT INTO event_leaderboards (event_id, user_id, score, `rank`) VALUES (?, ?, ?, 0)",
                  [task.event_id, userId, task.points],
                );
              }
            }

            await pool.query(
              "UPDATE users SET last_bot_task_id = NULL, pending_bot_result = NULL WHERE id = ?",
              [userId],
            );

            return client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                {
                  type: "text",
                  text: `✅ บันทึกภารกิจ "${task.note || task.type}" สำเร็จ!\n🎯 กิจกรรม: ${task.event_title}\n💰 ได้รับ ${task.points || 0} คะแนน`,
                  quickReply: await getMainQuickReply(userId, isGroupChat),
                },
              ],
            });
          }
        } else {
          // Personal Exercise / Tanita
          if (result.type === "TANITA") {
            const [subResult]: any = await pool.query(
              "INSERT INTO submissions (user_id, img_url, value, status, activity_type) VALUES (?, ?, ?, ?, ?)",
              [
                userId,
                publicUrl,
                parseFloat(result.weight) || 0,
                "approved",
                "health",
              ],
            );
            const tanitaData = {
              body_type: String(result.body_type || ""),
              age: Number(result.age) || null,
              height: Number(result.height) || null,
              weight: result.weight ? String(result.weight) : null,
              fat_pc: result.fat_pc ? String(result.fat_pc) : null,
              fat_mass: result.fat_mass ? String(result.fat_mass) : null,
              ffm: result.ffm ? String(result.ffm) : null,
              muscle_mass: result.muscle_mass
                ? String(result.muscle_mass)
                : null,
              tbw_mass: result.tbw_mass ? String(result.tbw_mass) : null,
              tbw_pc: result.tbw_pc ? String(result.tbw_pc) : null,
              bone_mass: result.bone_mass ? String(result.bone_mass) : null,
              bmr_kcal: Number(result.bmr_kcal) || null,
              metabolic_age: result.metabolic_age
                ? String(result.metabolic_age)
                : null,
              visceral_fat: result.visceral_fat
                ? String(result.visceral_fat)
                : null,
              bmi: result.bmi ? String(result.bmi) : null,
              ideal_weight: result.ideal_weight
                ? String(result.ideal_weight)
                : null,
              obesity_degree: result.obesity_degree
                ? String(result.obesity_degree)
                : null,
              physique_rating: String(result.physique_rating || ""),
            };
            const encryptedTanita = encryptFields(
              tanitaData,
              TANITA_ENCRYPTED_FIELDS,
            );
            await pool.query(
              `INSERT INTO tanita (user_id, submission_id, recorded_at, body_type, age, height, weight, fat_pc, fat_mass, ffm, muscle_mass, tbw_mass, tbw_pc, bone_mass, bmr_kcal, metabolic_age, visceral_fat, bmi, ideal_weight, obesity_degree, physique_rating)
                 VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                userId,
                subResult.insertId,
                encryptedTanita.body_type,
                encryptedTanita.age,
                encryptedTanita.height,
                encryptedTanita.weight,
                encryptedTanita.fat_pc,
                encryptedTanita.fat_mass,
                encryptedTanita.ffm,
                encryptedTanita.muscle_mass,
                encryptedTanita.tbw_mass,
                encryptedTanita.tbw_pc,
                encryptedTanita.bone_mass,
                encryptedTanita.bmr_kcal,
                encryptedTanita.metabolic_age,
                encryptedTanita.visceral_fat,
                encryptedTanita.bmi,
                encryptedTanita.ideal_weight,
                encryptedTanita.obesity_degree,
                encryptedTanita.physique_rating,
              ],
            );
            await pool.query(
              "UPDATE users SET pending_bot_result = NULL WHERE id = ?",
              [userId],
            );
            return client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                {
                  type: "text",
                  text: "⚖️ บันทึกผลร่างกาย Tanita เข้าสู่ระบบเรียบร้อยแล้วครับ!",
                  quickReply: await getMainQuickReply(userId, isGroupChat),
                },
              ],
            });
          } else if (result.type === "RUNNING") {
            const detectedDistance = parseFloat(result.distance) || 0;
            await pool.query(
              "INSERT INTO submissions (user_id, img_url, value, status, activity_type) VALUES (?, ?, ?, ?, ?)",
              [userId, publicUrl, detectedDistance, "approved", "exercise"],
            );
            const [uRows]: any = await pool.query(
              "SELECT total_score, team_id FROM users WHERE id = ?",
              [userId],
            );
            const newTotal =
              (Number(uRows[0]?.total_score) || 0) + detectedDistance;
            await pool.query(
              "UPDATE users SET total_score = ?, pending_bot_result = NULL WHERE id = ?",
              [newTotal, userId],
            );
            if (uRows[0]?.team_id) {
              await pool.query(
                "UPDATE teams SET total_score = total_score + ? WHERE id = ?",
                [detectedDistance, uRows[0].team_id],
              );
            }
            return client.replyMessage({
              replyToken: event.replyToken,
              messages: [
                {
                  type: "text",
                  text: `🤖 บันทึกระยะทาง ${detectedDistance} km เรียบร้อย!\n📈 ระยะทางสะสมของคุณคือ ${newTotal.toFixed(2)} km`,
                  quickReply: await getMainQuickReply(userId, isGroupChat),
                },
              ],
            });
          }
        }
      }

      if (userMessage === "ยกเลิก") {
        await pool.query(
          "UPDATE users SET last_bot_task_id = NULL, pending_bot_result = NULL WHERE id = ?",
          [userId],
        );
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: "ยกเลิกการทำรายการแล้วครับ คุณสามารถส่งรูปภาพใหม่ได้ทันที",
              quickReply: await getMainQuickReply(userId, isGroupChat),
            },
          ],
        });
      }

      if (userMessage === "ส่งข้อมูล องค์ประกอบของร่างกาย") {
        await pool.query(
          "UPDATE users SET last_bot_task_id = 0 WHERE line_id = ?",
          [lineUserId],
        );
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: "กรุณาส่งรูปสลิปองค์ประกอบร่างกาย เพื่อบันทึกข้อมูลสุขภาพครับ\n\nบอทจะช่วยวิเคราะห์ข้อมูลจากรูปโดยอัตโนมัติ (น้ำหนัก, ไขมัน, กล้ามเนื้อ ฯลฯ)",
              quickReply: await getPhotoUploadQuickReply(userId, isGroupChat),
            },
          ],
        });
      }

      if (userMessage === "วิธีใช้งาน") {
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: "📖 วิธีใช้งาน VitalCare Bot\n\n1. ส่งรูปผลวิ่ง/สรุปผล เพื่อบันทึกระยะทาง\n2. ส่งรูปสลิป องค์ประกอบของร่างกาย เพื่อบันทึกข้อมูลร่างกาย\n3. กด 'ส่งภารกิจ' เพื่อเลือกและส่งหลักฐานภารกิจ\n\nหลังส่งรูป บอทจะวิเคราะห์และให้คุณยืนยันก่อนบันทึกครับ 🏃",
              quickReply: await getMainQuickReply(userId, isGroupChat),
            },
          ],
        });
      }

      if (userMessage === "ส่งภารกิจ") {
        // ใช้ helper ที่แชร์กับ image handler — logic เดียวกันทั้งหมด
        const validTasks = await getValidTasksForUser(userId);

        if (validTasks.length === 0) {
          return client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: "🎉 เยี่ยมมากครับ! คุณทำภารกิจของวันนี้ครบหมดแล้ว\nพักผ่อนให้เพียงพอแล้วเจอกันใหม่พรุ่งนี้นะครับ 😄",
                quickReply: await getMainQuickReply(userId, isGroupChat),
              },
            ],
          });
        }

        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: `🤺กรุณากิจกรรมต่อไปนี้ครับ`,
            },
            {
              type: "flex",
              altText: `เลือกกิจกรรมของคุณ ${displayName}`,
              contents: {
                type: "carousel",
                contents: buildEventCarousel(validTasks, userId),
              },
              quickReply: await getMainQuickReply(userId, isGroupChat),
            },
          ],
        });
      }

      // ─── ภารกิจวันนี้ ─────────────────────────────────────────────────────
      if (userMessage === "ภารกิจวันนี้") {
        const validTasks = await getValidTasksForUser(userId);
        if (validTasks.length === 0) {
          return client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: "🎉 วันนี้คุณไม่มีภารกิจค้างครับ หรือยังไม่ได้ลงทะเบียนกิจกรรม\nสามารถสมัครกิจกรรมได้ที่แอป VitalCare ครับ",
                quickReply: await getMainQuickReply(userId, isGroupChat),
              },
            ],
          });
        }
        // สรุปภารกิจในรูปแบบข้อความ
        const taskList = validTasks
          .map((t: any, i: number) => {
            const isDone = (t.note || "").startsWith("✅");
            return `${i + 1}. ${isDone ? t.note : `📌 ${t.note || t.type}`} (${t.eventTitle})`;
          })
          .join("\n");
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: `📋 ภารกิจของคุณวันนี้ (${new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}):\n\n${taskList}\n\nกด "ส่งภารกิจ" เพื่อเริ่มส่งหลักฐานได้เลยครับ 💪`,
              quickReply: await getMainQuickReply(userId, isGroupChat),
            },
          ],
        });
      }

      // ─── แก้ไขค่า ─────────────────────────────────────────────────────────
      if (userMessage === "แก้ไขค่า") {
        if (!pendingBotResult) {
          return client.replyMessage({
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: "⚠️ ไม่มีข้อมูลที่รอการแก้ไขครับ\nกรุณาส่งรูปภาพใหม่ได้เลย",
                quickReply: await getMainQuickReply(userId, isGroupChat),
              },
            ],
          });
        }
        let parsed: any;
        try {
          parsed =
            typeof pendingBotResult === "string"
              ? JSON.parse(pendingBotResult)
              : pendingBotResult;
        } catch {
          parsed = {};
        }
        const typeLabel: Record<string, string> = {
          RUNNING: "ระยะทาง (km) เช่น: 5.2",
          CYCLING: "ระยะทาง (km) เช่น: 20.5",
          SWIMMING: "ระยะทาง (km) เช่น: 1.5",
          WALKING: "ระยะทาง (km) เช่น: 3.0",
          STEPS: "จำนวนก้าว (ก้าว) เช่น: 8500",
          CALORIES: "แคลอรี่ (kcal) เช่น: 350",
          WORKOUT: "ระยะเวลา (นาที) เช่น: 45",
          TANITA: "น้ำหนัก (kg) เช่น: 65.5",
        };
        const hint = typeLabel[parsed?.type] || "ค่าที่ต้องการแก้ไข";
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: `✏️ กรุณาพิมพ์ค่าที่ถูกต้องครับ\n\nประเภท: ${parsed?.type || "ไม่ทราบ"}\nรูปแบบ: ${hint}\n\n⚠️ พิมพ์เฉพาะตัวเลขเท่านั้น ไม่ต้องใส่หน่วยครับ`,
              quickReply: getConfirmQuickReply(lastBotTaskId, parsed, userId),
            },
          ],
        });
      }

      // Use Typhoon as a smart assistant with knowledge about the user
      const userContext = `You are a helpful and encouraging health assistant for the "VitalCare" application.
The user's name is ${displayName}. IMPORTANT: Use the user's name exactly as provided (${displayName}), do not translate or transliterate it to Thai.
${lastBotTaskId ? "They are currently working on a mission." : "They haven't selected a specific mission yet."}
Answer in a friendly Thai language (ใช้ภาษาที่เป็นกันเองและให้กำลังใจ). Keep answers concise.`;

      const typhoonResponse = await callTyphoon([
        { role: "system", content: userContext },
        { role: "user", content: userMessage },
      ]);

      return client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: "text",
            text:
              typhoonResponse ||
              "🏃 กรุณาส่ง 'รูปภาพ' ผลการวิ่งเพื่อบันทึกระยะทางครับ",
            quickReply: await getMainQuickReply(userId, isGroupChat),
          },
        ],
      });
    }
  } catch (err: any) {
    console.error("[LINE] HandleEvent Error:", err);
    // Attempt to send an error message to the user if possible
    try {
      if (event.replyToken) {
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: `ขออภัยครับ เกิดข้อผิดพลาดบางอย่าง: ${err.message || "Unknown Error"}\nกรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ`,
              quickReply: await getMainQuickReply(null, false),
            },
          ],
        });
      }
    } catch (botErr) {
      console.error(
        "[LINE] Failed to send error message back to user:",
        botErr,
      );
    }
  }
}

// เพิ่มการ Log ทุกๆ Request ที่เข้ามาที่ /webhook เพื่อใช้วิเคราะห์การเชื่อมต่อของ LINE
router.post(
  "/webhook",
  (req, res, next) => {
    console.log(
      `\n\n=== 📥 [LINE WEBHOOK RECEIVED at ${new Date().toLocaleTimeString()}] ===`,
    );
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    next();
  },
  middleware(config),
  (req, res) => {
    const events = req.body.events || [];
    console.log(
      `[LINE] ✅ Webhook Signature Verified! | Events Count: ${events.length}`,
    );
    res.status(200).json({ status: "ok" });
    Promise.all(events.map(handleEvent)).catch((err) =>
      console.error("[LINE] Webhook Promise Error:", err),
    );
  },
);

// ดักจับ Error กรณี Signature ผิดพลาดหรืออื่นๆ จาก middleware ด้านบน
router.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err && err.name === "SignatureValidationFailed") {
      console.error(
        "[LINE] ❌ SignatureValidationFailed: ตรวจสอบ Channel Secret ให้ตรงกับใน LINE Console!",
      );
      res.status(401).send(err.signatureValidationFailed);
    } else if (err) {
      console.error(`[LINE] ❌ Webhook Middleware Error:`, err);
      res.status(500).send("Internal Server Error");
    } else {
      next();
    }
  },
);

// Endpoint สำหรับให้หน้าเว็บ LIFF ดึงข้อมูลที่ AI วิเคราะห์ได้ (เพิ่มความปลอดภัย ไม่ต้องส่งผ่าน URL)
router.get("/pending-result", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [rows]: any = await pool.query(
      "SELECT pending_bot_result FROM users WHERE id = ?",
      [userId],
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const result = rows[0].pending_bot_result;
    res.json(
      result
        ? typeof result === "string"
          ? JSON.parse(result)
          : result
        : null,
    );
  } catch (error: any) {
    console.error("[BOT] Failed to fetch pending result:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// เพิ่ม GET เพื่อไว้เทสเวลาคนเอา URL ไปเปิดในเบราเซอร์
router.get("/webhook", (req, res) => {
  res.send(`
    <html>
      <head><title>VitalCare LINE Webhook</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>✅ Webhook Server is Running!</h2>
        <p>This endpoint receives <b>POST</b> requests from LINE Messaging API.</p>
        <p>If you see this page, it means your tunnel is working correctly!</p>
      </body>
    </html>
  `);
});

// server/routes/bot.ts
console.log(
  "LINE Config Secret Loaded:",
  config.channelSecret ? "✅" : "❌ (รหัสว่างเปล่า)",
);
if (config.channelSecret) {
  console.log("Secret Length:", config.channelSecret.length); // ควรยาวประมาณ 32 ตัว
}

export default router;
