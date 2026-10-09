(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.MemberCExport=api;
})(globalThis,function(){
  'use strict';
  const xml = value => String(value == null ? '' : value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const relText = r => r.id + ': ' + r.type + '(' + r.from.join(', ') + (r.to == null ? '' : ' → ' + r.to) + ')';
  function column(n){ let out=''; do{out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26)-1;}while(n>=0);return out; }
  function worksheet(rows){
    const cells=rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((v,j)=>{
      const ref=column(j)+(i+1);
      return typeof v==='number' ? '<c r="'+ref+'"><v>'+v+'</v></c>' : '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>';
    }).join('')+'</row>').join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="60" customWidth="1"/><col min="3" max="1000" width="18" customWidth="1"/></cols><sheetData>'+cells+'</sheetData></worksheet>';
  }
  async function workbook(p,Zip){
    const z=new Zip(), ids=p.propositions.map(x=>x.id);
    const matrix = ids.map(from=>[from,...ids.map(to=>p.relations.filter(r=>
      r.to === null ? from!==to && r.from.includes(from) && r.from.includes(to) : r.from.includes(from) && r.to===to
    ).map(r=>r.type+' ['+r.id+']').join('; '))]);
    const sheets=[
      ['命题列表',[['命题 ID','原文','开始索引（含）','结束索引（不含）','一级标签','二级标签'],...p.propositions.map(x=>[x.id,x.text,x.start,x.end,x.tag1,x.tag2])]],
      ['关系列表',[['关系 ID','类型','来源命题','目标命题'],...p.relations.map(r=>[r.id,r.type,r.from.join(', '),r.to||''])]],
      ['关系矩阵',[['来源 / 目标',...ids],...matrix]],
      ['任务信息',[['字段','内容'],['任务 ID',p.task.id],['任务名称',p.task.name],['指南版本',p.task.guideVersion],['裁定者',p.finalizedBy],['定稿时间',p.finalizedAt],['原文',p.task.document.text],['索引约定','JavaScript UTF-16，左闭右开'],['矩阵约定','S/A/M 从来源到目标；J/I 在组合成员之间标记，同一关系 ID 表示一组'],['状态','最终版本（只读）']]]
    ];
    z.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>');
    z.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    z.file('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>'<sheet name="'+s[0]+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>');
    z.file('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'</Relationships>');
    sheets.forEach((s,i)=>z.file('xl/worksheets/sheet'+(i+1)+'.xml',worksheet(s[1])));
    return z.generateAsync({type:'uint8array',compression:'DEFLATE'});
  }
  function svg(p){
    const colors={SF:'#e6f7ff',GF:'#e6fffb',SM:'#fff7e6',GM:'#f9f0ff'}, pos={}, nodes=[];
    let y=85;
    p.propositions.forEach(prop=>{
      const chars=Array.from(prop.text), lines=[];
      for(let i=0;i<chars.length;i+=27) lines.push(chars.slice(i,i+27).join(''));
      const h=45+Math.max(1,lines.length)*22; pos[prop.id]={y:y+h/2};
      nodes.push('<g><rect x="30" y="'+y+'" width="490" height="'+h+'" rx="8" fill="'+(colors[prop.tag1]||'#fff')+'" stroke="#909399"/><text x="46" y="'+(y+25)+'" font-weight="bold">'+xml(prop.id+' · '+prop.tag1+(prop.tag2?' / '+prop.tag2:''))+'</text>'+lines.map((line,i)=>'<text x="46" y="'+(y+50+i*22)+'">'+xml(line)+'</text>').join('')+'</g>');
      y+=h+30;
    });
    const edges=[];
    p.relations.forEach((r,i)=>{
      const pairs=r.to===null?r.from.slice(1).map(id=>[r.from[0],id]):r.from.map(id=>[id,r.to]);
      pairs.forEach(([f,t])=>{
        if(!pos[f]||!pos[t])return;
        const y1=pos[f].y,y2=pos[t].y,lane=590+(i%8)*38;
        edges.push('<path d="M 522 '+y1+' C '+lane+' '+y1+', '+lane+' '+y2+', 522 '+y2+'" fill="none" stroke="'+(r.type==='A'?'#d93025':'#409eff')+'" stroke-width="2"'+(r.to===null?' stroke-dasharray="5 4"':' marker-end="url(#arrow)"')+'/>'+
          '<text x="'+(lane-35)+'" y="'+((y1+y2)/2-4)+'" fill="#303133">'+xml(r.id+' '+r.type)+'</text>');
      });
    });
    const legend=p.relations.map((r,i)=>'<text x="30" y="'+(y+25+i*24)+'">'+xml(relText(r))+'</text>').join('');
    const height=Math.max(300,y+65+p.relations.length*24);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="'+height+'" viewBox="0 0 1000 '+height+'"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#409eff"/></marker></defs><rect width="100%" height="100%" fill="white"/><g font-family="Microsoft YaHei, sans-serif" font-size="15"><text x="30" y="30" font-size="20" font-weight="bold">'+xml(p.task.name)+'</text><text x="30" y="58" fill="#606266">最终裁定版本 · S 支持 / A 反对 / J 组合 / M 匹配 / I 同一</text>'+edges.join('')+nodes.join('')+legend+'</g></svg>';
  }
  async function bundle(p,formats,guide,png,Zip){
    if(!formats.length || formats.some(f=>!['JSON','Excel','PNG','SVG'].includes(f)))throw Error('请选择有效的导出格式');
    if(formats.includes('PNG') && !png)throw Error('PNG 尚未成功生成');
    const z=new Zip();
    if(formats.includes('JSON'))z.file('annotations.json',JSON.stringify(p,null,2));
    if(formats.includes('Excel'))z.file('annotations.xlsx',await workbook(p,Zip));
    if(formats.includes('SVG'))z.file('argument.svg',svg(p));
    if(formats.includes('PNG'))z.file('argument.png',png);
    if(guide)z.file('guide/'+guide.name.replace(/[\\/\x00-\x1f]/g,'_'),guide.bytes);
    z.file('manifest.json',JSON.stringify({taskId:p.task.id,guideVersion:p.task.guideVersion,formats,guide:guide?guide.name:null,finalizedAt:p.finalizedAt,exportedAt:new Date().toISOString()},null,2));
    return z.generateAsync({type:'uint8array',compression:'DEFLATE'});
  }
  function download(bytes,name,type='application/octet-stream'){
    const blob=new Blob([bytes],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function png(svgText){
    const source=new Blob([svgText],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(source);
    try{
      const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('PNG 生成失败，请使用 SVG'));image.src=url;});
      if(img.height>16384)throw Error('图示过高，请选择 SVG 导出');
      const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
      const context=canvas.getContext('2d');if(!context)throw Error('浏览器无法生成 PNG');context.drawImage(img,0,0);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob)throw Error('PNG 生成失败，请使用 SVG');
      return new Uint8Array(await blob.arrayBuffer());
    }finally{URL.revokeObjectURL(url);}
  }
  return {xml,relText,workbook,svg,bundle,download,png};
});
