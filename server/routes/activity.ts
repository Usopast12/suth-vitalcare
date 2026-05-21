import express from "express";
import fs from "fs";
import path from "path";
import { pool } from "../mysql.js";
import {
  decrypt,
  decryptFields,
  TANITA_ENCRYPTED_FIELDS,
} from "../lib/crypto.js";
import { getIO, EVENTS } from "../lib/realtime.js";
import crypto from "crypto";
import { z } from "zod";
import { logAudit } from "../lib/audit.js";

const activitySchema = z
  .object({
    title: z.string().min(3, "ชื่อกิจกรรมต้องมีอย่างน้อย 3 ตัวอักษร"),
    max_slots: z.coerce
      .number()
      .min(0, "จำนวนรับสมัครต้องมากกว่าหรือเท่ากับ 0")
      .optional()
      .default(100),
  })
  .passthrough();

import { requireAdmin, requireAdminOrHost } from "../middleware/auth.js";
const router = express.Router();

// Helper: normalize visibility into an array of strings
const parseVisibility = (raw: any): string[] => {
  if (!raw) return ["general"];
  try {
    let vis = raw;
    // Handle over-escaped JSON (e.g. "\"["general"]\"")
    if (typeof vis === "string") {
      vis = vis.trim();
      if ((vis.startsWith('"') && vis.endsWith('"')) || (vis.startsWith("'") && vis.endsWith("'"))) {
        try {
          const inner = JSON.parse(vis);
          if (inner) vis = inner;
        } catch {
          vis = vis.slice(1, -1);
        }
      }
    }

    if (Array.isArray(vis)) return vis.map(String).filter(Boolean);

    if (typeof vis === "string") {
      vis = vis.trim();
      if (vis.startsWith("[") && vis.endsWith("]")) {
        try {
          const parsed = JSON.parse(vis);
          if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        } catch {
          // fallback to manual parse if JSON.parse fails (e.g. malformed JSON)
          return vis.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        }
      }
      if (vis.includes(",")) return vis.split(",").map(s => s.trim()).filter(Boolean);
      return vis ? [vis] : ["general"];
    }

    return [String(vis)];
  } catch (err) {
    console.error("parseVisibility error:", err);
    return ["general"];
  }
};

router.get("/", async (req, res) => {
  const userId = req.headers["x-user-id"];
  const manage = req.query.manage === "true";
  const creatorId = req.query.creatorId;
  const teamId = req.query.teamId;
  let role = "user";

  try {
    if (userId) {
      const [userRows]: any = await pool.query(
        "SELECT role FROM users WHERE id = ?",
        [userId],
      );
      if (userRows.length > 0) role = userRows[0].role;
    }

    const allReq = req.query.all === "true";
    let queryStr = "SELECT * FROM events";
    let params: any[] = [];
    let whereClauses: string[] = [];

    if (creatorId) {
      whereClauses.push("created_by = ?");
      params.push(creatorId);
    } else if (teamId) {
      whereClauses.push("team_id = ?");
      params.push(teamId);
    } else if (manage && (role === "admin" || role === "host")) {
      if (role === "host") {
        whereClauses.push("created_by = ?");
        params.push(userId);
      }
    } else {
      // แสดงกิจกรรมทุกตัวที่เปิดอยู่ให้ทุกคนเห็นเหมือนกัน
      // และรวมกิจกรรมที่ผู้ใช้คนนี้ลงทะเบียนไว้แล้วด้วย (เผื่อกรณีที่สถานะไม่ใช่ open แล้ว)
      if (userId) {
        whereClauses.push(
          "((status = 'open' OR status = 'published' OR status IS NULL) OR id IN (SELECT event_id FROM registrations WHERE user_id = ?))",
        );
        params.push(userId);
      } else {
        whereClauses.push(
          "(status = 'open' OR status = 'published' OR status IS NULL)",
        );
      }
    }

    if (whereClauses.length > 0) {
      queryStr += " WHERE " + whereClauses.join(" AND ");
    }
    queryStr += " ORDER BY start_date DESC";

    const [events]: any = await pool.query(queryStr, params);

    if (events.length === 0) return res.json([]);

    // Fetch related data
    const eventIds = events.map((e: any) => e.id);
    const placeholders = eventIds.map(() => "?").join(",");

    const [creators]: any = await pool.query(
      `SELECT id, fname_th, role, picture_url, team_id FROM users WHERE id IN (SELECT created_by FROM events WHERE id IN (${placeholders}))`,
      eventIds,
    );

    const [regCounts]: any = await pool.query(
      `SELECT event_id, COUNT(*) as count FROM registrations WHERE event_id IN (${placeholders}) GROUP BY event_id`,
      eventIds,
    );

    const [tasks]: any = await pool.query(
      `SELECT * FROM tasks WHERE event_id IN (${placeholders})`,
      eventIds,
    );

    const transformed = events.map((event: any) => {
      const creator = creators.find((c: any) => c.id === event.created_by);
      const regCountRow = regCounts.find((r: any) => r.event_id === event.id);
      const eventTasks = tasks.filter((t: any) => t.event_id === event.id);

      const missions_config: any = {};
      if (eventTasks.length > 0) {
        eventTasks.forEach((t: any) => {
          const configKey = t.type || t.metric_type || "custom";
          missions_config[configKey] = {
            id: t.id,
            enabled: t.is_active !== 0,
            points: t.points,
            allowed_days:
              typeof t.allowed_days === "string"
                ? JSON.parse(t.allowed_days)
                : t.allowed_days,
            note: t.note || t.title,
          };
        });
      }

      const parsedTasks = eventTasks.map((t: any) => ({
        ...t,
        allowed_days:
          typeof t.allowed_days === "string"
            ? JSON.parse(t.allowed_days)
            : t.allowed_days || [0, 1, 2, 3, 4, 5, 6],
      }));

      return {
        ...event,
        visibility: parseVisibility(event.visibility),
        health_config:
          typeof event.health_config === "string"
            ? JSON.parse(event.health_config)
            : event.health_config,
        goal_config:
          typeof event.goal_config === "string"
            ? JSON.parse(event.goal_config)
            : event.goal_config,
        assessment_config:
          typeof event.assessment_config === "string"
            ? JSON.parse(event.assessment_config)
            : event.assessment_config,
        creator: creator
          ? {
            ...creator,
            fname_th: decrypt(creator.fname_th),
          }
          : null,
        registration_count: regCountRow ? regCountRow.count : 0,
        tasks: parsedTasks,
        missions_config,
      };
    });

    res.json(transformed);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/user/:userId/registered", async (req, res) => {
  try {
    const userId = req.params.userId;
    const [regRows]: any = await pool.query(
      "SELECT event_id, created_at FROM registrations WHERE user_id = ?",
      [userId],
    );

    if (regRows.length === 0) return res.json([]);

    const eventIds = regRows.map((r: any) => r.event_id);
    const placeholders = eventIds.map(() => "?").join(",");

    const [events]: any = await pool.query(
      `SELECT * FROM events WHERE id IN (${placeholders}) ORDER BY start_date DESC`,
      eventIds,
    );

    // Fetch related creators and tasks
    const [creators]: any = await pool.query(
      `SELECT id, fname_th, role, picture_url, team_id FROM users WHERE id IN (SELECT created_by FROM events WHERE id IN (${placeholders}))`,
      eventIds,
    );

    const [tasks]: any = await pool.query(
      `SELECT * FROM tasks WHERE event_id IN (${placeholders})`,
      eventIds,
    );

    const transformed = events.map((event: any) => {
      const regInfo = regRows.find((r: any) => r.event_id === event.id);
      const creator = creators.find((c: any) => c.id === event.created_by);
      const eventTasks = tasks.filter((t: any) => t.event_id === event.id);

      const missions_config: any = {};
      eventTasks.forEach((t: any) => {
        const configKey = t.type || t.metric_type || "custom";
        missions_config[configKey] = {
          id: t.id,
          enabled: t.is_active !== 0,
          points: t.points,
          allowed_days:
            typeof t.allowed_days === "string"
              ? JSON.parse(t.allowed_days)
              : t.allowed_days,
          note: t.note || t.title,
        };
      });

      const parsedTasks = eventTasks.map((t: any) => ({
        ...t,
        allowed_days:
          typeof t.allowed_days === "string"
            ? JSON.parse(t.allowed_days)
            : t.allowed_days || [0, 1, 2, 3, 4, 5, 6],
      }));

      return {
        ...event,
        created_at: regInfo ? regInfo.created_at : null,
        visibility: parseVisibility(event.visibility),
        health_config:
          typeof event.health_config === "string"
            ? JSON.parse(event.health_config)
            : event.health_config,
        goal_config:
          typeof event.goal_config === "string"
            ? JSON.parse(event.goal_config)
            : event.goal_config,
        certificate_config:
          typeof event.certificate_config === "string"
            ? JSON.parse(event.certificate_config)
            : event.certificate_config,
        assessment_config:
          typeof event.assessment_config === "string"
            ? JSON.parse(event.assessment_config)
            : event.assessment_config,
        creator: creator
          ? { ...creator, fname_th: decrypt(creator.fname_th) }
          : null,
        tasks: parsedTasks,
        missions_config,
      };
    });

    res.json(transformed);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id/scores", async (req, res) => {
  const { id } = req.params;
  try {
    // Bug #4 fix: อ่านจาก event_leaderboards โดยตรง
    // ซึ่งถูก maintain โดย mission submit endpoint ด้วย task.points (ไม่คูณ value)
    // ป้องกันความไม่สอดคล้องกับ leaderboard ที่แสดงผลจริง
    const [rows]: any = await pool.query(
      "SELECT user_id, score FROM event_leaderboards WHERE event_id = ?",
      [id],
    );

    res.json(
      rows.reduce((acc: any, curr: any) => {
        acc[curr.user_id] = Number(curr.score);
        return acc;
      }, {}),
    );
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id/registration/:userId", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      "SELECT id FROM registrations WHERE user_id = ? AND event_id = ? LIMIT 1",
      [req.params.userId, req.params.id],
    );
    res.json({ registered: rows.length > 0 });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Batch fetch activities by IDs
router.get("/batch", async (req, res) => {
  try {
    const idsStr = req.query.ids as string;
    if (!idsStr) return res.json([]);

    const ids = idsStr.split(",").map(id => Number(id.trim())).filter(id => !isNaN(id));
    if (ids.length === 0) return res.json([]);

    const placeholders = ids.map(() => "?").join(",");
    const [events]: any = await pool.query(
      `SELECT * FROM events WHERE id IN (${placeholders})`,
      ids
    );

    if (events.length === 0) return res.json([]);

    // Fetch related creators and tasks for consistency with other endpoints
    const eventIds = events.map((e: any) => e.id);
    const idPlaceholders = eventIds.map(() => "?").join(",");

    const [creators]: any = await pool.query(
      `SELECT id, fname_th, role, picture_url, team_id FROM users WHERE id IN (SELECT created_by FROM events WHERE id IN (${idPlaceholders}))`,
      eventIds
    );

    const [tasks]: any = await pool.query(
      `SELECT * FROM tasks WHERE event_id IN (${idPlaceholders})`,
      eventIds
    );

    const transformed = events.map((event: any) => {
      const creator = creators.find((c: any) => c.id === event.created_by);
      const eventTasks = tasks.filter((t: any) => t.event_id === event.id);

      const missions_config: any = {};
      eventTasks.forEach((t: any) => {
        const configKey = t.type || t.metric_type || "custom";
        missions_config[configKey] = {
          id: t.id,
          enabled: t.is_active !== 0,
          points: t.points,
          allowed_days: typeof t.allowed_days === "string" ? JSON.parse(t.allowed_days) : t.allowed_days,
          note: t.note || t.title,
        };
      });

      return {
        ...event,
        visibility: parseVisibility(event.visibility),
        creator: creator ? { ...creator, fname_th: decrypt(creator.fname_th) } : null,
        tasks: eventTasks,
        missions_config,
      };
    });

    res.json(transformed);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/join", async (req, res) => {
  const { userId, eventCode, eventPassword, joinMode } = req.body;
  const eventId = req.params.id;

  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch event and host's team info with LOCK
    const [eventRows]: any = await connection.query(
      `
      SELECT e.event_code, e.event_password, e.visibility, e.max_slots, e.is_unlimited_max_slots, e.team_mode, e.created_by,
             u.team_id as creator_team_id
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ? FOR UPDATE
    `,
      [eventId],
    );

    if (eventRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Event Not Found" });
    }

    const event = eventRows[0];
    const visibility: string[] = parseVisibility(event.visibility || []);

    // 2. Fetch user info to check their team and roles
    const [userRows]: any = await connection.query(
      "SELECT id, team_id, role, role_type, role_detail_1, role_detail_2 FROM users WHERE id = ?",
      [userId],
    );
    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "User Not Found" });
    }

    const user = userRows[0];
    const isAdmin = user.role === "admin";

    // 3. ตรวจสอบจำนวนที่นั่ง (Bug #1 fix)
    const isUnlimited = [true, 1, "1"].includes(event.is_unlimited_max_slots);
    if (!isUnlimited) {
      const limit = Number(event.max_slots) || 0;
      const [countRows]: any = await connection.query(
        "SELECT COUNT(*) as count FROM registrations WHERE event_id = ?",
        [eventId],
      );
      const currentCount = countRows[0]?.count || 0;

      if (currentCount >= limit) {
        await connection.rollback();
        return res
          .status(400)
          .json({ error: "กิจกรรมนี้เต็มแล้ว ไม่สามารถลงทะเบียนได้" });
      }
    }

    // 4. CHECK VISIBILITY (BACKEND ENFORCEMENT)
    const checkUserEligibility = (u: any, vis: string[]) => {
      if (vis.includes("general") || vis.length === 0) return { ok: true };

      const uTeamId = u.team_id;
      const isTeamMatch =
        uTeamId &&
        event.creator_team_id &&
        Number(uTeamId) === Number(event.creator_team_id);

      const baseGroups = ["general", "my_team", "other_teams"];
      const roleTypeGroups = [
        "นักเรียน",
        "นักศึกษา",
        "บุคลากรโรงพยาบาล",
        "บุคลากรมหาวิทยาลัย",
        "บุคคลทั่วไป",
      ];
      const gradeGroups = ["ป.1 - ป.6", "ม.1 - ม.6"];
      const yearGroups = ["ปี 1", "ปี 2", "ปี 3", "ปี 4", "ปี 5", "ปี 6"];

      const visArray = Array.isArray(vis) ? vis : [vis].filter(Boolean);

      const baseVis = visArray.filter((v: string) => baseGroups.includes(v));
      const roleTypeVis = visArray.filter((v: string) => roleTypeGroups.includes(v));
      const gradeVis = visArray.filter((v: string) => gradeGroups.includes(v));
      const yearVis = visArray.filter((v: string) => yearGroups.includes(v));
      const facultyVis = visArray.filter(
        (v: string) =>
          !baseGroups.includes(v) &&
          !roleTypeGroups.includes(v) &&
          !gradeGroups.includes(v) &&
          !yearGroups.includes(v),
      );

      // (1) Base Access Check
      let passBase = false;
      if (baseVis.length === 0 || baseVis.includes("general")) {
        passBase = true;
      } else {
        if (baseVis.includes("my_team") && isTeamMatch) passBase = true;
        if (baseVis.includes("other_teams") && uTeamId) passBase = true;
      }
      if (!passBase)
        return { ok: false, error: "จำกัดสิทธิ์เฉพาะสมาชิกทีมที่กำหนด" };

      // (2) Role-based Filters
      const hasRoleFilters =
        roleTypeVis.length > 0 ||
        gradeVis.length > 0 ||
        yearVis.length > 0 ||
        facultyVis.length > 0;

      if (hasRoleFilters) {
        if (roleTypeVis.length > 0 && !roleTypeVis.includes(u.role_type)) {
          return {
            ok: false,
            error: `จำกัดเฉพาะกลุ่ม: ${roleTypeVis.join(", ")}`,
          };
        }

        if (u.role_type === "นักเรียน") {
          const userGrade = u.role_detail_2 || "";
          const passGrade =
            gradeVis.length === 0 ||
            gradeVis.some((v: string) => {
              if (v === "ป.1 - ป.6") return userGrade.startsWith("ป.");
              if (v === "ม.1 - ม.6") return userGrade.startsWith("ม.");
              return v === userGrade;
            });

          if (!passGrade) {
            return {
              ok: false,
              error: `จำกัดเฉพาะระดับชั้น: ${gradeVis.join(", ")} (ปัจจุบันคุณคือ: ${userGrade || "ไม่ระบุ"})`,
            };
          }
        } else if (u.role_type === "นักศึกษา") {
          let userFac = "";
          let userYear = "";
          const detail2 = u.role_detail_2 || "";
          if (detail2.includes(" - ")) {
            const parts = detail2.split(" - ");
            userFac = parts[0].trim();
            userYear = parts[1].trim();
          } else {
            userFac = detail2;
          }

          const standardFaculties = [
            "สำนักวิชาวิทยาศาสตร์", "สำนักวิชาเทคโนโลยีสังคม", "สำนักวิชาเทคโนโลยีการเกษตร", 
            "สำนักวิชาวิศวกรรมศาสตร์", "สำนักวิชาแพทยศาสตร์", "สำนักวิชาพยาบาลศาสตร์", 
            "สำนักวิชาทันตแพทยศาสตร์", "สำนักวิชาสาธารณสุขศาสตร์", "สำนักวิชาศาสตร์และศิลป์ดิจิทัล"
          ];
          const isOtherFac = !standardFaculties.includes(userFac) && !standardFaculties.includes(detail2);

          const passFac =
            facultyVis.length === 0 ||
            facultyVis.includes(userFac) ||
            facultyVis.includes(detail2) ||
            (facultyVis.includes("อื่น ๆ") && isOtherFac);
          if (!passFac) {
            return {
              ok: false,
              error: `จำกัดเฉพาะสำนักวิชา: ${facultyVis.join(", ")}`,
            };
          }

          const passYear =
            yearVis.length === 0 ||
            yearVis.includes(userYear) ||
            yearVis.includes(detail2);
          if (!passYear) {
            return {
              ok: false,
              error: `จำกัดเฉพาะชั้นปี: ${yearVis.join(", ")} (ปัจจุบันคุณคือ: ${userYear || "ไม่ระบุ"})`,
            };
          }
        } else if (
          u.role_type === "บุคลากรโรงพยาบาล" ||
          u.role_type === "บุคลากรมหาวิทยาลัย"
        ) {
          const standardFaculties = [
            "สำนักวิชาวิทยาศาสตร์", "สำนักวิชาเทคโนโลยีสังคม", "สำนักวิชาเทคโนโลยีการเกษตร", 
            "สำนักวิชาวิศวกรรมศาสตร์", "สำนักวิชาแพทยศาสตร์", "สำนักวิชาพยาบาลศาสตร์", 
            "สำนักวิชาทันตแพทยศาสตร์", "สำนักวิชาสาธารณสุขศาสตร์", "สำนักวิชาศาสตร์และศิลป์ดิจิทัล"
          ];
          const isOtherDept = !standardFaculties.includes(u.role_detail_1) && !standardFaculties.includes(u.role_detail_2);

          if (
            facultyVis.length > 0 &&
            !facultyVis.includes(u.role_detail_1) &&
            !facultyVis.includes(u.role_detail_2) &&
            !(facultyVis.includes("อื่น ๆ") && isOtherDept)
          ) {
            return {
              ok: false,
              error: `จำกัดเฉพาะหน่วยงาน/สำนักวิชา: ${facultyVis.join(", ")}`,
            };
          }
        } else {
          const hasSpecificFilters = gradeVis.length > 0 || yearVis.length > 0 || facultyVis.length > 0;
          if (hasSpecificFilters && !roleTypeVis.includes(u.role_type)) {
            return {
              ok: false,
              error: "กิจกรรมนี้จำกัดเฉพาะกลุ่มนักเรียน/นักศึกษา หรือหน่วยงานที่กำหนด",
            };
          }
        }
      }
      return { ok: true };
    };

    const eligibility = checkUserEligibility(user, visibility);
    if (!eligibility.ok) {
      await connection.rollback();
      return res.status(403).json({ error: eligibility.error });
    }

    // 5. Check Event Code
    if (event.event_code && event.event_code.trim() !== "") {
      if (!eventCode || eventCode !== event.event_code) {
        await connection.rollback();
        return res.status(403).json({ error: "รหัสเข้าร่วมไม่ถูกต้อง" });
      }
    }

    // 5b. Check Event Password (admin bypass)
    if (!isAdmin && event.event_password && event.event_password.trim() !== "") {
      if (!eventPassword || eventPassword !== event.event_password) {
        await connection.rollback();
        return res.status(403).json({ error: "รหัสผ่านกิจกรรมไม่ถูกต้อง", requires_password: true });
      }
    }

    // 6. Proceed to registration (Always Solo)
    await connection.query(
      "INSERT IGNORE INTO registrations (user_id, event_id) VALUES (?, ?)",
      [userId, eventId],
    );

    await connection.commit();

    // ✅ Emit realtime event
    getIO().emit(EVENTS.ACTIVITY_UPDATED, { id: String(eventId) });

    return res.status(201).json({ message: "Joined successfully" });
  } catch (error: any) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY")
      return res.status(400).json({ error: "คุณลงทะเบียนแล้ว" });
    return res.status(400).json({ error: "Bad Request" });
  } finally {
    connection.release();
  }
});

// Admin: Manual Enroll (Bypass checks)
router.post("/admin/enroll", requireAdmin, async (req, res) => {
  const { userId, eventId } = req.body;
  const adminId = req.headers["x-user-id"];

  if (!userId || !eventId)
    return res.status(400).json({ error: "Missing parameters" });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verify admin
    const [adminRows]: any = await connection.query(
      "SELECT role FROM users WHERE id = ?",
      [adminId],
    );
    if (adminRows[0]?.role !== "admin") {
      await connection.rollback();
      return res.status(403).json({ error: "Unauthorized" });
    }

    // 2. Fetch event with LOCK
    const [eventRows]: any = await connection.query(
      "SELECT max_slots, is_unlimited_max_slots FROM events WHERE id = ? FOR UPDATE",
      [eventId],
    );

    if (eventRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventRows[0];
    const isUnlimited = [true, 1, "1"].includes(event.is_unlimited_max_slots);

    if (!isUnlimited && event.max_slots > 0) {
      const [countRows]: any = await connection.query(
        "SELECT COUNT(*) as count FROM registrations WHERE event_id = ?",
        [eventId],
      );
      const currentCount = countRows[0]?.count || 0;

      if (currentCount >= event.max_slots) {
        await connection.rollback();
        return res
          .status(400)
          .json({ error: "กิจกรรมนี้เต็มแล้ว ไม่สามารถเพิ่มผู้ใช้ได้" });
      }
    }

    // 3. Register
    await connection.query(
      "INSERT IGNORE INTO registrations (user_id, event_id) VALUES (?, ?)",
      [userId, eventId],
    );

    await connection.commit();

    // ✅ Emit realtime event
    getIO().emit(EVENTS.ACTIVITY_UPDATED, { id: String(eventId) });

    await logAudit({
      userId: Number(adminId),
      action: "ENROLL_USER",
      description: `Admin enrolled user ${userId} to event ${eventId}`,
      targetType: "activity",
      targetId: Number(eventId),
    });

    return res.status(201).json({ message: "Enrolled user successfully" });
  } catch (error: any) {
    await connection.rollback();
    return res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

// Admin: Remove User (Kick)
router.post("/admin/kick", requireAdmin, async (req, res) => {
  const { userId, eventId } = req.body;
  const adminId = req.headers["x-user-id"];

  if (!userId || !eventId) return res.status(400).json({ error: "Missing parameters" });

  try {
    // 1. Verify admin
    const [adminRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [adminId]);
    if (adminRows[0]?.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });

    // 2. Remove registration
    await pool.query("DELETE FROM registrations WHERE user_id = ? AND event_id = ?", [userId, eventId]);

    // Also cleanup team memberships if they exist (Try both possible column names for safety)
    try {
      await pool.query("DELETE FROM team_members WHERE user_id = ? AND team_id IN (SELECT id FROM teams WHERE event_id = ?)", [userId, eventId]);
    } catch (e) {
      try {
        await pool.query("DELETE FROM team_members WHERE user_id = ? AND team_id IN (SELECT id FROM teams WHERE activity_id = ?)", [userId, eventId]);
      } catch (e2) { /* Ignore if team cleanup fails due to schema */ }
    }

    await logAudit({
      userId: Number(adminId),
      action: "KICK_USER",
      description: `Admin removed user ${userId} from event ${eventId}`,
      targetType: "activity",
      targetId: Number(eventId)
    });

    // ✅ Emit realtime event
    getIO().emit(EVENTS.ACTIVITY_UPDATED, { id: String(eventId) });

    return res.json({ message: "Removed user successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin: Remove User from Multiple Activities (Bulk Kick)
router.post("/admin/kick-bulk", requireAdmin, async (req, res) => {
  const { userId, eventIds } = req.body;
  const adminId = req.headers["x-user-id"];

  if (!userId || !eventIds || !Array.isArray(eventIds)) {
    return res.status(400).json({ error: "Missing parameters or invalid eventIds" });
  }

  if (eventIds.length === 0) return res.json({ message: "No activities to remove" });

  try {
    // 1. Verify admin
    const [adminRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [adminId]);
    if (adminRows[0]?.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });

    // 2. Perform bulk removal
    const placeholders = eventIds.map(() => "?").join(",");

    // Remove registrations
    await pool.query(
      `DELETE FROM registrations WHERE user_id = ? AND event_id IN (${placeholders})`,
      [userId, ...eventIds]
    );

    // Cleanup team memberships for these events
    try {
      await pool.query(
        `DELETE FROM team_members WHERE user_id = ? AND team_id IN (SELECT id FROM teams WHERE event_id IN (${placeholders}))`,
        [userId, ...eventIds]
      );
    } catch (e) {
      // Fallback for activity_id column
      try {
        await pool.query(
          `DELETE FROM team_members WHERE user_id = ? AND team_id IN (SELECT id FROM teams WHERE activity_id IN (${placeholders}))`,
          [userId, ...eventIds]
        );
      } catch (e2) { /* Ignore schema differences */ }
    }

    await logAudit({
      userId: Number(adminId),
      action: "BULK_KICK_USER",
      description: `Admin removed user ${userId} from ${eventIds.length} events`,
      targetType: "user",
      targetId: Number(userId)
    });

    return res.json({ message: `Removed user from ${eventIds.length} activities successfully` });
  } catch (error: any) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [eventRows]: any = await pool.query(
      "SELECT * FROM events WHERE id = ?",
      [req.params.id],
    );
    if (eventRows.length === 0)
      return res.status(404).json({ error: "Event Not Found" });
    const event = eventRows[0];

    const [creatorRows]: any = await pool.query(
      "SELECT id, fname_th, role, picture_url, team_id FROM users WHERE id = ?",
      [event.created_by],
    );
    const creator = creatorRows[0];

    const [regRows]: any = await pool.query(
      "SELECT COUNT(*) as count FROM registrations WHERE event_id = ?",
      [req.params.id],
    );

    const [tasks]: any = await pool.query(
      "SELECT * FROM tasks WHERE event_id = ?",
      [req.params.id],
    );

    const missions_config: any = {};
    tasks.forEach((t: any) => {
      const configKey = t.type || t.metric_type || "custom";
      missions_config[configKey] = {
        id: t.id,
        enabled: t.is_active !== 0,
        points: t.points,
        allowed_days:
          typeof t.allowed_days === "string"
            ? JSON.parse(t.allowed_days)
            : t.allowed_days,
        note: t.note || t.title,
      };
    });

    const parsedTasks = tasks.map((t: any) => ({
      ...t,
      allowed_days:
        typeof t.allowed_days === "string"
          ? JSON.parse(t.allowed_days)
          : t.allowed_days || [0, 1, 2, 3, 4, 5, 6],
    }));

    res.json({
      ...event,
      event_code: undefined, // Hide join code from frontend response
      event_password: undefined, // Hide password from frontend response
      has_event_code: !!(event.event_code && event.event_code.trim() !== ""),
      has_event_password: !!(event.event_password && event.event_password.trim() !== ""),
      visibility: parseVisibility(event.visibility),
      health_config:
        typeof event.health_config === "string"
          ? JSON.parse(event.health_config)
          : event.health_config,
      goal_config:
        typeof event.goal_config === "string"
          ? JSON.parse(event.goal_config)
          : event.goal_config,
      certificate_config:
        typeof event.certificate_config === "string"
          ? JSON.parse(event.certificate_config)
          : event.certificate_config,
      assessment_config:
        typeof event.assessment_config === "string"
          ? JSON.parse(event.assessment_config)
          : event.assessment_config,
      creator: creator
        ? { ...creator, fname_th: decrypt(creator.fname_th) }
        : null,
      registration_count: regRows[0]?.count || 0,
      filled: regRows[0]?.count || 0,
      tasks: parsedTasks,
      missions_config,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  const userId = req.headers["x-user-id"] || req.body.userId;
  if (!userId) return res.status(401).json({ error: "Missing User ID" });

  try {
    req.body = activitySchema.parse(req.body);
  } catch (error: any) {
    return res.status(400).json({
      error: error.errors
        ? error.errors[0].message
        : "ข้อมูลไม่ถูกต้องตามรูปแบบ",
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // --- Idempotency Check ---
    // Prevent creating identical activities within 10 seconds (e.g. from rapid double-clicks)
    const [existing]: any = await connection.query(
      `SELECT id FROM events 
       WHERE title = ? AND created_by = ? 
       AND created_at >= NOW() - INTERVAL 10 SECOND 
       ORDER BY created_at DESC LIMIT 1`,
      [req.body.title, userId]
    );

    if (existing.length > 0) {
      await connection.rollback();
      connection.release();
      console.log(`[IDEMPOTENCY] Activity creation skipped, returning existing id: ${existing[0].id}`);
      return res.status(200).json({ id: existing[0].id, message: "Activity already created (Idempotent)" });
    }

    const [userRows]: any = await connection.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );
    const user = userRows[0];
    const isAdmin = user?.role === "admin";

    if (!isAdmin) {
      await connection.rollback();
      return res.status(403).json({ error: "คุณไม่มีสิทธิ์ในการสร้างกิจกรรม (เฉพาะ Admin เท่านั้น)" });
    }

    const visibilityStr = JSON.stringify(
      typeof req.body.visibility === "string"
        ? JSON.parse(req.body.visibility)
        : req.body.visibility || ["general"],
    );
    const health_configStr = JSON.stringify(
      typeof req.body.health_config === "string"
        ? JSON.parse(req.body.health_config)
        : req.body.health_config || { tanita_dates: [] },
    );
    const goal_configStr = JSON.stringify(
      typeof req.body.goal_config === "string"
        ? JSON.parse(req.body.goal_config)
        : req.body.goal_config || {
          enabled: false,
          mode: "solo",
          team_size: 3,
          target_type: "points",
          target_value: 0,
          reward_text: "",
        },
    );
    const certificate_configStr = JSON.stringify(
      typeof req.body.certificate_config === "string"
        ? JSON.parse(req.body.certificate_config)
        : req.body.certificate_config || {
          enabled: false,
          issue_mode: "immediately",
        },
    );
    const assessment_configStr = JSON.stringify(
      typeof req.body.assessment_config === "string"
        ? JSON.parse(req.body.assessment_config)
        : req.body.assessment_config || {
          pre_test: { enabled: false, title: "" },
          post_test: { enabled: false, title: "" },
        },
    );
    const detail =
      req.body.detail ||
      (req.body.sections ? JSON.stringify(req.body.sections) : "");
    const teamId = req.body.team_id || null;

    // Security Check: If creating for a team, user must be Admin or the Host of that team
    if (teamId && !isAdmin) {
      const [teamRows]: any = await connection.query(
        "SELECT host_id FROM teams WHERE id = ?",
        [teamId]
      );
      if (teamRows[0]?.host_id?.toString() !== userId.toString()) {
        await connection.rollback();
        return res.status(403).json({ error: "คุณไม่มีสิทธิ์สร้างกิจกรรมให้ทีมนี้ (คุณไม่ใช่เจ้าของทีม)" });
      }
    }


    const [eventResult]: any = await connection.query(
      `INSERT INTO events (title, poster, detail, start_date, end_date, registration_start_date, registration_end_date, is_continuous_registration, is_continuous_event, start_time, end_time, max_slots, is_unlimited_max_slots, type, activity_mode, leaderboard_enabled, team_mode, location_name, organizer, rules_regulations, inclusions, event_code, event_password, visibility, health_config, goal_config, certificate_config, assessment_config, team_id, status, publish_start_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.body.title,
        req.body.poster,
        detail,
        req.body.start_date || null,
        req.body.end_date || null,
        req.body.registration_start_date || null,
        req.body.registration_end_date || null,
        req.body.is_continuous_registration ? 1 : 0,
        req.body.is_continuous_event ? 1 : 0,
        req.body.start_time || null,
        req.body.end_time || null,
        parseInt(req.body.max_slots) || 0,
        req.body.is_unlimited_max_slots ? 1 : 0,
        req.body.type || "กิจกรรม",
        req.body.activity_mode || "event",
        req.body.leaderboard_enabled || false,
        req.body.team_mode || false,
        req.body.location_name || null,
        req.body.organizer || null,
        req.body.rules_regulations || null,
        req.body.inclusions || null,
        req.body.event_code || null,
        req.body.event_password || null,
        visibilityStr,
        health_configStr,
        goal_configStr,
        certificate_configStr,
        assessment_configStr,
        teamId,
        req.body.status || "open",
        req.body.publish_start_date || null,
        userId,
      ],
    );

    const newEventId = eventResult.insertId;
    const tasks = req.body.tasks;

    if (tasks && Array.isArray(tasks) && tasks.length > 0) {
      const qValues: any[] = [];
      const placeholders = tasks
        .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .join(", ");

      tasks.forEach((task: any) => {
        console.log("[activity:post] Processing task:", JSON.stringify(task));
        const ad = task.allowed_days || [0, 1, 2, 3, 4, 5, 6];
        qValues.push(
          newEventId,
          task.title || task.note,
          task.metric_type,
          task.metric_unit,
          task.goal_type,
          task.goal_value,
          task.points || 0,
          task.submission_type || "manual",
          task.is_active !== false,
          JSON.stringify(ad),
          task.type || "exercise",
          [true, 1, "true", "1"].includes(task.use_ocr) ? 1 : 0,
        );
      });

      await connection.query(
        `INSERT INTO tasks (event_id, note, metric_type, metric_unit, goal_type, goal_value, points, submission_type, is_active, allowed_days, type, use_ocr) VALUES ${placeholders}`,
        qValues,
      );
    }

    await connection.commit();
    const [finalRows]: any = await pool.query(
      "SELECT * FROM events WHERE id = ?",
      [newEventId],
    );

    // Log the action
    await logAudit({
      userId: userId as string,
      action: "create_activity",
      targetType: "activity",
      targetId: newEventId,
      description: `สร้างกิจกรรม: ${req.body.title}`,
      metadata: { title: req.body.title },
    });

    getIO().emit(EVENTS.ACTIVITY_CREATED, finalRows[0]);

    res.status(201).json(finalRows[0]);
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: "Bad Request" });
  } finally {
    connection.release();
  }
});

router.patch("/bulk-status", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { ids, status } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
    return res.status(400).json({ error: "Invalid request payload" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [userRows]: any = await connection.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );
    const isAdmin = userRows[0]?.role === "admin";

    const placeholders = ids.map(() => "?").join(",");
    const queryParams = [...ids];

    let whereClause = `id IN (${placeholders})`;

    // Only allow non-admins to edit their own events or events in teams they host
    if (!isAdmin) {
      whereClause += ` AND (created_by = ? OR team_id IN (SELECT id FROM teams WHERE host_id = ?))`;
      queryParams.push(userId, userId);
    }

    const updateParams = [status, ...queryParams];

    // ✅ BUG FIX: ก่อนหน้านี้ไม่ได้ยิง UPDATE query เลย — commit เปล่าๆ
    await connection.query(
      `UPDATE events SET status = ? WHERE ${whereClause}`,
      updateParams,
    );

    await connection.commit();

    // ✅ Emit realtime event
    ids.forEach((id: number) => {
      getIO().emit(EVENTS.ACTIVITY_UPDATED, { id: String(id), status });
    });

    // Log the action
    await logAudit({
      userId: userId as string,
      action: "bulk_update_activity_status",
      targetType: "activity_bulk",
      description: `อัปเดตสถานะกิจกรรมเป็น ${status} สำหรับ ID: ${ids.join(", ")}`,
      metadata: { ids, status },
    });

    res.json({ message: "Successfully updated status" });
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

router.delete("/bulk", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Invalid request payload" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [userRows]: any = await connection.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );
    const isAdmin = userRows[0]?.role === "admin";

    const placeholders = ids.map(() => "?").join(",");
    const queryParams = [...ids];

    let whereClause = `id IN (${placeholders})`;

    if (!isAdmin) {
      whereClause += ` AND created_by = ?`;
      queryParams.push(userId);
    }

    await connection.query(
      `DELETE FROM events WHERE ${whereClause}`,
      queryParams,
    );

    await connection.commit();

    // Log the action
    await logAudit({
      userId: userId as string,
      action: "bulk_delete_activity",
      targetType: "activity_bulk",
      description: `ลบกิจกรรมหลายรายการ ID: ${ids.join(", ")}`,
      metadata: { ids },
    });

    // ✅ Emit realtime event สำหรับทุก ID ที่ถูกลบ
    ids.forEach((id: number) => {
      getIO().emit(EVENTS.ACTIVITY_DELETED, { id: String(id) });
    });

    res.status(204).send();
  } catch (error: any) {
    await connection.rollback();
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [eventRows]: any = await connection.query(
      "SELECT * FROM events WHERE id = ?",
      [req.params.id],
    );
    const [userRows]: any = await connection.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );

    const isAdmin = userRows[0]?.role === "admin";
    const isOwner = eventRows[0]?.created_by?.toString() === userId.toString();

    let isTeamHost = false;
    if (eventRows[0]?.team_id) {
      const [teamRows]: any = await connection.query(
        "SELECT host_id FROM teams WHERE id = ?",
        [eventRows[0].team_id]
      );
      if (teamRows[0]?.host_id?.toString() === userId.toString()) {
        isTeamHost = true;
      }
    }

    if (!isAdmin && !isOwner && !isTeamHost) {
      await connection.rollback();
      return res.status(403).json({ error: "คุณไม่มีสิทธิ์แก้ไขกิจกรรมนี้" });
    }

    // --- Cleanup orphaned physical files (poster & sections) ---
    if (req.body.poster !== undefined) {
      const oldPoster = eventRows[0]?.poster;
      if (oldPoster && oldPoster !== req.body.poster && oldPoster.startsWith("/uploads/")) {
        try {
          const relativeOldPath = oldPoster.substring('/uploads/'.length);
          const filePath = path.join(process.cwd(), "public", "uploads", ...relativeOldPath.split('/').filter(Boolean));
          console.log("[PATCH CLEANUP] Deleting poster:", filePath);
          if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
            console.log("[PATCH CLEANUP] Poster deleted.");
          }
        } catch (err: any) {
          console.error("[PATCH CLEANUP] Poster delete failed:", err.message);
        }
      }
    }
    if (req.body.detail !== undefined) {
      try {
        const oldDetail = JSON.parse(eventRows[0]?.detail || "[]");
        const newDetailStr = typeof req.body.detail === 'string' ? req.body.detail : JSON.stringify(req.body.detail);
        const newDetail = JSON.parse(newDetailStr || "[]");
        
        const oldImages = oldDetail.map((s:any)=>s.image).filter((u:any) => u && u.startsWith('/uploads/'));
        const newImages = newDetail.map((s:any)=>s.image).filter((u:any) => u && u.startsWith('/uploads/'));
        
        const imagesToDelete = oldImages.filter((img:string) => !newImages.includes(img));
        for (const img of imagesToDelete) {
           try {
             const relativeOldPath = img.substring('/uploads/'.length);
             const filePath = path.join(process.cwd(), "public", "uploads", ...relativeOldPath.split('/').filter(Boolean));
             if (fs.existsSync(filePath)) {
               await fs.promises.unlink(filePath);
               console.log("[PATCH CLEANUP] Detail image deleted:", filePath);
             }
           } catch (err: any) {
             console.error("[PATCH CLEANUP] Detail image delete failed:", err.message);
           }
        }
      } catch (e) {}
    }
    // -----------------------------------------------------------

    const updates: string[] = [];
    const values: any[] = [];
    const setField = (field: string, val: any) => {
      if (val !== undefined) {
        updates.push(`${field} = ?`);
        values.push(val);
      }
    };

    const smartStringify = (val: any) => {
      if (val === undefined || val === null) return null;
      if (typeof val === "string") {
        try {
          // If it's a valid JSON string, we return it as is (or re-normalize it)
          JSON.parse(val);
          return val;
        } catch {
          // If it's not a JSON string, we stringify it (e.g. "general" -> '"general"')
          return JSON.stringify(val);
        }
      }
      return JSON.stringify(val);
    };

    setField("title", req.body.title);
    setField("status", req.body.status);
    setField("poster", req.body.poster);
    setField("detail", req.body.detail !== undefined ? (typeof req.body.detail === 'string' ? req.body.detail : JSON.stringify(req.body.detail)) : undefined);
    setField("start_date", req.body.start_date);
    setField("end_date", req.body.end_date);
    setField(
      "publish_start_date",
      req.body.publish_start_date !== undefined
        ? req.body.publish_start_date || null
        : undefined,
    );
    setField("start_time", req.body.start_time);
    setField("end_time", req.body.end_time);
    setField("registration_start_date", req.body.registration_start_date);
    setField("registration_end_date", req.body.registration_end_date);
    setField(
      "is_continuous_registration",
      req.body.is_continuous_registration !== undefined
        ? req.body.is_continuous_registration
          ? 1
          : 0
        : undefined,
    );
    setField(
      "is_continuous_event",
      req.body.is_continuous_event !== undefined
        ? req.body.is_continuous_event
          ? 1
          : 0
        : undefined,
    );
    setField(
      "is_unlimited_max_slots",
      req.body.is_unlimited_max_slots !== undefined
        ? req.body.is_unlimited_max_slots
          ? 1
          : 0
        : undefined,
    );
    setField("max_slots", req.body.max_slots);
    setField("location_name", req.body.location_name);
    setField("organizer", req.body.organizer);
    setField("event_code", req.body.event_code);
    setField("event_password", req.body.event_password);

    if (req.body.visibility !== undefined) {
      setField("visibility", smartStringify(req.body.visibility));
    }
    if (req.body.health_config !== undefined) {
      setField("health_config", smartStringify(req.body.health_config));
    }
    if (req.body.goal_config !== undefined) {
      setField("goal_config", smartStringify(req.body.goal_config));
    }
    if (req.body.certificate_config !== undefined) {
      setField("certificate_config", smartStringify(req.body.certificate_config));
    }
    if (req.body.assessment_config !== undefined) {
      setField("assessment_config", smartStringify(req.body.assessment_config));
    }
    setField("team_id", req.body.team_id);

    if (updates.length > 0) {
      values.push(req.params.id);
      await connection.query(
        `UPDATE events SET ${updates.join(", ")} WHERE id = ?`,
        values,
      );
    }

    const tasks = req.body.tasks;
    if (tasks && Array.isArray(tasks)) {
      // 1. Get current tasks in DB for this event
      const [existingRows]: any = await connection.query(
        "SELECT id FROM tasks WHERE event_id = ?",
        [req.params.id],
      );
      const existingIds = existingRows.map((r: any) => r.id);

      const newIds = tasks.filter((t) => t.id).map((t) => Number(t.id));

      // 2. Identify tasks to delete (those in DB but not in request)
      const idsToDelete = existingIds.filter((id) => !newIds.includes(id));
      if (idsToDelete.length > 0) {
        await connection.query("DELETE FROM tasks WHERE id IN (?)", [
          idsToDelete,
        ]);
      }

      // 3. Update or Insert tasks
      for (const task of tasks) {
        console.log("[activity:patch] Processing task:", JSON.stringify(task));
        const ad = task.allowed_days || [0, 1, 2, 3, 4, 5, 6];
        const taskData = [
          task.title || task.note,
          task.metric_type,
          task.metric_unit,
          task.goal_type,
          task.goal_value,
          task.points || 0,
          task.submission_type || "manual",
          task.is_active !== false ? 1 : 0,
          JSON.stringify(ad),
          task.type || "exercise",
          [true, 1, "true", "1"].includes(task.use_ocr) ? 1 : 0,
        ];

        if (task.id && existingIds.includes(Number(task.id))) {
          // Update existing task
          await connection.query(
            `UPDATE tasks SET note = ?, metric_type = ?, metric_unit = ?, goal_type = ?, goal_value = ?, points = ?, submission_type = ?, is_active = ?, allowed_days = ?, type = ?, use_ocr = ? WHERE id = ?`,
            [...taskData, task.id],
          );
        } else {
          // Insert new task
          await connection.query(
            `INSERT INTO tasks (event_id, note, metric_type, metric_unit, goal_type, goal_value, points, submission_type, is_active, allowed_days, type, use_ocr) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, ...taskData],
          );
        }
      }
    }

    await connection.commit();
    const [finalRows]: any = await pool.query(
      "SELECT * FROM events WHERE id = ?",
      [req.params.id],
    );

    // Log the action (wrapped so audit failure never kills the response)
    try {
      if (finalRows[0]) {
        await logAudit({
          userId: userId as string,
          action: "edit_activity",
          targetType: "activity",
          targetId: req.params.id,
          description: `แก้ไขกิจกรรม: ${finalRows[0].title}`,
          metadata: { updates: Object.keys(req.body) },
        });
      }
    } catch (auditErr) {
      console.error("[activity:patch:audit:error]", auditErr);
    }

    // ✅ Emit realtime event
    if (finalRows[0]) getIO().emit(EVENTS.ACTIVITY_UPDATED, finalRows[0]);

    res.json(finalRows[0] || {});
  } catch (error: any) {
    await connection.rollback();
    console.error("[activity:patch:error]", {
      id: req.params.id,
      message: error?.message,
      code: error?.code,
      sql: error?.sql,
      stack: error?.stack?.split('\n').slice(0, 6),
    });
    res.status(400).json({ error: error?.message || "Bad Request" });
  } finally {
    connection.release();
  }
});

router.get("/:id/leaderboard", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `
          SELECT el.*, u.fname_th, u.nickname, u.picture_url
          FROM event_leaderboards el
          JOIN users u ON el.user_id = u.id
          WHERE el.event_id = ?
          ORDER BY el.rank ASC
      `,
      [req.params.id],
    );
    res.json(
      rows.map((r: any) => ({
        ...r,
        users: {
          fname_th: decrypt(r.fname_th) || r.fname_th,
          nickname: decrypt(r.nickname) || r.nickname,
          picture_url: r.picture_url,
        },
      })),
    );
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [eventRows]: any = await pool.query(
      "SELECT * FROM events WHERE id = ?",
      [req.params.id],
    );
    const [userRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );

    const isAdmin = userRows[0]?.role === "admin";
    const isOwner = eventRows[0]?.created_by?.toString() === userId.toString();

    let isTeamHost = false;
    if (eventRows[0]?.team_id) {
      const [teamRows]: any = await pool.query(
        "SELECT host_id FROM teams WHERE id = ?",
        [eventRows[0].team_id]
      );
      if (teamRows[0]?.host_id?.toString() === userId.toString()) {
        isTeamHost = true;
      }
    }

    if (!isAdmin && !isOwner && !isTeamHost) {
      return res.status(403).json({ error: "No permission" });
    }
    // 1. Cleanup physical files before deleting from DB
    if (eventRows[0]) {
      try {
        const { poster, detail } = eventRows[0];
        // Delete poster
        if (poster && poster.startsWith('/uploads/')) {
          const relativeOldPath = poster.substring('/uploads/'.length);
          const filePath = path.join(process.cwd(), "public", "uploads", ...relativeOldPath.split('/').filter(Boolean));
          if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
        }
        // Delete detail images
        if (detail) {
          const parsedDetail = typeof detail === 'string' ? JSON.parse(detail || "[]") : detail;
          const images = parsedDetail.map((s:any)=>s.image).filter((u:any) => u && u.startsWith('/uploads/'));
          for (const img of images) {
            const relativeOldPath = img.substring('/uploads/'.length);
            const filePath = path.join(process.cwd(), "public", "uploads", ...relativeOldPath.split('/').filter(Boolean));
            if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
          }
        }
      } catch (err: any) {
        console.error("[activity delete] Failed to cleanup physical files:", err.message);
      }
    }

    await pool.query("DELETE FROM events WHERE id = ?", [req.params.id]);

    // Log the action
    await logAudit({
      userId: userId as string,
      action: "delete_activity",
      targetType: "activity",
      targetId: req.params.id,
      description: `ลบกิจกรรม ID: ${req.params.id}`,
    });

    // ✅ Emit realtime event เพื่อให้ทุก client รู้ทันทีเมื่อลบกิจกรรม
    getIO().emit(EVENTS.ACTIVITY_DELETED, { id: req.params.id });

    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/leave", async (req, res) => {
  const { userId } = req.body;
  const requesterId = req.headers["x-user-id"];

  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // ── ตรวจสอบสิทธิ์ (Bug #2 fix) ──
    // ผู้ขอต้องเป็นตัวเองหรือ admin เท่านั้น
    if (requesterId) {
      const [reqRows]: any = await connection.query(
        "SELECT role FROM users WHERE id = ?",
        [requesterId],
      );
      const reqRole = reqRows[0]?.role;
      const isSelf = String(requesterId) === String(userId);
      const requesterIsAdmin = reqRole === "admin";
      if (!isSelf && !requesterIsAdmin) {
        await connection.rollback();
        return res
          .status(403)
          .json({ error: "คุณไม่มีสิทธิ์ดำเนินการแทนผู้ใช้อื่น" });
      }
    }

    // 1. Check if event exists and isn't expired
    const [eventRows]: any = await connection.query(
      "SELECT end_date FROM events WHERE id = ?",
      [req.params.id],
    );
    if (eventRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "ไม่พบกิจกรรมนี้" });
    }

    if (eventRows[0].end_date) {
      const endDate = new Date(eventRows[0].end_date);
      endDate.setHours(23, 59, 59, 999);
      if (new Date() > endDate) {
        await connection.rollback();
        return res
          .status(400)
          .json({ error: "ไม่สามารถออกจากกิจกรรมที่สิ้นสุดแล้ว" });
      }
    }

    // 2. Fetch user information to check if they are a host
    const [userRows]: any = await connection.query(
      "SELECT id, role, team_id FROM users WHERE id = ?",
      [userId],
    );
    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "ไม่พบผู้ใช้งาน" });
    }

    const user = userRows[0];
    const isHost = user.role === "host";
    const teamId = user.team_id;

    // 3. Deletion Logic - Always leave solo as per new requirements
    await connection.query(
      "DELETE FROM registrations WHERE user_id = ? AND event_id = ?",
      [userId, req.params.id],
    );

    await logAudit({
      userId: (requesterId || userId) as string,
      action: "leave_activity_solo",
      targetType: "activity",
      targetId: req.params.id,
      description: `User ID ${userId} ออกจากกิจกรรม`,
    });

    await connection.commit();
    res.status(200).json({
      success: true,
      message: "ออกจากกิจกรรมเรียบร้อยแล้ว",
    });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ error: "Bad Request" });
  } finally {
    connection.release();
  }
});



router.get("/:id/participants", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { id } = req.params;

    // Verify if user is admin or host
    const [userRows]: any = await pool.query(
      "SELECT role FROM users WHERE id = ?",
      [userId],
    );
    const userRole = userRows[0]?.role;
    if (userRole !== "admin" && userRole !== "host") {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Fetch registrants
    const [registrants]: any = await pool.query(
      `
      SELECT 
        r.id as reg_id, 
        r.created_at, 
        u.id, 
        u.id_code,
        u.fname_th, 
        u.lname_th, 
        u.email, 
        u.phone, 
        u.role_type, 
        u.role_detail_1,
        tm.name as team_name,
        (SELECT COUNT(*) FROM submissions s 
         JOIN tasks t ON s.task_id = t.id 
         WHERE s.user_id = u.id AND t.event_id = ? AND s.status = 'approved') as approved_count
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN teams tm ON u.team_id = tm.id
      WHERE r.event_id = ?
      ORDER BY r.created_at ASC
    `,
      [id, id],
    );

    const transformed = registrants.map((r: any) => ({
      ...r,
      fname_th: decrypt(r.fname_th),
      lname_th: decrypt(r.lname_th),
      email: decrypt(r.email),
      phone: decrypt(r.phone),
      id_code: decrypt(r.id_code),
      is_passed: r.approved_count > 0, // Basic implementation: passed if has at least 1 approved submission
    }));

    res.json(transformed);
  } catch (error: any) {
    console.error("[Get Participants Error]", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id/admin-stats", requireAdminOrHost, async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { id } = req.params;

    const [eventRows]: any = await pool.query(
      `SELECT start_date, end_date, goal_config, is_continuous_event, created_at FROM events WHERE id = ?`,
      [id],
    );
    const event = eventRows[0];

    const [registrants]: any = await pool.query(
      `
      SELECT r.id as reg_id, r.created_at, u.id as user_id, u.fname_th, u.lname_th, u.role, u.role_type, u.role_detail_1, u.role_detail_2, u.team_id, u.birth_date, u.gender, u.picture_url, u.email, u.phone, u.id_code
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      WHERE r.event_id = ?
    `,
      [id],
    );

    const [submissions]: any = await pool.query(
      `
      SELECT s.id, s.user_id, s.task_id, s.img_url, s.text_response, s.value, s.status, s.comment, s.activity_type, s.proof_type, s.created_at, t.type as task_type, t.note as task_note, t.metric_type, t.metric_unit, t.points, u.fname_th, u.lname_th, u.picture_url
      FROM submissions s
      JOIN tasks t ON s.task_id = t.id
      JOIN users u ON s.user_id = u.id
      WHERE t.event_id = ?
      ORDER BY s.created_at DESC
    `,
      [id],
    );

    const transformedRegistrants = registrants.map((r: any) => ({
      ...r,
      fname_th: decrypt(r.fname_th),
      lname_th: decrypt(r.lname_th),
      email: decrypt(r.email),
      phone: decrypt(r.phone),
      id_code: decrypt(r.id_code),
      gender: decrypt(r.gender),
      submission_count: submissions.filter(
        (s: any) => s.user_id === r.user_id && s.status !== "rejected",
      ).length,
    }));

    const transformedSubmissions = submissions.map((s: any) => ({
      ...s,
      fname_th: decrypt(s.fname_th),
      lname_th: decrypt(s.lname_th),
    }));

    const [teams]: any = await pool.query(`SELECT id, name FROM teams`);
    const [tasks]: any = await pool.query(
      `SELECT * FROM tasks WHERE event_id = ? AND is_active = 1`,
      [id],
    );

    const [tanitaData]: any = await pool.query(
      `
      SELECT * FROM tanita
      WHERE user_id IN (SELECT user_id FROM registrations WHERE event_id = ?)
      AND event_id = ?
      ORDER BY recorded_at ASC
    `,
      [id, id],
    );

    const transformedTanita = tanitaData.map((r: any) =>
      decryptFields(r, TANITA_ENCRYPTED_FIELDS),
    );

    res.json({
      event,
      registrants: transformedRegistrants,
      teams,
      submissions: transformedSubmissions,
      tasks,
      tanita: transformedTanita,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/:id/assign-team", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { userIds, teamId } = req.body;
  if (!userIds || !Array.isArray(userIds) || teamId === undefined) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const placeholders = userIds.map(() => "?").join(",");
    const queryParams = [teamId === null ? null : teamId, ...userIds];
    await connection.query(
      `UPDATE users SET team_id = ? WHERE id IN (${placeholders})`,
      queryParams,
    );

    await logAudit({
      userId: userId as string,
      action: "assign_team",
      targetType: "users",
      description:
        "กำหนดทีมผู้ใช้จำนวน " + userIds.length + " คน ให้กับทีม ID: " + teamId,
      metadata: { userIds, teamId },
    });

    await connection.commit();
    res.json({ success: true });
  } catch (err: any) {
    await connection.rollback();
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
});

// ─── Assessment Part Stats ───────────────────────────────────────────────────
router.get("/:id/assessment-part-stats", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { id } = req.params;

    // Get all answers grouped by health_assessment (part/section) with avg/min/max
    const [rows]: any = await pool.query(
      `SELECT 
        ha.id AS part_id,
        COALESCE(ha.overall_level, CONCAT('หมวด ', aa.health_assessment_id)) AS part_name,
        aa.health_assessment_id,
        asub.test_type,
        ROUND(AVG(sub_scores.part_score), 2) AS avg_score,
        MIN(sub_scores.part_score) AS min_score,
        MAX(sub_scores.part_score) AS max_score,
        COUNT(DISTINCT asub.user_id) AS respondent_count
       FROM assessment_answers aa
       JOIN assessment_submissions asub ON aa.submission_id = asub.id
       LEFT JOIN health_assessments ha ON aa.health_assessment_id = ha.id
       JOIN (
         SELECT submission_id, health_assessment_id, SUM(score) AS part_score
         FROM assessment_answers
         GROUP BY submission_id, health_assessment_id
       ) sub_scores ON sub_scores.submission_id = aa.submission_id AND sub_scores.health_assessment_id = aa.health_assessment_id
       WHERE asub.event_id = ?
       GROUP BY aa.health_assessment_id, asub.test_type
       ORDER BY aa.health_assessment_id`,
      [id]
    );

    // Also get question-level breakdown for specific health assessments
    const [questionRows]: any = await pool.query(
      `SELECT 
        aa.health_assessment_id,
        aa.question_text,
        asub.test_type,
        AVG(aa.score) AS avg_score,
        MIN(aa.score) AS min_score,
        MAX(aa.score) AS max_score,
        COUNT(*) AS answer_count
       FROM assessment_answers aa
       JOIN assessment_submissions asub ON aa.submission_id = asub.id
       WHERE asub.event_id = ?
       GROUP BY aa.health_assessment_id, aa.question_text, asub.test_type
       ORDER BY aa.health_assessment_id, avg_score ASC`,
      [id]
    );

    res.json({ partStats: rows, questionStats: questionRows });
  } catch (error: any) {
    console.error("[Assessment Stats Error]", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.get("/:id/assessments", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { id } = req.params;

    // Join with users to get profile info
    const [submissions]: any = await pool.query(
      `
      SELECT asub.*, u.fname_th, u.lname_th, u.nickname, u.picture_url,
             (SELECT ha.overall_level
              FROM health_assessments ha
              JOIN assessment_answers aa ON ha.id = aa.health_assessment_id
              WHERE aa.submission_id = asub.id
              LIMIT 1) as overall_level
      FROM assessment_submissions asub
      JOIN users u ON asub.user_id = u.id
      WHERE asub.event_id = ?
      ORDER BY asub.submitted_at DESC
    `,
      [id],
    );

    if (submissions.length === 0) return res.json([]);

    // Fetch answers for these submissions
    const subIds = submissions.map((s: any) => s.id);
    const [answers]: any = await pool.query(
      `
      SELECT * FROM assessment_answers
      WHERE submission_id IN (?)
    `,
      [subIds],
    );

    // Decrypt names and group answers
    const transformed = submissions.map((s: any) => {
      const subAnswers = answers.filter((a: any) => a.submission_id === s.id);
      return {
        ...s,
        fname_th: decrypt(s.fname_th),
        lname_th: decrypt(s.lname_th),
        nickname: decrypt(s.nickname),
        responses: subAnswers,
        created_at: s.submitted_at, // Map to field expected by frontend
        type: s.test_type, // Map to field expected by frontend
      };
    });

    res.json(transformed);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── 14. Activity Tanita Changes ─────────────────────────────────────────
router.get("/:id/tanita-changes", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { id } = req.params;

    // Verify role
    const [userRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [userId]);
    const userRole = userRows[0]?.role;
    if (userRole !== "admin" && userRole !== "host") return res.status(403).json({ error: "Forbidden" });

    const [registrants]: any = await pool.query(
      `SELECT u.id, u.fname_th, u.lname_th, u.picture_url, u.nickname, u.gender 
       FROM registrations r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.event_id = ?`,
      [id]
    );

    if (registrants.length === 0) return res.json([]);
    const userIds = registrants.map((r: any) => r.id);

    const [tanitaRecords]: any = await pool.query(
      `SELECT * FROM tanita WHERE user_id IN (?) AND event_id = ? ORDER BY recorded_at ASC`,
      [userIds, id]
    );

    const userMap = new Map();
    registrants.forEach((r: any) => {
      let fname = r.fname_th || '';
      let lname = r.lname_th || '';
      let nickname = r.nickname || '';
      let gender = r.gender || '';
      try { fname = decrypt(fname); } catch { }
      try { lname = decrypt(lname); } catch { }
      try { nickname = decrypt(nickname); } catch { }
      try { gender = decrypt(gender); } catch { }

      userMap.set(r.id, {
        user_id: r.id,
        fname_th: fname,
        lname_th: lname,
        nickname: nickname,
        picture_url: r.picture_url,
        gender: gender,
        first: null,
        latest: null
      });
    });

    tanitaRecords.forEach((rec: any) => {
      const u = userMap.get(rec.user_id);
      if (!u) return;
      const decrypted = decryptFields(rec, TANITA_ENCRYPTED_FIELDS);
      if (!u.first) u.first = decrypted;
      u.latest = decrypted;
    });

    // Only return users who have at least 2 different records to show "changes"
    const result = Array.from(userMap.values()).filter(u => u.first && u.latest && u.first.id !== u.latest.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── 15. Activity Assessment Comparison ──────────────────────────────────
router.get("/:id/assessment-comparison", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { id } = req.params;

    // Verify role
    const [userRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [userId]);
    const userRole = userRows[0]?.role;
    if (userRole !== "admin" && userRole !== "host") return res.status(403).json({ error: "Forbidden" });

    const [rows]: any = await pool.query(
      `SELECT 
        asub.user_id, asub.test_type, asub.total_score, asub.submitted_at,
        u.fname_th, u.lname_th, u.nickname, u.picture_url, t.name as team_name
       FROM assessment_submissions asub
       JOIN users u ON asub.user_id = u.id
       LEFT JOIN teams t ON u.team_id = t.id
       WHERE asub.event_id = ?
       ORDER BY asub.submitted_at ASC`,
      [id]
    );

    const userMap = new Map();
    rows.forEach((r: any) => {
      if (!userMap.has(r.user_id)) {
        let fname = r.fname_th || '';
        let lname = r.lname_th || '';
        let nickname = r.nickname || '';
        try { fname = decrypt(fname); } catch { }
        try { lname = decrypt(lname); } catch { }
        try { nickname = decrypt(nickname); } catch { }

        userMap.set(r.user_id, {
          user_id: r.user_id,
          fname_th: fname,
          lname_th: lname,
          nickname: nickname,
          picture_url: r.picture_url,
          team_name: r.team_name,
          pre_score: null,
          post_score: null,
          pre_date: null,
          post_date: null
        });
      }
      const u = userMap.get(r.user_id);
      if (r.test_type === 'pre_test') {
        u.pre_score = r.total_score;
        u.pre_date = r.submitted_at;
      } else if (r.test_type === 'post_test') {
        u.post_score = r.total_score;
        u.post_date = r.submitted_at;
      }
    });

    const result = Array.from(userMap.values()).filter(u => u.pre_score !== null || u.post_score !== null);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// --- Bonus Points System --------------------------------------------------
// Auto-create bonus_points table on startup (delayed to avoid race condition)
setTimeout(() => {
  (async function ensureBonusTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bonus_points (
          id INT AUTO_INCREMENT PRIMARY KEY,
          event_id INT NOT NULL,
          user_id INT NOT NULL,
          points INT NOT NULL,
          reason VARCHAR(500) DEFAULT NULL,
          given_by INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_event_user (event_id, user_id),
          INDEX idx_event (event_id)
        )
      `);
      console.log("[bonus_points] table ensured.");
    } catch (e: any) { console.error('[bonus_points] table ensure error:', e.message); }
  })();
}, 7000);

// GET /api/activities/:id/bonus-points
router.get('/:id/bonus-points', requireAdminOrHost, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows]: any = await pool.query(`
      SELECT bp.id, bp.event_id, bp.user_id, bp.points, bp.reason, bp.given_by, bp.created_at,
             u.fname_th, u.lname_th, u.nickname, u.picture_url,
             g.fname_th as given_by_name
      FROM bonus_points bp
      LEFT JOIN users u ON bp.user_id = u.id
      LEFT JOIN users g ON bp.given_by = g.id
      WHERE bp.event_id = ?
      ORDER BY bp.created_at DESC
    `, [id]);
    const decrypted = rows.map((r: any) => ({
      ...r,
      fname_th: (() => { try { return decrypt(r.fname_th) || r.fname_th; } catch { return r.fname_th; } })(),
      lname_th: (() => { try { return decrypt(r.lname_th) || r.lname_th; } catch { return r.lname_th; } })(),
      nickname: (() => { try { return decrypt(r.nickname) || r.nickname; } catch { return r.nickname; } })(),
      given_by_name: (() => { try { return decrypt(r.given_by_name) || r.given_by_name; } catch { return r.given_by_name; } })(),
    }));
    res.json(decrypted);
  } catch (error: any) { res.status(500).json({ error: "Internal Server Error" }); }
});

// POST /api/activities/:id/bonus-points
router.post('/:id/bonus-points', requireAdminOrHost, async (req, res) => {
  const { id } = req.params;
  const adminId = req.headers['x-user-id'];
  const { user_id, points, reason } = req.body;
  if (!user_id || points === undefined || points === null) return res.status(400).json({ error: 'Missing user_id or points' });
  const pts = Number(points);
  if (isNaN(pts) || pts === 0) return res.status(400).json({ error: '???????????????????????????? 0' });
  try {
    const [regRows]: any = await pool.query('SELECT id FROM registrations WHERE user_id = ? AND event_id = ? LIMIT 1', [user_id, id]);
    if (regRows.length === 0) return res.status(404).json({ error: '????????????????????????????????????' });
    const [result]: any = await pool.query(
      'INSERT INTO bonus_points (event_id, user_id, points, reason, given_by) VALUES (?, ?, ?, ?, ?)',
      [id, user_id, pts, reason || null, adminId]
    );
    if (pts > 0) {
      await pool.query('UPDATE users SET points = points + ?, total_score = total_score + ? WHERE id = ?', [pts, pts, user_id]);
    } else {
      await pool.query('UPDATE users SET points = GREATEST(0, points + ?), total_score = GREATEST(0, total_score + ?) WHERE id = ?', [pts, pts, user_id]);
    }
    await logAudit({ userId: Number(adminId), action: 'ADD_BONUS_POINTS', description: `Admin added ${pts} bonus pts to user ${user_id} in event ${id}. Reason: ${reason || '-'}`, targetType: 'activity', targetId: Number(id) });
    res.status(201).json({ id: result.insertId, message: '????????????????' });
  } catch (error: any) { res.status(500).json({ error: "Internal Server Error" }); }
});

// DELETE /api/activities/:id/bonus-points/:bonusId
router.delete('/:id/bonus-points/:bonusId', requireAdminOrHost, async (req, res) => {
  const { id, bonusId } = req.params;
  const adminId = req.headers['x-user-id'];
  try {
    const [rows]: any = await pool.query('SELECT id, user_id, points FROM bonus_points WHERE id = ? AND event_id = ? LIMIT 1', [bonusId, id]);
    if (rows.length === 0) return res.status(404).json({ error: '????????????????' });
    const { user_id, points } = rows[0];
    await pool.query('DELETE FROM bonus_points WHERE id = ?', [bonusId]);
    await pool.query('UPDATE users SET points = GREATEST(0, points - ?), total_score = GREATEST(0, total_score - ?) WHERE id = ?', [Number(points), Number(points), user_id]);
    await logAudit({ userId: Number(adminId), action: 'DELETE_BONUS_POINTS', description: `Admin removed bonus ${bonusId} (${points} pts) from user ${user_id} in event ${id}`, targetType: 'activity', targetId: Number(id) });
    res.json({ message: '?????????????' });
  } catch (error: any) { res.status(500).json({ error: "Internal Server Error" }); }
});
export default router;
