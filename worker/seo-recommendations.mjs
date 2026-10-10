// Evidence-based recommendations for one HTML response or a user-supplied offline HTML file.
export function buildSeoRecommendations(result){
 if(!result||!['live-html','offline-html'].includes(result.source)||!Array.isArray(result.observations))throw new Error('Measured HTML audit required');
 const out=[];
 const add=(id,severity,message,evidence)=>out.push({id,severity,message,evidence});
 if(!result.title)add('title-missing','high','Add a descriptive HTML title.','No title observed');
 else if(result.title.length>65)add('title-long','info','Review title display in search results; truncation varies.',result.title.length+' characters');
 if(!result.description)add('description-missing','medium','Write a useful meta description.','No description observed');
 if(result.h1Count===0)add('h1-missing','medium','Add a clear primary heading.','0 H1 headings observed');
 else if(result.h1Count>1)add('h1-multiple','info','Review heading hierarchy; multiple H1 elements are not automatically an SEO error.',result.h1Count+' H1 headings observed');
 if(!result.canonical)add('canonical-missing','info','Consider a canonical URL if duplicate or alternate URLs exist.','No canonical link observed');
 if(!result.viewport)add('viewport-missing','medium','Add a responsive viewport meta tag.','No viewport observed');
 if(/(?:^|[,\s])noindex(?:[,\s]|$)/i.test(result.robots||''))add('noindex','high','Confirm excluding this page from indexing is intentional.','Robots meta: '+result.robots);
 return {scope:result.source==='offline-html'?'user-supplied-html':'single-html-response',scoring:'not-calculated',recommendations:out,disclaimer:'Only supplied HTML was inspected. No indexing, ranking, performance or site-wide verification.'};
}
