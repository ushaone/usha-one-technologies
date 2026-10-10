// Evidence-based, conservative SEO suggestions for a single fetched HTML page.
// No fabricated indexing, ranking, Core Web Vitals or site-wide scores.
export function buildSeoRecommendations(result){
  if(!result||result.source!=='live-html'||!Array.isArray(result.observations))throw new Error('Measured HTML audit required');
  const out=[];
  const add=(id,severity,message,evidence)=>out.push({id,severity,message,evidence});
  if(!result.title)add('title-missing','high','Add a descriptive, unique HTML title.','No <title> text observed');
  else if(result.title.length>65)add('title-long','info','Review how the title appears in search results; display truncation varies.',result.title.length+' characters');
  if(!result.description)add('description-missing','medium','Write a useful meta description for this page.','No meta description observed');
  if(result.h1Count===0)add('h1-missing','medium','Add one clear primary heading that describes the page.','0 H1 headings observed');
  else if(result.h1Count>1)add('h1-multiple','info','Review heading hierarchy for clarity; multiple H1 elements are not automatically an SEO error.',result.h1Count+' H1 headings observed');
  if(!result.canonical)add('canonical-missing','info','Consider a canonical URL when duplicate or alternate URLs exist.','No valid canonical link observed');
  if(!result.viewport)add('viewport-missing','medium','Add a responsive viewport meta tag for mobile layout.','No viewport meta tag observed');
  if(/(?:^|[,\s])noindex(?:[,\s]|$)/i.test(result.robots||''))add('noindex','high','Confirm that excluding this page from search indexing is intentional.','Robots meta: '+result.robots);
  return {scope:'single-html-response',scoring:'not-calculated',recommendations:out,disclaimer:'Suggestions reflect only fetched HTML, not Google indexing, ranking, site-wide quality, or performance.'};
}
