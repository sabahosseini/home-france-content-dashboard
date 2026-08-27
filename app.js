const CONFIG={url:"https://jiupaabevawvnpwyjvjx.supabase.co",key:"sb_publishable_gOi9DT7HpLMZsR7w4uI0wA_S72AjUad",email:"dashboard@homefrance.internal"};
const db=supabase.createClient(CONFIG.url,CONFIG.key),$=id=>document.getElementById(id);
let proposals=[],calendar=[],events=[],selected;
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const months=["January","February","March","April","May","June","July","August","September","October","November","December"],weekdays=["MON","TUE","WED","THU","FRI","SAT","SUN"];
function toast(s){$("toast").textContent=s;$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),2400)}
function signedIn(v){$("login").classList.toggle("hidden",v);$("app").classList.toggle("hidden",!v)}
function more(x){return `<details><summary>See more</summary><div class="more"><b>Must cover</b><ul>${(x.must_cover||[]).map(p=>`<li>${esc(p)}</li>`).join("")}</ul>${x.source_url?`<a href="${esc(x.source_url)}" target="_blank" rel="noopener">Open source ↗</a>`:""}</div></details>`}
function renderProposals(){
 $("proposalCount").textContent=`${proposals.length} / 100`;
 $("proposals").innerHTML=proposals.length?proposals.map(p=>`<article class="proposal ${p.is_urgent?"urgent":""}"><div class="code">${esc(p.code)}</div><div class="${p.language==="fa"?"fa":""}"><div class="subject">${esc(p.subject)}</div><div class="source">${esc(p.source_label)}</div></div><div class="badges">${p.is_urgent?'<span class="badge urgent-b">URGENT</span>':""}${p.is_audience_priority?'<span class="badge audience">AUDIENCE PRIORITY</span>':""}<span class="badge language">${p.language==="fa"?"فارسی":"ENGLISH"}</span></div>${more(p)}<div class="row-actions"><button class="btn schedule-proposal" data-id="${p.id}">Add to Calendar</button><button class="btn pale urgent-toggle" data-id="${p.id}" data-urgent="${p.is_urgent}">${p.is_urgent?"Remove Urgent":"Urgent"}</button><button class="btn pale audience-toggle" data-id="${p.id}" data-audience="${p.is_audience_priority}">${p.is_audience_priority?"Remove Audience Priority":"Audience Priority"}</button><button class="btn pale rename-proposal" data-id="${p.id}">Rename</button></div></article>`).join(""):'<div class="empty">No active proposals.</div>';
 document.querySelectorAll(".schedule-proposal").forEach(b=>b.onclick=()=>openSchedule("proposal",b.dataset.id));
 document.querySelectorAll(".urgent-toggle").forEach(b=>b.onclick=()=>toggleUrgent(b.dataset.id,b.dataset.urgent!=="true"));
 document.querySelectorAll(".audience-toggle").forEach(b=>b.onclick=()=>toggleAudiencePriority(b.dataset.id,b.dataset.audience!=="true"));
 document.querySelectorAll(".rename-proposal").forEach(b=>b.onclick=()=>renameProposal(b.dataset.id));
}
async function toggleUrgent(id,value){
 const {error}=await db.from("proposals").update({is_urgent:value}).eq("id",id);
 if(error)return toast(error.message);
 await load();toast(value?"Marked urgent — moved to priority":"Urgent removed");
}
async function toggleAudiencePriority(id,value){
 const {error}=await db.from("proposals").update({is_audience_priority:value}).eq("id",id);
 if(error)return toast(error.message);
 await load();toast(value?"Marked audience priority — moved to priority":"Audience priority removed");
}
async function renameProposal(id){
 const item=proposals.find(x=>x.id===id);if(!item)return;
 const name=window.prompt("Rename proposal",item.subject);
 if(name===null)return;
 const subject=name.trim();if(!subject)return toast("Title cannot be empty");
 const language=/[؀-ۿ]/.test(subject)?"fa":"en";
 const {error}=await db.from("proposals").update({subject,language}).eq("id",id);
 if(error)return toast(error.message);
 await load();toast("Proposal renamed");
}
function renderEvents(){
 $("eventCount").textContent=`${events.length} verified`;
 $("events").innerHTML=events.length?events.map(e=>`<article class="event"><div class="event-date">${esc(e.date_label)}</div><div class="event-title">${esc(e.title)}</div><div class="event-place">${esc(e.place)}</div><div class="event-angle">${esc(e.content_angle)}</div>${e.source_url?`<a href="${esc(e.source_url)}" target="_blank" rel="noopener">Official source ↗</a>`:""}<div class="row-actions"><button class="btn schedule-event" data-id="${e.id}">Add to Calendar</button></div></article>`).join(""):'<div class="empty">No upcoming events.</div>';
 document.querySelectorAll(".schedule-event").forEach(b=>b.onclick=()=>openSchedule("event",b.dataset.id));
}
function month(year,mo){
 const first=(new Date(year,mo,1).getDay()+6)%7,total=new Date(year,mo+1,0).getDate(),now=new Date();let cells="";
 for(let i=0;i<first;i++)cells+='<div class="day blank"></div>';
 for(let d=1;d<=total;d++){const key=`${year}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,items=calendar.filter(x=>x.scheduled_date===key),today=now.getFullYear()===year&&now.getMonth()===mo&&now.getDate()===d;cells+=`<div class="day ${today?"today":""}"><div class="day-number">${d}</div>${items.map(x=>`<div class="content"><b>${esc(x.code)}</b> · ${esc(x.subject)}<div>${esc(x.platform)}</div>${more(x)}</div>`).join("")}</div>`}
 return `<div class="calendar"><div class="calendar-title">${months[mo]} ${year}</div><div class="week">${weekdays.map(x=>`<div class="weekday">${x}</div>`).join("")}</div><div class="days">${cells}</div></div>`;
}
function renderCalendar(){const n=new Date(),next=new Date(n.getFullYear(),n.getMonth()+1,1);$("calendarCount").textContent=`${calendar.length} scheduled`;$("calendars").innerHTML=month(n.getFullYear(),n.getMonth())+month(next.getFullYear(),next.getMonth())}
async function load(){
 const [p,c,e]=await Promise.all([db.from("proposals").select("*").is("scheduled_at",null).order("is_urgent",{ascending:false}).order("is_audience_priority",{ascending:false}).order("created_at",{ascending:false}),db.from("calendar_items").select("*").order("scheduled_date"),db.from("upcoming_events").select("*").order("starts_on")]);
 const error=p.error||c.error||e.error;if(error)throw error;[proposals,calendar,events]=[p.data,c.data,e.data];renderProposals();renderEvents();renderCalendar();$("updated").textContent=`Updated · ${new Date().toLocaleDateString("en-GB")}`;
}
function openSchedule(type,id){
 const item=type==="event"?events.find(x=>x.id===id):proposals.find(x=>x.id===id);
 selected={type,item};
 $("scheduleSubject").textContent=type==="event"?`Event · ${item.title}`:`${item.code} · ${item.subject}`;
 $("scheduleDate").min=new Date().toISOString().slice(0,10);
 if(type==="event"&&item.starts_on&&item.starts_on>=$("scheduleDate").min)$("scheduleDate").value=item.starts_on;else $("scheduleDate").value="";
 $("scheduleModal").classList.remove("hidden");
}
$("loginForm").onsubmit=async e=>{e.preventDefault();$("loginError").textContent="";const {error}=await db.auth.signInWithPassword({email:CONFIG.email,password:$("password").value});if(error){$("loginError").textContent="Incorrect password or account not configured.";return}signedIn(true);await load()};
$("logout").onclick=async()=>{await db.auth.signOut();signedIn(false)};
$("scheduleForm").onsubmit=async e=>{
 e.preventDefault();
 const date=$("scheduleDate").value,platform=$("platform").value;
 let error;
 if(selected.type==="proposal"){
  ({error}=await db.rpc("schedule_proposal",{p_proposal_id:selected.item.id,p_scheduled_date:date,p_platform:platform}));
 }else{
  const ev=selected.item,fa=/[؀-ۿ]/.test(ev.title||"");
  ({error}=await db.from("calendar_items").insert({proposal_id:null,event_id:ev.id,code:"EVENT",subject:ev.title,language:fa?"fa":"en",must_cover:[ev.content_angle,ev.place?`Place: ${ev.place}`:null,ev.date_label?`Event date: ${ev.date_label}`:null].filter(Boolean),source_url:ev.source_url||null,scheduled_date:date,platform}));
 }
 if(error)return toast(error.message);
 const label=selected.type==="event"?selected.item.title:selected.item.code;
 $("scheduleModal").classList.add("hidden");await load();toast(`${label} scheduled`);
};
$("cancelSchedule").onclick=()=>$("scheduleModal").classList.add("hidden");
$("changePassword").onclick=()=>$("passwordModal").classList.remove("hidden");$("cancelPassword").onclick=()=>$("passwordModal").classList.add("hidden");
$("passwordForm").onsubmit=async e=>{e.preventDefault();const {error}=await db.auth.updateUser({password:$("newPassword").value});if(error)return toast(error.message);$("newPassword").value="";$("passwordModal").classList.add("hidden");toast("Password updated")};
(async()=>{if(CONFIG.key.startsWith("REPLACE_"))return $("loginError").textContent="Supabase configuration is pending.";const {data}=await db.auth.getSession();if(data.session){signedIn(true);try{await load()}catch(e){toast(e.message)}}})();
