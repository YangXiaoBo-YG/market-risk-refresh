'use client';
import {useMemo} from 'react';
import type {Series} from '../lib/analytics';
import {freshness} from '../lib/analytics';
import {riskSignals} from '../lib/risk-methods';
export default function SignalOverview({series,dd,pct,jump}:{series:Record<string,Series>;dd:number;pct:number;jump:number}){
 const signals=useMemo(()=>riskSignals(series,dd,pct,jump),[series,dd,pct,jump]);
 const warning=Object.values(series).filter(s=>['IXG','MOVE','VIX','SPX','SPXEW','NDX','NDXE'].includes(s.id)&&freshness(s)!=='日度数据');
 return <section className="signal-overview"><div className="section-title"><h2>信号总览</h2><span className="count">{signals.filter(s=>s.hit).length} 项触发</span></div>{warning.length>0&&<p className="notice">{warning.map(s=>s.id).join('、')} 数据滞后或更新失败；以下状态仅对应标注的观测日期。</p>}<div className="signals">{signals.map((s,i)=><article key={s.title} className={'signal '+(s.hit?'triggered':s.near?'approaching':'')+(i===0?' joint-signal':'')}><div><span>{s.title}</span><b className="signal-state">{s.status}</b></div><strong>{s.display||'—'}</strong><p>{s.rule}</p><small>美东观测 {s.date||'—'}</small>{s.since&&<><small>本轮首次触发 {s.since} · 已持续 {s.duration} 个观测日</small><small>首次触发值 {s.triggerValue}</small></>}</article>)}</div><p className="fine">日期与持续天数按当前阈值历史回算，仅表示本轮连续触发，不是当时发出通知的记录。接近阈值：数值达到阈值的 90%，或广度条件已连续 1–9 日；联动条件不设“接近”状态。广度比值仅衡量等权相对表现，并非成分股参与率。</p></section>;
}
