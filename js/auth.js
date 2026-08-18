// Check auth on page load
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  const publicPages = ["index.html", "/", ""];
  const currentPage = window.location.pathname.split("/").pop();

  if (!session && !publicPages.includes(currentPage)) {
    window.location.href = "index.html";
    return null;
  }

  if (session && publicPages.includes(currentPage)) {
    window.location.href = "dashboard.html";
    return null;
  }

  return session;
}

// Load CR profile into sidebar
async function loadCRProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: profile } = await supabase
    .from("cr_profiles")
    .select("*, classes(*)")
    .eq("id", session.user.id)
    .single();

  if (profile) {
    const nameEl = document.getElementById("crName");
    const classEl = document.getElementById("crClass");
    const avatarEl = document.getElementById("crAvatar");

    if (nameEl) nameEl.textContent = profile.full_name;
    if (classEl) classEl.textContent = profile.classes
      ? `${profile.classes.department} - Sem ${profile.classes.semester}${profile.classes.section}`
      : "No class assigned";
    if (avatarEl) avatarEl.textContent = profile.full_name.charAt(0).toUpperCase();
  }

  return profile;
}

// Logout
async function logout() {
  await supabase.auth.signOut();
  window.location.href = "index.html";
}

// Toggle sidebar
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// Toggle password visibility
function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

// Switch login/register tabs
function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".auth-form").forEach(f => f.classList.add("hidden"));

  document.querySelector(`.tab-btn:${tab === "login" ? "first" : "last"}-child`)
    .classList.add("active");
  document.getElementById(tab === "login" ? "loginForm" : "registerForm")
    .classList.remove("hidden");
}

// Forgot password
async function forgotPassword() {
  const email = prompt("Enter your registered email:");
  if (!email) return;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/index.html`,
  });

  if (error) alert("Error: " + error.message);
  else alert("Password reset email sent! Check your inbox.");
}

// Set loading state on button
function setLoading(btnId, loaderId, isLoading) {
  document.querySelector(`#${btnId} .btn-text`).classList.toggle("hidden", isLoading);
  document.querySelector(`#${btnId} .btn-loader`).classList.toggle("hidden", !isLoading);
  document.getElementById(btnId).disabled = isLoading;
}

// Show error/success message
function showMsg(id, msg, isError = true) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = isError ? "error-msg" : "success-msg";
}

// Login Form Submit
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  setLoading("loginBtn", "loginBtn", true);
  document.getElementById("loginError").classList.add("hidden");

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showMsg("loginError", error.message);
    setLoading("loginBtn", "loginBtn", false);
  } else {
    window.location.href = "dashboard.html";
  }
});

// Register Form Submit
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("regName").value.trim();
  const roll = document.getElementById("regRoll").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const dept = document.getElementById("regDept").value;
  const sem = document.getElementById("regSem").value;
  const section = document.getElementById("regSection").value;

  if (!name || !roll || !email || !password || !dept || !sem || !section) {
    showMsg("registerError", "Please fill all required fields");
    return;
  }

  setLoading("registerBtn", "registerBtn", true);

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    showMsg("registerError", authError.message);
    setLoading("registerBtn", "registerBtn", false);
    return;
  }

  // 2. Create class
  const { data: classData, error: classError } = await supabase
    .from("classes")
    .insert({ name: `${dept} - ${section}`, department: dept, semester: parseInt(sem), section })
    .select()
    .single();

  if (classError) {
    showMsg("registerError", "Failed to create class: " + classError.message);
    setLoading("registerBtn", "registerBtn", false);
    return;
  }

  // 3. Create CR profile
  const { error: profileError } = await supabase.from("cr_profiles").insert({
    id: authData.user.id,
    full_name: name,
    roll_number: roll,
    email,
    class_id: classData.id,
  });

  if (profileError) {
    showMsg("registerError", "Profile creation failed: " + profileError.message);
    setLoading("registerBtn", "registerBtn", false);
    return;
  }

  showMsg("registerSuccess", "✅ Account created! Please check your email to verify.", false);
  setLoading("registerBtn", "registerBtn", false);
  document.getElementById("registerForm").reset();
});

// Today's date display
const todayEl = document.getElementById("todayDate");
if (todayEl) {
  todayEl.textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

// Init
(async () => {
  await checkAuth();
  const currentPage = window.location.pathname.split("/").pop();
  if (!["index.html", "", "/"].includes(currentPage)) {
    await loadCRProfile();
  }
})();
