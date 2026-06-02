$file = 'src\views\Profile.vue'
$content = Get-Content $file -Raw -Encoding UTF8

# Tanita form labels (tn-f-group)
$content = $content -replace '<label>ส่วนสูง \(cm\)</label>', '<label>{{ langStore.locale === ''th'' ? ''ส่วนสูง (cm)'' : ''Height (cm)'' }}</label>'
$content = $content -replace '<label>น้ำหนัก \(kg\)</label>', '<label>{{ langStore.locale === ''th'' ? ''น้ำหนัก (kg)'' : ''Weight (kg)'' }}</label>'
$content = $content -replace '<label>ประเภทร่างกาย</label>', '<label>{{ langStore.locale === ''th'' ? ''ประเภทร่างกาย'' : ''Body Type'' }}</label>'
$content = $content -replace '<label>อายุ \(ปี\)', '<label>{{ langStore.locale === ''th'' ? ''อายุ (ปี)'' : ''Age (Years)'' }}'
$content = $content -replace '\(จากวันเกิด\)', '{{ langStore.locale === ''th'' ? ''(จากวันเกิด)'' : ''(from birthday)'' }}'
$content = $content -replace '<div class="tn-divider-label">องค์ประกอบร่างกาย</div>', '<div class="tn-divider-label">{{ langStore.locale === ''th'' ? ''องค์ประกอบร่างกาย'' : ''Body Composition'' }}</div>'
$content = $content -replace '<div class="tn-divider-label">ระบบเผาผลาญ &amp; ดัชนีสุขภาพ</div>', '<div class="tn-divider-label">{{ langStore.locale === ''th'' ? ''ระบบเผาผลาญ & ดัชนีสุขภาพ'' : ''Metabolism & Health Index'' }}</div>'
$content = $content -replace '<label>ไขมัน \(%\)</label>', '<label>{{ langStore.locale === ''th'' ? ''ไขมัน (%)'' : ''Fat (%)'' }}</label>'
$content = $content -replace '<label>มวลไขมัน \(kg\)</label>', '<label>{{ langStore.locale === ''th'' ? ''มวลไขมัน (kg)'' : ''Fat Mass (kg)'' }}</label>'
$content = $content -replace '<label>มวลไร้ไขมัน FFM \(kg\)</label>', '<label>{{ langStore.locale === ''th'' ? ''มวลไร้ไขมัน FFM (kg)'' : ''Fat-Free Mass (kg)'' }}</label>'
$content = $content -replace '<label>มวลกล้ามเนื้อ \(kg\)</label>', '<label>{{ langStore.locale === ''th'' ? ''มวลกล้ามเนื้อ (kg)'' : ''Muscle Mass (kg)'' }}</label>'
$content = $content -replace '<label>มวลน้ำ \(kg\)</label>', '<label>{{ langStore.locale === ''th'' ? ''มวลน้ำ (kg)'' : ''Total Water (kg)'' }}</label>'
$content = $content -replace '<label>น้ำในร่างกาย \(%\)</label>', '<label>{{ langStore.locale === ''th'' ? ''น้ำในร่างกาย (%)'' : ''Body Water (%)'' }}</label>'
$content = $content -replace '<label>มวลกระดูก \(kg\)</label>', '<label>{{ langStore.locale === ''th'' ? ''มวลกระดูก (kg)'' : ''Bone Mass (kg)'' }}</label>'
$content = $content -replace '<label>น้ำหนักเสื้อผ้า \(kg\)</label>', '<label>{{ langStore.locale === ''th'' ? ''น้ำหนักเสื้อผ้า (kg)'' : ''Clothes Weight (kg)'' }}</label>'
$content = $content -replace '<label>รอบเอว \(cm\)</label>', '<label>{{ langStore.locale === ''th'' ? ''รอบเอว (cm)'' : ''Waist (cm)'' }}</label>'
$content = $content -replace '<label>อายุเมตาบอลิก \(ปี\)</label>', '<label>{{ langStore.locale === ''th'' ? ''อายุเมตาบอลิก (ปี)'' : ''Metabolic Age (Years)'' }}</label>'
$content = $content -replace '<label>ไขมันช่องท้อง</label>', '<label>{{ langStore.locale === ''th'' ? ''ไขมันช่องท้อง'' : ''Visceral Fat'' }}</label>'
$content = $content -replace '<label>น้ำหนักที่เหมาะสม \(kg\)</label>', '<label>{{ langStore.locale === ''th'' ? ''น้ำหนักที่เหมาะสม (kg)'' : ''Ideal Weight (kg)'' }}</label>'
$content = $content -replace '<label>ระดับความอ้วน \(%\)</label>', '<label>{{ langStore.locale === ''th'' ? ''ระดับความอ้วน (%)'' : ''Obesity Degree (%)'' }}</label>'

# Tanita footer buttons
$content = $content -replace '<button class="tn-btn-cancel" @click="showTanitaModal = false">ยกเลิก</button>', '<button class="tn-btn-cancel" @click="showTanitaModal = false">{{ langStore.locale === ''th'' ? ''ยกเลิก'' : ''Cancel'' }}</button>'
$content = $content -replace '(<span v-else>)บันทึกข้อมูล(</span>)', '$1{{ langStore.locale === ''th'' ? ''บันทึกข้อมูล'' : ''Save Data'' }}$2'

# Mission popup title
$content = $content -replace '>ภารกิจวันที่ {{ formatDate\(selectedDate\) }}<', '>{{ langStore.locale === ''th'' ? ''ภารกิจวันที่'' : ''Missions on'' }} {{ formatDate(selectedDate) }}<'

# Mission status badges
$content = $content -replace "m\.status === 'approved' \? 'ส่งแล้ว' :", "m.status === 'approved' ? (langStore.locale === 'th' ? 'ส่งแล้ว' : 'Submitted') :"
$content = $content -replace "m\.status === 'pending' \? 'รอตรวจสอบ' :", "m.status === 'pending' ? (langStore.locale === 'th' ? 'รอตรวจสอบ' : 'Pending') :"
$content = $content -replace "m\.status === 'rejected' \? 'ปฏิเสธ' :", "m.status === 'rejected' ? (langStore.locale === 'th' ? 'ปฏิเสธ' : 'Rejected') :"
$content = $content -replace "m\.status === 'missed' \? 'ไม่ส่ง' :", "m.status === 'missed' ? (langStore.locale === 'th' ? 'ไม่ส่ง' : 'Missed') :"
$content = $content -replace "m\.status === 'active' \? 'รอส่ง' : 'ยังไม่ถึง'", "m.status === 'active' ? (langStore.locale === 'th' ? 'รอส่ง' : 'Pending') : (langStore.locale === 'th' ? 'ยังไม่ถึง' : 'Upcoming')"

# Mission task fallback
$content = $content -replace "m\.task\?\.note \|\| 'ภารกิจ'", "m.task?.note || (langStore.locale === 'th' ? 'ภารกิจ' : 'Mission')"

# Empty missions
$content = $content -replace '>ไม่มีกิจกรรมในวันนี้<', '>{{ langStore.locale === ''th'' ? ''ไม่มีกิจกรรมในวันนี้'' : ''No activities today'' }}<'

# Pagination
$content = $content -replace '>(\s*)ย้อนกลับ(\s*)<', '>$1{{ langStore.locale === ''th'' ? ''ย้อนกลับ'' : ''Previous'' }}$2<'
$content = $content -replace '>(\s*)ถัดไป(\s*)<', '>$1{{ langStore.locale === ''th'' ? ''ถัดไป'' : ''Next'' }}$2<'
$content = $content -replace 'หน้า {{ currentPopupPage }} / {{ totalPopupPages }}', '{{ langStore.locale === ''th'' ? ''หน้า'' : ''Page'' }} {{ currentPopupPage }} / {{ totalPopupPages }}'

Set-Content $file $content -Encoding UTF8
Write-Host "Translation complete!"
