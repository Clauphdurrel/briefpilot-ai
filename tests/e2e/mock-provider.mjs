import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
export function createMockProvider() {
  const checkouts = new Map(), subscriptions = new Map();
  const categories = ['context','problem','objectives','users','features','pages','journeys','roles','content','branding','integrations','data','technical','regulatory','budget','timeline','success'];
  return createServer(async (req, res) => {
    const respond = (body, status = 200) => { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(body)); };
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/__state' && req.method === 'POST') { subscriptions.set(body.data.id, body); return respond({ok:true}); }
      if (path.startsWith('/__checkout/')) return respond(checkouts.get(path.split('/').at(-1)) ?? {});
      if (path === '/v1/stores/100') return respond({data:{id:'100',attributes:{currency:'EUR'}}});
      if (path.startsWith('/v1/variants/')) { const id=path.split('/').at(-1); return respond({data:{id,attributes:{product_id:10,test_mode:true,is_subscription:true,interval:'month',interval_count:1,price:id==='200'?1900:5900,pay_what_you_want:false}}}); }
      if (path === '/v1/products/10') return respond({data:{attributes:{store_id:100,test_mode:true}}});
      if (path === '/v1/checkouts') { const id=randomUUID(); checkouts.set(id,body); return respond({data:{type:'checkouts',id,attributes:{test_mode:true,url:`https://briefpilot.lemonsqueezy.com/checkout/${id}`}}}); }
      if (path.startsWith('/v1/subscriptions/')) {
        const remote=subscriptions.get(path.split('/').at(-1)); if (!remote) return respond({},404);
        if (req.method==='DELETE') { remote.data.attributes.status='cancelled'; remote.data.attributes.cancelled=true; remote.data.attributes.ends_at=remote.data.attributes.renews_at; }
        if (req.method==='PATCH') { remote.data.attributes.status='active'; remote.data.attributes.cancelled=false; remote.data.attributes.ends_at=null; }
        if (req.method!=='GET') remote.data.attributes.updated_at=new Date(Date.parse(remote.data.attributes.updated_at)+1000).toISOString();
        return respond(remote);
      }
      if (path !== '/v1/responses' || body.store !== false) return respond({error:{message:'Unexpected local mock request'}},400);
      const context=JSON.parse(body.input[1].content), kind=body.text.format.name;
      let document;
      if (kind==='project_brief') {
        const source=context.sources.find(item=>item.kind==='answer').id;
        document=JSON.parse(readFileSync('docs/prompts/brief-generator.example.json','utf8').replaceAll('message:answer-1',source));
      } else if (kind==='project_backlog') {
        document=JSON.parse(readFileSync('docs/prompts/backlog-generator.example.json','utf8'));
        document.summary.projectName=context.project.name;
        document.summary.missingInformation=context.brief.missingInformation.map(item=>item.description);
      } else {
        const answered=context.conversation.some(item=>item.role==='user');
        const question=answered?'Quel budget prévoyez-vous ?':'Quels contenus pouvez-vous fournir ?';
        document={summary:'Réservations du restaurant',message:question,knownInformation:answered?['Réservation de tables']:[],missingInformation:['Budget','Délais'],assumptions:[],completionScore:0,nextQuestion:{id:'content',question,category:'content',priority:'high',required:true,helpText:null},coverage:categories.map(category=>({category,status:'missing',evidence:null}))};
      }
      return respond({id:`resp_${randomUUID()}`,object:'response',created_at:Math.floor(Date.now()/1000),status:'completed',model:'test-model',output:[{id:`msg_${randomUUID()}`,type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(document),annotations:[],logprobs:[]}]}],error:null,incomplete_details:null,metadata:{}});
    } catch { respond({error:{message:'Invalid local mock request'}},500); }
  });
}
