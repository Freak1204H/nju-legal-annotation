/* 成员 C：独立于 Vue 的数据契约、裁定与本地存储。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MemberC = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const KEY = 'nju.memberC.v1';
  const tags = ['SF','GF','SM','GM'];
  const subTags = ['GM-L','GM-I','GM-C','GM-U','GM-M','GM-O'];
  const relationTypes = ['S','A','J','M','I'];
  const clone = x => JSON.parse(JSON.stringify(x));
  const check = (ok, message) => { if (!ok) throw Error(message); };
  function sample() {
    const text = '原告已依约提供劳务。被告尚欠劳务报酬11000元。被告应向原告支付该款项。';
    const make = (id, phrase, tag1) => {
      const start = text.indexOf(phrase);
      return {id, text:phrase, start, end:start + phrase.length, tag1, tag2:''};
    };
    const a = {annotatorId:'A', name:'标注员 A', props:[
      make('P1','原告已依约提供劳务。','SF'),
      make('P2','被告尚欠劳务报酬11000元。','SF'),
      make('P3','被告应向原告支付该款项','SM')
    ], rels:[{id:'R1',type:'S',from:['P2'],to:'P3'}]};
    const b = clone(a); b.annotatorId = 'B'; b.name = '标注员 B';
    b.props[1].tag1 = 'GM'; b.props[1].tag2 = 'GM-C';
    b.props[2] = make('P3','被告应向原告支付该款项。','SM'); b.rels = [];
    return {schemaVersion:1, task:{id:'demo-labor',name:'劳务合同纠纷标注（示例）',guideVersion:'v1.2',
      document:{id:'doc-demo',name:'劳务合同纠纷裁判理由（示例）',text}}, versions:[a,b]};
  }
  function validateProps(props, text) {
    check(Array.isArray(props), '命题列表必须是数组');
    const ids = new Set();
    props.forEach(p => {
      check(p && typeof p.id === 'string' && p.id.trim() && !ids.has(p.id), '命题 ID 缺失或重复'); ids.add(p.id);
      check(Number.isInteger(p.start) && Number.isInteger(p.end) && p.start >= 0 && p.end > p.start && p.end <= text.length, '命题边界必须在原文范围内');
      check(p.text === text.slice(p.start,p.end), '命题文本与原文字符范围不一致');
      check(tags.includes(p.tag1) && (p.tag1 === 'GM' ? (p.tag2 === '' || subTags.includes(p.tag2)) : p.tag2 === ''), '命题标签不合法');
    });
    return ids;
  }
  function validateRels(rels, ids) {
    check(Array.isArray(rels), '关系列表必须是数组');
    const seen = new Set();
    rels.forEach(r => {
      check(r && typeof r.id === 'string' && r.id.trim() && !seen.has(r.id), '关系 ID 缺失或重复'); seen.add(r.id);
      check(relationTypes.includes(r.type), '关系类型不合法');
      check(Array.isArray(r.from) && r.from.length && new Set(r.from).size === r.from.length && r.from.every(id => ids.has(id)), '关系来源命题不存在或重复');
      if (r.type === 'J' || r.type === 'I') check(r.from.length >= 2 && r.to === null, 'J/I 关系需要至少两个来源命题，目标为 null');
      else check(r.from.length === 1 && ids.has(r.to) && r.from[0] !== r.to, '关系目标命题不存在或与来源相同');
    });
  }
  function validateDataset(d) {
    check(d && d.schemaVersion === 1, '不支持的数据版本，应为 schemaVersion: 1');
    check(d.task && typeof d.task.id === 'string' && d.task.id.trim() && typeof d.task.name === 'string' && d.task.name.trim(), '缺少任务 ID 或名称');
    check(typeof d.task.guideVersion === 'string' && d.task.guideVersion.trim(), '缺少指南版本');
    check(d.task.document && typeof d.task.document.text === 'string' && d.task.document.text.length, '缺少文书原文');
    check(Array.isArray(d.versions) && d.versions.length === 2, '当前支持两名标注员的版本对照');
    const names = new Set();
    d.versions.forEach(v => {
      check(v && typeof v.annotatorId === 'string' && v.annotatorId.trim() && !names.has(v.annotatorId), '标注员 ID 缺失或重复'); names.add(v.annotatorId);
      validateRels(v.rels, validateProps(v.props, d.task.document.text));
    });
    return d;
  }
  function diff(d) {
    const [a,b] = d.versions, out = [];
    const push = (kind,id,av,bv) => out.push({key:kind + ':' + id,kind,id,a:clone(av),b:clone(bv)});
    const am = new Map(a.props.map(p=>[p.id,p])), bm = new Map(b.props.map(p=>[p.id,p]));
    [...new Set([...am.keys(),...bm.keys()])].forEach(id => {
      const x = am.get(id) || null, y = bm.get(id) || null;
      if (!x || !y) push('presence',id,x,y);
      else {
        if (x.tag1 !== y.tag1 || x.tag2 !== y.tag2) push('label',id,x,y);
        if (x.start !== y.start || x.end !== y.end) push('boundary',id,x,y);
      }
    });
    const ar = new Map(a.rels.map(r=>[r.id,r])), br = new Map(b.rels.map(r=>[r.id,r]));
    [...new Set([...ar.keys(),...br.keys()])].forEach(id => {
      const x = ar.get(id) || null, y = br.get(id) || null;
      const signature = r => r ? JSON.stringify([r.type,[...r.from].sort(),r.to]) : '';
      if (signature(x) !== signature(y)) push('relation',id,x,y);
    });
    return out;
  }
  function initial(dataset) {
    validateDataset(dataset);
    return {schemaVersion:1,dataset:clone(dataset),stage:'review',decisions:{},final:null,records:[]};
  }
  function resolve(state) {
    const data = clone(state.dataset.versions[0]);
    const props = new Map(data.props.map(p=>[p.id,p])), rels = new Map(data.rels.map(r=>[r.id,r]));
    diff(state.dataset).forEach(d => {
      const choice = state.decisions[d.key];
      check(choice && !choice.deferred && ['A','B','R'].includes(choice.pick), '还有未处理或待专家裁决的争议');
      const selected = choice.pick === 'R' ? choice.custom : d[choice.pick.toLowerCase()];
      check(choice.pick !== 'R' || selected !== undefined && selected !== null, '请填写完整的重标内容');
      if (d.kind === 'relation') {
        if (selected) rels.set(d.id, {...clone(selected),id:d.id}); else rels.delete(d.id);
      } else if (d.kind === 'presence') {
        if (selected) props.set(d.id, {...clone(selected),id:d.id}); else props.delete(d.id);
      } else {
        const p = props.get(d.id);
        if (d.kind === 'label') {
          check(selected && tags.includes(selected.tag1), '重标标签不合法');
          p.tag1 = selected.tag1; p.tag2 = selected.tag2 || '';
        } else {
          check(selected && Number.isInteger(selected.start) && Number.isInteger(selected.end) && selected.start >= 0 && selected.end > selected.start && selected.end <= state.dataset.task.document.text.length, '重标边界不合法');
          p.start = selected.start; p.end = selected.end;
          p.text = state.dataset.task.document.text.slice(p.start,p.end);
        }
      }
    });
    const result = {props:[...props.values()].sort((a,b)=>a.start-b.start || a.id.localeCompare(b.id)),rels:[...rels.values()]};
    validateRels(result.rels,validateProps(result.props,state.dataset.task.document.text));
    return result;
  }
  function finalize(state, who, time = new Date().toISOString()) {
    check(state.stage !== 'final', '最终版本已只读，不能再次裁定');
    validateDataset(state.dataset);
    const final = resolve(state);
    check(final.props.length, '最终版本至少需要一条命题');
    return {...clone(state),stage:'final',final:{...final,who,time}};
  }
  function validateState(state) {
    check(state && state.schemaVersion === 1 && ['review','final'].includes(state.stage) && state.decisions && typeof state.decisions === 'object' && !Array.isArray(state.decisions) && Array.isArray(state.records), '保存的数据格式不合法');
    validateDataset(state.dataset);
    const disagreements = new Map(diff(state.dataset).map(d=>[d.key,d]));
    const allIds = new Set(state.dataset.versions.flatMap(v=>v.props.map(p=>p.id)));
    Object.entries(state.decisions).forEach(([key,c])=>{
      const d = disagreements.get(key);
      check(d && c && typeof c === 'object' && !Array.isArray(c) && ['', 'A','B','R'].includes(c.pick), '裁定项格式不合法');
      check((c.note === undefined || typeof c.note === 'string') && (c.deferred === undefined || typeof c.deferred === 'boolean'), '裁定理由或专家待办格式不合法');
      if(c.custom !== undefined){
        check(c.custom && typeof c.custom === 'object' && !Array.isArray(c.custom), '重标内容格式不合法');
        if(d.kind === 'relation') validateRels([c.custom],allIds);
        else {
          if(d.kind === 'label') check(tags.includes(c.custom.tag1), '重标标签不完整');
          if(d.kind === 'boundary') check(Number.isInteger(c.custom.start) && Number.isInteger(c.custom.end), '重标边界不完整');
          let prop = d.kind === 'presence' ? {...clone(c.custom),id:d.id} : {...clone(d.a || d.b),...clone(c.custom),id:d.id};
          if(d.kind === 'boundary') prop.text=state.dataset.task.document.text.slice(prop.start,prop.end);
          validateProps([prop],state.dataset.task.document.text);
        }
      }
    });
    state.records.forEach(r=>{
      check(r && typeof r === 'object' && ['who','task','ver','file'].every(k=>typeof r[k] === 'string' && r[k].trim()) && typeof r.time === 'string' && Number.isFinite(Date.parse(r.time)), '导出记录字段缺失或格式不合法');
      check(Array.isArray(r.formats) && r.formats.length && r.formats.every(f=>['JSON','Excel','PNG','SVG'].includes(f)), '导出记录格式列表不合法');
    });
    if (state.stage === 'final') {
      check(state.final && typeof state.final.time === 'string' && Number.isFinite(Date.parse(state.final.time)) && typeof state.final.who === 'string' && state.final.who.trim() && state.final.props && state.final.props.length, '最终版本信息不完整');
      validateRels(state.final.rels,validateProps(state.final.props,state.dataset.task.document.text));
      const expected = resolve(state);
      check(JSON.stringify(expected.props) === JSON.stringify(state.final.props) && JSON.stringify(expected.rels) === JSON.stringify(state.final.rels), '最终版本与裁定记录不一致');
    }
    return state;
  }
  function load(storage) {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    try { return validateState(JSON.parse(raw)); }
    catch(e) { throw Error('本地数据已损坏：' + e.message + '。请先备份再重新导入。'); }
  }
  function save(storage,state) {
    validateState(state);
    try { storage.setItem(KEY,JSON.stringify(state)); }
    catch(e) { throw Error('本地保存失败，请检查浏览器存储空间或下载备份。'); }
  }
  function exportPayload(state) {
    check(state.stage === 'final' && state.final, '请先完成裁定并定稿');
    validateState(state);
    return {schemaVersion:1,task:clone(state.dataset.task),readOnly:true,finalizedBy:state.final.who,finalizedAt:state.final.time,
      propositions:clone(state.final.props),relations:clone(state.final.rels),decisions:clone(state.decisions)};
  }
  function recordExport(state, record) {
    exportPayload(state);
    return {...clone(state),records:[clone(record),...clone(state.records)]};
  }
  return {KEY,tags,subTags,relationTypes,clone,sample,validateDataset,diff,initial,resolve,finalize,validateState,load,save,exportPayload,recordExport};
});
