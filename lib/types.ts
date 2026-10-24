export type Category={id:string;name:string;updated_at:number};
export type Product={id:string;category_id:string|null;image_source:string;name:string;description:string;price:number;stock:number;images:string[];year:string;denomination:string;active:boolean;updated_at:number};
export type User={id:string;name:string;username:string;admin:boolean};
export type Order={id:string;order_code:string|null;user_id:string;telegram_name:string;telegram_username:string;customer:string;phone:string;city:string;branch:string;total:number;deposit:number;receipt:string;status:'pending'|'accepted'|'rejected';reason:string;created_at:number;items:{id:string;name:string;image:string;price:number;quantity:number}[]};
export const money=(n:number)=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:n%100?2:0}).format(n/100);

export type OrderConfirmation={id:string;order_code:string;total:number;deposit:number};
