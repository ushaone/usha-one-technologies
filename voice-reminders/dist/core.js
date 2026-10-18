export const todayIST = (d=new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export function normalizeRow(input) {
 const name=String(input.name??'').trim(), reference=String(input.reference??'').trim();
 let phone=String(input.phone??'').replace(/[\s()\-]/g,'');
 if (/^[6-9]\d{9}$/.test(phone)) phone='+91'+phone;
 if (/^91[6-9]\d{9}$/.test(phone)) phone='+'+phone;
 const amount=Number(input.amount), due_date=String(input.due_date??'').trim();
 const consent=input.consent===true || /^(true|yes|1)$/i.test(String(input.consent));
 if(!name || name.length>120) throw Error('Name: 1–120 characters required');
 if(!reference || reference.length>80 || /^[=+@\-]/.test(reference)) throw Error('Reference: use a unique invoice ID (1–80 characters)');
 if(!/^\+91[6-9]\d{9}$/.test(phone)) throw Error('Phone: enter a valid Indian mobile number');
 if(!Number.isFinite(amount)||amount<=0||amount>999999999||Math.abs(amount*100-Math.round(amount*100))>0.00001) throw Error('Amount: positive rupees with at most 2 decimal places');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(due_date)||!Number.isFinite(Date.parse(due_date))||new Date(due_date).toISOString().slice(0,10)!==due_date) throw Error('Due date: use YYYY-MM-DD');
 return {name,phone,reference,amount,due_date,consent};
}
export const escapeXML = x=>String(x).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export function messageFor(row,settings){return settings.template.replace(/\{(name|business|amount|due_date)\}/g,(_,key)=>({name:row.name,business:settings.business_name,amount:Number(row.amount).toFixed(2),due_date:new Intl.DateTimeFormat('te-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(row.due_date+'T00:00:00+05:30'))}[key]));}
export function validateTemplate(t){if(typeof t!=='string'||t.length<10||t.length>1500||/\{(?!name\}|business\}|amount\}|due_date\})[^}]*\}/.test(t))throw Error('Use 10–1500 characters and supported placeholders only');return t;}
