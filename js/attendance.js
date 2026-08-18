let currentSession = null;
let students = [];
let attendance = {};

async function initAttendancePage() {
  const profile = await loadCRProfile();
  if (!profile?.class_id) {
    document.getElementById("sessionError").textContent = "No class assigned to your profile.";
    document.getElementById("sessionError").classList.remove("hidden");
    return;
  }

  // Set today's date
  document.getElementById("attendanceDate").value = new Date().toISOString().split("T")[0];

  // Load subjects
  const { data: subjects } = await supabase
    .from("subjects")
    .select("*")
    .eq("class_id", profile.class_id)
    .order("name");

  const select = document.getElementById("subjectSelect");
  if (!subjects || subjects.length === 0) {
    select.innerHTML = `<option value="">No subjects found - <a href="subjects.html">Add subjects</a></option>`;
  } else {
    select.innerHTML = `<option value="">Select Subject</option>` +
      subjects.map(s => `<option value="${s.id}">${s.name} (${s.code})</option>`).join("");
  }

  // Load students
  const { data: studentList } = await supabase
    .from("students")
    .select("*")
    .eq("class_id", profile.class_id)
    .eq("is_active", true)
    .order("roll_number");

  students = studentList || [];
}

async function startSession() {
  const subjectId = document.getElementById("subjectSelect").value;
  const lectureNo = document.getElementById("lectureNo").value;
  const date = document.getElementById("attendanceDate").value;
  const notes = document.getElementById("sessionNotes").value;
  const errEl = document.getElementById("sessionError");

  if (!subjectId) {
    showEl(errEl, "Please select a subject");
    return;
  }
  if (!date) {
    showEl(errEl, "Please select a date");
    return;
  }
  if (students.length === 0) {
    showEl(errEl, "No students in your class. Please add students first.");
    return;
  }

  errEl.classList.add("hidden");

  // Get subject name
  const subjectSelect = document.getElementById("subjectSelect");
  const subjectName = subjectSelect.options[subjectSelect.selectedIndex].text;

  currentSession = { subjectId, subjectName, lectureNo, date, notes };

  // Init attendance as absent
  attendance = {};
  students.forEach(s => (attendance[s.id] = "absent"));

  // Show attendance section
  document.getElementById("sessionSetup").classList.add("hidden");
  document.getElementById("attendanceSection").classList.remove("hidden");
  document.getElementById("sessionSubject").textContent = `📖 ${subjectName}`;
  document.getElementById("sessionDate").textContent = `📅 ${formatDate(date)}`;

  renderStudentList(students);
  updateCounters();
}

function renderStudentList(list) {
  const container = document.getElementById("studentsList");
  document.getElementById("totalCount").textContent = students.length;

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state">No students found</div>`;
    return;
  }

  container.innerHTML = list.map(s => `
    <div class="student-attendance-row" id="row-${s.id}">
      <div class="student-info-col">
        <div class="student-avatar">${s.full_name.charAt(0)}</div>
        <div>
          <div class="student-name">${s.full_name}</div>
          <div class="student-roll">${s.roll_number}</div>
        </div>
      </div>
      <div class="attendance-btns">
        <button class="att-btn present ${attendance[s.id] === 'present' ? 'active' : ''}"
                onclick="setStatus('${s.id}', 'present')">✅ Present</button>
        <button class="att-btn absent ${attendance[s.id] === 'absent' ? 'active' : ''}"
                onclick="setStatus('${s.id}', 'absent')">❌ Absent</button>
        <button class="att-btn late ${attendance[s.id] === 'late' ? 'active' : ''}"
                onclick="setStatus('${s.id}', 'late')">⏰ Late</button>
      </div>
    </div>
  `).join("");
}

function setStatus(studentId, status) {
  attendance[studentId] = status;

  // Update button UI
  const row = document.getElementById(`row-${studentId}`);
  row.querySelectorAll(".att-btn").forEach(btn => btn.classList.remove("active"));
  row.querySelector(`.att-btn.${status}`).classList.add("active");

  updateCounters();
}

function updateCounters() {
  const values = Object.values(attendance);
  const present = values.filter(v => v === "present").length;
  const absent = values.filter(v => v === "absent").length;
  const late = values.filter(v => v === "late").length;
  const marked = present + late; // late counts as marked/present-ish

  document.getElementById("presentCount").textContent = present;
  document.getElementById("absentCount").textContent = absent;
  document.getElementById("lateCount").textContent = late;
  document.getElementById("markedCount").textContent = present + late + absent;

  const pct = students.length > 0 ? ((present + late) / students.length) * 100 : 0;
  document.getElementById("progressBar").style.width = pct + "%";
  document.getElementById("progressBar").style.background = pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
}

function markAll(status) {
  students.forEach(s => {
    attendance[s.id] = status;
  });
  renderStudentList(students);
  updateCounters();
}

function filterStudents() {
  const query = document.getElementById("searchStudent").value.toLowerCase();
  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(query) ||
    s.roll_number.toLowerCase().includes(query)
  );
  renderStudentList(filtered);
}

function cancelSession() {
  currentSession = null;
  attendance = {};
  document.getElementById("attendanceSection").classList.add("hidden");
  document.getElementById("sessionSetup").classList.remove("hidden");
}

async function submitAttendance() {
  if (!currentSession) return;

  const profile = await loadCRProfile();
  const submitBtn = document.getElementById("submitBtn");
  const errEl = document.getElementById("submitError");
  const successEl = document.getElementById("submitSuccess");

  submitBtn.disabled = true;
  submitBtn.textContent = "⏳ Saving...";
  errEl.classList.add("hidden");
  successEl.classList.add("hidden");

  // Create session
  const { data: sessionData, error: sessionErr } = await supabase
    .from("attendance_sessions")
    .insert({
      class_id: profile.class_id,
      subject_id: currentSession.subjectId,
      cr_id: profile.id,
      date: currentSession.date,
      lecture_number: currentSession.lectureNo ? parseInt(currentSession.lectureNo) : null,
      notes: currentSession.notes || null,
    })
    .select()
    .single();

  if (sessionErr) {
    showEl(errEl, "Failed to create session: " + sessionErr.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "💾 Save Attendance";
    return;
  }

  // Insert attendance records
  const records = students.map(s => ({
    session_id: sessionData.id,
    student_id: s.id,
    status: attendance[s.id] || "absent",
  }));

  const { error: recordsErr } = await supabase
    .from("attendance_records")
    .insert(records);

  if (recordsErr) {
    showEl(errEl, "Failed to save records: " + recordsErr.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "💾 Save Attendance";
    return;
  }

  showEl(successEl, `✅ Attendance saved for ${students.length} students!`, false);
  submitBtn.textContent = "✅ Saved!";

  setTimeout(() => {
    cancelSession();
    submitBtn.disabled = false;
    submitBtn.textContent = "💾 Save Attendance";
    successEl.classList.add("hidden");
  }, 2000);
}

function showEl(el, msg, isError = true) {
  el.textContent = msg;
  el.className = isError ? "error-msg" : "success-msg";
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

initAttendancePage();
