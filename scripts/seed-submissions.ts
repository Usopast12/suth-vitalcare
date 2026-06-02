import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// โหลดตัวแปรสภาพแวดล้อมจาก .env
dotenv.config();

// Helper สุ่มวันที่ย้อนหลัง (0 - 90 วัน เพื่อให้ครอบคลุม สัปดาห์/เดือน/ไตรมาส)
function getRandomDate(daysBack = 90) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
    // สุ่มเวลาด้วย
    date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0);
    return date.toISOString().slice(0, 19).replace('T', ' '); // Format YYYY-MM-DD HH:MM:SS
}

async function run() {
    console.log('⏳ กำลังเชื่อมต่อฐานข้อมูล...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'vitalcare'
    });

    try {
        console.log('✅ เชื่อมต่อสำเร็จ');
        
        // 1. ดึง users ทั้งหมด (จำกัดแค่ 50 คนเพื่อไม่ให้เยอะเกินไป)
        const [users] = await connection.query('SELECT id FROM users LIMIT 50');
        if (!users || (users as any[]).length === 0) {
            console.log('❌ ไม่พบผู้ใช้ในระบบ');
            return;
        }
        console.log(`👤 พบผู้ใช้ ${ (users as any[]).length } คน`);

        // 2. หากิจกรรมสัก 1 กิจกรรม เพื่อผูก tasks 
        // สร้าง Dummy Event ถ้าไม่มี หรือใช้ Event ล่าสุด
        const [events] = await connection.query('SELECT id FROM events ORDER BY id DESC LIMIT 1');
        let eventId;
        if ((events as any[]).length === 0) {
            console.log('สร้าง Event ใหม่จำลอง...');
            const [result] = await connection.query(`
                INSERT INTO events (title, start_date, end_date) 
                VALUES ('กิจกรรมทดสอบ Dashboard', '2026-01-01', '2026-12-31')
            `);
            eventId = (result as any).insertId;
        } else {
            eventId = (events as any[])[0].id;
        }
        console.log(`📅 ใช้ Event ID: ${eventId}`);

        // 3. จัดการ Tasks ให้มี metric_unit หลากหลายแบบ
        const dummyTasks = [
            { note: 'วิ่งสะสมระยะทาง', metric_unit: 'km', type: 'exercise' },
            { note: 'เดิน 10,000 ก้าว', metric_unit: 'steps', type: 'exercise' },
            { note: 'ดื่มน้ำ 8 แก้ว', metric_unit: 'glass', type: 'health' },
            { note: 'นอนหลับ 8 ชั่วโมง', metric_unit: 'hr', type: 'health' }
        ];

        const taskIds = [];
        for (const task of dummyTasks) {
            const [result] = await connection.query(`
                INSERT INTO tasks (event_id, note, metric_unit, type, is_active)
                VALUES (?, ?, ?, ?, 1)
            `, [eventId, task.note, task.metric_unit, task.type]);
            taskIds.push((result as any).insertId);
        }
        console.log(`📝 สร้าง Tasks จำลอง 4 แบบ (ID: ${taskIds.join(', ')})`);

        // 4. ให้ทุกคนสมัครเข้าร่วม Event
        console.log('👥 กำลังให้ผู้ใช้ลงทะเบียนกิจกรรม...');
        for (const user of (users as any[])) {
            await connection.query(`
                INSERT IGNORE INTO registrations (user_id, event_id)
                VALUES (?, ?)
            `, [user.id, eventId]);
        }

        // 5. สุ่มสร้าง Submissions
        console.log('🚀 กำลังสุ่มสร้างประวัติการส่งงาน (Submissions)...');
        let totalSubs = 0;
        for (const user of (users as any[])) {
            // สุ่มว่าแต่ละคนจะส่งงานกี่ครั้ง (5 - 20 ครั้ง)
            const numSubs = Math.floor(Math.random() * 15) + 5;
            
            for (let i = 0; i < numSubs; i++) {
                const taskId = taskIds[Math.floor(Math.random() * taskIds.length)];
                const status = Math.random() > 0.2 ? 'approved' : 'pending'; // 80% สำเร็จ
                
                // สุ่มค่า value
                let value = 0;
                if (taskId === taskIds[0]) value = (Math.random() * 5) + 1; // 1-6 km
                if (taskId === taskIds[1]) value = Math.floor(Math.random() * 5000) + 2000; // 2k-7k steps
                if (taskId === taskIds[2]) value = Math.floor(Math.random() * 5) + 1; // 1-5 glass
                if (taskId === taskIds[3]) value = (Math.random() * 4) + 4; // 4-8 hr

                const randomDate = getRandomDate(90); // สุ่มย้อนหลัง 90 วัน

                await connection.query(`
                    INSERT INTO submissions (user_id, task_id, value, status, activity_type, created_at, approved_at)
                    VALUES (?, ?, ?, ?, 'exercise', ?, ?)
                `, [
                    user.id, 
                    taskId, 
                    value.toFixed(2), 
                    status, 
                    randomDate,
                    status === 'approved' ? randomDate : null
                ]);
                totalSubs++;
            }
        }

        console.log(`🎉 สร้าง Submissions ไปทั้งหมด ${totalSubs} รายการ เรียบร้อยแล้ว!`);
        console.log('ลองเปิดดูแท็บ Dashboard ในหน้าโปรไฟล์เพื่อดูความเปลี่ยนแปลง');

    } catch (err) {
        console.error('❌ เกิดข้อผิดพลาด:', err);
    } finally {
        await connection.end();
    }
}

run();
