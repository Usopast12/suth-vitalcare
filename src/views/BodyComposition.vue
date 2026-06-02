<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { authStore } from "../store/auth";
import { langStore } from "../store/lang";
import { Loader2, ChevronLeft, X as XIcon } from "lucide-vue-next";
import { swal } from "../lib/swal";
const router = useRouter();
const route = useRoute();
const isSubmitting = ref(false);
const isAnalyzing = ref(false);
const errorMsg = ref("");
// Pre-compute real age from birth_date
const computedAge = (() => {
  const bd = authStore.user?.birth_date;
  if (!bd) return "";
  const birth = new Date(bd);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : "";
})();
// === Upload & AI ===
const isDragging = ref(false);
const loadingMessages = computed(() => langStore.locale === 'th' ? [
  "กำลังอัปโหลดรูปภาพใบเสร็จ...",
  "AI กำลังสแกนตัวเลขบนหน้าจอ...",
  "กำลังวิเคราะห์ข้อมูลสุขภาพ...",
  "เกือบเสร็จแล้ว รออีกนิดนะ...",
  "กำลังจัดเรียงข้อมูลลงแบบฟอร์ม...",
] : [
  "Uploading receipt image...",
  "AI is scanning numbers on the screen...",
  "Analyzing health data...",
  "Almost done, please wait...",
  "Organizing data into the form...",
]);
const currentLoadingIndex = ref(0);
const currentLoadingMessage = computed(() => loadingMessages.value[currentLoadingIndex.value]);
let messageInterval: any = null;
const startLoadingMessages = () => {
  currentLoadingIndex.value = 0;
  messageInterval = setInterval(() => {
    currentLoadingIndex.value = (currentLoadingIndex.value + 1) % loadingMessages.value.length;
  }, 3500);
};
const stopLoadingMessages = () => {
  if (messageInterval) clearInterval(messageInterval);
};
const getBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
const handleFileSelect = async (file: File) => {
  if (!file || !file.type.startsWith("image/")) {
    swal.fire({
      icon: "error",
      title: langStore.locale === 'th' ? "กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น" : "Please upload an image file only",
      toast: true,
      position: "top-end",
      timer: 3000,
      showConfirmButton: false,
    });
    return;
  }

  isAnalyzing.value = true;
  startLoadingMessages();

  try {
    const imageBase64 = await getBase64(file);
    const response = await fetch("/api/ai/analyze-tanita", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-silent-errors": "1",
      },
      body: JSON.stringify({
        imageBase64,
        userId: authStore.user?.id || "anonymous",
      }),
    });

    const aiRaw = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 422) {
        swal.fire({
          icon: "error",
          title: langStore.locale === 'th' ? "รูปภาพไม่ถูกต้อง" : "Invalid Image",
          text:
            aiRaw?.error ||
            (langStore.locale === 'th' ? "รูปภาพที่ส่งมาไม่ใช่ใบตรวจสุขภาพ กรุณาลองใหม่อีกครั้ง หรือกรอกข้อมูลด้วยตนเอง" : "The uploaded image is not a health check receipt. Please try again or fill in manually."),
          confirmButtonText: langStore.locale === 'th' ? "ตกลง" : "OK",
          confirmButtonColor: "#356768",
        });
        return;
      }

      swal.fire({
        icon: "warning",
        title: langStore.locale === 'th' ? "AI ไม่สามารถวิเคราะห์ข้อมูลได้" : "AI couldn't analyze data",
        text: aiRaw?.error || (langStore.locale === 'th' ? "กรุณากรอกข้อมูลด้วยตนเอง" : "Please fill in manually"),
        confirmButtonText: langStore.locale === 'th' ? "ตกลง" : "OK",
        confirmButtonColor: "#356768",
      });
      return;
    }

    if (aiRaw?.ok === false && aiRaw?.code === "INVALID_IMAGE") {
      swal.fire({
        icon: "error",
        title: langStore.locale === 'th' ? "รูปภาพไม่ถูกต้อง" : "Invalid Image",
        text: aiRaw?.error || (langStore.locale === 'th' ? "รูปภาพไม่ถูกต้อง" : "Invalid Image"),
        confirmButtonText: langStore.locale === 'th' ? "ตกลง" : "OK",
        confirmButtonColor: "#356768",
      });
      return;
    }

    const flatData: Record<string, any> = {};
    const extractFlat = (obj: Record<string, any>) => {
      if (!obj || typeof obj !== "object") return;
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val !== null && typeof val === "object" && !Array.isArray(val)) {
          extractFlat(val);
        } else if (val !== null && val !== undefined) {
          flatData[key] = val;
        }
      }
    };

    extractFlat(aiRaw);

    let filledCount = 0;
    Object.keys(form.value).forEach((key) => {
      if (
        Object.prototype.hasOwnProperty.call(flatData, key) &&
        flatData[key] !== null &&
        flatData[key] !== undefined &&
        flatData[key] !== 0 &&
        flatData[key] !== ""
      ) {
        form.value[key] = flatData[key];
        filledCount++;
      }
    });

    swal.fire({
      icon: "success",
      title: langStore.locale === 'th' ? "AI วิเคราะห์ข้อมูลสำเร็จ!" : "AI analysis successful!",
      text: langStore.locale === 'th' ? `AI กรอกข้อมูลให้ ${filledCount} ช่อง แล้ว กรุณาตรวจสอบความถูกต้องก่อนบันทึก` : `AI filled in ${filledCount} fields. Please review before saving.`,
      toast: true,
      position: "top-end",
      timer: 5000,
      showConfirmButton: false,
    });
  } catch {
    swal.fire({
      icon: "warning",
      title: langStore.locale === 'th' ? "AI ไม่สามารถระบุข้อมูลจากรูปภาพ" : "AI couldn't identify data from image",
      text: langStore.locale === 'th' ? "กรุณากรอกข้อมูลด้วยตนเอง" : "Please fill in manually",
      confirmButtonText: langStore.locale === 'th' ? "ตกลง" : "OK",
      confirmButtonColor: "#356768",
    });
  } finally {
    isAnalyzing.value = false;
    stopLoadingMessages();
  }
};
const handleImageUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) handleFileSelect(file);
};
const handleDrop = (e: DragEvent) => {
  isDragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (file) handleFileSelect(file);
};
const handlePaste = (e: ClipboardEvent) => {
  const item = e.clipboardData?.items[0];
  if (item?.type.indexOf("image") !== -1) {
    const file = item?.getAsFile();
    if (file) handleFileSelect(file);
  }
};
// === Form ===
const inputMethod = ref("manual");
const form = ref<Record<string, any>>({
  body_type: "STANDARD",
  gender: authStore.user?.gender || "",
  age: computedAge,
  height: "",
  waist_cm: "",
  clothes_weight: "",
  weight: "",
  fat_pc: "",
  fat_mass: "",
  ffm: "",
  muscle_mass: "",
  tbw_mass: "",
  tbw_pc: "",
  bone_mass: "",
  bmr_kj: "",
  bmr_kcal: "",
  metabolic_age: "",
  visceral_fat: "",
  bmi: "",
  ideal_weight: "",
  obesity_degree: "",
  physique_rating: "",
});
const getDraftKey = () => {
  const eventId = route.query.fromEventId || "global";
  const session = route.query.session_label || "global";
  return `tanita_form_draft_${eventId}_${session}`;
};
onMounted(async () => {
  window.scrollTo(0, 0);
  // 1. Fetch from Bot Pending Result (Secure Way) - ป้องกันการดักจับข้อมูลผ่าน URL
  if (route.query.fromBot === "true" && authStore.user?.id) {
    try {
      const res = await fetch("/api/bot/pending-result", {
        headers: { "x-user-id": authStore.user.id },
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          Object.keys(form.value).forEach((key) => {
            if (
              data[key] !== undefined &&
              data[key] !== null &&
              data[key] !== ""
            ) {
              form.value[key] = data[key];
            }
          });
          // แจ้งเตือนให้ผู้ใช้ตรวจสอบความถูกต้อง
          swal.fire({
            icon: "info",
            title: langStore.locale === 'th' ? "ตรวจสอบความถูกต้อง" : "Please Verify Data",
            text: langStore.locale === 'th' ? "ระบบได้กรอกข้อมูลเบื้องต้นจาก AI ให้แล้ว กรุณาตรวจสอบความถูกต้องอีกครั้งก่อนบันทึกครับ" : "The system has filled in initial data from AI. Please verify its accuracy before saving.",
            confirmButtonText: langStore.locale === 'th' ? "รับทราบ" : "Acknowledge",
            confirmButtonColor: "#06C755",
          });
        }
      }
    } catch (err) {}
  }
  // 2. Load from draft (if no query params or after query params)
  const draft = localStorage.getItem(getDraftKey());
  if (draft) {
    try {
      const parsed = JSON.parse(draft);
      form.value = { ...form.value, ...parsed };
    } catch (e) {}
  }
});
watch(
  form,
  (newVal) => {
    localStorage.setItem(getDraftKey(), JSON.stringify(newVal));
  },
  { deep: true },
);
// === Submit ===
const handleSubmit = async () => {
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  errorMsg.value = "";
  try {
    const payload: Record<string, any> = {
      user_id: authStore.user?.id || null,
      recorded_at: new Date().toISOString(),
      submission_id: route.query.taskId || null,
    };
    Object.keys(form.value).forEach((key) => {
      const val = form.value[key];
      payload[key] =
        val === "" || val === null || val === undefined ? null : val;
    });
    if (route.query.fromEventId) payload.event_id = route.query.fromEventId;
    if (route.query.session_label)
      payload.session_label = route.query.session_label;
    const res = await fetch("/api/tanita", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": authStore.user?.id,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to submit body composition record");
    }
    localStorage.removeItem(getDraftKey());
    swal.fire({
      icon: "success",
      title: langStore.locale === 'th' ? "บันทึกข้อมูลเรียบร้อยแล้ว" : "Data saved successfully",
      toast: true,
      position: "top-end",
      timer: 3000,
      showConfirmButton: false,
    });
    const fromEventId = route.query.fromEventId;
    if (route.query.taskId) {
      router.push("/missions");
    } else if (fromEventId) {
      router.push({
        path: `/activities/${fromEventId}`,
        query: { success: "health_updated" },
      });
    } else {
      router.push("/");
    }
  } catch (err: any) {
    swal.fire({
      icon: "error",
      title: langStore.locale === 'th' ? "เกิดข้อผิดพลาด" : "An error occurred",
      text: err.message,
    });
  } finally {
    isSubmitting.value = false;
  }
};
const handleBack = () => {
  router.back();
};
</script>
<template>
  <div class="body-comp-wrapper">
    <div class="bg-shape shape1"></div>
    <div class="bg-shape shape2"></div>
    <div class="main-container">
      <div class="header-top">
        <button type="button" class="back-icon-btn" @click="handleBack">
          <ChevronLeft :size="28" />
        </button>
      </div>
      <div class="header-section">
        <h1>{{ langStore.locale === 'th' ? 'บันทึกองค์ประกอบร่างกาย' : 'Body Composition Record' }}</h1>
        <p v-if="route.query.session_label" class="session-tag">
          {{ langStore.locale === 'th' ? 'สำหรับช่วง:' : 'For Session:' }} <strong>{{ route.query.session_label }}</strong>
        </p>
        <p class="subtitle">
          {{ langStore.locale === 'th' ? 'กรุณาระบุข้อมูลสุขภาพของคุณให้ครบถ้วนเพื่อความแม่นยำในการวิเคราะห์' : 'Please provide complete health data for accurate analysis.' }}
        </p>
      </div>
      <form @submit.prevent="handleSubmit" class="form-content fade-in">
        <!-- Mode Selector -->
        <div class="mode-selector">
          <label
            class="mode-card"
            :class="{ active: inputMethod === 'manual' }"
          >
            <input type="radio" value="manual" v-model="inputMethod" />
            <div class="mode-content">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <span>{{ langStore.locale === 'th' ? 'กรอกข้อมูลเอง' : 'Manual Entry' }}</span>
            </div>
          </label>
          <label class="mode-card" :class="{ active: inputMethod === 'ai' }">
            <input type="radio" value="ai" v-model="inputMethod" />
            <div class="mode-content">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <span>{{ langStore.locale === 'th' ? 'AI ช่วยอ่านจากรูป' : 'AI Scan from Image' }}</span>
            </div>
          </label>
        </div>
        <!-- AI Upload Box -->
        <transition name="slide-fade">
          <div v-if="inputMethod === 'ai'" class="ai-upload-box">
            <div v-if="isAnalyzing" class="ai-loading">
              <div class="spinner"></div>
              <p class="loading-msg">
                {{ currentLoadingMessage }}
              </p>
            </div>
            <div v-else>
              <input
                type="file"
                accept="image/*"
                id="ai-upload"
                @change="handleImageUpload"
                class="hidden"
              />
              <label
                for="ai-upload"
                class="upload-trigger"
                :class="{ dragging: isDragging }"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
                @paste="handlePaste"
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                <span class="upload-main-text"
                  >{{ langStore.locale === 'th' ? 'ถ่ายภาพ, อัปโหลด หรือวางรูป (Paste)' : 'Take Photo, Upload, or Paste Image' }}</span
                >
                <span class="upload-sub-text"
                  >{{ langStore.locale === 'th' ? 'AI จะช่วยกรอกข้อมูลจากใบเสร็จ Tanita ให้อัตโนมัติ' : 'AI will automatically fill data from the Tanita receipt.' }}</span
                >
              </label>
            </div>
          </div>
        </transition>
        <!-- Form Fields -->
        <div class="premium-card">
          <h3 class="section-title">{{ langStore.locale === 'th' ? 'ข้อมูลภาพรวม' : 'Overview' }}</h3>
          <div class="grid-3 mb-6">
            <div class="premium-input-group">
              <input
                type="number"
                v-model="form.height"
                placeholder=" "
                required
              />
              <label>{{ langStore.locale === 'th' ? 'ส่วนสูง (cm) *' : 'Height (cm) *' }}</label>
            </div>
            <div class="premium-input-group">
              <input
                type="number"
                step="0.1"
                v-model="form.weight"
                placeholder=" "
                required
              />
              <label>{{ langStore.locale === 'th' ? 'น้ำหนัก (kg) *' : 'Weight (kg) *' }}</label>
            </div>
            <div class="premium-input-group">
              <input type="text" v-model="form.body_type" placeholder=" " />
              <label>{{ langStore.locale === 'th' ? 'รูปร่าง (Body Type)' : 'Body Type' }}</label>
            </div>
          </div>
          <div class="grid-2 mb-6">
            <div class="premium-input-group">
              <input type="number" v-model="form.age" placeholder=" " />
              <label
                >{{ langStore.locale === 'th' ? 'อายุ (ปี)' : 'Age (years)' }}
                <span v-if="computedAge" class="text-xs text-gray-400"
                  >{{ langStore.locale === 'th' ? '(คำนวณจากวันเกิด)' : '(Calculated from birthday)' }}</span
                ></label
              >
            </div>
            <div class="premium-input-group">
              <input type="text" v-model="form.gender" placeholder=" " />
              <label>{{ langStore.locale === 'th' ? 'เพศ' : 'Gender' }}</label>
            </div>
          </div>
          <h3 class="section-title mt-4">
            {{ langStore.locale === 'th' ? 'องค์ประกอบร่างกาย (Body Composition)' : 'Body Composition' }}
          </h3>
          <div class="grid-2 mb-6">
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.fat_pc"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'ไขมัน (%)' : 'Fat (%)' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.fat_mass"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'มวลไขมัน (kg)' : 'Fat Mass (kg)' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.ffm"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'มวลไร้ไขมัน FFM (kg)' : 'Fat Free Mass (kg)' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.muscle_mass"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'มวลกล้ามเนื้อ (kg)' : 'Muscle Mass (kg)' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.tbw_mass"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'มวลน้ำ (kg)' : 'TBW Mass (kg)' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.tbw_pc"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'น้ำในร่างกาย (%)' : 'TBW (%)' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.bone_mass"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'มวลกระดูก (kg)' : 'Bone Mass (kg)' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.clothes_weight"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'น้ำหนักเสื้อผ้า (kg)' : 'Clothes Weight (kg)' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.waist_cm"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'รอบเอว (cm)' : 'Waist (cm)' }}</label>
            </div>
          </div>
          <h3 class="section-title mt-4">{{ langStore.locale === 'th' ? 'ระบบเผาผลาญ & ดัชนีสุขภาพ' : 'Metabolism & Health Index' }}</h3>
          <div class="grid-2">
            <div class="premium-input-group small">
              <input
                type="number"
                v-model="form.bmr_kj"
                placeholder=" "
              /><label>BMR (kJ)</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                v-model="form.bmr_kcal"
                placeholder=" "
              /><label>BMR (kcal)</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                v-model="form.metabolic_age"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'อายุเมตาบอลิก (ปี)' : 'Metabolic Age (years)' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.visceral_fat"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'ไขมันช่องท้อง' : 'Visceral Fat' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.bmi"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'ค่าดัชนีมวลกาย (BMI)' : 'BMI' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.ideal_weight"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'น้ำหนักเหมาะสม (kg)' : 'Ideal Weight (kg)' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="number"
                step="0.1"
                v-model="form.obesity_degree"
                placeholder=" "
              /><label>{{ langStore.locale === 'th' ? 'ระดับความอ้วน (%)' : 'Obesity Degree (%)' }}</label>
            </div>
            <div class="premium-input-group small">
              <input
                type="text"
                v-model="form.physique_rating"
                placeholder=" "
              /><label>Physique Rating</label>
            </div>
          </div>
        </div>
        <div class="actions mt-6">
          <button
            type="submit"
            class="btn-primary-gradient"
            :disabled="isSubmitting || isAnalyzing"
          >
            <Loader2 v-if="isSubmitting" class="spin" />
            <span>{{
              isSubmitting ? (langStore.locale === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (langStore.locale === 'th' ? 'ยืนยันบันทึกข้อมูล' : 'Confirm Save')
            }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
<style scoped>
.body-comp-wrapper {
  --primary-color: #f05a23;
  --primary-light: #fff5f2;
  --accent-color: #356768;
  --accent-light: #f0f7f7;
  --text-main: #1e293b;
  --text-muted: #64748b;
  --border-color: #e2e8f0;
  --surface-color: #f8fafc;
  min-height: 100vh;
  background-color: var(--surface-color);
  font-family: "Sarabun", sans-serif;
  position: relative;
  overflow-x: hidden;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 40px 20px;
}
.bg-shape {
  position: fixed;
  border-radius: 50%;
  filter: blur(80px);
  z-index: 0;
  opacity: 0.4;
}
.shape1 {
  width: 400px;
  height: 400px;
  background: var(--primary-light);
  top: -100px;
  right: -100px;
}
.shape2 {
  width: 300px;
  height: 300px;
  background: var(--accent-light);
  bottom: -50px;
  left: -50px;
}
.main-container {
  width: 100%;
  max-width: 650px;
  background: #ffffff;
  border-radius: 30px;
  padding: 40px;
  position: relative;
  z-index: 1;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.8);
}
.header-top {
  margin-bottom: 24px;
}
.back-icon-btn {
  background: #f1f5f9;
  border: none;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}
.back-icon-btn:hover {
  background: #e2e8f0;
  color: var(--text-main);
}
.header-section {
  margin-bottom: 32px;
}
.header-section h1 {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-main);
  margin-bottom: 8px;
  letter-spacing: -0.02em;
}
.subtitle {
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1.5;
}
.session-tag {
  display: inline-block;
  background: var(--accent-light);
  color: var(--accent-color);
  padding: 6px 14px;
  border-radius: 99px;
  font-size: 14px;
  margin-bottom: 12px;
  border: 1px solid rgba(53, 103, 104, 0.1);
}
.form-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.mode-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.mode-card {
  position: relative;
  cursor: pointer;
}
.mode-card input {
  display: none;
}
.mode-content {
  padding: 20px;
  border: 2px solid var(--border-color);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #fff;
  color: var(--text-muted);
  transition: all 0.3s;
  font-weight: 600;
}
.mode-card.active .mode-content {
  border-color: var(--primary-color);
  background: var(--primary-light);
  color: var(--primary-color);
  box-shadow: 0 8px 20px rgba(240, 90, 35, 0.1);
}
.ai-upload-box {
  margin-top: 8px;
}
.upload-trigger {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  border: 2px dashed rgba(53, 103, 104, 0.3);
  border-radius: 16px;
  background: var(--accent-light);
  color: var(--accent-color);
  cursor: pointer;
  transition: all 0.3s;
}
.upload-trigger:hover,
.upload-trigger.dragging {
  background: rgba(53, 103, 104, 0.1);
  border-color: var(--accent-color);
  transform: scale(1.01);
}
.upload-main-text {
  font-size: 16px;
  font-weight: 600;
  margin-top: 12px;
  text-align: center;
}
.upload-sub-text {
  font-size: 13px;
  margin-top: 4px;
  opacity: 0.8;
  text-align: center;
}
.ai-loading {
  text-align: center;
  padding: 40px;
  color: var(--accent-color);
}
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}
@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
.loading-msg {
  font-weight: 600;
  font-size: 15px;
}
.premium-card {
  padding: 0;
  background: transparent;
}
.section-title {
  font-size: 16px;
  color: var(--primary-color);
  margin: 0 0 20px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--primary-light);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}
.premium-input-group {
  position: relative;
  background: #fff;
  border-radius: 12px;
}
.premium-input-group input {
  width: 100%;
  padding: 24px 16px 10px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-size: 16px;
  font-family: inherit;
  color: var(--text-main);
  background: transparent;
  transition: all 0.2s;
  outline: none;
}
.premium-input-group.small input {
  padding: 20px 12px 6px;
  font-size: 15px;
}
.premium-input-group label {
  position: absolute;
  top: 18px;
  left: 16px;
  font-size: 15px;
  color: var(--text-muted);
  transition: all 0.2s;
  pointer-events: none;
}
.premium-input-group.small label {
  left: 12px;
  top: 14px;
  font-size: 14px;
}
.premium-input-group input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 4px 12px rgba(240, 90, 35, 0.05);
}
.premium-input-group input:focus ~ label,
.premium-input-group input:not(:placeholder-shown) ~ label {
  top: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary-color);
}
.btn-primary-gradient {
  width: 100%;
  padding: 18px;
  font-size: 18px;
  border-radius: 16px;
  background: #06c755;
  color: white;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 10px 25px rgba(6, 199, 85, 0.2);
  transition: all 0.3s;
}
.btn-primary-gradient:hover:not(:disabled) {
  background: #05b34c;
  box-shadow: 0 15px 30px rgba(6, 199, 85, 0.3);
  transform: translateY(-2px);
}

.btn-primary-gradient:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.spin {
  animation: spin 1s linear infinite;
}
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(10px);
  opacity: 0;
}
.fade-in {
  animation: fadeIn 0.6s ease-out forwards;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 600px) {
  .body-comp-wrapper {
    padding: 0;
    background-color: #fff;
  }
  .main-container {
    padding: 24px 20px 100px;
    border-radius: 0;
    box-shadow: none;
    max-width: none;
    min-height: 100vh;
  }
  .grid-2,
  .grid-3 {
    grid-template-columns: 1fr;
  }
  .header-section h1 {
    font-size: 24px;
  }
  .bg-shape {
    display: none;
  }
}
</style>
