let allStudents = [];
let classId = null;

async function initStudentsPage() {
  const profile = await loadCRProfile();
  if (!profile?.class_id) return;
  classId = profile.class_id;
  await loadStudents();
}

async function loadStudents() {
  const { data: students } = await supabase
    .from("students")
    .select("*")
    .eq("class_id", classId)
    .order("roll_number");

  allStudents = students || [];
  renderStudentsTable(allStudents);
  document.getElementById("studentCount").textContent = `${allStudents.length} students`;
}

function renderStudentsTable(list) {
  const container = document.getElementById("studentsTable");
  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state">👥 No students yet. Add your first student!</div>`;
    return;
  }

  container.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Roll Number</th>
          <th>Full Name</th>
          <th>Email</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map((s, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${s.roll_number}</strong></td>
            <td>${s.full_name}</td>
            <td>${s.email || "--"}</td>
            <td>
              <span class="status-badge ${s.is_active ? 'status-good' : 'status-bad'}">
                ${s.is_active ? "✅ Active" : "❌ Inactive"}
              </span>
            </td>
            <td class="action-col">
              <button class="btn-icon" onclick="openEditModal('${s.id}')">✏️</button>
              <button class="btn-icon danger" onclick="toggleStudentStatus('${s.id}', ${s.is_active})">
                ${s.is_active ? "🚫" : "✅"}
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function filterStudentList() {
  const query = document.getElementById("searchStudents").value.toLowerCase();
  const filtered = allStudents.filter(s =>
    s.full_name.toLowerCase().includes(query) ||
    s.roll_number.toLowerCase().includes(query)
  );
  renderStudentsTable(filtered);
}

async function addStudent(e) {
  e.preventDefault();
  const name = document.getElementById("studentName").value.trim();
  const roll = document.getElementById("studentRoll").value.trim();
  const email = document.getElementById("studentEmail").value.trim();
  const errEl = document.getElementById("addStudentError");

  const { error } = await supabase.from("students").insert({
    full_name: name,
    roll_number: roll,
    email: email || null,
    class_id: classId,
  });

  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove("hidden");
    return;
  }

  closeModal("addStudentModal");
  document.getElementById("studentName").value = "";
  document.getElementById("studentRoll").value = "";
  document.getElementById("studentEmail").value = "";
  await loadStudents();
}

function openEditModal(studentId) {
  const student = allStudents.find(s => s.id === studentId);
  if (!student) return;

  document.getElementById("editStudentId").value = student.id;
  document.getElementById("editStudentName").value = student.full_name;
  document.getElementById("editStudentRoll").value = student.roll_number;
  document.getElementById("editStudentEmail").value = student.email || "";
  openModal("editStudentModal");
}

async function updateStudent(e) {
  e.preventDefault();
  const id = document.getElementById("editStudentId").value;
  const name = document.getElementById("editStudentName").value.trim();
  const roll = document.getElementById("editStudentRoll").value.trim();
  const email = document.getElementById("editStudentEmail").value.trim();
  const errEl = document.getElementById("editStudentError");

  const { error } = await supabase
    .from("students")
    .update({ full_name: name, roll_number: roll, email: email || null })
    .eq("id", id);

  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove("hidden");
    return;
  }

  closeModal("editStudentModal");
  await loadStudents();
}

async function toggleStudentStatus(id, isActive) {
  const msg = isActive
    ? "Deactivate this student? They won't appear in attendance."
    : "Reactivate this student?";

  if (!confirm(msg)) return;

  await supabase.from("students").update({ is_active: !isActive }).eq("id", id);
  await loadStudents();
}

function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}

initStudentsPage();
