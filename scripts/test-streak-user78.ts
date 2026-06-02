import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

function formatDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "suth_vitalcare", // Change if your DB name is different
    dateStrings: true,
  });

  try {
    const userId = 78;
    // Task IDs for Event 97
    const taskIds = [258, 259, 260, 261];
    
    console.log(`Clearing existing submissions for User ${userId} on tasks ${taskIds.join(', ')}...`);
    // Clear old data for user 78 for these tasks
    await conn.query(
      `DELETE FROM submissions WHERE user_id = ? AND task_id IN (?)`,
      [userId, taskIds]
    );

    const submissionRows: any[][] = [];
    const today = new Date();

    // 10 consecutive days
    for (let i = 9; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = formatDateOnly(date);

      for (const taskId of taskIds) {
        let value = 0;
        let activityType = 'exercise';
        let proofType = 'manual';
        
        if (taskId === 258) value = 5.0; // วิ่งสะสมระยะทาง 5 km
        else if (taskId === 259) value = 10000; // เดิน 10,000 ก้าว
        else if (taskId === 260) { value = 8; activityType = 'health'; } // ดื่มน้ำ 8 แก้ว
        else if (taskId === 261) { value = 8; activityType = 'health'; } // นอนหลับ 8 ชั่วโมง

        const createdAt = `${dateStr} 08:00:00`;
        
        submissionRows.push([
          userId,
          taskId,
          value,
          null, // img_url
          null, // text_response
          "approved",
          activityType,
          proofType,
          null, // device_id
          createdAt, // approved_at
          createdAt  // created_at
        ]);
      }
    }

    if (submissionRows.length > 0) {
      const placeholders = submissionRows.map(() => `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).join(",");
      const params = submissionRows.flat();
      await conn.query(
        `
        INSERT INTO submissions (
          user_id, task_id, value, img_url, text_response, status, activity_type, proof_type, device_id, approved_at, created_at
        ) VALUES ${placeholders}
        `,
        params
      );
    }

    console.log(`✅ Inserted streak 10 days for User ID ${userId}`);
    
    // Recalculate points for the user
    console.log(`Recalculating points for User ${userId}...`);
    await conn.query(
      `
      UPDATE users u
      LEFT JOIN (
        SELECT s.user_id, COALESCE(SUM(t.points), 0) AS total_points
        FROM submissions s
        JOIN tasks t ON t.id = s.task_id
        WHERE s.status = 'approved' AND s.user_id = ?
        GROUP BY s.user_id
      ) agg ON agg.user_id = u.id
      SET
        u.points = COALESCE(agg.total_points, 0),
        u.total_score = COALESCE(agg.total_points, 0)
      WHERE u.id = ?
      `,
      [userId, userId]
    );

    console.log(`✅ Finished updating User ID ${userId}`);
    
  } catch (error: any) {
    console.error("❌ Failed:", error);
  } finally {
    await conn.end();
  }
}

main();
