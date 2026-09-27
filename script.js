const form = document.getElementById("mp-contact-form");
const inputUsername = document.getElementById("username");
const inputPassword = document.getElementById("password");
const statusLogin = document.getElementById("status-login");
const submitBtn = document.getElementById("submit-btn");

function setStatus(message, type) {
  // type: "loading" | "error" | null (hide)
  statusLogin.classList.remove("is-loading", "is-error", "is-visible");

  if (!message) {
    statusLogin.textContent = "";
    return;
  }

  statusLogin.textContent = message;
  statusLogin.classList.add("is-visible");
  if (type === "loading") statusLogin.classList.add("is-loading");
  if (type === "error") statusLogin.classList.add("is-error");
}

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  submitBtn.querySelector(".submit-btn-label").textContent = isSubmitting
    ? "Logging in..."
    : "Login";
}

async function handleLogin(username, password) {
  setSubmitting(true);
  setStatus("Sedang memverifikasi akun...", "loading"); // 1. Loading state

  try {
    const respon = await fetch("https://dummyjson.com/users");

    if (!respon.ok) {
      throw new Error(`Gagal terhubung ke server (status ${respon.status})`);
    }

    const data = await respon.json();
    const daftarUser = data.users;

    const userDitemukan = daftarUser.find(
      (u) => u.username === username && u.password === password,
    );

    if (!userDitemukan) {
      setStatus("Username atau password salah.", "error"); // 2. Error: kredensial salah
      setSubmitting(false);
      return;
    }

    // 3. Success: simpan sesi dan redirect
    localStorage.setItem("firstName", userDitemukan.firstName);
    setStatus(`Berhasil masuk, mengalihkan...`, "loading");

    window.location.href = "catalog.html";
  } catch (error) {
    // 4. Error: koneksi/API bermasalah
    setStatus(`Terjadi kesalahan: ${error.message}`, "error");
    setSubmitting(false);
  }
}

// Jika sudah ada sesi login, langsung arahkan ke katalog produk
if (localStorage.getItem("firstName")) {
  window.location.href = "catalog.html";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = inputUsername.value.trim();
  const password = inputPassword.value.trim();

  if (!username || !password) {
    setStatus("Username dan password wajib diisi.", "error");
    return;
  }

  handleLogin(username, password);
});
