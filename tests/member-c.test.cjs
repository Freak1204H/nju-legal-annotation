const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '../assets/member-c-core.js');
test('成员 C 的数据模块可供离线页面使用', () => assert.ok(fs.existsSync(file), '缺少成员 C 数据模块'));
const C = fs.existsSync(file) ? require(file) : {};
test('识别标签、边界和关系缺失，不把相同命题当作争议', () => {
  const ds = C.sample();
  assert.deepEqual(C.diff(ds).map(d => d.kind), ['label', 'boundary', 'relation']);
  assert.equal(C.diff(ds).length, 3);
});
test('未解决争议与空重标不能生成最终版本', () => {
  const s = C.initial(C.sample());
  assert.throws(() => C.finalize(s, '裁定者'), /未处理/);
  C.diff(s.dataset).forEach(d => s.decisions[d.key] = { pick:'A', note:'' });
  s.decisions['label:P2'] = { pick:'R', custom:null };
  assert.throws(() => C.finalize(s, '裁定者'), /重标/);
});
test('采纳 B 和重标生成实际数据，最终版本冻结且不允许再次裁定', () => {
  const s = C.initial(C.sample());
  C.diff(s.dataset).forEach(d => s.decisions[d.key] = { pick:'A', note:'核对原文' });
  s.decisions['label:P2'].pick = 'B';
  s.decisions['boundary:P3'] = { pick:'R', custom:{start:25,end:37}, note:'完整句' };
  const out = C.finalize(s, '裁定者', '2026-10-09T00:00:00.000Z');
  assert.equal(out.final.props[1].tag1, 'GM');
  assert.equal(out.final.props[2].text, '被告应向原告支付该款项。');
  assert.equal(out.stage, 'final');
  assert.equal(s.stage, 'review');
  assert.throws(() => C.finalize(out, '裁定者'), /只读/);
});
test('导入校验拒绝越界、字符不一致、重复 ID、悬空关系与错误标签', () => {
  for (const mutate of [
    d => d.versions[0].props[0].end = 999,
    d => d.versions[0].props[0].text = '错误原文',
    d => d.versions[0].props[1].id = 'P1',
    d => d.versions[0].rels[0].from = ['不存在'],
    d => d.versions[0].props[0].tag1 = '未知',
  ]) {
    const d = C.sample(); mutate(d);
    assert.throws(() => C.validateDataset(d));
  }
});
test('重标边界越界或删除命题后悬空的关系阻止定稿', () => {
  const s = C.initial(C.sample());
  C.diff(s.dataset).forEach(d => s.decisions[d.key] = { pick:'A' });
  s.decisions['boundary:P3'] = { pick:'R', custom:{start:-1,end:5} };
  assert.throws(() => C.finalize(s, '裁定者'), /边界/);
  s.decisions['boundary:P3'] = {pick:'A'};
  s.decisions['relation:R1'] = {pick:'R', custom:{id:'R1',type:'S',from:['P99'],to:'P3'}};
  assert.throws(() => C.finalize(s, '裁定者'), /命题/);
});
test('保存失败不报告成功，损坏的数据不静默覆盖', () => {
  const storage = { value:null, getItem(){return this.value}, setItem(k,v){this.value=v} };
  const s = C.initial(C.sample());
  C.save(storage, s);
  assert.deepEqual(C.load(storage), s);
  storage.value = '{bad';
  assert.throws(() => C.load(storage), /损坏/);
  assert.throws(() => C.save({setItem(){throw Error('full')}}, s), /保存失败/);
});
test('只读结果必须先定稿，导出记录保存文件名与实际格式', () => {
  const s = C.initial(C.sample());
  assert.throws(() => C.exportPayload(s), /定稿/);
  C.diff(s.dataset).forEach(d => s.decisions[d.key] = {pick:'A'});
  const done = C.finalize(s, '裁定者');
  const payload = C.exportPayload(done);
  assert.equal(payload.propositions.length, 3);
  assert.equal(payload.relations[0].type, 'S');
  const recorded = C.recordExport(done, {file:'result.zip',formats:['JSON'],who:'测试',time:'2026-10-09',task:'任务',ver:'v1.2'});
  assert.equal(recorded.records[0].file, 'result.zip');
  assert.equal(done.records.length, 0);
});
test('损坏备份的空裁定项、错误重标和缺字段导出记录在导入时被拒绝', () => {
  for(const mutate of [
    s=>s.decisions['label:P2']=null,
    s=>s.decisions['label:P2']={pick:'R',custom:{}},
    s=>s.decisions['relation:R1']={pick:'R',custom:{from:null}},
    s=>s.decisions['boundary:P3']={pick:'R',custom:{start:-1,end:999}},
    s=>s.decisions['label:P2']={pick:'wrong'},
    s=>s.records=[{}],
    s=>s.records=[{time:'bad',who:'测试',task:'任务',ver:'v1',file:'a.zip',formats:['JSON']}],
  ]){
    const s=C.initial(C.sample());mutate(s);
    assert.throws(()=>C.validateState(s));
  }
});
