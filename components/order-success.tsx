'use client';
import {ShieldCheck,ArrowUpRight,Clock,PackageCheck} from 'lucide-react';
import {money,type OrderConfirmation} from '@/lib/types';
export function OrderSuccess({order,onHistory,onCatalog}:{order:OrderConfirmation;onHistory:()=>void;onCatalog:()=>void}){
 return <section className="mission-success" aria-labelledby="mission-heading">
  <div className="mission-emblem" aria-hidden="true"><ShieldCheck size={37} strokeWidth={1.3}/></div>
  <p className="eyebrow">MILITARYCOIN · ЦЕНТР ЗАМОВЛЕНЬ</p>
  <h2 id="mission-heading">МІСІЮ<br/><span>ВИКОНАНО</span></h2>
  <p className="mission-intro">Вашу заявку збережено.<br/>Монети зарезервовано для вас.</p>
  <div className="mission-folder">
   <span className="folder-tab" aria-hidden="true">ОСОБОВА СПРАВА / MC</span>
   <div className="mission-ticket">
    <div className="ticket-heading"><PackageCheck size={20}/><span>ПІДТВЕРДЖЕННЯ ЗАЯВКИ</span><span>UA</span></div>
    <p className="ticket-label">ВАШ НОМЕР ЗАМОВЛЕННЯ</p>
    <div className="mission-code" aria-label={'Номер замовлення '+order.order_code}>{order.order_code.split('').map((digit,index)=><span key={index}>{digit}</span>)}</div>
    <div className="ticket-divider"/>
    <dl className="ticket-amounts"><div><dt>Вартість монет</dt><dd>{money(order.total)}</dd></div><div><dt>Передоплата · 10%</dt><dd>{money(order.deposit)}</dd></div></dl>
    <div className="received-stamp">ЗАЯВКУ ОТРИМАНО</div>
    <div className="ticket-footer"><span className="ticket-bars" aria-hidden="true"/><span>MC / {order.order_code}</span></div>
   </div>
  </div>
  <div className="mission-status"><Clock size={15}/><strong>В обробці</strong><span>Перевіряємо передоплату</span></div>
  <p className="mission-note">Результат перевірки з’явиться в «Моєму профілі». Збережіть номер заявки для звернення до нас.</p>
  <button type="button" className="primary full-width" onClick={onHistory}>Мої замовлення <ArrowUpRight size={18}/></button>
  <button type="button" className="secondary full-width" onClick={onCatalog}>Повернутися до каталогу</button>
 </section>
}
