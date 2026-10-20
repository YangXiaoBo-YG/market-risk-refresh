export function csvText(headers:string[],rows:(string|number|null|undefined)[][]){
 const field=(value:string|number|null|undefined)=>{let text=value==null?'':String(value);if(typeof value==='string'&&/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return '\uFEFF'+[headers,...rows].map(row=>row.map(field).join(',')).join('\r\n');
}
export function downloadCsv(filename:string,headers:string[],rows:(string|number|null|undefined)[][]){
 const url=URL.createObjectURL(new Blob([csvText(headers,rows)],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
