import {shop} from '@/lib/shop-server';
export const dynamic='force-dynamic';
const pagesOrigin='https://timurmozgo.github.io';
async function handler(req:Request,context:{params:Promise<{path:string[]}>}){
 const origin=req.headers.get('origin');
 if(origin && origin!==pagesOrigin && origin!==new URL(req.url).origin)return new Response('Origin not allowed',{status:403});
 const response=req.method==='OPTIONS'?new Response(null,{status:204}):await shop(req,(await context.params).path);
 if(origin===pagesOrigin){response.headers.set('Access-Control-Allow-Origin',pagesOrigin);response.headers.set('Vary','Origin');response.headers.set('Access-Control-Allow-Methods','GET, POST, PUT, OPTIONS');response.headers.set('Access-Control-Allow-Headers','Content-Type, x-telegram-init-data');response.headers.set('Access-Control-Max-Age','600')}
 return response;
}
export {handler as GET,handler as POST,handler as PUT,handler as OPTIONS};
