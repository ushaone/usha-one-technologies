// Product-specific data minimization. Never transfer entire CRM records to an AI provider.
export function neoLeadContext(lead) {
 return {leadId:String(lead.id??lead.lead_id??''),enquiryType:String(lead.enquiry_type??lead.type??'Admission enquiry'),status:String(lead.status??'New'),preferredLanguage:String(lead.language??'en')};
}
export function ushaLeadContext(lead) {
 return {leadId:String(lead.id??lead.lead_id??''),service:String(lead.service??'Business enquiry'),status:String(lead.status??'New'),preferredLanguage:String(lead.language??'en')};
}
export function draftInstruction(context, product) {
 const business=product==='neo-school-india'?'school admissions':'business services';
 return `Write a short, courteous, factual follow-up in the requested language for ${business}. Do not invent prices, guarantees, availability, or admission eligibility. Do not include sensitive personal data. Return only a draft for staff approval. Context: ${JSON.stringify(context)}`;
}
