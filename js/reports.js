let allSessions = [];
let allStudents = [];
let allRecords = [];
let profile = null;

async function initReports() {
  profile = await loadCRProfile();
  if (!profile?.class_id) return;

  // Set default date range (last 30 days)
  const today = new Date();
  const last30 = new Date(today);
  last30.setDate(today.getDate() - 30);

  document.getElementById("filterFrom").value = last30.toISOString().split("T")[0];
  document.getElementById("filterTo").value = today.toISOString().split("T")[0];

  // Load subjects for filter
  const { data: subjects } = await supabase
    .from("subjects")
    .select("*")
    .eq("class_id", profile.class_id);

  const filterSubject = document.getElementById("filterSubject");
  filterSubject.innerHTML = `<option value="">All Subjects</option>` +
    (subjects || []).map(s => `<option value="${s.id}">${s.name}</option>`).join("");

  // Load students
  const { data: students } = await supabase
    .from("students")
    .select("*")
    .eq("class_id", profile.class_id)
    .eq("is_active", true)
    .order("roll_number");

  allStudents = students || [];

  await loadReport();
}

async function loadReport() {
  if (!profile?.class_id) return;

  const subjectId = document.getElementById("filterSubject").value;
  const fromDate = document.getElementById("filterFrom").value;
  const toDate = document.getElementById("filterTo").value;
  const viewType = document.getElementById("viewType").value;

  // Load sessions
  let sessionQuery = supabase
    .from("attendance_sessions")
    .select("*, subjects(name, code)")
    .eq("class_id", profile.class_id)
    .order("date", { ascending: false });

  if (subjectId) sessionQuery = sessionQuery.eq("subject_id", subjectId);
  if (fromDate) sessionQuery = sessionQuery.gte("date", fromDate);
  if (toDate) sessionQuery = sessionQuery.lte("date", toDate);

  const { data: sessions } = await sessionQuery;
  allSessions = sessions || [];

  if (allSessions.length === 0) {
    document.getElementById("reportTable").innerHTML =
      `<div class="empty-state">📭 No sessions found for selected filters</div>`;
    updateReportStats([], []);
    return;
  }

  const sessionIds = allSessions.map(s => s.id);

  // Load records
  const { data: records } = await supabase
    .from("attendance_records")
    .select("*, students(full_name, roll_number)")
    .in("session_id", sessionIds);

  allRecords = records || [];

  updateReportStats(allSessions, allRecords);

  if (viewType === "student") {
    renderStudentReport();
  } else {
    renderSessionReport();
  }

  renderLowAttendance();
}

function updateReportStats(sessions, records) {
  document.getElementById("rTotalSessions").textContent = sessions.length;

  if (sessions.length === 0 || allStudents.length === 0) {
    document.getElementById("rAvgAttendance").textContent = "--";
    document.getElementById("rBelow75").textContent = "--";
    document.getElementById("rPerfect").textContent = "--";
    return;
  }

  const studentStats = computeStudentStats(sessions, records);
  const percentages = Object.values(studentStats).map(s => s.percentage);

  const avg = percentages.length > 0
    ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
    : 0;

  document.getElementById("rAvgAttendance").textContent = avg + "%";
  document.getElementById("rBelow75").textContent = percentages.filter(p => p < 75).length;
  document.getElementById("rPerfect").textContent = percentages.filter(p => p === 100).length;
}

function computeStudentStats(sessions, records) {
  const stats = {};
  const totalSessions = sessions.length;

  allStudents.forEach(student => {
    const studentRecords = records.filter(r => r.student_id === student.id);
    const present = studentRecords.filter(r => r.status === "present" || r.status === "late").length;
    const absent = studentRecords.filter(r => r.status === "absent").length;
    const percentage = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0;

    stats[student.id] = {
      student,
      present,
      absent,
      totalSessions,
      percentage,
    };
  });

  return stats;
}

function renderStudentReport() {
  const studentStats = computeStudentStats(allSessions, allRecords);
  const sortedStats = Object.values(studentStats).sort((a, b) =>
    a.student.roll_number.localeCompare(b.student.roll_number)
  );

  let html = `
    <div class="table-scroll">
      <table class="report-table">
        <thead>
          <tr>
            <th>Roll No.</th>
            <th>Student Name</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Total</th>
            <th>Attendance %</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
  `;

  sortedStats.forEach(stat => {
    const statusClass = stat.percentage >= 75 ? "status-good" : "status-bad";
    const statusText = stat.percentage >= 75 ? "✅ OK" : "⚠️ Low";

    html += `
      <tr class="${stat.percentage < 75 ? 'row-danger' : ''}">
        <td><strong>${stat.student.roll_number}</strong></td>
        <td>${stat.student.full_name}</td>
        <td class="text-green">${stat.present}</td>
        <td class="text-red">${stat.absent}</td>
        <td>${stat.totalSessions}</td>
        <td>
          <div class="mini-progress">
            <div class="mini-bar ${stat.percentage >= 75 ? 'bar-green' : 'bar-red'}"
                 style="width: ${stat.percentage}%"></div>
          </div>
          <span class="pct-label">${stat.percentage}%</span>
        </td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  document.getElementById("reportTable").innerHTML = html;
}

function renderSessionReport() {
  let html = `
    <div class="table-scroll">
      <table class="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Subject</th>
            <th>Lecture #</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Late</th>
            <th>Attendance %</th>
          </tr>
        </thead>
        <tbody>
  `;

  allSessions.forEach(session => {
    const sessionRecords = allRecords.filter(r => r.session_id === session.id);
    const present = sessionRecords.filter(r => r.status === "present").length;
    const absent = sessionRecords.filter(r => r.status === "absent").length;
    const late = sessionRecords.filter(r => r.status === "late").length;
    const total = sessionRecords.length;
    const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    html += `
      <tr>
        <td>${formatDate(session.date)}</td>
        <td>${session.subjects?.name || "--"}</td>
        <td>${session.lecture_number || "--"}</td>
        <td class="text-green">${present}</td>
        <td class="text-red">${absent}</td>
        <td class="text-orange">${late}</td>
        <td>
          <div class="mini-progress">
            <div class="mini-bar ${pct >= 75 ? 'bar-green' : 'bar-red'}" style="width: ${pct}%"></div>
          </div>
          <span class="pct-label">${pct}%</span>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  document.getElementById("reportTable").innerHTML = html;
}

function renderLowAttendance() {
  const studentStats = computeStudentStats(allSessions, allRecords);
  const lowStudents = Object.values(studentStats).filter(s => s.percentage < 75);
  const container = document.getElementById("lowAttendanceList");

  if (lowStudents.length === 0) {
    container.innerHTML = `<div class="empty-state success">🎉 All students have attendance above 75%!</div>`;
    return;
  }

  container.innerHTML = lowStudents.map(s => `
    <div class="alert-item">
      <div class="alert-left">
        <span class="alert-icon">⚠️</span>
        <div>
          <div class="alert-name">${s.student.full_name}</div>
          <div class="alert-roll">${s.student.roll_number}</div>
        </div>
      </div>
      <div class="alert-right">
        <span class="pct-badge danger">${s.percentage}%</span>
        <span class="alert-detail">${s.present}/${s.totalSessions} classes</span>
      </div>
    </div>
  `).join("");
}

function exportCSV() {
  const studentStats = computeStudentStats(allSessions, allRecords);
  const rows = [["Roll Number", "Student Name", "Present", "Absent", "Total Sessions", "Attendance %", "Status"]];

  Object.values(studentStats).forEach(s => {
    rows.push([
      s.student.roll_number,
      s.student.full_name,
      s.present,
      s.absent,
      s.totalSessions,
      s.percentage + "%",
      s.percentage >= 75 ? "OK" : "Low Attendance",
    ]);
  });

  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_report_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

initReports();
