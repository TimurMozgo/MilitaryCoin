import {shop} from '@/lib/shop-server';
export const dynamic='force-dynamic';
async function handler(req:Request,context:{params:Promise<{path:string[]}>}){return shop(req,(await context.params).path)}
export {handler as GET,handler as POST,handler as PUT};
