import { ref, computed } from "vue";
import { showError } from "../lib/swal";
export function useTanitaProfile(user: any, onTanitaSaved: any) {
  const tanita = ref<any>(null);
  const isTanitaLoaded = ref(false);
  const showTanitaModal = ref(false);
  const isSavingTanita = ref(false);
  const isAnalyzingTanita = ref(false);
  const isTanitaDragging = ref(false);
  const tanitaInputMethod = ref("manual");
  const tanitaLoadingMsgs = [
    "กำลังอัปโหลดรูปภาพ...",
    "AI กำลังสแกนตัวเลข...",
    "กำลังวิเคราะห์ข้อมูลสุขภาพ...",
    "เกือบเสร็จแล้ว...",
  ];
  const tanitaLoadingMsg = ref(tanitaLoadingMsgs[0]);
  let _tanitaMsgInterval: any = null;
  const emptyTanitaForm = (): any => ({
    age: "",
    height: "",
    weight: "",
    waist_cm: "",
    bodyType: "STANDARD",
    clothesWeight: "",
    fatPercent: "",
    fatMass: "",
    ffm: "",
    muscleMass: "",
    bodyWaterMass: "",
    bodyWaterPercent: "",
    boneMass: "",
    bmrKj: "",
    bmrKcal: "",
    metabolicAge: "",
    visceralFat: "",
    bmi: "",
    idealWeight: "",
    obesityDegree: "",
    physiqueRating: "",
  });
  const tanitaForm = ref(emptyTanitaForm());
  function openTanitaModal(prefill: any) {
    tanitaForm.value = emptyTanitaForm();
    // Auto-fill real age from birth_date
    const bd = user.value?.birth_date;
    if (bd) {
      const birth = new Date(bd);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      tanitaForm.value.age = age >= 0 ? age : "";
    }
    if (prefill && tanita.value) {
      const t = tanita.value;
      tanitaForm.value = {
        ...tanitaForm.value,
        age: tanitaForm.value.age || t.age || "",
        height: t.height ?? "",
        weight: t.weight ?? "",
        waist_cm: t.waist_cm ?? "",
        bodyType: t.body_type ?? "STANDARD",
        clothesWeight: t.clothes_weight ?? "",
        fatPercent: t.fat_pc ?? "",
        fatMass: t.fat_mass ?? "",
        ffm: t.ffm ?? "",
        muscleMass: t.muscle_mass ?? "",
        bodyWaterMass: t.tbw_mass ?? "",
        bodyWaterPercent: t.tbw_pc ?? "",
        boneMass: t.bone_mass ?? "",
        bmrKj: t.bmr_kj ?? "",
        bmrKcal: t.bmr_kcal ?? "",
        metabolicAge: t.metabolic_age ?? "",
        visceralFat: t.visceral_fat ?? "",
        bmi: t.bmi ?? "",
        idealWeight: t.ideal_weight ?? "",
        obesityDegree: t.obesity_degree ?? "",
        physiqueRating: t.physique_rating ?? "",
      };
    }
    showTanitaModal.value = true;
  }
  async function fetchTanitaData() {
    if (!user.value?.id || isTanitaLoaded.value) return;
    try {
      const tanRes = await fetch(`/api/tanita/user/${user.value.id}`, {
        headers: { "x-user-id": String(user.value.id) },
      });
      const tanData = await tanRes.json();
      if (tanData && tanData.length > 0) tanita.value = tanData[0];
      isTanitaLoaded.value = true;
    } catch {}
  }
  async function submitTanitaForm() {
    if (!user.value?.id || isSavingTanita.value) return;
    if (!tanitaForm.value.weight && !tanitaForm.value.height) {
      alert("กรุณากรอกส่วนสูงและน้ำหนักอย่างน้อย");
      return;
    }
    isSavingTanita.value = true;
    try {
      const f = tanitaForm.value;
      const payload = {
        user_id: user.value.id,
        recorded_at: new Date().toISOString(),
        age: f.age || null,
        height: f.height || null,
        weight: f.weight || null,
        waist_cm: f.waist_cm || null,
        body_type: f.bodyType || null,
        clothes_weight: f.clothesWeight || null,
        fat_pc: f.fatPercent || null,
        fat_mass: f.fatMass || null,
        ffm: f.ffm || null,
        muscle_mass: f.muscleMass || null,
        tbw_mass: f.bodyWaterMass || null,
        tbw_pc: f.bodyWaterPercent || null,
        bone_mass: f.boneMass || null,
        bmr_kj: f.bmrKj || null,
        bmr_kcal: f.bmrKcal || null,
        metabolic_age: f.metabolicAge || null,
        visceral_fat: f.visceralFat || null,
        bmi: f.bmi || null,
        ideal_weight: f.idealWeight || null,
        obesity_degree: f.obesityDegree || null,
        physique_rating: f.physiqueRating || null,
      };
      const res = await fetch("/api/tanita", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(user.value.id),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      showTanitaModal.value = false;
      if (onTanitaSaved) await onTanitaSaved();
      isTanitaLoaded.value = false; // force reload
      await fetchTanitaData();
    } catch (err) {
      showError("บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      isSavingTanita.value = false;
    }
  }
  const AI_TANITA_KEY_MAP = {
    height: "height",
    weight: "weight",
    body_type: "bodyType",
    clothes_weight: "clothesWeight",
    fat_pc: "fatPercent",
    fat_mass: "fatMass",
    ffm: "ffm",
    muscle_mass: "muscleMass",
    tbw_mass: "bodyWaterMass",
    tbw_pc: "bodyWaterPercent",
    bone_mass: "boneMass",
    bmr_kj: "bmrKj",
    bmr_kcal: "bmrKcal",
    metabolic_age: "metabolicAge",
    visceral_fat: "visceralFat",
    bmi: "bmi",
    ideal_weight: "idealWeight",
    obesity_degree: "obesityDegree",
    physique_rating: "physiqueRating",
  };

  const normalizeAiValue = (value: any) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return Number.isFinite(value) ? value : "";
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";
      const parsed = parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : trimmed;
    }
    return value;
  };
  async function handleTanitaFileSelect(file: any) {
    if (!file || !file.type.startsWith("image/")) return;
    isAnalyzingTanita.value = true;
    let idx = 0;
    _tanitaMsgInterval = setInterval(() => {
      idx = (idx + 1) % tanitaLoadingMsgs.length;
      tanitaLoadingMsg.value = tanitaLoadingMsgs[idx];
    }, 3000);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            // Tanita slips are long and thin, so we use 1600 for better OCR
            let w = img.width,
              h = img.height,
              max = 1600;
            if (w > h) {
              if (w > max) {
                h *= max / w;
                w = max;
              }
            } else {
              if (h > max) {
                w *= max / h;
                h = max;
              }
            }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/png"));
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
      const aiRes = await fetch("/api/ai/analyze-tanita", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-silent-errors": "1",
        },
        body: JSON.stringify({
          imageBase64: base64,
          userId: user.value?.id || "anonymous",
        }),
      });
      if (!aiRes.ok) {
        const errData = await aiRes.json().catch(() => ({}));
        if (aiRes.status === 422) {
          throw {
            code: "INVALID_IMAGE",
            message:
              errData.error ||
              "รูปภาพที่ส่งมาไม่ใช่ใบตรวจสุขภาพ กรุณาลองใหม่อีกครั้ง หรือกรอกข้อมูลด้วยตนเองครับ",
          };
        }
        throw new Error(
          aiRes.status === 429
            ? "โควต้า AI เต็ม กรุณากรอกเอง"
            : errData.error || "AI วิเคราะห์ไม่สำเร็จ",
        );
      }
      const aiData = await aiRes.json();
      Object.keys(aiData).forEach((k) => {
        const fk = (AI_TANITA_KEY_MAP as any)[k] || k;
        if (fk in tanitaForm.value) {
          (tanitaForm.value as any)[fk] = normalizeAiValue(aiData[k]);
        }
      });
      tanitaInputMethod.value = "manual";
    } catch (err: any) {
      if (err?.code === "INVALID_IMAGE") {
        showError("รูปภาพไม่ถูกต้อง", err.message);
      } else {
        showError(err.message || "เกิดข้อผิดพลาด AI");
      }
    } finally {
      isAnalyzingTanita.value = false;
      clearInterval(_tanitaMsgInterval);
    }
  }
  function handleTanitaImageUpload(e: any) {
    const file = e.target.files?.[0];
    if (file) handleTanitaFileSelect(file);
  }
  function handleTanitaDrop(e: any) {
    isTanitaDragging.value = false;
    const file = e.dataTransfer?.files[0];
    if (file) handleTanitaFileSelect(file);
  }
  return {
    tanita,
    isTanitaLoaded,
    showTanitaModal,
    isSavingTanita,
    isAnalyzingTanita,
    isTanitaDragging,
    tanitaInputMethod,
    tanitaLoadingMsg,
    tanitaForm,
    openTanitaModal,
    fetchTanitaData,
    submitTanitaForm,
    handleTanitaFileSelect,
    handleTanitaImageUpload,
    handleTanitaDrop,
  };
}
export function useTanitaInsights(
  tanita: any,
  user: any,
  profileStats: any,
  dashboardGoal: any = null,
  dashboardActivity: any = null,
) {
  const {
    latestWeight,
    latestHeight,
    profileBMI,
    recommendedCalories,
    accurateAge,
  } = profileStats;
  const insightSweetSpot = computed(() => {
    const w = parseFloat(latestWeight.value);
    const h = parseFloat(latestHeight.value);
    const a = parseInt(accurateAge.value);
    const rawGender = (user.value?.gender || "").toLowerCase();
    if (isNaN(w) || isNaN(h) || isNaN(a) || !rawGender) return null;
    // Mifflin-St Jeor Formula
    const isMale = rawGender.includes("ชาย") || rawGender.includes("male");
    const bmr = isMale
      ? Math.round(10 * w + 6.25 * h - 5 * a + 5)
      : Math.round(10 * w + 6.25 * h - 5 * a - 161);
    const mult: any = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      very_active: 1.725,
      extra_active: 1.9,
    };
    const lvl =
      dashboardActivity?.value || user.value?.activity_level || "sedentary";
    const tdee = Math.round(bmr * (mult[lvl] || 1.2));
    const goal = dashboardGoal?.value || user.value?.main_goal || "";
    let bca = tdee;
    let goalNote = "รักษาน้ำหนักให้เท่าเดิม — กินเท่ากับ TDEE";
    if (goal.includes("ลด")) {
      // ลด 300-500 kcal แต่ห้ามต่ำกว่า BMR (ปลอดภัยขั้นต่ำ)
      const deficit = Math.min(
        500,
        Math.max(300, Math.round((tdee - bmr) * 0.4)),
      );
      bca = Math.max(bmr, tdee - deficit);
      goalNote = `ลดน้ำหนัก — กินน้อยกว่า TDEE ${(tdee - bca).toLocaleString()} kcal (ไม่ต่ำกว่า BMR ${bmr.toLocaleString()} kcal)`;
    } else if (goal.includes("เพิ่ม")) {
      // เพิ่ม 200-300 kcal เหนือ TDEE
      bca = tdee + 250;
      goalNote = `เพิ่มกล้ามเนื้อ — กินมากกว่า TDEE ${bca - tdee} kcal`;
    }
    return {
      title: "จุดดูแลน้ำหนักที่เหมาะสม (Health Focus Spot)",
      value: `${bca.toLocaleString()} kcal`,
      desc: `คำนวณจาก BMR ${bmr.toLocaleString()} kcal และกิจกรรมในชีวิตประจำวัน (TDEE ${tdee.toLocaleString()} kcal) โดยใช้สูตรมาตรฐานสากล Mifflin-St Jeor (อ้างอิง: กรมอนามัย กระทรวงสาธารณสุข)`,
      action: `${goalNote} — แนะนำให้รับประทานที่ ${bca.toLocaleString()} kcal/วัน เพื่อผลลัพธ์ที่ยั่งยืน`,
    };
  });
  const insightProtein = computed(() => {
    const w = parseFloat(latestWeight.value);
    const a = parseInt(accurateAge.value);
    const goal = dashboardGoal?.value || user.value?.main_goal || "";
    const lvl =
      dashboardActivity?.value || user.value?.activity_level || "sedentary";
    if (isNaN(w) || w <= 0) return null;
    let minMult = 0.8;
    let maxMult = 1.0;
    let label = "คนทั่วไป (ทำงานออฟฟิศ/ออกกำลังกายน้อย)";
    if (a >= 60) {
      minMult = 1.0;
      maxMult = 1.2;
      label = "ผู้สูงอายุ (เพื่อป้องกันมวลกล้ามเนื้อลดลง)";
    } else if (goal.includes("เพิ่มกล้ามเนื้อ")) {
      minMult = 1.6;
      maxMult = 2.2;
      label = "สายเล่นเวท/สร้างกล้ามเนื้อ";
    } else if (lvl !== "sedentary" && goal.includes("ลดน้ำหนัก")) {
      // ออกกำลังกาย + ลดน้ำหนัก
      minMult = 1.2;
      maxMult = 1.5;
      label = "คนออกกำลังกาย/คุมน้ำหนัก";
    } else if (lvl !== "sedentary") {
      // ออกกำลังกาย แต่ไม่ได้คุมน้ำหนัก
      minMult = 1.2;
      maxMult = 1.5;
      label = "คนออกกำลังกาย";
    } else if (goal.includes("ลดน้ำหนัก")) {
      // ไม่ออกกำลังกาย แต่ต้องการลดน้ำหนัก → เพิ่มโปรตีนนิดหน่อยเพื่อรักษากล้ามเนื้อ
      minMult = 1.0;
      maxMult = 1.2;
      label = "คนลดน้ำหนัก (ออกกำลังกายน้อย) — เน้นโปรตีนเพื่อรักษากล้ามเนื้อ";
    }
    const minP = Math.round(w * minMult);
    const maxP = Math.round(w * maxMult);
    return {
      title: "ปริมาณโปรตีนที่แนะนำต่อวัน",
      value: `${minP} - ${maxP} กรัม`,
      desc: `คำนวณตามเกณฑ์ "${label}" (ใช้สัดส่วน ${minMult}-${maxMult} g/kg) ตามมาตรฐาน ACSM และ Thai RDA (อ้างอิง: กรมอนามัย กระทรวงสาธารณสุข)`,
      action: `แนะนำให้ทานโปรตีนให้ถึงเป้าหมาย ${minP}-${maxP} กรัมต่อวัน เพื่อรักษาสมดุลของกล้ามเนื้อและซ่อมแซมส่วนที่สึกหรอ`,
    };
  });
  const insightBodyType = computed(() => {
    const fat = parseFloat(tanita.value?.fat_pc);
    const bmi = parseFloat(profileBMI.value);
    const w = parseFloat(latestWeight.value);
    if (!fat || !bmi || isNaN(fat) || isNaN(bmi)) return null;
    return {
      title: "การวิเคราะห์องค์ประกอบร่างกาย",
      value: `ไขมัน ${fat}% / BMI ${bmi}`,
      desc: `การวิเคราะห์จากสัดส่วนไขมัน (${fat}%) เทียบกับดัชนีมวลกาย (${bmi}) แนะนำให้โฟกัสที่การปรับเปลี่ยนพฤติกรรมแทนการลดอาหาร (อ้างอิง: กรมอนามัย กระทรวงสาธารณสุข และมาตรฐาน Tanita)`,
      action: `แนะนำให้รักษามวลกล้ามเนื้อด้วยการออกกำลังกายแบบใช้แรงต้าน (Weight Training) ร่วมกับกิจกรรมเบาๆ เพื่อช่วยให้รูปร่างกระชับขึ้นอย่างยั่งยืน`,
    };
  });
  const insightVisceral = computed(() => {
    const vis = parseFloat(tanita.value?.visceral_fat);
    if (!vis || isNaN(vis)) return null;
    const isHigh = vis >= 10;
    return {
      title: "การดูแลไขมันช่องท้อง (Visceral Fat)",
      value: `ระดับ ${vis} ${isHigh ? "(ควรลดไขมัน)" : "(อยู่ในเกณฑ์ดี)"}`,
      desc: `ระดับไขมันที่เกาะอยู่ตามอวัยวะภายใน ค่าปัจจุบันอยู่ที่ ${vis} ${isHigh ? "ซึ่งอาจส่งผลต่อระบบการทำงานภายในร่างกายได้" : "ถือว่าอยู่ในเกณฑ์ที่น่าพอใจ"} (อ้างอิง: กรมอนามัย กระทรวงสาธารณสุข และมาตรฐาน Tanita)`,
      action: `การคุมปริมาณน้ำตาลและเน้นทานกากใยให้มากขึ้น จะช่วยรักษาระดับไขมันช่องท้องให้อยู่ในเกณฑ์ที่ปลอดภัย (เป้าหมายคือต่ำกว่าระดับ 9)`,
    };
  });
  const insightHydration = computed(() => {
    const tbwPc = parseFloat(tanita.value?.tbw_pc);
    if (isNaN(tbwPc) || tbwPc <= 0) return null;
    const rawGender = (user.value?.gender || "").toLowerCase();
    const isMale = rawGender.includes("ชาย") || rawGender.includes("male");
    const minStd = isMale ? 55 : 45;
    const maxStd = isMale ? 65 : 60;
    const isLow = tbwPc < minStd;
    const isHigh = tbwPc > maxStd;
    const status = isLow
      ? "ต่ำกว่าเกณฑ์"
      : isHigh
        ? "สูงกว่าเกณฑ์"
        : "อยู่ในเกณฑ์ดี";
    const gLabel = isMale ? "ผู้ชาย" : "ผู้หญิง";
    return {
      title: "ระดับน้ำในร่างกาย (Hydration)",
      value: `${tbwPc}% (${status})`,
      desc: `ปริมาณน้ำในร่างกาย ${tbwPc}% ${isLow ? `ต่ำกว่าเกณฑ์มาตรฐาน${gLabel} (${minStd}-${maxStd}%) อาจทำให้เหนื่อยง่ายและระบบเผาผลาญไม่เต็มประสิทธิภาพ` : isHigh ? `สูงกว่าเกณฑ์${gLabel} (${minStd}-${maxStd}%) เล็กน้อย` : `อยู่ในเกณฑ์มาตรฐาน${gLabel} (${minStd}-${maxStd}%) ดีมาก`} (อ้างอิง: มาตรฐาน Tanita และแนวทางเวชปฏิบัติ กรมอนามัย กระทรวงสาธารณสุข)`,
      action: isLow
        ? `แนะนำให้ดื่มน้ำสะอาด 2-3 ลิตร/วัน หลีกเลี่ยงน้ำหวานและแอลกอฮอล์ เพื่อเพิ่มระดับน้ำในร่างกายให้อยู่ในเกณฑ์ที่เหมาะสม`
        : `รักษาพฤติกรรมการดื่มน้ำที่ดีต่อไป ออกกำลังกายสม่ำเสมอเพื่อให้ระบบน้ำในร่างกายทำงานสมดุล`,
    };
  });
  const insightWeightGap = computed(() => {
    const idealW = parseFloat(tanita.value?.ideal_weight);
    const currentW = parseFloat(latestWeight.value);
    if (isNaN(idealW) || idealW <= 0 || isNaN(currentW) || currentW <= 0)
      return null;
    const gap = Math.round((currentW - idealW) * 10) / 10;
    const absGap = Math.abs(gap);
    const isOver = gap > 0;
    const weeksModerate = Math.round(absGap / 0.5);
    const weeksIntense = Math.round(absGap / 1);
    return {
      title: "น้ำหนักเป้าหมาย (Weight Gap)",
      value: isOver
        ? `เกินเป้าหมาย ${absGap} กก.`
        : gap < 0
          ? `ต่ำกว่าเป้าหมาย ${absGap} กก.`
          : "อยู่ในน้ำหนักที่เหมาะสม",
      desc: `น้ำหนักปัจจุบัน ${currentW} กก. / น้ำหนักที่เหมาะสมตาม ค่าองค์ประกอบของร่างกาย: ${idealW} กก. ${isOver ? `(ยังต้องลดอีก ${absGap} กก.)` : gap < 0 ? `(สามารถเพิ่มได้อีก ${absGap} กก.)` : "(สมบูรณ์แบบ!)"} (อ้างอิง: กรมอนามัย กระทรวงสาธารณสุข และมาตรฐาน Tanita)`,
      action: isOver
        ? `ด้วยการคุมแคลอรี่และออกกำลังกายสม่ำเสมอ คาดว่าจะถึงเป้าหมายภายใน ${weeksIntense}-${weeksModerate} สัปดาห์ (${Math.ceil(weeksIntense / 4)}-${Math.ceil(weeksModerate / 4)} เดือน)`
        : gap < 0
          ? `แนะนำให้เพิ่มมวลกล้ามเนื้อด้วย Resistance Training และทานโปรตีนให้เพียงพอ`
          : `รักษาน้ำหนักนี้ด้วยการรับประทานอาหารสมดุลและออกกำลังกายสม่ำเสมอ`,
    };
  });
  return {
    insightSweetSpot,
    insightProtein,
    insightBodyType,
    insightVisceral,
    insightHydration,
    insightWeightGap,
  };
}