
const questions = [
  ["digital","Our business has a professional digital presence that is current and easy for customers to use."],
  ["digital","Important business information is stored in organised digital systems rather than scattered across devices or chats."],
  ["sales","We consistently capture enquiries, customer details and follow-up status in one place."],
  ["sales","Our team has a defined process for follow-ups, sales stages and customer communication."],
  ["operations","Core day-to-day workflows are documented and handled consistently."],
  ["operations","Tasks, approvals and responsibilities are visible instead of depending on memory or verbal follow-up."],
  ["automation","Repetitive reminders, notifications, data entry or handoffs are automated where practical."],
  ["automation","Our software tools are connected enough to avoid repeated manual copying between systems."],
  ["data","We can see important business KPIs without manually collecting information from multiple sources."],
  ["data","Management decisions are supported by reliable, timely data."],
  ["ai","We have identified realistic ways AI could support customer service, operations, analysis or team productivity."],
  ["ai","Access to sensitive actions and data is controlled with appropriate permissions and accountability."]
];
const dimensions = {
  digital:"Digital Foundation",
  sales:"Customers & Sales",
  operations:"Operations",
  automation:"Automation",
  data:"Data & AI",
  ai:"Data & AI"
};
const qWrap = document.getElementById("questions");
questions.forEach((q,i)=>{
  const div=document.createElement("div"); div.className="question";
  div.innerHTML=`<label>${i+1}. ${q[1]}</label><div class="rating">${
    [0,1,2,3,4].map(v=>`<input required type="radio" id="q${i}_${v}" name="q${i}" value="${v}"><label for="q${i}_${v}">${v}</label>`).join("")
  }</div>`;
  qWrap.appendChild(div);
});
document.getElementById("auditForm").addEventListener("submit",e=>{
  e.preventDefault();
  const vals=questions.map((q,i)=>Number(new FormData(e.currentTarget).get(`q${i}`)));
  const total=vals.reduce((a,b)=>a+b,0);
  const score=Math.round(total/(questions.length*4)*100);
  let band, summary;
  if(score<=30){band="Digital Foundation Needed";summary="Focus first on a reliable digital foundation, organised information and basic customer/operational processes."}
  else if(score<=50){band="Developing";summary="You have useful building blocks. The next opportunity is to standardise processes and reduce fragmented manual work."}
  else if(score<=70){band="Growth Ready";summary="Your foundation is strong enough to benefit from deeper integrations, automation and management visibility."}
  else if(score<=85){band="Connected";summary="Your systems are relatively mature. Prioritise smarter automation, better data flows and selective AI use cases."}
  else{band="Intelligent Business";summary="You have a strong digital operating base. Focus on continuous optimisation, AI-assisted decision support and scalable governance."}
  document.getElementById("scoreValue").textContent=score;
  document.getElementById("scoreBand").textContent=band;
  document.getElementById("scoreSummary").textContent=summary;

  const buckets={digital:[],sales:[],operations:[],automation:[],data:[]};
  questions.forEach((q,i)=>{
    let key=q[0]==="ai"?"data":q[0];
    buckets[key].push(vals[i]);
  });
  const box=document.getElementById("subscores"); box.innerHTML="";
  Object.entries(buckets).forEach(([k,a])=>{
    const s=Math.round(a.reduce((x,y)=>x+y,0)/(a.length*4)*100);
    const row=document.createElement("div"); row.className="subscore";
    row.innerHTML=`<span>${dimensions[k]}</span><strong>${s}/100</strong>`;
    box.appendChild(row);
  });
  document.getElementById("scoreCard").scrollIntoView({behavior:"smooth",block:"center"});
});
const toggle=document.querySelector(".menu-toggle"), nav=document.querySelector(".nav-links");
toggle.addEventListener("click",()=>{
  const open=nav.style.display==="flex";
  nav.style.display=open?"none":"flex";
  if(!open){
    nav.style.position="absolute";nav.style.top="70px";nav.style.left="12px";nav.style.right="12px";
    nav.style.flexDirection="column";nav.style.background="#071426";nav.style.padding="20px";nav.style.borderRadius="12px";
    nav.style.boxShadow="0 20px 45px rgba(0,0,0,.32)";
  }
});
