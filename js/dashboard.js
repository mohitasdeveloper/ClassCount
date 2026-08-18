async function loadDashboard() {
  const profile = await loadCRProfile();
  if (!profile?.class_id) return;

  const classId = profile.class_id;
  const today = new Date().toISOString().split("T")[0];

  // Total students
  const { count: studentCount } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("is_active", true);

  document.getElementById("totalStudents").textContent = studentCount || 0;

  // Total sessions
  const { count: sessionCount } = await supabase
    .from("attendance_sessions")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId);

  document.getElementById("totalSessions").textContent = sessionCount || 0;

  // Today's stats
  const { data: todaySessions } = await supabase
    .from("attendance_sessions")
    .select("id")
    .eq("class_id", classId)
    .eq("date", today);

  if (todaySessions?.length > 0) {
    const sessionIds = todaySessions.map(s => s.id);

    const { count: presentCount } = await supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .in("session_id", sessionIds)
      .eq("status", "present");

    const { count: absentCount } = await supabase
      .from("attendance_records")
      .select("*", { count: "exact", head: true })
      .in("session_id", sessionIds)
      .eq("status", "absent");

    document.getElementById("todayPresent").textContent = presentCount || 0;
    document.getElementById("todayAbsent").textContent = absentCount || 0;
  } else {
    document.getElementById("todayPresent").textContent = "N/A";
    document.getElementById("todayAbsent").textContent = "N/A";
  }

  // Recent sessions
  await loadRecentSessions(classId);

  // Today's absentees
  await loadTodayAbsentees(classId, today);
}

async function loadRecentSessions(classId) {
  const { data: sessions } = await supabase
    .from("attendance_sessions")
    .select("*, subjects(name)")
    .eq("class_id", classId)
    .order("created_at", { ascending: false })
    .limit(5);

  const container = document.getElementById("recentSessions");

  if (!sessions || sessions.length === 0) {
    container.innerHTML = `<div class="empty-state">📭 No sessions yet. <a href="mark-attendance.html">Mark attendance</a></div>`;
    return;
  }

  container.innerHTML = sessions.map(s => `
    <div class="list-item">
      <div class="list-item-left">
        <div class="list-icon">📖</div>
        <div>
          <div class="list-title">${s.subjects?.name || "Unknown Subject"}</div>
          <div class="list-sub">Lecture ${s.lecture_number || "--"} • ${formatDate(s.date)}</div>
        </div>
      </div>
      <div class="list-item-right">
        <a href="reports.html" class="tag-btn">View</a>
      </div>
    </div>
  `).join("");
}

async function loadTodayAbsentees(classId, today) {
  const { data: sessions } = await supabase
    .from("attendance_sessions")
    .select("id")
    .eq("class_id", classId)
    .eq("date", today);

  const container = document.getElementById("todayAbsentees");

  if (!sessions || sessions.length === 0) {
    container.innerHTML = `<div class="empty-state">📭 No attendance marked today</div>`;
    return;
  }

  const sessionIds = sessions.map(s => s.id);

  const { data: absentees } = await supabase
    .from("attendance_records")
    .select("*, students(full_name, roll_number)")
    .in("session_id", sessionIds)
    .eq("status", "absent");

  if (!absentees || absentees.length === 0) {
    container.innerHTML = `<div class="empty-state success">🎉 No absentees today!</div>`;
    return;
  }

  // Unique students
  const unique = [...new Map(absentees.map(a => [a.student_id, a])).values()];

  container.innerHTML = unique.map(a => `
    <div class="absentee-chip">
      <span>❌</span>
      <span>${a.students?.full_name}</span>
      <span class="roll-tag">${a.students?.roll_number}</span>
    </div>
  `).join("");
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

// Init
loadDashboard();
