// ============================================
// COMPLETE REPLACEMENT FOR js/auth.js
// ============================================

// Check auth on page load
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  const publicPages = ["index.html", "/", "", "index"];
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

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
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;

  const { data: profile, error } = await supabaseClient
    .from("cr_profiles")
    .select("*, classes(*)")
    .eq("id", session.user.id)
    .single();

  if (error) {
    console.error("Profile load error:", error);
    return null;
  }

  if (profile) {
    const nameEl = document.getElementById("crName");
    const classEl = document.getElementById("crClass");
    const avatarEl = document.getElementById("crAvatar");

    if (nameEl) nameEl.textContent = profile.full_name;
    if (classEl) {
      classEl.textContent = profile.classes
        ? `${profile.classes.department} - Sem ${profile.classes.semester} ${profile.classes.section}`
        : "No class assigned";
    }
    if (avatarEl) avatarEl.textContent = profile.full_name.charAt(0).toUpperCase();
  }

  return profile;
}

// Logout
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

// Toggle sidebar
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.toggle("open");
}

// Toggle password visibility
function togglePassword(id) {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
}

// Switch login/register tabs
function switchTab(tab) {
  const loginBtn = document.getElementById("tabLogin");
  const regBtn = document.getElementById("tabRegister");
  const loginForm = document.getElementById("loginForm");
  const regForm = document.getElementById("registerForm");

  if (tab === "login") {
    loginBtn.classList.add("active");
    regBtn.classList.remove("active");
    loginForm.classList.remove("hidden");
    regForm.classList.add("hidden");
  } else {
    regBtn.classList.add("active");
    loginBtn.classList.remove("active");
    regForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
  }
}

// Forgot password
async function forgotPassword() {
  const email = prompt("Enter your registered email:");
  if (!email) return;

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
  if (error) {
    alert("Error: " + error.message);
  } else {
    alert("✅ Password reset email sent! Check your inbox.");
  }
}

// Set loading state
function setButtonLoading(btnId, isLoading, originalText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "⏳ Please wait..." : originalText;
}

// Show message
function showMessage(id, msg, isError = true) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = isError ? "error-msg" : "success-msg";
  el.classList.remove("hidden");
}

// Hide message
function hideMessage(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

// =====================
// LOGIN FORM
// =====================
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessage("loginError");

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      showMessage("loginError", "Please enter email and password");
      return;
    }

    setButtonLoading("loginBtn", true, "Login");

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showMessage("loginError", error.message);
      setButtonLoading("loginBtn", false, "Login");
    } else {
      window.location.href = "dashboard.html";
    }
  });
}

// =====================
// REGISTER FORM
// =====================
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessage("registerError");
    hideMessage("registerSuccess");

    const name = document.getElementById("regName").value.trim();
    const roll = document.getElementById("regRoll").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const dept = document.getElementById("regDept").value;
    const sem = document.getElementById("regSem").value;
    const section = document.getElementById("regSection").value;

    // Validation
    if (!name || !roll || !email || !password || !dept || !sem || !section) {
      showMessage("registerError", "⚠️ Please fill in all required fields");
      return;
    }

    if (password.length < 6) {
      showMessage("registerError", "⚠️ Password must be at least 6 characters");
      return;
    }

    setButtonLoading("registerBtn", true, "Create Account");

    // Step 1: Create Supabase auth user
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    if (authError) {
      showMessage("registerError", "❌ " + authError.message);
      setButtonLoading("registerBtn", false, "Create Account");
      return;
    }

    if (!authData.user) {
      showMessage("registerError", "❌ Sign up failed. Try again.");
      setButtonLoading("registerBtn", false, "Create Account");
      return;
    }

    // Step 2: Create class record
    const { data: classData, error: classError } = await supabaseClient
      .from("classes")
      .insert({
        name: `${dept} - Sec ${section}`,
        department: dept,
        semester: parseInt(sem),
        section: section,
      })
      .select()
      .single();

    if (classError) {
      showMessage("registerError", "❌ Class setup failed: " + classError.message);
      setButtonLoading("registerBtn", false, "Create Account");
      return;
    }

    // Step 3: Create CR profile
    const { error: profileError } = await supabaseClient
      .from("cr_profiles")
      .insert({
        id: authData.user.id,
        full_name: name,
        roll_number: roll,
        email: email,
        class_id: classData.id,
      });

    if (profileError) {
      showMessage("registerError", "❌ Profile setup failed: " + profileError.message);
      setButtonLoading("registerBtn", false, "Create Account");
      return;
    }

    // Success
    showMessage(
      "registerSuccess",
      "✅ Account created successfully! Please check your email to verify, then login.",
      false
    );
    setButtonLoading("registerBtn", false, "Create Account");
    registerForm.reset();
  });
}

// =====================
// TODAY DATE DISPLAY
// =====================
const todayEl = document.getElementById("todayDate");
if (todayEl) {
  todayEl.textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// =====================
// INIT
// =====================
(async () => {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const isPublicPage = ["index.html", "", "index"].includes(currentPage);

  await checkAuth();

  if (!isPublicPage) {
    await loadCRProfile();
  }
})();
