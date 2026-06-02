<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from 'vue-router';
import { 
  CheckCircle2, ArrowLeft, ChevronRight, AlertTriangle, 
  TrendingUp, Award, ThumbsUp, Calendar, History, ClipboardCheck, 
  ChevronLeft, LayoutGrid, Check, X, Target, ChevronDown, FileText,
  Info, Lock, ArrowRight, Lightbulb, ShieldAlert, ExternalLink, ShieldCheck,
  Loader2
} from "lucide-vue-next";
import { authStore } from '../store/auth';
import { useSWR } from '../composables/useSWR';
import { uiStore } from '../store/ui';
import { langStore } from '../store/lang';
import Swal from 'sweetalert2';
const route = useRoute();
const router = useRouter();
const isSubmitting = ref(false);
// Activity assessment context (from EventDetail.vue redirect)
const activityEventId = computed(() => route.query.eventId ? Number(route.query.eventId) : null);
const activityTestType = computed(() => (route.query.type as 'pre_test' | 'post_test') || null);
interface Option { text: string; score: number; shortLabel: string }
interface Question { id: string; text: string; isList?: boolean; options: Option[] }
interface ScoringRange { min: number; max: number; level: string; desc: string; advice: string }
interface Section {
  id: string; label: string; shortLabel: string;
  questions: Question[];
  maxScore: number;
  scoringRanges: ScoringRange[];
  layout: 'grid' | 'list';
  gridHeaders?: string[];
}
// ─── ข้อมูลแบบประเมินอิงตามไฟล์ PDF ───
const sections: Section[] = [
  {
    id: "food", label: "1. พฤติกรรมการบริโภคอาหาร", shortLabel: "อาหาร",
    maxScore: 40,
    layout: 'grid',
    gridHeaders: ["ทุกวัน", "5-6 วัน", "3-4 วัน", "1-2 วัน", "ไม่ปฏิบัติ"],
    scoringRanges: [
      { min: 8,  max: 15, level: "ควรปรับปรุง", desc: "มีพฤติกรรมการบริโภคอาหารไม่ถูกต้อง", advice: "ควรเริ่มปรับลดอาหารหวาน มัน เค็ม และเพิ่มผักผลไม้ให้ได้วันละ 5 กำมือ" },
      { min: 16, max: 23, level: "พอใช้", desc: "มีพฤติกรรมการบริโภคอาหารได้ถูกต้องเป็นส่วนใหญ่ แต่ไม่สม่ำเสมอ", advice: "ดีแล้ว แต่ลองตั้งเป้าให้ทำได้สม่ำเสมอขึ้น โดยเฉพาะวันหยุด" },
      { min: 24, max: 31, level: "ดี", desc: "มีพฤติกรรมการบริโภคอาหารถูกต้องเป็นส่วนใหญ่ อย่างสม่ำเสมอ", advice: "รักษาระดับนี้ไว้ และลองเพิ่มความหลากหลายของผักผลไม้สีต่าง ๆ" },
      { min: 32, max: 40, level: "ดีมาก", desc: "มีพฤติกรรมการบริโภคอาหารได้อย่างถูกต้อง และสม่ำเสมอ", advice: "ยอดเยี่ยม! คุณดูแลอาหารการกินได้อย่างถูกต้องและสม่ำเสมอ" },
    ],
    questions: [
      { id: "f1", text: "1) ท่านกินอาหารที่ปรุงสุกและสะอาด บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ] },
      { id: "f2", text: "2) ท่านกินอาหารครบ 5 หมู่อย่างหลากหลาย ในสัดส่วนที่เหมาะสม โดยใน 1 มื้อ มีข้าว-แป้ง เนื้อสัตว์ ไขมัน ผักและผลไม้ บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ] },
      { id: "f3", text: "3) ท่านกินผักและผลไม้ รวมกันอย่างน้อยวันละ 5 กำมือ (400 กรัม) บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ] },
      { id: "f4", text: "4) ท่านกินขนมหวาน เช่น ขนมเค้ก ช็อกโกแลต ไอศกรีม เป็นต้น หรือดื่มเครื่องดื่มรสหวาน (ผสมน้ำตาล น้ำเชื่อม นมข้น) บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 1 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 2 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 5 },
      ] },
      { id: "f5", text: "5) ท่านกินอาหารมัน เช่น ข้าวขาหมู ข้าวมันไก่ แกงกะทิ เป็นต้น บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 1 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 2 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 5 },
      ] },
      { id: "f6", text: "6) ท่านกินอาหารเค็มหรือปรุงรสเค็ม เช่น ไส้กรอก ขนมกรุบกรอบ เป็นต้น บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 1 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 2 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 5 },
      ] },
      { id: "f7", text: "7) ท่านกินอาหารแปรรูป อาหารทอด ปิ้งย่าง อาหารใส่สี เช่น ไก่ทอด หมูทอด เนื้อย่างรมควัน เป็นต้น บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 1 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 2 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 5 },
      ] },
      { id: "f8", text: "8) ท่านดื่มน้ำสะอาด วันละ 6 - 8 แก้ว บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ] },
    ],
  },
  {
    id: "exercise", label: "2. พฤติกรรมการออกกำลังกาย", shortLabel: "ออกกำลังกาย",
    maxScore: 11,
    layout: 'grid',
    gridHeaders: ["ทุกวัน", "5-6 วัน", "3-4 วัน", "1-2 วัน", "ไม่ปฏิบัติ"],
    scoringRanges: [
      { min: 3,  max: 4,  level: "ควรปรับปรุง", desc: "มีพฤติกรรมการออกกำลังกายไม่เพียงพอ", advice: "ลองเริ่มจากการลุกเดินทุก 2 ชั่วโมง แล้วค่อย ๆ เพิ่มเป็นออกกำลังกาย 30 นาทีต่อวัน" },
      { min: 5,  max: 6,  level: "พอใช้", desc: "มีพฤติกรรมการออกกำลังกายเพียงพอเป็นส่วนใหญ่ แต่ไม่สม่ำเสมอ", advice: "ดีแล้ว ลองตั้งเวลาออกกำลังกายให้แน่นอน เช่น ทุกเช้าหลังตื่นนอน" },
      { min: 7,  max: 8,  level: "ดี", desc: "มีพฤติกรรมการออกกำลังกายเพียงพอเป็นส่วนใหญ่ อย่างสม่ำเสมอ", advice: "รักษาระดับนี้ไว้ และเพิ่มการฝึกความแข็งแรงกล้ามเนื้อให้ครบ 2–3 วันต่อสัปดาห์" },
      { min: 9,  max: 13, level: "ดีมาก", desc: "มีพฤติกรรมการออกกำลังกายได้อย่างเพียงพอ และสม่ำเสมอ", advice: "ยอดเยี่ยม! คุณมีวินัยการออกกำลังกายที่ดีมาก" },
    ],
    questions: [
      { id: "e1", text: "1) ท่านลุกขยับร่างกายทุก 2 ชั่วโมง ระหว่างทำงานหรือระหว่างวัน บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ] },
      { id: "e2", text: "2) ท่านออกกำลังกายจนรู้สึกหัวใจเต้นเร็วขึ้น หรือหายใจแรงขึ้นกว่าปกติ สะสมวันละ 30 นาที บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 4 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ]},
      { id: "e3", text: "3) ท่านฝึกสร้างความเข็งแรงของกล้ามเนื้อ เช่น ดันพื้น ดันกำแพง ลุกนั่ง เป็นต้น บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 2 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 2 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 2 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ]},
    ],
  },
  {
    id: "emotion", label: "3. พฤติกรรมการจัดการอารมณ์", shortLabel: "อารมณ์",
    maxScore: 30,
    layout: 'grid',
    gridHeaders: ["ทุกวัน", "5-6 วัน", "3-4 วัน", "1-2 วัน", "ไม่ปฏิบัติ"],
    scoringRanges: [
      { min: 6,  max: 11, level: "ควรปรับปรุง", desc: "มีพฤติกรรมการจัดการอารมณ์ตนเองที่ไม่ถูกต้อง", advice: "ลองเริ่มจากการสังเกตอารมณ์ตนเองแต่ละวัน และหากิจกรรมผ่อนคลายที่ชอบ 1 อย่าง" },
      { min: 12, max: 17, level: "พอใช้", desc: "มีพฤติกรรมการจัดการอารมณ์ตนเองได้ถูกต้อง เป็นส่วนใหญ่ แต่ไม่สม่ำเสมอ", advice: "ดีแล้ว ลองจัดตารางเวลาส่วนตัวและพักผ่อนให้เพียงพออย่างสม่ำเสมอ" },
      { min: 18, max: 23, level: "ดี", desc: "มีพฤติกรรมการจัดการอารมณ์ตนเองได้ถูกต้อง เป็นส่วนใหญ่ อย่างสม่ำเสมอ", advice: "รักษาระดับนี้ไว้ และอาจลองฝึกสติหรือการหายใจเพื่อเสริมความแข็งแกร่งทางจิต" },
      { min: 24, max: 30, level: "ดีมาก", desc: "มีพฤติกรรมการจัดการอารมณ์ตนเองได้อย่างถูกต้อง และสม่ำเสมอ", advice: "ยอดเยี่ยม! สุขภาพจิตของคุณอยู่ในระดับที่ดีมาก" },
    ],
    questions: [
      { id: "m1", text: "1) ท่านสังเกตอารมณ์ หรือความรู้สึกของตนเองในแต่ละวันบ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ] },
      { id: "m2", text: "2) ท่านมีวิธีผ่อนคลาย เมื่อรู้สึกเครียด หรือไม่สบายใจ เช่น เล่นกีฬา ฟังเพลง ดูภาพยนตร์ เป็นต้น บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ] },
      { id: "m3", text: "3) ท่านทำกิจกรรมที่ทำให้จิตใจร่าเริงอยู่เสมอ เช่น พูดคุย กับเพื่อน ทำงานอดิเรก เลี้ยงสัตว์ ร้องเพลง เป็นต้น บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ] },
      { id: "m4", text: "4) ท่านสามารถจัดเวลาให้เพียงพอในเรื่อง การทำงาน ชีวิตส่วนตัว และครอบครัว บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ] },
      { id: "m5", text: "5) ท่านนอนหลับ วันละ 7 - 8 ชั่วโมง บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 5 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 4 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ] },
      { id: "m6", text: "6) เมื่อท่านเจอสถานการณ์ที่ก่อให้เกิดความเครียด เช่น การทะเลาะเบาะแว้ง หรือขัดแย้งกัน ท่านสามารถ หลีกเลี่ยงได้ บ่อยเพียงใด", isList: true, options: [
        { text: "ทุกครั้ง หรือไม่เคยเจอสถานการณ์", shortLabel: "ทุกครั้ง/ไม่เคย", score: 5 },
        { text: "บ่อยครั้ง", shortLabel: "บ่อยครั้ง", score: 4 },
        { text: "บางครั้ง", shortLabel: "บางครั้ง", score: 3 },
        { text: "นานๆ ครั้ง", shortLabel: "นานๆ ครั้ง", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ] },
    ],
  },
  {
    id: "smoke", label: "4. พฤติกรรมการไม่สูบบุหรี่", shortLabel: "บุหรี่",
    maxScore: 12,
    layout: 'list',
    scoringRanges: [
      { min: 3,  max: 4,  level: "ควรปรับปรุง", desc: "มีพฤติกรรมไม่ถูกต้องในการป้องกันตนเอง ไม่สูบบุหรี่ บุหรี่ไฟฟ้าหรือได้รับควันบุหรี่", advice: "หากสูบอยู่ ขอแนะนำให้ปรึกษาแพทย์เพื่อเลิกบุหรี่ และหลีกเลี่ยงกลุ่มคนที่สูบ" },
      { min: 5,  max: 6,  level: "พอใช้", desc: "มีพฤติกรรมที่ถูกต้องในการป้องกันตนเองไม่สูบบุหรี่ บุหรี่ไฟฟ้า หรือได้รับควันบุหรี่เป็นส่วนน้อย", advice: "ดีแล้ว พยายามหลีกเลี่ยงพื้นที่ที่มีควันบุหรี่ให้ได้มากขึ้น" },
      { min: 7,  max: 9,  level: "ดี", desc: "มีพฤติกรรมที่ถูกต้องในการป้องกันตนเองไม่สูบบุหรี่ บุหรี่ไฟฟ้า หรือได้รับควันบุหรี่เป็นส่วนใหญ่", advice: "รักษาระดับนี้ไว้ และสนับสนุนคนรอบข้างให้เลิกบุหรี่ด้วย" },
      { min: 10, max: 12, level: "ดีมาก", desc: "มีพฤติกรรมที่ถูกต้องในการป้องกันตนเองไม่สูบบุหรี่ บุหรี่ไฟฟ้า หรือได้รับควันบุหรี่สม่ำเสมอ", advice: "ยอดเยี่ยม! คุณดูแลตนเองได้ดีมากในด้านนี้" },
    ],
    questions: [
      { id: "s1", text: "1) ท่านสูบบุหรี่ หรือ บุหรี่ไฟฟ้า หรือไม่", options: [
        { text: "สูบ", shortLabel: "สูบ", score: 1 },
        { text: "ไม่สูบ", shortLabel: "ไม่สูบ", score: 5 },
      ]},
      { id: "s2", text: "2) ในช่วง 1 สัปดาห์ที่ผ่านมา ท่านอยู่ใกล้ชิดหรือรวมกลุ่มกับผู้ที่สูบบุหรี่ หรือบุหรี่ไฟฟ้า บ่อยเพียงใด", options: [
        { text: "ทุกวัน", shortLabel: "ทุกวัน", score: 1 },
        { text: "5-6 วัน", shortLabel: "5-6 วัน", score: 2 },
        { text: "3-4 วัน", shortLabel: "3-4 วัน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 5 },
      ]},
    ],
  },
  {
    id: "alcohol", label: "5. พฤติกรรมการไม่ดื่มเครื่องดื่มที่มีแอลกอฮอล์", shortLabel: "สุรา",
    maxScore: 15,
    layout: 'list',
    scoringRanges: [
      { min: 3,  max: 5,  level: "ควรปรับปรุง", desc: "มีพฤติกรรมไม่ถูกต้องในการป้องกันตนเอง ไม่ดื่มสุรา หรือเครื่องดื่มที่มีแอลกอฮอล์", advice: "ขอแนะนำให้ลดปริมาณและความถี่ในการดื่ม และฝึกปฏิเสธเมื่อถูกชักชวน" },
      { min: 6,  max: 8,  level: "พอใช้", desc: "มีพฤติกรรมที่ถูกต้องในการป้องกันตนเองไม่ดื่มสุรา หรือเครื่องดื่มที่มีแอลกอฮอล์เป็นส่วนน้อย", advice: "ดีแล้ว ลองตั้งกติกาให้ตนเองในการดื่มในโอกาสพิเศษเท่านั้น" },
      { min: 9,  max: 11, level: "ดี", desc: "มีพฤติกรรมที่ถูกต้องในการป้องกันตนเองไม่ดื่มสุรา หรือเครื่องดื่มที่มีแอลกอฮอล์เป็นส่วนใหญ่", advice: "รักษาระดับนี้ไว้ และช่วยสนับสนุนคนรอบข้างให้ลดการดื่มด้วย" },
      { min: 12, max: 15, level: "ดีมาก", desc: "มีพฤติกรรมที่ถูกต้องในการป้องกันตนเองไม่ดื่มสุรา หรือเครื่องดื่มที่มีแอลกอฮอล์อย่างสม่ำเสมอ", advice: "ยอดเยี่ยม! คุณดูแลตนเองได้ดีมากในด้านนี้" },
    ],
    questions: [
      { id: "a1", text: "1) ในช่วง 1 เดือนที่ผ่านมา ท่านดื่มสุราหรือเครื่องดื่มแอลกอฮอร์ บ่อยเพียงใด", options: [
        { text: "4 ครั้งขึ้นไปต่อสัปดาห์", shortLabel: "4+ ครั้ง/สัปดาห์", score: 1 },
        { text: "2-3 ครั้งต่อสัปดาห์", shortLabel: "2-3 ครั้ง/สัปดาห์", score: 2 },
        { text: "2-4 ครั้งต่อเดือน", shortLabel: "2-4 ครั้ง/เดือน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
        { text: "ไม่ดื่ม", shortLabel: "ไม่ดื่ม", score: 5 },
      ]},
      { id: "a2", text: "2) ในช่วง 1 เดือนที่ผ่านมา ท่านอยู่ใกล้ชิดหรือรวมกลุ่มกับผู้ที่ดื่มสุรา หรือเครื่องดื่มแอลกอฮอล์ บ่อยเพียงใด", options: [
        { text: "4 ครั้งขึ้นไปต่อสัปดาห์", shortLabel: "4+ ครั้ง/สัปดาห์", score: 1 },
        { text: "2-3 ครั้งต่อสัปดาห์", shortLabel: "2-3 ครั้ง/สัปดาห์", score: 2 },
        { text: "2-4 ครั้งต่อเดือน", shortLabel: "2-4 ครั้ง/เดือน", score: 3 },
        { text: "1-2 วัน", shortLabel: "1-2 วัน", score: 4 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 5 },
      ]},
      { id: "a3", text: "3) ท่านปฏิเสธเมื่อถูกชักชวนให้ดื่มสุราหรือเครื่องดื่มที่มีแอลกอฮอล์จากเพื่อน ครอบครัว และบุคคลใกล้ชิดบ่อยเพียงใด", options: [
        { text: "ทุกครั้ง หรือไม่เคยถูกชักชวน", shortLabel: "ทุกครั้ง", score: 5 },
        { text: "บ่อยครั้ง", shortLabel: "บ่อยครั้ง", score: 4 },
        { text: "บางครั้ง", shortLabel: "บางครั้ง", score: 3 },
        { text: "นานๆครั้ง", shortLabel: "นานๆครั้ง", score: 2 },
        { text: "ไม่ปฏิบัติ", shortLabel: "ไม่ปฏิบัติ", score: 1 },
      ]},
    ],
  },
];
// ─── PDPA Consent ─────────────────────────────────────────────────────────────
const acceptAll = ref(false);
const acceptTerms = ref(false);
const acceptPrivacy = ref(false);
const pdpaAccepted = computed(() => acceptTerms.value && acceptPrivacy.value);
watch(acceptAll, (val) => {
  acceptTerms.value = val;
  acceptPrivacy.value = val;
});
watch([acceptTerms, acceptPrivacy], ([terms, privacy]) => {
  acceptAll.value = terms && privacy;
});
const showPrivacyPolicy = (e?: Event) => {
  if (e) e.stopPropagation();
  const w = window.innerWidth;
  Swal.fire({
    title: 'นโยบายความเป็นส่วนตัว (PDPA)',
    width: w < 480 ? '95vw' : w < 768 ? '90vw' : '560px',
    html: `
      <div style="text-align:left;font-size:${w < 480 ? '12px' : w < 768 ? '13px' : '15px'};line-height:1.7;color:#475569;font-family:'Kanit',sans-serif;max-height:55vh;overflow-y:auto;padding-right:4px;">
        <p style="margin-bottom:10px;">เพื่อการประเมินสุขภาพที่แม่นยำ ระบบมีความจำเป็นต้องเก็บรวบรวมข้อมูลดังต่อไปนี้:</p>
        <ul style="margin:10px 0;padding-left:20px;list-style-type:disc;">
          <li style="margin-bottom:6px;"><b>ข้อมูลสุขภาพและพฤติกรรม:</b> ประวัติการกิน การออกกำลังกาย และพฤติกรรมเสี่ยง</li>
          <li style="margin-bottom:6px;"><b>ข้อมูลส่วนบุคคล:</b> น้ำหนัก ส่วนสูง เพศ และอายุ</li>
        </ul>
        <p>ข้อมูลทั้งหมดจะถูกเก็บเป็นความลับสูงสุด และใช้เพื่อวิเคราะห์สุขภาพและให้คำแนะนำส่วนบุคคลแก่ท่านเท่านั้น ไม่มีการนำไปเผยแพร่ต่อสาธารณะ</p>
      </div>
    `,
    icon: 'info',
    confirmButtonText: 'รับทราบและยอมรับ',
    confirmButtonColor: '#F05A23',
  }).then((result) => {
    if (result.isConfirmed) acceptPrivacy.value = true;
  });
};
const showTerms = (e?: Event) => {
  if (e) e.stopPropagation();
  const w = window.innerWidth;
  Swal.fire({
    title: 'เงื่อนไขการให้บริการ',
    width: w < 480 ? '95vw' : w < 768 ? '90vw' : '560px',
    html: `
      <div style="text-align:left;font-size:${w < 480 ? '12px' : w < 768 ? '13px' : '15px'};line-height:1.7;color:#475569;font-family:'Kanit',sans-serif;max-height:55vh;overflow-y:auto;padding-right:4px;">
        <p style="margin-bottom:8px;">1. ข้อมูลในแบบประเมินนี้จะถูกนำไปใช้ประเมินพฤติกรรมสุขภาพเบื้องต้นเท่านั้น <b>ไม่ใช่การวินิจฉัยโรคทางการแพทย์</b></p>
        <p style="margin-bottom:8px;">2. ผู้ใช้ตกลงที่จะให้ข้อมูลตามความเป็นจริง เพื่อให้ระบบสามารถประมวลผลคำแนะนำที่แม่นยำที่สุด</p>
        <p style="margin-bottom:8px;">3. ระบบขอสงวนสิทธิ์ในการใช้ข้อมูลรวม (แบบไม่ระบุตัวตน) เพื่อการวิจัยและพัฒนา</p>
      </div>
    `,
    icon: 'info',
    confirmButtonText: 'รับทราบและยอมรับ',
    confirmButtonColor: '#F05A23',
  }).then((result) => {
    if (result.isConfirmed) acceptTerms.value = true;
  });
};
// ─── SWR / History ────────────────────────────────────────────────────────────
const { 
  data: historyData, 
  isValidating: historyLoading,
  mutate: revalidateHistory 
} = useSWR<any[]>(
  () => authStore.user ? `/api/health/my-assessments/${authStore.user.id}` : null,
  { showErrorToast: false }
);
const localHistoryData = ref<any[]>([]);
const updateLocalHistory = () => {
  if (authStore.user) {
    const stored = localStorage.getItem(`health_history_${authStore.user.id}`);
    if (stored) localHistoryData.value = JSON.parse(stored);
  }
};
const displayHistory = computed(() => {
  if (historyData.value && historyData.value.length > 0) return historyData.value;
  return localHistoryData.value || [];
});
// ─── View state ───────────────────────────────────────────────────────────────
type View = "intro" | "explanation" | "form" | "result";
const view = ref<View>("intro");
const genInfo = ref({
  fullName: authStore.user?.full_name || "",
  nickname: "",
  age: "",
  gender: "",
  weight: "",
  height: "",
  status: "",
  job: "",
  jobOther: "",
  disease: "ไม่มี",
  familyDisease: "ไม่มี",
  smokeHistory: "ไม่เคยสูบ",
  alcoholHistory: "ไม่เคยดื่ม"
});
const bmi = computed(() => {
  const w = parseFloat(genInfo.value.weight);
  const h = parseFloat(genInfo.value.height) / 100;
  if (!w || !h) return 0;
  return parseFloat((w / (h * h)).toFixed(2));
});
const currentSectionIdx = ref(0);
const answers = ref<Record<string, string>>({});
const isMobile = ref(false);
const checkMobile = () => { isMobile.value = window.innerWidth < 768; };
const showHistoryModal = ref(false);
const selectedRecord = ref<any>(null);
const currentSection = computed(() => sections[currentSectionIdx.value]);
const highlightQId = ref<string | null>(null);
const selectAnswer = (qId: string, optText: string) => {
  answers.value[qId] = optText;
  if (highlightQId.value === qId) highlightQId.value = null;
};
watch(currentSectionIdx, () => { 
  highlightQId.value = null;
});
// ─── Progress ─────────────────────────────────────────────────────────────────
const sectionAnsweredCount = computed(() => currentSection.value.questions.filter(q => answers.value[q.id]).length);
const sectionComplete = computed(() => sectionAnsweredCount.value === currentSection.value.questions.length);
const totalQuestions = sections.reduce((t, s) => t + s.questions.length, 0);
const overallAnsweredCount = computed(() => Object.keys(answers.value).length);
const overallProgress = computed(() => (overallAnsweredCount.value / totalQuestions) * 100);
const isLastSection = computed(() => currentSectionIdx.value === sections.length - 1);
// ─── Scoring ──────────────────────────────────────────────────────────────────
const sectionScores = computed(() => {
  if (selectedRecord.value && view.value === 'result') {
    let rawScores = selectedRecord.value.summary_json || selectedRecord.value.section_scores || selectedRecord.value.sectionScores || [];
    if (typeof rawScores === 'string') {
      try { rawScores = JSON.parse(rawScores); } catch (e) { rawScores = []; }
    }
    return sections.map(s => {
      const rs = rawScores.find((r: any) => (r.sectionId || r.section_id || r.section?.id) === s.id);
      let score = rs ? rs.score : 0;
      let lvl = rs ? (rs.level || rs.overall_level) : s.scoringRanges[0].level;
      const pct = (score / s.maxScore) * 100;
      const range = s.scoringRanges.find(r => r.level === lvl) || s.scoringRanges[0];
      return { section: s, score, pct, level: lvl, desc: range.desc, advice: range.advice };
    });
  }
  return sections.map(s => {
    let score = 0;
    s.questions.forEach(q => {
      const ansVal = answers.value[q.id];
      const opt = q.options.find(o => o.text === ansVal);
      if (opt) score += opt.score;
    });
    const pct = (score / s.maxScore) * 100;
    const range = s.scoringRanges.find(r => score >= r.min && score <= r.max) || s.scoringRanges[s.scoringRanges.length - 1];
    return { section: s, score, pct, level: range.level, desc: range.desc, advice: range.advice };
  });
});
const overallLevel = computed(() => {
  if (selectedRecord.value && view.value === 'result') {
    return selectedRecord.value.overall_level || selectedRecord.value.overallLevel;
  }
  const levels = sectionScores.value.map(s => s.level);
  if (levels.includes("ควรปรับปรุง")) return "ควรปรับปรุง";
  if (levels.includes("พอใช้")) return "พอใช้";
  if (levels.includes("ดี")) return "ดี";
  return "ดีมาก";
});
// ─── Navigation ───────────────────────────────────────────────────────────────
const start = () => { 
  selectedRecord.value = null; 
  view.value = "explanation"; 
  answers.value = {};
  currentSectionIdx.value = 0;
  highlightQId.value = null;
  window.scrollTo({ top: 0, behavior: 'smooth' }); 
};
const handleNextClick = () => {
  const qs = currentSection.value.questions;
  const unanswered = qs.find(q => !answers.value[q.id]);
  if (unanswered) {
    highlightQId.value = unanswered.id;
    const el = document.getElementById(`q-row-${unanswered.id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    uiStore.toast('warning', 'กรุณาตอบให้ครบ', 'ยังมีข้อคำถามที่ท่านยังไม่ได้ตอบในหมวดนี้');
  } else {
    if (isLastSection.value) { 
      submitForm();
    } else { 
      currentSectionIdx.value++; 
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
    } 
  }
};
const prevSection = () => { 
  if (currentSectionIdx.value > 0) { 
    currentSectionIdx.value--;
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  } 
};
const submitForm = async () => {
  if (!authStore.user || isSubmitting.value) return;
  isSubmitting.value = true;
  uiStore.setLoading(true, 'กำลังบันทึกสุขภาพของคุณ...');
  try {
    const granularAnswers = Object.entries(answers.value).map(([qId, val]) => {
      const section = sections.find(s => s.questions.some(q => q.id === qId));
      const question = section?.questions.find(q => q.id === qId);
      const option = question?.options.find(o => o.text === val);
      return {
        question_text: question?.text || qId,
        answer_text: val,
        score: option?.score || 0
      };
    });
    const payload: Record<string, any> = {
      userId: authStore.user.id,
      granularAnswers,
      totalScore: sectionScores.value.reduce((t, s) => t + s.score, 0),
      overallLevel: overallLevel.value,
      sectionScores: sectionScores.value.map(s => ({
        sectionId: s.section.id,
        score: s.score,
        level: s.level
      })),
      metadata: { ...genInfo.value, bmi: bmi.value, assessmentType: "3O2S_FULL" }
    };
    if (activityEventId.value) {
      payload.activityId = activityEventId.value;
      payload.assessmentType = activityTestType.value || 'pre_test';
    }
    const res = await fetch("/api/health/save-assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('บันทึกลงฐานข้อมูลล้มเหลว');
    revalidateHistory();
    const localKey = `health_history_${authStore.user.id}`;
    const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
    const newRecord = {
      id: Date.now(),
      created_at: new Date().toISOString(),
      overall_level: payload.overallLevel,
      total_score: payload.totalScore,
      section_scores: payload.sectionScores
    };
    localData.unshift(newRecord);
    localStorage.setItem(localKey, JSON.stringify(localData));
    updateLocalHistory();
    selectedRecord.value = null;
    view.value = "result";
    window.scrollTo({ top: 0, behavior: "smooth" });
    uiStore.toast('success', 'บันทึกสำเร็จ', 'ข้อมูลสุขภาพของคุณถูกเก็บเข้าฐานข้อมูลเรียบร้อยแล้ว');
  } catch (e) {
    uiStore.showAlert('error', 'ล้มเหลว', 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้ กรุณาลองอีกครั้ง');
  } finally {
    uiStore.setLoading(false);
    isSubmitting.value = false;
  }
};
const restart = () => {
  if (Object.keys(answers.value).length > 0 && view.value === 'form') {
    if (!confirm('ข้อมูลที่กำลังทำจะหายไป ต้องการเริ่มใหม่ใช่หรือไม่?')) return;
  }
  view.value = 'intro';
  history.replaceState(null, '', '/health');
  answers.value = {};
  currentSectionIdx.value = 0;
  selectedRecord.value = null;
  revalidateHistory();
};
const viewPastRecord = (record: any) => {
  selectedRecord.value = record;
  showHistoryModal.value = false;
  view.value = "result";
  window.scrollTo({ top: 0, behavior: "smooth" });
};
// ─── Helpers (Semantic Colors based on Theme) ─────────────────────────────────
const levelMeta = (lvl: string) => {
  if (lvl === "ดีมาก") return { color: "#16a34a", bg: "#f0fdf4", border: "#16a34a" }; // Green-600
  if (lvl === "ดี") return { color: "#22c55e", bg: "#f0fdf4", border: "#22c55e" }; // Green-500
  if (lvl === "พอใช้") return { color: "#eab308", bg: "#fefce8", border: "#eab308" }; // Yellow-500
  return { color: "#ef4444", bg: "#fef2f2", border: "#ef4444" }; // Red-500 (ควรปรับปรุง)
};
const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543} เวลา ${time}`;
};
const formatHistoryDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543} เวลา ${time}`;
};
const getAnswerForQuestion = (qId: string) => {
  if (answers.value[qId]) return answers.value[qId];
  if (selectedRecord.value) {
    let gAns = selectedRecord.value.granular_answers || selectedRecord.value.granularAnswers;
    if (typeof gAns === 'string') {
      try { gAns = JSON.parse(gAns); } catch (e) { gAns = []; }
    }
    if (gAns && Array.isArray(gAns)) {
      const section = sections.find(s => s.questions.some(q => q.id === qId));
      const question = section?.questions.find(q => q.id === qId);
      const qText = question?.text || qId;
      const found = gAns.find((a: any) => a.question_text === qText || a.question_id === qId);
      return found ? found.answer_text : null;
    }
  }
  return null;
};
onMounted(() => {
  checkMobile();
  updateLocalHistory();
  window.addEventListener('resize', checkMobile);
  if (activityEventId.value && authStore.user) {
    start();
  }
});
onUnmounted(() => { 
  window.removeEventListener('resize', checkMobile); 
});
watch(() => authStore.user, updateLocalHistory);
const goBackToActivity = () => {
  if (activityEventId.value) {
    router.push(`/activities/${activityEventId.value}`);
  } else {
    router.push('/health');
  }
};
</script>
<template>
  <div class="app theme-white-orange">
    <transition name="page" mode="out-in">
      <div v-if="view === 'intro'" class="intro-page">
        <div class="intro-top-bar">
          <button v-if="activityEventId" class="rect-btn-history" @click="goBackToActivity">
            <ArrowLeft :size="18" stroke-width="2.5" />
            <span>{{ langStore.locale === 'th' ? 'กลับไปที่กิจกรรม' : 'Back to Event' }}</span>
          </button>
          <button v-if="!activityEventId" class="rect-btn-history" @click="showHistoryModal = true">
            <History :size="18" stroke-width="2.5" />
            <span>{{ langStore.locale === 'th' ? 'ประวัติสุขภาพ' : 'Health History' }}</span>
          </button>
        </div>
        <div class="intro-centered">
          <div class="icon-block mx-auto mb-6">
            <ClipboardCheck :size="48" stroke-width="1.5" />
          </div>
          <h1 class="intro-heading" v-if="langStore.locale === 'th'">แบบประเมิน<br><em>พฤติกรรมสุขภาพ</em></h1>
          <h1 class="intro-heading" v-else>Health<br><em>Behavior Assessment</em></h1>
          <div class="intro-divider"></div>
          <p class="intro-body">{{ langStore.locale === 'th' ? 'เช็กความพร้อมของร่างกายผ่านหลัก 3อ. 2ส. และรับคำแนะนำที่ตรงจุดเพื่อนำไปปรับใช้ได้จริงในชีวิตประจำวัน' : 'Check your body readiness through the 3O 2S principles and receive personalized advice for your daily life.' }}</p>
          <button class="btn-rect-primary btn-large shadow-sharp" @click="start">{{ langStore.locale === 'th' ? 'เริ่มทำแบบประเมิน' : 'Start Assessment' }}</button>
        </div>
      </div>
      <div v-else-if="view === 'explanation'" class="intro-page">
        <div class="explanation-container">
          <div class="explanation-card">
            <div class="explanation-header">
              <h2 class="explanation-title">{{ langStore.locale === 'th' ? 'ก่อนเริ่มการประเมิน' : 'Before Starting' }}</h2>
              <p class="explanation-subtitle">{{ langStore.locale === 'th' ? 'ใช้เวลาประมาณ 3-5 นาที เพื่อเข้าใจสุขภาพของคุณ' : 'Takes about 3-5 minutes to understand your health.' }}</p>
              <p>{{ langStore.locale === 'th' ? 'ประเมิน 5 ด้าน: อาหาร, ออกกำลังกาย, อารมณ์, บุหรี่ และสุรา' : 'Assess 5 areas: Food, Exercise, Emotion, Smoking, and Alcohol.' }}</p>
            </div>
            <div class="explanation-body">
              <!-- PDPA Consent Checkboxes -->
              <div class="pdpa-consent">
                <label class="pdpa-row pdpa-accept-all" @click.stop>
                  <span class="pdpa-checkbox-wrap">
                    <input type="checkbox" id="acceptAll" v-model="acceptAll" />
                    <span class="pdpa-custom-box" :class="{ checked: acceptAll }">
                      <svg v-if="acceptAll" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                  </span>
                  <span class="pdpa-label-text pdpa-label-bold">{{ langStore.locale === 'th' ? 'ยอมรับข้อตกลงทั้งหมด' : 'Accept all terms' }}</span>
                </label>
                <div class="pdpa-divider"></div>
                <label class="pdpa-row" @click.stop>
                  <span class="pdpa-checkbox-wrap">
                    <input type="checkbox" id="acceptTerms" v-model="acceptTerms" />
                    <span class="pdpa-custom-box" :class="{ checked: acceptTerms }">
                      <svg v-if="acceptTerms" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                  </span>
                  <span class="pdpa-label-text">{{ langStore.locale === 'th' ? 'ยอมรับ ' : 'Accept ' }}<button type="button" class="pdpa-link" @click.stop="showTerms()">{{ langStore.locale === 'th' ? 'เงื่อนไขการให้บริการ' : 'Terms of Service' }}</button></span>
                </label>
                <label class="pdpa-row" @click.stop>
                  <span class="pdpa-checkbox-wrap">
                    <input type="checkbox" id="acceptPrivacy" v-model="acceptPrivacy" />
                    <span class="pdpa-custom-box" :class="{ checked: acceptPrivacy }">
                      <svg v-if="acceptPrivacy" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                  </span>
                  <span class="pdpa-label-text">{{ langStore.locale === 'th' ? 'ยอมรับ ' : 'Accept ' }}<button type="button" class="pdpa-link" @click.stop="showPrivacyPolicy()">{{ langStore.locale === 'th' ? 'นโยบายความเป็นส่วนตัว (PDPA)' : 'Privacy Policy (PDPA)' }}</button></span>
                </label>
              </div>
              <button class="btn-premium-primary mt-4" :class="{ 'btn-disabled': !pdpaAccepted }" :disabled="!pdpaAccepted" @click="view = 'form'">
                {{ langStore.locale === 'th' ? 'เริ่มทำแบบประเมิน' : 'Start Assessment' }} <ArrowRight :size="18" />
              </button>
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <div style="display: flex; gap: 12px; align-items: flex-start; text-align: left;">
                  <ShieldCheck :size="16" style="color: #16a34a; margin-top: 2px; flex-shrink: 0;" />
                  <p style="font-size: 0.8rem; color: #64748b; line-height: 1.4;">
                    <strong>{{ langStore.locale === 'th' ? 'การรักษาความลับ:' : 'Confidentiality:' }}</strong> {{ langStore.locale === 'th' ? 'ข้อมูลของท่านจะถูกเก็บเป็นความลับและใช้เพื่อประมวลผลคำแนะนำเบื้องต้นเท่านั้น (ไม่ใช่การวินิจฉัยทางการแพทย์)' : 'Your data will be kept strictly confidential and used for preliminary guidance only (not medical diagnosis).' }}
                  </p>
                </div>
              </div>
              <div style="margin-top: 16px; display: flex; justify-content: center;">
                <a href="/docs/manual_3O2S.pdf" target="_blank" style="font-size: 0.8rem; color: #f97316; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                  <FileText :size="14" /> {{ langStore.locale === 'th' ? 'เอกสารอ้างอิงการประเมิน 3อ. 2ส.' : 'Reference Manual 3O 2S' }}
                </a>
              </div>
            </div>
          </div>
          <button class="btn-text-muted" @click="view = 'intro'"><ChevronLeft :size="16" /> {{ langStore.locale === 'th' ? 'ย้อนกลับ' : 'Back' }}</button>
        </div>
      </div>
      <div v-else-if="view === 'form'" class="form-page">
        <div class="form-scroll">
          <div class="form-inner">
            <div class="sec-label-row">
              <div class="sec-label-title">{{ currentSection.label }}</div>
              <div class="sec-label-progress">{{ currentSectionIdx + 1 }} / {{ sections.length }}</div>
            </div>
            <div class="question-list">
              <div v-for="q in currentSection.questions" :key="q.id" :id="`q-row-${q.id}`" 
                   class="question-block" :class="{ 'is-highlighted': highlightQId === q.id }">
                <div class="q-header">
                  <div class="q-number-box" :class="{ 'done': answers[q.id] }">{{ q.text.split(')')[0] }}</div>
                  <div class="q-text-rect">{{ q.text.split(')')[1] }}</div>
                </div>
                <div class="q-options-container">
                  <div class="q-options-grid">
                    <button v-for="opt in q.options" :key="opt.text" 
                            class="q-opt-btn" :class="{ 'active': answers[q.id] === opt.text }"
                            @click="selectAnswer(q.id, opt.text)">
                      {{ opt.shortLabel }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="form-cta">
              <div v-if="!sectionComplete" class="cta-hint-rect">{{ langStore.locale === 'th' ? 'กรุณาตอบให้ครบทุกข้อ' : 'Please answer all questions' }}</div>
              <div class="cta-buttons">
                <button class="btn-rect-outline" @click="prevSection" v-if="currentSectionIdx > 0">{{ langStore.locale === 'th' ? 'ย้อนกลับ' : 'Back' }}</button>
                <button class="btn-rect-primary" @click="handleNextClick" :disabled="isSubmitting">
                  <span v-if="isSubmitting" class="flex items-center gap-2">
                    <Loader2 class="w-4 h-4 spin" /> {{ langStore.locale === 'th' ? 'บันทึกข้อมูล...' : 'Saving...' }}
                  </span>
                  <span v-else>{{ isLastSection ? (langStore.locale === 'th' ? 'ดูผลลัพธ์' : 'View Results') : (langStore.locale === 'th' ? 'ถัดไป' : 'Next') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="view === 'result'" class="res-page">
        <div class="res-hero">
          <div class="res-hero-sub-rect">{{ langStore.locale === 'th' ? 'สรุปผลพฤติกรรมสุขภาพของคุณ' : 'Your Health Behavior Summary' }}</div>
          <h2 class="res-hero-title">{{ langStore.locale === 'th' ? 'ผลประเมินรวม:' : 'Overall Result:' }} <span :style="{ color: levelMeta(overallLevel).color }">{{ overallLevel }}</span></h2>
          <div class="res-overall-rect" :style="{ borderColor: levelMeta(overallLevel).color, background: levelMeta(overallLevel).bg }">
            <div class="res-overall-label">{{ langStore.locale === 'th' ? 'คะแนนรวม' : 'Total Score' }}</div>
            <div class="res-overall-value" :style="{ color: levelMeta(overallLevel).color }">
              {{ sectionScores.reduce((t, s) => t + s.score, 0) }} / {{ sections.reduce((t, s) => t + s.maxScore, 0) }}
            </div>
          </div>
        </div>
        <div v-for="res in sectionScores" :key="res.section.id" class="res-section">
          <div class="res-section-title-rect">{{ res.section.label }}</div>
          <div class="res-cards-rect">
            <div class="res-card-rect">
              <div class="res-card-head">
                <div class="res-card-name">{{ langStore.locale === 'th' ? 'ระดับ:' : 'Level:' }} {{ res.level }} ({{ res.score }} {{ langStore.locale === 'th' ? 'คะแนน' : 'pts' }})</div>
                <div class="res-card-badge-rect" :style="{ background: levelMeta(res.level).bg, color: levelMeta(res.level).color }">
                  {{ res.level }}
                </div>
              </div>
              <div class="res-advice-rect" :style="{ borderColor: levelMeta(res.level).color }">
                <div class="res-advice-icon" :style="{ color: levelMeta(res.level).color }"><Lightbulb :size="24" /></div>
                <div class="res-advice-content">
                  <p class="res-advice-desc">{{ res.desc }}</p>
                  <div class="res-advice-sep" :style="{ background: levelMeta(res.level).color }"></div>
                  <p class="res-advice-text">{{ res.advice }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- ─── ส่วนแสดงสรุปคำตอบ ─── -->
        <div class="res-section" v-if="Object.keys(answers).length > 0 || (selectedRecord && (selectedRecord.granular_answers || selectedRecord.granularAnswers))">
          <div class="res-section-title-rect">
            <ClipboardCheck :size="24" class="text-primary" />
            {{ langStore.locale === 'th' ? 'สรุปคำตอบของคุณ' : 'Your Answers Summary' }}
          </div>
          <div class="res-ans-list-rect">
            <div v-for="s in sections" :key="s.id" class="res-section-group" style="margin-bottom: 32px;">
              <h4 style="font-size: 1rem; font-weight: 700; color: #64748b; margin-bottom: 12px; padding-left: 8px; border-left: 3px solid #cbd5e1;">{{ s.label }}</h4>
              <template v-for="q in s.questions" :key="q.id">
                <div class="res-ans-row-rect" v-if="getAnswerForQuestion(q.id)">
                  <div class="res-ans-num">{{ s.shortLabel }} - {{ langStore.locale === 'th' ? 'ข้อ' : 'Q' }} {{ q.text.split(')')[0] }}</div>
                  <p class="res-ans-q">{{ q.text.split(')')[1] }}</p>
                  <div class="res-ans-bottom">
                    <div class="res-ans-a-rect">
                      <CheckCircle2 :size="16" />
                      <span>{{ getAnswerForQuestion(q.id) }}</span>
                    </div>
                    <div class="res-ans-score-rect">
                      {{ q.options.find(o => o.text === getAnswerForQuestion(q.id))?.score || 0 }} {{ langStore.locale === 'th' ? 'คะแนน' : 'pts' }}
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
        <div class="res-actions">
          <button class="btn-rect-primary" @click="restart">{{ langStore.locale === 'th' ? 'ประเมินใหม่อีกครั้ง' : 'Retake Assessment' }}</button>
          <button class="btn-rect-outline" @click="goBackToActivity">{{ langStore.locale === 'th' ? 'กลับไปยังกิจกรรม' : 'Back to Event' }}</button>
        </div>
      </div>
    </transition>
    <div v-if="showHistoryModal" class="history-modal-overlay" @click.self="showHistoryModal = false">
      <div class="history-modal-rect">
        <div class="hm-header">
          <div style="font-weight:700;">{{ langStore.locale === 'th' ? 'ประวัติย้อนหลัง' : 'History' }}</div>
          <div class="hm-close" @click="showHistoryModal = false"><X :size="18" /></div>
        </div>
        <div class="hm-body">
          <div v-for="h in displayHistory" :key="h.id" class="journal-card-rect" @click="viewPastRecord(h)">
            <div class="jc-date-wrap"><Calendar :size="14" /> <span class="jc-date">{{ formatHistoryDate(h.created_at || h.id) }}</span></div>
            <div class="jc-main">
              <div>
                <div class="jc-level">{{ h.overall_level || h.overallLevel }}</div>
                <div class="jc-sub">{{ langStore.locale === 'th' ? 'คะแนนรวม:' : 'Total Score:' }} {{ h.total_score || h.totalScore }}</div>
              </div>
              <div class="jc-icon" :style="{ background: levelMeta(h.overall_level || h.overallLevel).bg, color: levelMeta(h.overall_level || h.overallLevel).color }">
                <CheckCircle2 :size="20" />
              </div>
            </div>
          </div>
          <div v-if="displayHistory.length === 0" style="text-align:center; padding: 40px; color: #9ca3af;">{{ langStore.locale === 'th' ? 'ยังไม่มีประวัติการทำแบบประเมิน' : 'No assessment history' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
.theme-white-orange {
  --P: #f97316;
  --P-hover: #ea580c;
  --P-bg: #fff7ed;
  --text: #1f2937;
  --text-muted: #6b7280;
  --bg: #ffffff;
  --border: #e5e7eb;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  overflow-x: hidden;
  font-family: 'Kanit', sans-serif;
}
.text-primary { color: var(--P); }
.bg-primary { background: var(--P); }
.rect-btn-history {
  display: flex; align-items: center; gap: 8px;
  background: #fff; border: 1px solid var(--border); color: var(--text-muted);
  padding: 10px 18px; border-radius: 12px; font-weight: 600; font-size: 0.95rem; cursor: pointer;
  transition: all 0.2s ease;
}
.rect-btn-history:hover { background: var(--P-bg); border-color: var(--P); color: var(--P); }
.intro-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; position: relative; }
.intro-top-bar { position: absolute; top: 16px; right: 16px; left: 16px; z-index: 10; display: flex; flex-direction: column; align-items: flex-end; }
.intro-centered { text-align: center; max-width: 600px; width: 100%; display: flex; flex-direction: column; align-items: center; animation: fadeUp 0.5s ease-out; }
.icon-block { width: 90px; height: 90px; background: var(--P-bg); border: 2px solid var(--P); display: flex; align-items: center; justify-content: center; color: var(--P); margin-bottom: 24px; border-radius: 20px; }
.intro-heading { font-size: clamp(2rem, 4vw, 2.8rem); font-weight: 800; line-height: 1.2; color: var(--text); margin-bottom: 20px; }
.intro-heading em { font-style: normal; color: var(--P); }
.intro-divider { width: 60px; height: 4px; background: var(--P); border-radius: 2px; margin: 0 auto 24px auto; }
.intro-body { font-size: 1.1rem; color: var(--text-muted); line-height: 1.7; margin-bottom: 30px; }
/* Buttons */
.btn-rect-primary {
  padding: 16px 24px; border-radius: 12px; background: var(--P); color: #fff; font-size: 1.1rem; font-weight: 700;
  border: 1px solid var(--P); cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 12px;
  transition: all 0.2s; width: auto; min-width: 200px;
}
.btn-rect-primary:hover { background: var(--P-hover); border-color: var(--P-hover); }
.btn-rect-primary.btn-large { width: 100%; max-width: 400px; }
.btn-rect-outline {
  padding: 16px 24px; border-radius: 12px; background: #fff; color: var(--P); font-size: 1.1rem; font-weight: 700;
  border: 1px solid var(--P); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all 0.2s; width: auto; min-width: 140px;
}
.btn-rect-outline:hover { background: var(--P-bg); }
.shadow-sharp { box-shadow: 4px 4px 0px rgba(249, 115, 22, 0.2); transition: all 0.2s ease; }
.shadow-sharp:hover { box-shadow: 6px 6px 0px rgba(249, 115, 22, 0.3); transform: translate(-2px, -2px); }
/* Modal */
.history-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0, 0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
.history-modal-rect { background: #fff; width: 100%; max-width: 480px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); overflow: hidden; display: flex; flex-direction: column; max-height: 85vh; border: 1px solid var(--border); }
.hm-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border); background: #fafafa; }
.hm-close { background: #fff; border: 1px solid var(--border); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); cursor: pointer; border-radius: 8px; }
.hm-body { padding: 24px; overflow-y: auto; flex: 1; }
.journal-card-rect { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 20px; text-align: left; transition: all 0.2s ease; margin-bottom: 16px; cursor: pointer; border-left: 4px solid transparent; }
.journal-card-rect:hover { border-left-color: var(--P); background: var(--P-bg); }
.jc-date-wrap { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.jc-date { font-size: 0.85rem; font-weight: 600; color: #9ca3af; }
.jc-main { display: flex; align-items: center; justify-content: space-between; }
.jc-level { font-size: 1.3rem; font-weight: 800; line-height: 1.2; margin-bottom: 2px; }
.jc-sub { font-size: 0.85rem; color: var(--text-muted); }
.jc-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
/* Form Navigation */
.form-page { min-height: 100vh; display: flex; flex-direction: column; }
.form-scroll { flex: 1; overflow-y: auto; }
.form-inner { max-width: 800px; margin: 0 auto; padding: 36px 24px 120px; }
.sec-label-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; border-bottom: 2px solid var(--P); padding-bottom: 16px; }
.sec-label-title { font-size: 1.5rem; font-weight: 700; color: var(--text); }
.sec-label-progress { font-weight: 700; color: var(--P); font-size: 1.1rem; }
/* REBUILT UI: Smart Dropdown List */
.question-list { display: flex; flex-direction: column; gap: 20px; }
.question-block {
  padding: 32px 0;
  border-bottom: none;
  background: transparent;
  transition: all 0.3s;
}
.question-block:last-child { border-bottom: none; }
.question-block.is-answered { background: transparent; }
.question-block.is-highlighted { background: transparent; }
.question-block.is-highlighted .q-number-box { 
  background: #ef4444; 
  border-color: #ef4444; 
  color: #fff; 
  animation: qNumberBlink 0.6s infinite; 
}
.q-header { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 24px; }
.q-number-box { 
  width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: #f3f4f6; border: 1px solid var(--border); font-weight: bold; font-size: 1rem; color: var(--text-muted); border-radius: 8px;
}
.q-number-box.done { background: var(--P); border-color: var(--P); color: #fff; }
.q-text-rect { font-size: 1.15rem; font-weight: 600; color: var(--text); line-height: 1.6; padding-top: 4px; }
/* REBUILT UI: Visible Option Buttons */
.q-options-container { width: 100%; }
.q-options-grid { 
  display: grid; 
  grid-template-columns: repeat(5, 1fr); 
  gap: 12px; 
}
.q-opt-btn {
  padding: 14px 10px;
  border: 1px solid var(--border);
  background: #fff;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 12px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  line-height: 1.2;
}
.q-opt-btn:hover { background: var(--P-bg); border-color: var(--P); color: var(--P); }
.q-opt-btn.active { 
  background: var(--P); 
  border-color: var(--P); 
  color: #fff;
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.2);
}
@media (max-width: 992px) {
  .q-options-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 640px) {
  .q-options-grid { grid-template-columns: repeat(2, 1fr); }
  .q-text-rect { font-size: 1.05rem; }
}
@media (max-width: 400px) {
  .q-options-grid { grid-template-columns: 1fr; }
}
.form-cta { text-align: center; margin-top: 40px; border-top: none; padding-top: 30px; }
.cta-hint-rect { background: #fee2e2; color: #ef4444; padding: 6px 18px; border-radius: 30px; font-size: 0.95rem; font-weight: 600; margin-bottom: 16px; display: inline-block; border: 1px solid #fca5a5; }
.cta-buttons { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
/* Result Page */
.res-page { max-width: 800px; margin: 0 auto; padding: 0 0 80px; }
.res-hero { text-align: center; padding: 48px 24px 40px; border-bottom: 1px solid var(--border); background: transparent; margin-bottom: 40px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
.res-hero-sub-rect { display: flex; align-items: center; gap: 8px; font-size: 1rem; color: var(--text-muted); font-weight: 500; background: #fff; border: 1px solid var(--border); padding: 8px 20px; border-radius: 30px; margin: 0; }
.res-hero-title { font-size: 2.2rem; font-weight: 900; color: var(--text); line-height: 1.2; margin: 0; }
.res-overall-rect { display: flex; flex-direction: column; align-items: center; gap: 8px; background: #fff; border: 4px solid; border-radius: 20px; padding: 24px 60px; box-shadow: 8px 8px 0px rgba(0,0,0,0.05); margin-top: 8px; }
.res-overall-label { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: var(--text-muted); }
.res-overall-value { font-size: 3rem; font-weight: 900; line-height: 1; }
.res-section { padding: 0 20px; margin-bottom: 40px; }
.res-section-title-rect { display: flex; align-items: center; gap: 12px; font-size: 1.3rem; font-weight: 800; color: var(--text); margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid var(--P); }
.res-cards-rect { display: flex; flex-direction: column; gap: 16px; }
.res-card-rect { background: #fff; border: 1px solid var(--border); border-radius: 20px; padding: 24px; animation: fadeUp 0.6s both; }
.res-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.res-card-name { font-size: 1.05rem; font-weight: 800; color: var(--text); line-height: 1.3; }
.res-card-badge-rect { font-size: 0.85rem; font-weight: 800; padding: 6px 16px; border-radius: 30px; white-space: nowrap; }
.res-advice-rect { display: flex; align-items: flex-start; gap: 16px; background: #fffcf7; border-left: 6px solid; border-radius: 12px; padding: 18px 20px; }
.res-advice-icon { flex-shrink: 0; padding-top: 2px; }
.res-advice-content { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.res-advice-desc { font-size: 1rem; font-weight: 500; color: #64748b; line-height: 1.5; margin: 0; }
.res-advice-sep { height: 1px; width: 30px; margin: 4px 0; }
.res-advice-text { font-size: 1.05rem; font-weight: 700; color: var(--text); line-height: 1.5; margin: 0; }
.res-ans-list-rect { background: transparent; border: none; border-radius: 0; overflow: visible; }
.res-ans-row-rect { padding: 16px 0; border-bottom: none; display: flex; flex-direction: column; gap: 8px; transition: background 0.15s; }
.res-ans-row-rect:last-child { border-bottom: none; }
.res-ans-row-rect:hover { background: transparent; }
.res-ans-num { font-size: 0.85rem; font-weight: 800; color: var(--P); text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.8; }
.res-ans-q { font-size: 1.1rem; font-weight: 600; color: var(--text); line-height: 1.5; margin: 0; }
.res-ans-bottom { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
.res-ans-a-rect { display: flex; align-items: center; gap: 10px; background: #fff; color: var(--P); border: 1px solid var(--P); border-radius: 12px; padding: 12px 20px; font-size: 1rem; font-weight: 700; flex: 1; min-width: 0; word-break: break-word; }
.res-ans-score-rect { font-size: 0.9rem; font-weight: 800; background: #fff; color: var(--text-muted); border: 1px solid var(--border); border-radius: 8px; padding: 8px 14px; white-space: nowrap; flex-shrink: 0; }
.res-actions { display: flex; flex-direction: column; gap: 16px; padding: 0 20px; margin-top: 16px; }
/* Animations */
@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes qNumberBlink {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); box-shadow: 0 0 15px rgba(239, 68, 68, 0.5); }
  100% { transform: scale(1); }
}
.page-enter-active, .page-leave-active { transition: all 0.3s ease-out; }
.page-enter-from { opacity: 0; transform: translateY(15px); }
.page-leave-to { opacity: 0; transform: translateY(-15px); }
.dropdown-fade-enter-active, .dropdown-fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(-5px); }
/* Responsive adjustments */
@media (min-width: 480px) {
  .res-actions { flex-direction: row; justify-content: center; }
  .res-actions .btn-rect-primary, .res-actions .btn-rect-outline { min-width: 220px; }
}
@media (max-width: 640px) {
  .intro-page { padding-top: 80px; }
  .history-modal-rect { max-height: 90vh; }
  .cta-buttons { flex-direction: column-reverse; }
  .btn-rect-primary, .btn-rect-outline { width: 100%; }
}
@media (max-width: 768px) {
  .question-block { padding: 16px; }
  .q-header { flex-direction: column; gap: 10px; }
}
.intro-page.bg-grid-pattern {
  background-image: radial-gradient(var(--border) 1px, transparent 1px);
  background-size: 24px 24px;
}
.explanation-container {
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.step-indicator { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
.step-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border); }
.step-dot.active { background: var(--P); box-shadow: 0 0 0 3px var(--P-bg); }
.step-line { width: 30px; height: 1px; background: var(--border); }
.explanation-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 32px;
  width: 100%;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
}
.explanation-header { margin-bottom: 24px; }
.explanation-title { font-size: 1.6rem; font-weight: 800; color: var(--text); margin-bottom: 4px; }
.explanation-subtitle { font-size: 0.95rem; color: var(--text-muted); font-weight: 500; }
.explanation-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.explanation-footer {
  padding-top: 24px;
}
.info-item {
  display: flex;
  gap: 16px;
  text-align: left;
  align-items: flex-start;
  padding: 4px 0;
}
.info-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.info-text p {
  font-size: 0.95rem; color: var(--text); line-height: 1.5;
}
.reassurance-box {
  background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 16px;
  padding: 16px 20px; text-align: left;
}
.reassurance-check {
  width: 36px; height: 36px; background: #fff; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; color: #10b981;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.1); flex-shrink: 0;
}
.resource-link-card {
  display: flex; align-items: center; gap: 12px; padding: 14px 18px;
  background: #fff; border: 1px solid var(--border); border-radius: 16px;
  text-decoration: none; transition: all 0.2s ease; text-align: left;
}
.resource-link-card:hover { border-color: var(--P); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(249, 115, 22, 0.1); }
.rlc-icon { width: 40px; height: 40px; background: var(--P-bg); color: var(--P); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.resource-link-card:hover .rlc-icon { background: var(--P); color: #fff; }
.rlc-content { flex: 1; display: flex; flex-direction: column; }
.rlc-label { font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
.rlc-title { font-size: 0.95rem; font-weight: 700; color: var(--text); }
.rlc-arrow { color: var(--border); }
.btn-premium-primary {
  width: 100%; padding: 16px; background: var(--P); color: #fff; border: none; border-radius: 14px;
  font-size: 1.05rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
  box-shadow: 0 5px 15px rgba(249, 115, 22, 0.2); transition: all 0.2s ease;
}
.btn-premium-primary:hover { background: var(--P-hover); transform: translateY(-2px); }
.btn-text-muted {
  background: none; border: none; color: var(--text-muted); font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: pointer; font-size: 0.85rem; transition: color 0.2s; padding: 8px;
}
.btn-text-muted:hover { color: var(--text); }
@media (max-width: 640px) {
  .explanation-card { padding: 24px 20px; }
  .explanation-title { font-size: 1.4rem; }
  .info-item { gap: 12px; }
}
/* ── PDPA Consent Block ───────────────────────────────────────────────────── */
.pdpa-consent { margin-top: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; text-align: left; }
.pdpa-divider { height: 1px; background: #e2e8f0; margin: 2px 0; }
.pdpa-row { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; user-select: none; padding: 2px 0; margin-bottom: 0; }
.pdpa-accept-all { padding-bottom: 2px; }
.pdpa-checkbox-wrap { position: relative; flex-shrink: 0; display: flex; align-items: center; margin-top: 2px; }
.pdpa-checkbox-wrap input[type="checkbox"] { position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none; }
.pdpa-custom-box { width: 20px; height: 20px; border: 2px solid #cbd5e1; border-radius: 5px; background: #fff; display: flex; align-items: center; justify-content: center; transition: all 0.18s ease; flex-shrink: 0; }
.pdpa-custom-box.checked { background: #F05A23; border-color: #F05A23; }
.pdpa-row:hover .pdpa-custom-box:not(.checked) { border-color: #F05A23; background: #fff5f2; }
.pdpa-label-text { font-size: 13px; color: #475569; line-height: 1.4; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.pdpa-label-bold { font-weight: 700; color: #1e293b; font-size: 13.5px; }
.pdpa-link { background: none; border: none; padding: 0; color: #F05A23; font-weight: 600; font-size: 13px; cursor: pointer; text-decoration: underline; font-family: inherit; line-height: inherit; }
.btn-disabled { opacity: 0.45 !important; cursor: not-allowed !important; pointer-events: none; }
</style>