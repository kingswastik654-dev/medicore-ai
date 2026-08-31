$ErrorActionPreference = "Continue"
$base = "http://localhost:8000"
$pass = 0; $fail = 0

function Check($name, $ok, $detail = "") {
  if ($ok) { $script:pass++; Write-Output "PASS  $name $detail" }
  else { $script:fail++; Write-Output "FAIL  $name  $detail" }
}

function Api($method, $path, $body, $tok) {
  $headers = @{}
  if ($tok) { $headers["Authorization"] = "Bearer $tok" }
  try {
    if ($body) {
      return Invoke-RestMethod -Uri "$base$path" -Method $method -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 6)
    } else {
      return Invoke-RestMethod -Uri "$base$path" -Method $method -Headers $headers
    }
  } catch {
    return @{ __error = $_.Exception.Message; __status = $_.Exception.Response.StatusCode.value__ }
  }
}

# 1. AUTH
$login = Api POST "/api/auth/login" @{ username = "admin"; password = "Admin@123" } $null
$tok = $login.access_token
Check "auth: admin login" ($null -ne $tok)
$bad = Api POST "/api/auth/login" @{ username = "admin"; password = "wrong" } $null
Check "auth: rejects bad password" ($null -ne $bad.__error)
$me = Api GET "/api/auth/me" $null $tok
Check "auth: /me returns profile" ($me.role -eq "SUPER_ADMIN") ("role=" + $me.role)

# 2. ANALYTICS / DASHBOARD
$s = Api GET "/api/analytics/summary" $null $tok
Check "analytics: summary" ($null -ne $s.total_patients) ("patients=" + $s.total_patients + " appts_today=" + $s.appointments_today)
$c = Api GET "/api/analytics/consolidated" $null $tok
Check "analytics: consolidated" ($null -ne $c.totals)

# 3. PATIENTS (real schema: first_name/last_name)
$uniq = Get-Random -Maximum 999999
$p1 = Api POST "/api/patients" @{ first_name = "Verify"; last_name = "Test$uniq"; gender = "MALE"; dob = "1990-05-10"; phone = "98$uniq" } $tok
Check "patients: create" ($null -ne $p1.mrn) ("mrn=" + $p1.mrn)
$p2 = Api POST "/api/patients" @{ first_name = "Verify"; last_name = "Test$uniq"; gender = "MALE"; dob = "1990-05-10"; phone = "98$uniq" } $tok
Check "patients: duplicate MPI check" ($null -ne $p2) ("flagged=" + $p2.needs_confirmation)
$plist = Api GET "/api/patients?page=1&page_size=5" $null $tok
Check "patients: list paginated" ($plist.items.Count -le 5 -and $plist.total -gt 0) ("total=" + $plist.total)
$psearch = Api GET "/api/patients?q=Verify" $null $tok
Check "patients: search" ($psearch.items.Count -ge 1)

# 4. APPOINTMENTS (real shapes: /api/doctors, /slots, doctor_profile_id)
$docs = Api GET "/api/doctors" $null $tok
$doc = $docs[0]
Check "appointments: doctor lookup" ($null -ne $doc.id) ("id=" + $doc.id)
$tmr = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
$slots = Api GET "/api/doctors/$($doc.id)/slots?date=$tmr" $null $tok
Check "appointments: slot grid" ($null -ne $slots.slots -and $slots.slots.Count -gt 0) ("slots=" + $slots.slots.Count)
if ($slots.slots.Count -gt 0) {
  $s0 = ($slots.slots | Where-Object { $_.available } | Select-Object -First 1)
  $apt = Api POST "/api/appointments" @{ patient_id = $p1.id; doctor_profile_id = $doc.id; scheduled_date = $tmr; slot_start = $s0.slot_start; slot_end = $s0.slot_end; chief_complaint = "verify-audit" } $tok
  if ($null -eq $apt.id) { $apt = Api POST "/api/appointments" @{ patient_id = $p1.id; doctor_profile_id = $doc.id; scheduled_date = $tmr; slot_start = $s0.start; slot_end = $s0.end; chief_complaint = "verify-audit" } $tok }
  Check "appointments: book" ($null -ne $apt.id) ("id=" + $apt.id + " status=" + $apt.status)
  $dbl = Api POST "/api/appointments" @{ patient_id = $p1.id; doctor_profile_id = $doc.id; scheduled_date = $tmr; slot_start = $s0.slot_start; slot_end = $s0.slot_end } $tok
  Check "appointments: double-booking blocked" ($null -ne $dbl.__error) ("status=" + $dbl.__status)
  if ($null -ne $apt.id) {
    $st = Api PATCH "/api/appointments/$($apt.id)/status" @{ status = "CHECKED_IN" } $tok
    Check "appointments: status machine" ($null -ne $st.status -and $null -eq $st.__error) ("status=" + $st.status)
  }
}

# 5. BILLING (routes: /api/services, /api/invoices)
$svc = Api GET "/api/services" $null $tok
Check "billing: service catalog" ($svc.Count -gt 0) ("items=" + $svc.Count)
if ($svc.Count -gt 0 -and $null -ne $p1.id) {
  $inv = Api POST "/api/invoices" @{ patient_id = $p1.id; lines = @(@{ description = $svc[0].name; quantity = 1; unit_price = $svc[0].price }) } $tok
  Check "billing: draft invoice" ($inv.status -eq "DRAFT") ("total=" + $inv.grand_total)
  $iss = Api POST "/api/invoices/$($inv.id)/issue" $null $tok
  Check "billing: issue" ($iss.status -eq "ISSUED") ("no=" + $iss.invoice_no)
  $pay = Api POST "/api/invoices/$($inv.id)/payments" @{ amount = $iss.grand_total; method = "CASH" } $tok
  Check "billing: payment recorded" ($null -ne $pay.id -and $null -eq $pay.__error) ("payment_id=" + $pay.id + " amount=" + $pay.amount)
}

# 6. AI COPILOTS
$scr = Api POST "/api/ai/scribe/draft" @{ transcript = "Patient reports fever for two days with cough and mild breathlessness. Doctor: any chest pain? Patient: no chest pain." } $tok
Check "ai: scribe draft" ($null -ne $scr.subjective -and $null -ne $scr.disclaimer) ("provider=" + $scr.provider)
$code = Api POST "/api/ai/coding/suggest" @{ text = "Type 2 diabetes mellitus without complications, uncontrolled" } $tok
Check "ai: coding suggestions" ($code.Count -ge 1) ("top=" + $code[0].code)
$know = Api GET "/api/ai/knowledge/search?q=sepsis" $null $tok
Check "ai: knowledge RAG" ($null -ne $know.hits -and $know.hits.Count -ge 1) ("hits=" + $know.hits.Count + " err=" + $know.__error)
$ask = Api POST "/api/analytics/ask?question=how%20many%20patients%20today" $null $tok
Check "ai: conversational analytics" ($null -ne $ask.answer) ("supported=" + $ask.supported)

# 7. MODULES
$rad = Api GET "/api/radiology/orders" $null $tok
Check "radiology: worklist" ($null -ne $rad) ("count=" + $rad.Count)
$ot = Api GET "/api/ot/rooms" $null $tok
Check "ot: rooms" ($null -ne $ot) ("rooms=" + $ot.Count)
$otb = Api GET "/api/ot/bookings" $null $tok
Check "ot: bookings" ($null -ne $otb)
$ed = Api GET "/api/ed/visits" $null $tok
Check "ed: visits board" ($null -ne $ed)
$bb = Api GET "/api/blood/units" $null $tok
Check "blood: units" ($null -ne $bb)
$hr = Api GET "/api/hr/shifts" $null $tok
Check "hr: shifts" ($null -ne $hr)

# 8. AUDIT + RBAC
$aud = Api GET "/api/audits?page=1&page_size=5" $null $tok
Check "audit: trail populated" ($aud.total -gt 0) ("entries=" + $aud.total)
$recep = Api POST "/api/auth/login" @{ username = "reception.rekha"; password = "Reception@123" } $null
$rtok = $recep.access_token
Check "auth: receptionist login" ($null -ne $rtok)
$ra = Api GET "/api/audits?page=1&page_size=5" $null $rtok
Check "rbac: audit blocked for receptionist" ($null -ne $ra.__error) ("status=" + $ra.__status)

Write-Output ""
Write-Output "RESULT: $pass passed, $fail failed"

