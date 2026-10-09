const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const C = require('../assets/member-c-core.js');
const Zip = require('../assets/vendor/jszip.min.js');
const path = require('node:path');
const file = path.join(__dirname,'../assets/member-c-export.js');
const E = fs.existsSync(file) ? require(file) : {};
function payload(){
  const s=C.initial(C.sample());
  C.diff(s.dataset).forEach(d=>s.decisions[d.key]={pick:'A'});
  return C.exportPayload(C.finalize(s,'测试裁定者'));
}
test('Excel 工作簿包含命题、关系、矩阵与任务信息，文本不执行公式',async()=>{
  const p=payload(); p.task.name='=HYPERLINK("unsafe")';
  const bytes=await E.workbook(p,Zip);
  const zip=await Zip.loadAsync(bytes,{checkCRC32:true});
  const book=await zip.file('xl/workbook.xml').async('string');
  assert.match(book,/命题列表/); assert.match(book,/关系矩阵/);
  const sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sheet,/被告尚欠劳务报酬11000元/);
  const meta=await zip.file('xl/worksheets/sheet4.xml').async('string');
  assert.match(meta,/t="inlineStr"/); assert.doesNotMatch(meta,/<f>/);
  assert.match(meta,/=HYPERLINK/);
});
test('SVG 从最终关系生成箭头，用户文本被转义',()=>{
  const p=payload(); p.propositions[0].text='<script>alert(1)</script>';
  const svg=E.svg(p);
  assert.match(svg,/marker-end="url\(#arrow\)"/);
  assert.match(svg,/&lt;script&gt;/);
  assert.doesNotMatch(svg,/<script>/);
  assert.match(svg,/R1: S\(P2 → P3\)/);
});
test('压缩包实际包含指定数据、工作簿、图示与原始指南附件',async()=>{
  const p=payload();
  const bytes=await E.bundle(p,['JSON','Excel','SVG'],{name:'指南.txt',bytes:new TextEncoder().encode('指南正文')},null,Zip);
  const zip=await Zip.loadAsync(bytes,{checkCRC32:true});
  const json=JSON.parse(await zip.file('annotations.json').async('string'));
  assert.equal(json.readOnly,true);
  assert.equal(json.propositions.length,3);
  assert.ok(zip.file('annotations.xlsx')); assert.ok(zip.file('argument.svg'));
  assert.equal(await zip.file('guide/指南.txt').async('string'),'指南正文');
  assert.ok(zip.file('manifest.json'));
});
test('空格式与未生成的 PNG 不会生成假成功压缩包',async()=>{
  await assert.rejects(()=>E.bundle(payload(),[],null,null,Zip),/格式/);
  await assert.rejects(()=>E.bundle(payload(),['PNG'],null,null,Zip),/PNG/);
});
