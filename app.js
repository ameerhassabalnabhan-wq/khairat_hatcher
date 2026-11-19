const $ = (id) => document.getElementById(id);
const DB = {
  users: "khairat_users_v1", batches: "khairat_batches_v1", session: "khairat_session_v1"
};
const read = (key, fallback=[]) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
let users = read(DB.users);
let batches = read(DB.batches);
let session = read(DB.session, null);
if (!users.some(u => u.email === "admin@khairat.local")) {
  users.push({id:crypto.randomUUID(),name:"مسؤول النظام",email:"admin@khairat.local",password:"Admin123!",role:"admin",status:"approved"});
  write(DB.users,users);
}
const isAdmin = () => session && session.role === "admin";
const isApproved = () => session && session.status === "approved";
const fmt = (v) => v ? new Date(v).toLocaleString("ar-IQ") : "—";
const dateFmt = (v) => v || "—";
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
function saveAll(){write(DB.users,users);write(DB.batches,batches);}
function render(){
  $("currentUser").textContent = session ? `${session.name} (${session.role==="admin"?"مسؤول":"مشاهد"})` : "زائر";
  $("logoutBtn").classList.toggle("hidden",!session);
  $("openLoginBtn").classList.toggle("hidden",!!session);
  $("accessNotice").classList.toggle("hidden",isApproved());
  $("appContent").classList.toggle("hidden",!isApproved());
  $("adminPanel").classList.toggle("hidden",!isAdmin());
  document.querySelectorAll(".admin-only").forEach(el=>el.classList.toggle("hidden",!isAdmin()));
  if(!isApproved()) return;
  const active=batches.filter(b=>!b.archived).sort((a,b)=>a.createdAt-b.createdAt);
  const archived=batches.filter(b=>b.archived).sort((a,b)=>b.archivedAt-a.archivedAt);
  $("activeCount").textContent=active.length;
  $("eggCount").textContent=active.reduce((n,b)=>n+Number(b.eggs||0),0).toLocaleString("en-US");
  $("archiveCount").textContent=archived.length;
  $("pendingCount").textContent=users.filter(u=>u.status==="pending").length;
  $("archiveLabel").textContent=`${archived.length} سجل`;
  $("activeTable").innerHTML=active.length?active.map(b=>`<tr>
    <td><b>${esc(b.number)}</b></td><td>${esc(b.machine)}</td><td>${esc(b.cartons)}</td><td>${Number(b.eggs).toLocaleString("en-US")}</td><td>${esc(b.type)}</td>
    <td>${dateFmt(b.entryDate)}</td><td>${fmt(b.startAt)}</td><td>${fmt(b.temperatureAt)}</td><td>${esc(b.trolleys||"—")}</td>
    <td>${esc(b.candling)}${b.candlingAt?`<small>${fmt(b.candlingAt)}</small>`:""}</td>
    <td>${esc(b.transfer)}${b.transferAt?`<small>${fmt(b.transferAt)}</small>`:""}</td><td><span class="status">${esc(b.hatchStatus)}</span></td>
    <td>${isAdmin()?`<button class="mini-btn edit" data-edit="${b.id}">تعديل</button><button class="mini-btn archive" data-archive="${b.id}">تحويل للسجلات</button>`:"—"}</td></tr>`).join(""):`<tr><td colspan="13" class="empty">لا توجد وجبات نشطة حالياً.</td></tr>`;
  $("archiveTable").innerHTML=archived.length?archived.map(b=>`<tr><td><b>${esc(b.number)}</b></td><td>${esc(b.machine)}</td><td>${Number(b.eggs).toLocaleString("en-US")}</td><td>${esc(b.type)}</td><td>${dateFmt(b.entryDate)}</td><td>${fmt(b.archivedAt)}</td><td>${esc(b.chicks??"—")}</td><td>${b.eggs&&b.chicks!==""&&b.chicks!=null?`${(Number(b.chicks)/Number(b.eggs)*100).toFixed(1)}%`:"—"}</td><td><button class="mini-btn view" data-view="${b.id}">عرض السجل</button></td></tr>`).join(""):`<tr><td colspan="9" class="empty">لا توجد سجلات مؤرشفة.</td></tr>`;
  renderRequests();
}
function renderRequests(){
  if(!isAdmin())return;
  const pending=users.filter(u=>u.status==="pending");
  $("requestsList").innerHTML=pending.length?pending.map(u=>`<div class="request"><div><b>${esc(u.name)}</b><small>${esc(u.email)} · طلب انضمام</small></div><div class="request-actions"><button class="mini-btn approve" data-approve="${u.id}">موافقة</button><button class="mini-btn reject" data-reject="${u.id}">رفض</button></div></div>`).join(""):`<p class="empty">لا توجد طلبات معلقة.</p>`;
}
function showAuth(tab="login"){
  $("authDialog").showModal();switchAuth(tab);
}
function switchAuth(tab){
  $("loginForm").classList.toggle("hidden",tab!=="login");$("registerForm").classList.toggle("hidden",tab!=="register");
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.authTab===tab));
  $("authTitle").textContent=tab==="login"?"تسجيل الدخول":"طلب إنشاء حساب";
}
$("openLoginBtn").onclick=()=>showAuth("login");
$("noticeRegisterBtn").onclick=()=>showAuth("register");
document.querySelectorAll("[data-auth-tab]").forEach(b=>b.onclick=()=>switchAuth(b.dataset.authTab));
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$("logoutBtn").onclick=()=>{session=null;localStorage.removeItem(DB.session);render();toast("تم تسجيل الخروج");};
$("loginForm").onsubmit=e=>{
  e.preventDefault();const email=$("loginEmail").value.trim().toLowerCase(),password=$("loginPassword").value;
  const user=users.find(u=>u.email===email&&u.password===password);
  if(!user){toast("بيانات الدخول غير صحيحة");return;}
  if(user.status!=="approved"){toast(user.status==="pending"?"حسابك بانتظار موافقة المسؤول":"هذا الحساب غير مفعل");return;}
  session={id:user.id,name:user.name,role:user.role,status:user.status};write(DB.session,session);$("authDialog").close();render();toast("أهلاً بك في مفقس خيرات أربيل");
};
$("registerForm").onsubmit=e=>{
  e.preventDefault();const name=$("registerName").value.trim(),email=$("registerEmail").value.trim().toLowerCase(),password=$("registerPassword").value;
  if(users.some(u=>u.email===email)){toast("هذا البريد مسجل مسبقاً");return;}
  users.push({id:crypto.randomUUID(),name,email,password,role:"viewer",status:"pending",createdAt:Date.now()});saveAll();$("registerForm").reset();$("authDialog").close();render();toast("تم إرسال طلبك، انتظر موافقة المسؤول");
};
function openBatch(b=null){
  $("batchForm").reset();$("batchId").value=b?.id||"";
  $("batchDialogTitle").textContent=b?"تعديل بيانات الوجبة":"إضافة وجبة جديدة";
  const fields={batchNumber:"number",machineNumber:"machine",cartons:"cartons",eggs:"eggs",eggType:"type",entryDate:"entryDate",startAt:"startAt",temperatureAt:"temperatureAt",trolleys:"trolleys",candlingStatus:"candling",candlingAt:"candlingAt",transferStatus:"transfer",transferAt:"transferAt",hatchStatus:"hatchStatus",chicks:"chicks"};
  Object.entries(fields).forEach(([id,key])=>$(id).value=b?.[key]??(key==="candling"||key==="transfer"?"لم يتم":key==="hatchStatus"?"بانتظار الفقس":""));
  $("batchDialog").showModal();
}
$("addBatchBtn").onclick=()=>openBatch();
$("batchForm").onsubmit=e=>{
  e.preventDefault();if(!isAdmin())return;
  const id=$("batchId").value;
  const data={id:id||crypto.randomUUID(),number:$("batchNumber").value.trim(),machine:$("machineNumber").value.trim(),cartons:$("cartons").value,eggs:$("eggs").value,type:$("eggType").value.trim(),entryDate:$("entryDate").value,startAt:$("startAt").value,temperatureAt:$("temperatureAt").value,trolleys:$("trolleys").value,candling:$("candlingStatus").value,candlingAt:$("candlingAt").value,transfer:$("transferStatus").value,transferAt:$("transferAt").value,hatchStatus:$("hatchStatus").value,chicks:$("chicks").value,createdAt:id?(batches.find(x=>x.id===id)?.createdAt||Date.now()):Date.now(),archived:false};
  const index=batches.findIndex(x=>x.id===id);if(index>=0)batches[index]={...batches[index],...data};else batches.push(data);
  saveAll();$("batchDialog").close();render();toast("تم حفظ بيانات الوجبة");
};
document.addEventListener("click",e=>{
  const edit=e.target.closest("[data-edit]");if(edit&&isAdmin()){openBatch(batches.find(b=>b.id===edit.dataset.edit));return;}
  const archive=e.target.closest("[data-archive]");if(archive&&isAdmin()){
    const b=batches.find(x=>x.id===archive.dataset.archive);if(!b)return;
    if(!confirm(`تحويل الوجبة ${b.number} إلى السجلات المكتملة؟`))return;
    b.archived=true;b.archivedAt=Date.now();b.hatchStatus="تمت";saveAll();render();toast("تم نقل الوجبة إلى السجلات");
  }
  const view=e.target.closest("[data-view]");if(view){const b=batches.find(x=>x.id===view.dataset.view);if(!b)return;
    const entries=[["رقم الوجبة",b.number],["رقم الجهاز",b.machine],["عدد الكراتين",b.cartons],["عدد البيض",b.eggs],["نوع البيض",b.type],["تاريخ إدخال البيض",b.entryDate],["تشغيل الجهاز",fmt(b.startAt)],["أخذ الحرارة",fmt(b.temperatureAt)],["عدد العربايات",b.trolleys],["فحص الضوء",b.candling],["وقت فحص الضوء",fmt(b.candlingAt)],["النقل للفاقسة",b.transfer],["وقت النقل",fmt(b.transferAt)],["حالة الفقسة",b.hatchStatus],["عدد الصيصان",b.chicks||"—"],["تاريخ الأرشفة",fmt(b.archivedAt)]];
    $("recordDetails").innerHTML=entries.map(([k,v])=>`<div class="detail"><small>${esc(k)}</small><b>${esc(v??"—")}</b></div>`).join("");$("recordDialog").showModal();
  }
  const approve=e.target.closest("[data-approve]");if(approve&&isAdmin()){const u=users.find(x=>x.id===approve.dataset.approve);if(u){u.status="approved";saveAll();render();toast("تمت الموافقة على الحساب");}}
  const reject=e.target.closest("[data-reject]");if(reject&&isAdmin()){users=users.filter(x=>x.id!==reject.dataset.reject);saveAll();render();toast("تم رفض طلب الحساب");}
});
render();
