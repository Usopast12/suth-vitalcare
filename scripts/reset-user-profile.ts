import { pool } from "../server/mysql.js";
import { encryptFields } from "../server/lib/crypto.js";

async function run() {
  try {
    // 1. Inspect table columns
    const [columns]: any = await pool.query("SHOW COLUMNS FROM users");
    console.log("Users columns:", columns.map((c: any) => c.Field));
    
    const [users]: any = await pool.query("SELECT * FROM users LIMIT 1");
    console.log("Current user row:", users);

    if (users.length === 0) {
      console.log("No users found in database.");
      process.exit(0);
    }

    const userId = users[0].id;
    console.log(`Targeting user ID: ${userId}`);

    // 2. Clear old Tanita records to start fresh or update them
    await pool.query("DELETE FROM tanita WHERE user_id = ?", [userId]);

    // 3. Define clean normal human metrics
    const p = {
      gender: "male",
      weight: "72.5",
      fat_pc: "16.2",
      fat_mass: "11.7",
      muscle_mass: "57.8",
      metabolic_age: "24",
      visceral_fat: "5",
      bmi: "22.4"
    };

    // Encrypt fields using the CURRENT active key in the environment
    const textFields = ["gender", "weight", "fat_pc", "fat_mass", "muscle_mass", "metabolic_age", "visceral_fat", "bmi"];
    const encryptedText = encryptFields(p, textFields);

    const recordedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const query = `
      INSERT INTO tanita (
        user_id, recorded_at, body_type, gender, age, height, clothes_weight, weight,
        fat_pc, fat_mass, ffm, muscle_mass, tbw_mass, tbw_pc, bone_mass, bmr_kj, bmr_kcal,
        metabolic_age, visceral_fat, bmi, ideal_weight, obesity_degree, physique_rating, waist_cm
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      userId,
      recordedAt,
      "Standard",
      encryptedText.gender,
      25,           // age
      178.0,        // height
      1.0,          // clothes weight
      encryptedText.weight,
      encryptedText.fat_pc,
      encryptedText.fat_mass,
      60.8,         // ffm
      encryptedText.muscle_mass,
      44.5,         // tbw_mass
      59.5,         // tbw_pc
      3.2,          // bone_mass
      6900,         // bmr_kj
      1650,         // bmr_kcal
      encryptedText.metabolic_age,
      encryptedText.visceral_fat,
      encryptedText.bmi,
      71.2,         // ideal_weight
      0.0,          // obesity_degree
      5,            // physique_rating
      82.0          // waist_cm
    ];

    await pool.query(query, values);
    console.log("Successfully inserted a normal human health profile for user!");

    // Also update the main user record
    await pool.query("UPDATE users SET main_goal = 'ลดน้ำหนัก', activity_level = 'light' WHERE id = ?", [userId]);
    console.log("Updated users table with normal credentials!");

    process.exit(0);
  } catch (error) {
    console.error("Error executing profile reset script:", error);
    process.exit(1);
  }
}

run();
