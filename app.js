
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ulofkckropitsrgwtkdn.supabase.co";
const SUPABASE_KEY = "sb_publishable_Qg5X1BAbzDs3r4cT3Z77Jg_M1NK2jhm";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const $ = id => document.getElementById(id);

let session = null;
let profile = null;
let batches = [];
let users = [];
let loading = false;

const isAdmin = () =>
  profile?.role === "admin" && profile?.status === "approved";

const isApproved = () =>
  profile?.status === "approved";

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);

const fmt = value =>
  value ? new Date(value).toLocaleString("ar-IQ") : "—";

const dateFmt = value => value || "—";

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

function setLoading(value) {
  loading = value;
  const button = $("addBatchBtn");
  if (button) button.disabled = value;
}

function renderAccess() {
  $("currentUser").textContent = session
    ? `${profile?.full_name || session.user.email} (${isAdmin() ? "مدير" : "مشاهد"})`
    : "زائر";

  $("logoutBtn").classList.toggle("hidden", !session);
  $("openLoginBtn").classList.toggle("hidden", !!session);

  $("accessNotice").classList.toggle("hidden", isApproved());
  $("appContent").classList.toggle("hidden", !isApproved());
  $("adminPanel").classList.toggle("hidden", !isAdmin());

  document.querySelectorAll(".admin-only").forEach(el => {
    el.classList.toggle("hidden", !isAdmin());
  });
}

async function loadProfile() {
  if (!session) {
    profile = null;
    renderAccess();
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role,status")
    .eq("id", session.user.id)
    .single();

  if (error) {
    console.error("Profile error:", error);
    toast("تعذر تحميل بيانات الحساب");
    profile = null;
    renderAccess();
    return;
  }

  profile = data;
  renderAccess();

  if (isApproved()) {
    await loadBatches();
    if (isAdmin()) await loadUsers();
  }
}

async function loadBatches() {
  const { data, error } = await supabase
    .from("batches")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Load batches error:", error);
    toast("تعذر تحميل الوجبات: " + error.message);
    return;
  }

  batches = data || [];
  render();
}

async function loadUsers() {
  if (!isAdmin()) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role,status,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load users error:", error);
    toast("تعذر تحميل طلبات الحسابات");
    return;
  }

  users = data || [];
  renderRequests();
}

function render() {
  renderAccess();

  if (!isApproved()) return;

  const active = batches
    .filter(b => !b.archived)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const archived = batches
    .filter(b => b.archived)
    .sort((a, b) => new Date(b.archived_at) - new Date(a.archived_at));

  $("activeCount").textContent = active.length;

  $("eggCount").textContent = active
    .reduce((sum, b) => sum + Number(b.eggs || 0), 0)
    .toLocaleString("en-US");

  $("archiveCount").textContent = archived.length;
  $("pendingCount").textContent =
    users.filter(u => u.status === "pending").length;

  $("archiveLabel").textContent = `${archived.length} سجل`;

  $("activeTable").innerHTML = active.length
    ? active.map(b => `
      <tr>
        <td><b>${esc(b.number)}</b></td>
        <td>${esc(b.machine)}</td>
        <td>${esc(b.cartons)}</td>
        <td>${Number(b.eggs).toLocaleString("en-US")}</td>
        <td>${esc(b.type)}</td>
        <td>${dateFmt(b.entry_date)}</td>
        <td>${fmt(b.start_at)}</td>
        <td>${fmt(b.temperature_at)}</td>
        <td>${esc(b.trolleys ?? "—")}</td>
        <td>${esc(b.candling)}
          ${b.candling_at ? `<small>${fmt(b.candling_at)}</small>` : ""}
        </td>
        <td>${esc(b.transfer)}
          ${b.transfer_at ? `<small>${fmt(b.transfer_at)}</small>` : ""}
        </td>
        <td><span class="status">${esc(b.hatch_status)}</span></td>
        <td>
          ${isAdmin() ? `
            <button class="mini-btn edit" data-edit="${b.id}">تعديل</button>
            <button class="mini-btn archive" data-archive="${b.id}">تحويل للسجلات</button>
          ` : "—"}
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="13" class="empty">لا توجد وجبات نشطة حالياً.</td></tr>`;

  $("archiveTable").innerHTML = archived.length
    ? archived.map(b => `
      <tr>
        <td><b>${esc(b.number)}</b></td>
        <td>${esc(b.machine)}</td>
        <td>${Number(b.eggs).toLocaleString("en-US")}</td>
        <td>${esc(b.type)}</td>
        <td>${dateFmt(b.entry_date)}</td>
        <td>${fmt(b.archived_at)}</td>
        <td>${esc(b.chicks ?? "—")}</td>
        <td>
          ${b.eggs && b.chicks !== "" && b.chicks != null
            ? `${(Number(b.chicks) / Number(b.eggs) * 100).toFixed(1)}%`
            : "—"}
        </td>
        <td><button class="mini-btn view" data-view="${b.id}">عرض السجل</button></td>
      </tr>
    `).join("")
    : `<tr><td colspan="9" class="empty">لا توجد سجلات مؤرشفة.</td></tr>`;

  renderRequests();
}

function renderRequests() {
  if (!isAdmin()) return;

  const pending = users.filter(u => u.status === "pending");

  $("requestsList").innerHTML = pending.length
    ? pending.map(u => `
      <div class="request">
        <div>
          <b>${esc(u.full_name)}</b>
          <small>${esc(u.id)} · طلب انضمام</small>
        </div>
        <div class="request-actions">
          <button class="mini-btn approve" data-approve="${u.id}">موافقة</button>
          <button class="mini-btn reject" data-reject="${u.id}">رفض</button>
        </div>
      </div>
    `).join("")
    : `<p class="empty">لا توجد طلبات معلقة.</p>`;
}

function showAuth(tab = "login") {
  $("authDialog").showModal();
  switchAuth(tab);
}

function switchAuth(tab) {
  $("loginForm").classList.toggle("hidden", tab !== "login");
  $("registerForm").classList.toggle("hidden", tab !== "register");

  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.authTab === tab);
  });

  $("authTitle").textContent =
    tab === "login" ? "تسجيل الدخول" : "طلب إنشاء حساب";
}

$("openLoginBtn").onclick = () => showAuth("login");
$("noticeRegisterBtn").onclick = () => showAuth("register");

document.querySelectorAll("[data-auth-tab]").forEach(button => {
  button.onclick = () => switchAuth(button.dataset.authTab);
});

document.querySelectorAll("[data-close]").forEach(button => {
  button.onclick = () => $(button.dataset.close).close();
});

// تسجيل الدخول
$("loginForm").onsubmit = async e => {
  e.preventDefault();

  if (loading) return;
  setLoading(true);

  try {
    const email = $("loginEmail").value.trim().toLowerCase();
    const password = $("loginPassword").value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    session = data.session;
    await loadProfile();

    if (!profile) {
      toast("تعذر قراءة ملف الحساب");
      return;
    }

    if (profile.status !== "approved") {
      await supabase.auth.signOut();
      session = null;
      profile = null;
      renderAccess();

      toast(profile?.status === "pending"
        ? "الحساب بانتظار موافقة المدير"
        : "الحساب غير مفعل");
      return;
    }

    $("authDialog").close();
    $("loginForm").reset();
    toast("أهلاً بك في مفقس خيرات أربيل");

  } catch (error) {
    console.error("Login error:", error);
    toast("فشل تسجيل الدخول: " + error.message);
  } finally {
    setLoading(false);
  }
};

// إنشاء حساب جديد
$("registerForm").onsubmit = async e => {
  e.preventDefault();

  if (loading) return;
  setLoading(true);

  try {
    const name = $("registerName").value.trim();
    const email = $("registerEmail").value.trim().toLowerCase();
    const password = $("registerPassword").value;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }
      }
    });

    if (error) throw error;

    $("registerForm").reset();
    $("authDialog").close();

    if (data.session) {
      await supabase.auth.signOut();
    }

    toast("تم إرسال طلب الحساب، انتظر موافقة المدير");

  } catch (error) {
    console.error("Registration error:", error);
    toast("تعذر إنشاء الحساب: " + error.message);
  } finally {
    setLoading(false);
  }
};

// تسجيل الخروج
$("logoutBtn").onclick = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error(error);
    toast(error.message);
    return;
  }

  session = null;
  profile = null;
  batches = [];
  users = [];

  renderAccess();
  toast("تم تسجيل الخروج");
};

// فتح نموذج الوجبة
function openBatch(b = null) {
  $("batchForm").reset();
  $("batchId").value = b?.id || "";

  $("batchDialogTitle").textContent =
    b ? "تعديل بيانات الوجبة" : "إضافة وجبة جديدة";

  const fields = {
    batchNumber: "number",
    machineNumber: "machine",
    cartons: "cartons",
    eggs: "eggs",
    eggType: "type",
    entryDate: "entry_date",
    startAt: "start_at",
    temperatureAt: "temperature_at",
    trolleys: "trolleys",
    candlingStatus: "candling",
    candlingAt: "candling_at",
    transferStatus: "transfer",
    transferAt: "transfer_at",
    hatchStatus: "hatch_status",
    chicks: "chicks"
  };

  Object.entries(fields).forEach(([id, key]) => {
    let value = b?.[key] ?? "";

    if (key === "candling" && !value) value = "لم يتم";
    if (key === "transfer" && !value) value = "لم يتم";
    if (key === "hatch_status" && !value) value = "بانتظار الفقس";

    if (["start_at", "temperature_at", "candling_at", "transfer_at"].includes(key) && value) {
      value = String(value).slice(0, 16);
    }

    $(id).value = value;
  });

  $("batchDialog").showModal();
}

$("addBatchBtn").onclick = () => openBatch();

// حفظ الوجبة في Supabase
$("batchForm").onsubmit = async e => {
  e.preventDefault();

  if (!isAdmin()) {
    toast("ليس لديك صلاحية إضافة الوجبات");
    return;
  }

  if (loading) return;
  setLoading(true);

  try {
    const id = $("batchId").value;

    const data = {
      number: $("batchNumber").value.trim(),
      machine: $("machineNumber").value.trim(),
      cartons: Number($("cartons").value),
      eggs: Number($("eggs").value),
      type: $("eggType").value.trim(),
      entry_date: $("entryDate").value,
      start_at: $("startAt").value,
      temperature_at: $("temperatureAt").value || null,
      trolleys: $("trolleys").value ? Number($("trolleys").value) : null,
      candling: $("candlingStatus").value,
      candling_at: $("candlingAt").value || null,
      transfer: $("transferStatus").value,
      transfer_at: $("transferAt").value || null,
      hatch_status: $("hatchStatus").value,
      chicks: $("chicks").value === "" ? null : Number($("chicks").value)
    };

    let result;

    if (id) {
      result = await supabase
        .from("batches")
        .update(data)
        .eq("id", id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("batches")
        .insert(data)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    $("batchDialog").close();
    await loadBatches();
    toast(id ? "تم تعديل الوجبة بنجاح" : "تم حفظ الوجبة بنجاح");

  } catch (error) {
    console.error("Save batch error:", error);
    toast("فشل حفظ الوجبة: " + error.message);
  } finally {
    setLoading(false);
  }
};

// أزرار الجداول
document.addEventListener("click", async e => {
  const edit = e.target.closest("[data-edit]");

  if (edit && isAdmin()) {
    openBatch(batches.find(b => b.id === edit.dataset.edit));
    return;
  }

  const archive = e.target.closest("[data-archive]");

  if (archive && isAdmin()) {
    const b = batches.find(x => x.id === archive.dataset.archive);
    if (!b) return;

    if (!confirm(`تحويل الوجبة ${b.number} إلى السجلات المكتملة؟`)) return;

    try {
      const { error } = await supabase
        .from("batches")
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
          hatch_status: "تمت"
        })
        .eq("id", b.id);

      if (error) throw error;

      await loadBatches();
      toast("تم نقل الوجبة إلى السجلات");

    } catch (error) {
      console.error("Archive error:", error);
      toast("تعذر نقل الوجبة: " + error.message);
    }
    return;
  }

  const view = e.target.closest("[data-view]");

  if (view) {
    const b = batches.find(x => x.id === view.dataset.view);
    if (!b) return;

    const entries = [
      ["رقم الوجبة", b.number],
      ["رقم الجهاز", b.machine],
      ["عدد الكراتين", b.cartons],
      ["عدد البيض", b.eggs],
      ["نوع البيض", b.type],
      ["تاريخ إدخال البيض", b.entry_date],
      ["تشغيل الجهاز", fmt(b.start_at)],
      ["أخذ الحرارة", fmt(b.temperature_at)],
      ["عدد العربايات", b.trolleys],
      ["فحص الضوء", b.candling],
      ["وقت فحص الضوء", fmt(b.candling_at)],
      ["النقل للفاقسة", b.transfer],
      ["وقت النقل", fmt(b.transfer_at)],
      ["حالة الفقسة", b.hatch_status],
      ["عدد الصيصان", b.chicks ?? "—"],
      ["تاريخ الأرشفة", fmt(b.archived_at)]
    ];

    $("recordDetails").innerHTML = entries.map(([k, v]) => `
      <div class="detail">
        <small>${esc(k)}</small>
        <b>${esc(v ?? "—")}</b>
      </div>
    `).join("");

    $("recordDialog").showModal();
    return;
  }

  const approve = e.target.closest("[data-approve]");

  if (approve && isAdmin()) {
    const id = approve.dataset.approve;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "approved" })
        .eq("id", id);

      if (error) throw error;

      await loadUsers();
      toast("تمت الموافقة على الحساب");

    } catch (error) {
      console.error("Approve error:", error);
      toast("تعذرت الموافقة: " + error.message);
    }
    return;
  }

  const reject = e.target.closest("[data-reject]");

  if (reject && isAdmin()) {
    const id = reject.dataset.reject;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "rejected" })
        .eq("id", id);

      if (error) throw error;

      await loadUsers();
      toast("تم رفض طلب الحساب");

    } catch (error) {
      console.error("Reject error:", error);
      toast("تعذر رفض الحساب: " + error.message);
    }
  }
});

// استعادة جلسة الدخول مرة واحدة
async function init() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    session = data.session;

    if (session) {
      await loadProfile();
    } else {
      renderAccess();
    }

  } catch (error) {
    console.error("Initialization error:", error);
    toast("تعذر الاتصال: " + error.message);
  }
}

// مراقبة تغير حالة الدخول
supabase.auth.onAuthStateChange((event, newSession) => {
  if (event === "SIGNED_OUT") {
    session = null;
    profile = null;
    batches = [];
    users = [];
    renderAccess();
  }
});

init();
