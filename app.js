
const SUPABASE_URL = "https://ulofkckropitsrgwtkdn.supabase.co";
const SUPABASE_KEY = "sb_publishable_Qg5X1BAbzDs3r4cT3Z77Jg_M1NK2jhm";

const sb = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = id => document.getElementById(id);

let session = null;
let profile = null;
let batches = [];
let users = [];
let realtimeChannel = null;

const isAdmin = () =>
  profile?.role === "admin" && profile?.status === "approved";

const isApproved = () =>
  profile?.status === "approved";

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;",
    '"':"&quot;", "'":"&#39;"
  }[c]));

const fmt = value =>
  value ? new Date(value).toLocaleString("ar-IQ") : "—";

const localInput = value => {
  if (!value) return "";
  const d = new Date(value);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000)
    .toISOString().slice(0,16);
};

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

function showError(error) {
  console.error(error);
  toast(error?.message || "حدث خطأ، حاول مرة أخرى");
}

function showAuth(tab = "login") {
  $("authDialog").showModal();
  switchAuth(tab);
}

function switchAuth(tab) {
  $("loginForm").classList.toggle("hidden", tab !== "login");
  $("registerForm").classList.toggle("hidden", tab !== "register");

  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.authTab === tab)
  );

  $("authTitle").textContent =
    tab === "login" ? "تسجيل الدخول" : "طلب إنشاء حساب";
}

function renderAccess() {
  $("currentUser").textContent =
    profile ? profile.full_name + (isAdmin() ? " (مدير)" : " (موظف)") : "زائر";

  $("logoutBtn").classList.toggle("hidden", !session);
  $("openLoginBtn").classList.toggle("hidden", !!session);

  $("accessNotice").classList.toggle("hidden", isApproved());
  $("appContent").classList.toggle("hidden", !isApproved());

  $("adminPanel").classList.toggle("hidden", !isAdmin());

  document.querySelectorAll(".admin-only").forEach(el =>
    el.classList.toggle("hidden", !isAdmin())
  );

  if (!session) {
    $("accessNotice").querySelector("b").textContent =
      "الدخول يتطلب موافقة المسؤول";
    $("accessNotice").querySelector("p").textContent =
      "يمكنك إنشاء حساب، لكن لن تتمكن من مشاهدة بيانات المفقس حتى تتم الموافقة.";
  } else if (profile?.status === "pending") {
    $("accessNotice").querySelector("b").textContent =
      "حسابك بانتظار موافقة المسؤول";
    $("accessNotice").querySelector("p").textContent =
      "تم استلام طلبك. ستتمكن من الدخول إلى بيانات المفقس بعد موافقة الإدارة.";
  } else if (profile?.status === "rejected") {
    $("accessNotice").querySelector("b").textContent =
      "لم تتم الموافقة على حسابك";
    $("accessNotice").querySelector("p").textContent =
      "يرجى التواصل مع إدارة المفقس.";
  }
}

async function loadProfile() {
  if (!session) {
    profile = null;
    return;
  }

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) throw error;

  profile = data;
}

async function loadBatches() {
  if (!isApproved()) return;

  const { data, error } = await sb
    .from("batches")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;

  batches = data || [];
  renderBatches();
}

async function loadUsers() {
  if (!isAdmin()) return;

  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;

  users = data || [];
  renderRequests();
}

function renderBatches() {
  const active = batches.filter(b => !b.archived)
    .sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

  const archived = batches.filter(b => b.archived)
    .sort((a,b) => new Date(b.archived_at) - new Date(a.archived_at));

  $("activeCount").textContent = active.length;

  $("eggCount").textContent = active
    .reduce((n,b) => n + Number(b.eggs || 0), 0)
    .toLocaleString("en-US");

  $("archiveCount").textContent = archived.length;
  $("archiveLabel").textContent = `${archived.length} سجل`;
  $("pendingCount").textContent = users.length;

  $("activeTable").innerHTML = active.length
    ? active.map(b => `<tr>
      <td><b>${esc(b.number)}</b></td>
      <td>${esc(b.machine)}</td>
      <td>${esc(b.cartons)}</td>
      <td>${Number(b.eggs).toLocaleString("en-US")}</td>
      <td>${esc(b.type)}</td>
      <td>${esc(b.entry_date || "—")}</td>
      <td>${fmt(b.start_at)}</td>
      <td>${fmt(b.temperature_at)}</td>
      <td>${esc(b.trolleys || "—")}</td>
      <td>${esc(b.candling)}${b.candling_at ? `<small>${fmt(b.candling_at)}</small>` : ""}</td>
      <td>${esc(b.transfer)}${b.transfer_at ? `<small>${fmt(b.transfer_at)}</small>` : ""}</td>
      <td><span class="status">${esc(b.hatch_status)}</span></td>
      <td>${isAdmin() ? `
        <button class="mini-btn edit" data-edit="${b.id}">تعديل</button>
        <button class="mini-btn archive" data-archive="${b.id}">تحويل للسجلات</button>
      ` : "—"}</td>
    </tr>`).join("")
    : `<tr><td colspan="13" class="empty">لا توجد وجبات نشطة حالياً.</td></tr>`;

  $("archiveTable").innerHTML = archived.length
    ? archived.map(b => `<tr>
      <td><b>${esc(b.number)}</b></td>
      <td>${esc(b.machine)}</td>
      <td>${Number(b.eggs).toLocaleString("en-US")}</td>
      <td>${esc(b.type)}</td>
      <td>${esc(b.entry_date || "—")}</td>
      <td>${fmt(b.archived_at)}</td>
      <td>${esc(b.chicks ?? "—")}</td>
      <td>${b.eggs && b.chicks != null && b.chicks !== ""
        ? (Number(b.chicks)/Number(b.eggs)*100).toFixed(1)+"%" : "—"}</td>
      <td><button class="mini-btn view" data-view="${b.id}">عرض السجل</button></td>
    </tr>`).join("")
    : `<tr><td colspan="9" class="empty">لا توجد سجلات مؤرشفة.</td></tr>`;
}

function renderRequests() {
  if (!isAdmin()) return;

  $("requestsList").innerHTML = users.length
    ? users.map(u => `<div class="request">
      <div>
        <b>${esc(u.full_name)}</b>
        <small>طلب انضمام · ${fmt(u.created_at)}</small>
      </div>
      <div class="request-actions">
        <button class="mini-btn approve" data-approve="${u.id}">موافقة</button>
        <button class="mini-btn reject" data-reject="${u.id}">رفض</button>
      </div>
    </div>`).join("")
    : `<p class="empty">لا توجد طلبات معلقة.</p>`;
}

async function refreshApp() {
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;

    session = data.session;

    await loadProfile();
    renderAccess();

    if (isApproved()) {
      await loadBatches();
      if (isAdmin()) await loadUsers();
    } else {
      batches = [];
      users = [];
    }

    setupRealtime();
  } catch (error) {
    showError(error);
  }
}

function setupRealtime() {
  if (realtimeChannel) {
    sb.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  if (!isApproved()) return;

  realtimeChannel = sb
    .channel("khairat-live-updates")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "batches"
    }, () => loadBatches().catch(showError))
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "profiles"
    }, async () => {
      await refreshApp();
    })
    .subscribe();
}

$("openLoginBtn").onclick = () => showAuth("login");
$("noticeRegisterBtn").onclick = () => showAuth("register");

document.querySelectorAll("[data-auth-tab]").forEach(button => {
  button.onclick = () => switchAuth(button.dataset.authTab);
});

document.querySelectorAll("[data-close]").forEach(button => {
  button.onclick = () => $(button.dataset.close).close();
});

$("loginForm").onsubmit = async e => {
  e.preventDefault();

  try {
    const { error } = await sb.auth.signInWithPassword({
      email: $("loginEmail").value.trim().toLowerCase(),
      password: $("loginPassword").value
    });

    if (error) throw error;

    $("authDialog").close();
    await refreshApp();
    toast(isApproved() ? "أهلاً بك في مفقس خيرات أربيل" : "تم تسجيل الدخول، حسابك بانتظار الموافقة");
  } catch (error) {
    showError(error);
  }
};

$("registerForm").onsubmit = async e => {
  e.preventDefault();

  try {
    const name = $("registerName").value.trim();
    const email = $("registerEmail").value.trim().toLowerCase();
    const password = $("registerPassword").value;

    const { data, error } = await sb.auth.signUp({
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
      await refreshApp();
    }

    toast("تم إرسال طلب التسجيل. انتظر موافقة المسؤول وتأكيد البريد إذا طُلب منك.");
  } catch (error) {
    showError(error);
  }
};

$("logoutBtn").onclick = async () => {
  const { error } = await sb.auth.signOut();
  if (error) return showError(error);

  session = null;
  profile = null;
  batches = [];
  users = [];

  renderAccess();
  $("activeTable").innerHTML = "";
  $("archiveTable").innerHTML = "";

  if (realtimeChannel) sb.removeChannel(realtimeChannel);
  realtimeChannel = null;

  toast("تم تسجيل الخروج");
};

function openBatch(b = null) {
  $("batchForm").reset();
  $("batchId").value = b?.id || "";

  $("batchDialogTitle").textContent =
    b ? "تعديل بيانات الوجبة" : "إضافة وجبة جديدة";

  const fields = {
    batchNumber:"number",
    machineNumber:"machine",
    cartons:"cartons",
    eggs:"eggs",
    eggType:"type",
    entryDate:"entry_date",
    startAt:"start_at",
    temperatureAt:"temperature_at",
    trolleys:"trolleys",
    candlingStatus:"candling",
    candlingAt:"candling_at",
    transferStatus:"transfer",
    transferAt:"transfer_at",
    hatchStatus:"hatch_status",
    chicks:"chicks"
  };

  Object.entries(fields).forEach(([id,key]) => {
    let value = b?.[key] ?? "";

    if (["start_at","temperature_at","candling_at","transfer_at"].includes(key)) {
      value = localInput(value);
    }

    if (key === "candling" || key === "transfer") {
      value = b?.[key] ?? "لم يتم";
    }

    if (key === "hatch_status") {
      value = b?.[key] ?? "بانتظار الفقس";
    }

    $(id).value = value;
  });

  $("batchDialog").showModal();
}

$("addBatchBtn").onclick = () => openBatch();

$("batchForm").onsubmit = async e => {
  e.preventDefault();
  if (!isAdmin()) return;

  try {
    const id = $("batchId").value;

    const timestamp = value =>
      value ? new Date(value).toISOString() : null;

    const data = {
      number: $("batchNumber").value.trim(),
      machine: $("machineNumber").value.trim(),
      cartons: Number($("cartons").value || 0),
      eggs: Number($("eggs").value || 0),
      type: $("eggType").value.trim(),
      entry_date: $("entryDate").value || null,
      start_at: timestamp($("startAt").value),
      temperature_at: timestamp($("temperatureAt").value),
      trolleys: Number($("trolleys").value || 0),
      candling: $("candlingStatus").value,
      candling_at: timestamp($("candlingAt").value),
      transfer: $("transferStatus").value,
      transfer_at: timestamp($("transferAt").value),
      hatch_status: $("hatchStatus").value,
      chicks: $("chicks").value === "" ? null : Number($("chicks").value)
    };

    let result;

    if (id) {
      result = await sb.from("batches").update(data).eq("id", id);
    } else {
      result = await sb.from("batches").insert(data);
    }

    if (result.error) throw result.error;

    $("batchDialog").close();
    await loadBatches();
    toast("تم حفظ بيانات الوجبة بنجاح");
  } catch (error) {
    showError(error);
  }
};

document.addEventListener("click", async e => {
  try {
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

      const { error } = await sb.from("batches")
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
          hatch_status: "تمت"
        })
        .eq("id", b.id);

      if (error) throw error;

      await loadBatches();
      toast("تم نقل الوجبة إلى السجلات");
    }

    const view = e.target.closest("[data-view]");
    if (view) {
      const b = batches.find(x => x.id === view.dataset.view);
      if (!b) return;

      const entries = [
        ["رقم الوجبة",b.number],
        ["رقم الجهاز",b.machine],
        ["عدد الكراتين",b.cartons],
        ["عدد البيض",b.eggs],
        ["نوع البيض",b.type],
        ["تاريخ إدخال البيض",b.entry_date],
        ["تشغيل الجهاز",fmt(b.start_at)],
        ["أخذ الحرارة",fmt(b.temperature_at)],
        ["عدد العربايات",b.trolleys],
        ["فحص الضوء",b.candling],
        ["وقت فحص الضوء",fmt(b.candling_at)],
        ["النقل للفاقسة",b.transfer],
        ["وقت النقل",fmt(b.transfer_at)],
        ["حالة الفقسة",b.hatch_status],
        ["عدد الصيصان",b.chicks ?? "—"],
        ["تاريخ الأرشفة",fmt(b.archived_at)]
      ];

      $("recordDetails").innerHTML = entries.map(([k,v]) =>
        `<div class="detail"><small>${esc(k)}</small><b>${esc(v ?? "—")}</b></div>`
      ).join("");

      $("recordDialog").showModal();
    }

    const approve = e.target.closest("[data-approve]");
    if (approve && isAdmin()) {
      const { error } = await sb.from("profiles")
        .update({ status: "approved" })
        .eq("id", approve.dataset.approve);

      if (error) throw error;

      await loadUsers();
      renderBatches();
      toast("تمت الموافقة على الحساب");
    }

    const reject = e.target.closest("[data-reject]");
    if (reject && isAdmin()) {
      const { error } = await sb.from("profiles")
        .update({ status: "rejected" })
        .eq("id", reject.dataset.reject);

      if (error) throw error;

      await loadUsers();
      renderBatches();
      toast("تم رفض طلب الحساب");
    }
  } catch (error) {
    showError(error);
  }
});

sb.auth.onAuthStateChange(() => {
  setTimeout(() => refreshApp(), 0);
});

refreshApp();
