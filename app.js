const CONFIG={url:"https://jiupaabevawvnpwyjvjx.supabase.co",key:"sb_publishable_gOi9DT7HpLMZsR7w4uI0wA_S72AjUad",email:"dashboard@homefrance.internal"};
const db=supabase.createClient(CONFIG.url,CONFIG.key),$=id=>document.getElementById(id);
let proposals=[],calendar=[],events=[],inbox=[],selected;
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const months=["January","February","March","April","May","June","July","August","September","October","November","December"],weekdays=["MON","TUE","WED","THU","FRI","SAT","SUN"];
function toast(s){$("toast").textContent=s;$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),2400)}
function signedIn(v){$("login").classList.toggle("hidden",v);$("app").classList.toggle("hidden",!v)}
function more(x){return `<details><summary>See more</summary><div class="more"><b>Must cover</b><ul>${(x.must_cover||[]).map(p=>`<li>${esc(p)}</li>`).join("")}</ul>${x.source_url?`<a href="${esc(x.source_url)}" target="_blank" rel="noopener">Open source ↗</a>`:""}</div></details>`}
function inboxLabel(s){return s==="processing"?"IN REVIEW":s==="failed"?"NEEDS ATTENTION":"NEW"}
function renderInbox(){
 $("inboxCount").textContent=inbox.length;
 $("inboxTotal").textContent=`${inbox.length} waiting`;
 $("inboxItems").innerHTML=inbox.length?inbox.map(x=>`<article class="inbox-item"><div class="inbox-top"><div><span class="badge ${x.source==="telegram"?"telegram-b":"note-b"}">${x.source==="telegram"?"TELEGRAM":"DASHBOARD NOTE"}</span><span class="badge status-b">${inboxLabel(x.status)}</span></div><time>${esc(new Date(x.created_at).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"}))}</time></div><div class="inbox-sender">${esc(x.sender_name||"Home France team")} · ${esc(x.message_type||"note")}</div><div class="inbox-body ${/[؀-ۿ]/.test(x.body||"")?"fa":""}">${esc(x.body||"Media received — awaiting review")}</div></article>`).join(""):'<div class="empty">Inbox is clear. Nothing is waiting for review.</div>';
}
async function loadInbox(){
 const [n,t]=await Promise.all([
  db.from("notes").select("*").in("status",["new","processing","failed"]).order("created_at",{ascending:false}),
  db.from("telegram_messages").select("*").in("status",["new","processing","failed"]).order("received_at",{ascending:false})
 ]);
 const error=n.error||t.error;if(error)throw error;
 inbox=[
  ...n.data.map(x=>({...x,body:x.note_text,message_type:"note",sender_name:"Dashboard",created_at:x.created_at})),
  ...t.data.map(x=>({...x,body:x.transcript||x.message_text||`${x.message_type} received — awaiting extraction`,created_at:x.received_at,source:"telegram"}))
 ].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 renderInbox();
}
function fileExtension(item){
 const mime=String(item.mime_type||"");
 if(mime.includes("ogg"))return"ogg";if(mime.includes("mpeg"))return"mp3";if(mime.includes("mp4"))return"mp4";if(mime.includes("wav"))return"wav";if(mime.includes("jpeg"))return"jpg";if(mime.includes("png"))return"png";if(mime.includes("pdf"))return"pdf";return"bin";
}
async function downloadAndClearInbox(){
 if(!inbox.length)return toast("Inbox is already clear");
 const button=$("downloadInbox");button.disabled=true;
 try{
  toast("Preparing your inbox file…");
  const zip=new JSZip();
  const manifest={exported_at:new Date().toISOString(),items:inbox.map(x=>({source:x.source||"dashboard_note",id:x.id,type:x.message_type||"note",sender:x.sender_name||"Home France team",received_at:x.created_at,text:x.body||null,media_file:x.media_path?"media/"+(x.source||"note")+"-"+x.id+"."+fileExtension(x):null}))};
  zip.file("inbox.json",JSON.stringify(manifest,null,2));
  for(const item of inbox.filter(x=>x.source==="telegram"&&x.media_path)){
   const {data,error}=await db.storage.from("telegram-raw").download(item.media_path);
   if(error)throw new Error("Could not download a Telegram file: "+error.message);
   zip.file("media/telegram-"+item.id+"."+fileExtension(item),data);
  }
  const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE"});
  const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="home-france-inbox-"+new Date().toISOString().slice(0,10)+".zip";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  const noteIds=inbox.filter(x=>x.source!=="telegram").map(x=>x.id),telegramIds=inbox.filter(x=>x.source==="telegram").map(x=>x.id);
  const mediaPaths=inbox.filter(x=>x.source==="telegram"&&x.media_path).map(x=>x.media_path);
  if(mediaPaths.length){const {error}=await db.storage.from("telegram-raw").remove(mediaPaths);if(error)throw error;}
  const deletes=[];
  if(noteIds.length)deletes.push(db.from("notes").delete().in("id",noteIds));
  if(telegramIds.length)deletes.push(db.from("telegram_messages").delete().in("id",telegramIds));
  const deleted=await Promise.all(deletes);const deleteFailed=deleted.find(x=>x.error);if(deleteFailed)throw deleteFailed.error;
  await loadInbox();toast("Inbox downloaded and permanently cleared");
 }catch(error){toast(error.message||"Could not prepare the inbox file")}finally{button.disabled=false}
}
function renderProposals(){
 $("proposalCount").textContent=`${proposals.length} / 100`;
 $("proposals").innerHTML=proposals.length?proposals.map(p=>`<article class="proposal ${p.is_urgent?"urgent":""}"><div class="code">${esc(p.code)}</div><div class="${p.language==="fa"?"fa":""}"><div class="subject">${esc(p.subject)}</div><div class="source">${esc(p.source_label)}</div></div><div class="badges">${p.is_urgent?'<span class="badge urgent-b">URGENT</span>':""}${p.is_audience_priority?'<span class="badge audience">AUDIENCE PRIORITY</span>':""}<span class="badge language">${p.language==="fa"?"فارسی":"ENGLISH"}</span></div>${more(p)}<div class="row-actions"><button class="btn schedule" data-id="${p.id}">Add to Calendar</button></div></article>`).join(""):'<div class="empty">No active proposals.</div>';
 document.querySelectorAll(".schedule").forEach(b=>b.onclick=()=>openSchedule(b.dataset.id));
}
function renderEvents(){
 $("eventCount").textContent=`${events.length} verified`;
 $("events").innerHTML=events.length?events.map(e=>`<article class="event"><div class="event-date">${esc(e.date_label)}</div><div class="event-title">${esc(e.title)}</div><div class="event-place">${esc(e.place)}</div><div class="event-angle">${esc(e.content_angle)}</div>${e.source_url?`<a href="${esc(e.source_url)}" target="_blank" rel="noopener">Official source ↗</a>`:""}</article>`).join(""):'<div class="empty">No upcoming events.</div>';
}
function month(year,mo){
 const first=(new Date(year,mo,1).getDay()+6)%7,total=new Date(year,mo+1,0).getDate(),now=new Date();let cells="";
 for(let i=0;i<first;i++)cells+='<div class="day blank"></div>';
 for(let d=1;d<=total;d++){const key=`${year}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,items=calendar.filter(x=>x.scheduled_date===key),today=now.getFullYear()===year&&now.getMonth()===mo&&now.getDate()===d;cells+=`<div class="day ${today?"today":""}"><div class="day-number">${d}</div>${items.map(x=>`<div class="content"><b>${esc(x.code)}</b> · ${esc(x.subject)}<div>${esc(x.platform)}</div>${more(x)}</div>`).join("")}</div>`}
 return `<div class="calendar"><div class="calendar-title">${months[mo]} ${year}</div><div class="week">${weekdays.map(x=>`<div class="weekday">${x}</div>`).join("")}</div><div class="days">${cells}</div></div>`;
}
function renderCalendar(){const n=new Date(),next=new Date(n.getFullYear(),n.getMonth()+1,1);$("calendarCount").textContent=`${calendar.length} scheduled`;$("calendars").innerHTML=month(n.getFullYear(),n.getMonth())+month(next.getFullYear(),next.getMonth())}
async function load(){
 const [p,c,e]=await Promise.all([db.from("proposals").select("*").is("scheduled_at",null).order("is_urgent",{ascending:false}).order("created_at",{ascending:false}),db.from("calendar_items").select("*").order("scheduled_date"),db.from("upcoming_events").select("*").order("starts_on")]);
 const error=p.error||c.error||e.error;if(error)throw error;[proposals,calendar,events]=[p.data,c.data,e.data];renderProposals();renderEvents();renderCalendar();await loadInbox();$("updated").textContent=`Updated · ${new Date().toLocaleDateString("en-GB")}`;
}
function openSchedule(id){selected=proposals.find(x=>x.id===id);$("scheduleSubject").textContent=`${selected.code} · ${selected.subject}`;$("scheduleDate").min=new Date().toISOString().slice(0,10);$("scheduleModal").classList.remove("hidden")}
$("loginForm").onsubmit=async e=>{e.preventDefault();$("loginError").textContent="";const {error}=await db.auth.signInWithPassword({email:CONFIG.email,password:$("password").value});if(error){$("loginError").textContent="Incorrect password or account not configured.";return}signedIn(true);await load()};
$("logout").onclick=async()=>{await db.auth.signOut();signedIn(false)};
$("scheduleForm").onsubmit=async e=>{e.preventDefault();const {error}=await db.rpc("schedule_proposal",{p_proposal_id:selected.id,p_scheduled_date:$("scheduleDate").value,p_platform:$("platform").value});if(error)return toast(error.message);$("scheduleModal").classList.add("hidden");await load();toast(`${selected.code} scheduled`)};
$("cancelSchedule").onclick=()=>$("scheduleModal").classList.add("hidden");
$("noteForm").onsubmit=async e=>{e.preventDefault();const message=$("noteText").value.trim();if(!message)return;const button=e.submitter;button.disabled=true;const {error}=await db.from("notes").insert({note_text:message});button.disabled=false;if(error)return toast(error.message);$("noteText").value="";await loadInbox();toast("Note sent to Notification Center")};
$("notifications").onclick=async()=>{try{await loadInbox();$("inboxModal").classList.remove("hidden")}catch(e){toast(e.message)}};$("downloadInbox").onclick=downloadAndClearInbox;$("closeInbox").onclick=()=>$("inboxModal").classList.add("hidden");$("refreshInbox").onclick=async()=>{try{await loadInbox();toast("Inbox refreshed")}catch(e){toast(e.message)}};
$("changePassword").onclick=()=>$("passwordModal").classList.remove("hidden");$("cancelPassword").onclick=()=>$("passwordModal").classList.add("hidden");
$("passwordForm").onsubmit=async e=>{e.preventDefault();const {error}=await db.auth.updateUser({password:$("newPassword").value});if(error)return toast(error.message);$("newPassword").value="";$("passwordModal").classList.add("hidden");toast("Password updated")};
(async()=>{if(CONFIG.key.startsWith("REPLACE_"))return $("loginError").textContent="Supabase configuration is pending.";const {data}=await db.auth.getSession();if(data.session){signedIn(true);try{await load()}catch(e){toast(e.message)}}})();
