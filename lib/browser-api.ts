declare global { interface Window { MILITARYCOIN_API_ORIGIN?: string } }
export function apiUrl(path:string){return (typeof window!=='undefined'?window.MILITARYCOIN_API_ORIGIN||'':'')+'/api/shop/'+path}
export function assetUrl(path:string){
 if(!path || !path.startsWith('/'))return path;
 return (typeof window!=='undefined'?window.MILITARYCOIN_API_ORIGIN||'':'')+path;
}
