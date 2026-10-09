/* 三页复用的 Vue 组件；数据与导出模块可独立测试。 */
(function(){
  'use strict';
  const C=MemberC,E=MemberCExport,ARCHIVES='nju.memberC.archives.v1';
  const labels={label:'标签不同',boundary:'边界不同',relation:'关系差异',presence:'命题缺失'};
  const Workspace={
    props:['page','role'],
    data(){
      let state=C.initial(C.sample()),error='',archives=[];
      try{state=C.load(localStorage)||state;}catch(e){error=e.message;}
      try{const raw=localStorage.getItem(ARCHIVES);const saved=raw?JSON.parse(raw):[];if(!Array.isArray(saved))throw Error('任务存档格式错误');saved.forEach(C.validateState);archives=saved;}
      catch(e){error+=(error?'；':'')+'任务存档读取失败：'+e.message;}
      return {state,archives,error,storageSnapshot:localStorage.getItem(C.KEY),operator:'演示裁定者',filter:'all',statusFilter:'all',search:'',editing:null,form:{},dialog:false,
        formats:['JSON','Excel'],withGuide:false,guide:null,busy:false,graphUrl:'',savedAt:'',archiveIndex:null};
    },
    computed:{
      task(){return this.state.dataset.task;},
      locked(){return this.state.stage==='final';},
      canReview(){return this.role==='arbitrator' && !this.locked && !this.error;},
      canExport(){return ['creator','arbitrator'].includes(this.role) && this.locked && !this.error;},
      diffs(){return C.diff(this.state.dataset);},
      resolvedCount(){return this.diffs.filter(d=>this.resolved(d)).length;},
      filtered(){return this.diffs.filter(d=>(this.filter==='all'||d.kind===this.filter) &&
        (this.statusFilter==='all'||(this.statusFilter==='done')===this.resolved(d)) &&
        (!this.search || (d.id+' '+this.describe(d,d.a)+' '+this.describe(d,d.b)).toLowerCase().includes(this.search.toLowerCase())));},
      propIds(){return [...new Set(this.state.dataset.versions.flatMap(v=>v.props.map(p=>p.id)))];},
      previewText(){const p=this.form;return Number.isInteger(p.start)&&Number.isInteger(p.end)?this.task.document.text.slice(p.start,p.end):'';},
      finalProps(){return this.state.final?this.state.final.props:[];},
      finalRels(){return this.state.final?this.state.final.rels:[];}
    },
    watch:{
      'state.final':{handler(){this.refreshGraph();},deep:true},
      role(){ if(this.dialog && !this.canReview)this.dialog=false; }
    },
    mounted(){
      this.ensureDecisions();this.refreshGraph();
      const key=new URLSearchParams(location.search).get('focus');
      if(key){this.$nextTick(()=>{const row=document.getElementById('diff-'+key);if(row){row.classList.add('c-focus');row.scrollIntoView({block:'center'});}});}
    },
    beforeUnmount(){if(this.graphUrl)URL.revokeObjectURL(this.graphUrl);},
    methods:{
      ensureDecisions(){if(!this.locked)this.diffs.forEach(d=>{if(!Object.hasOwn(this.state.decisions,d.key))this.state.decisions[d.key]={pick:'',note:'',deferred:false};});},
      decision(d){return Object.hasOwn(this.state.decisions,d.key)?this.state.decisions[d.key]:{pick:'',note:''};},
      resolved(d){const c=this.decision(d);return !c.deferred&&(['A','B'].includes(c.pick)||(c.pick==='R'&&!!c.custom));},
      kindLabel(kind){return labels[kind]||kind;},
      typeTag(kind){return {label:'warning',boundary:'info',relation:'danger',presence:'danger'}[kind];},
      describe(d,v){if(!v)return '未标注';if(d.kind==='relation')return E.relText(v);if(d.kind==='label')return v.tag1+(v.tag2?' / '+v.tag2:'')+'\n'+v.text;return '['+v.start+', '+v.end+')\n'+v.text+(d.kind==='presence'?'\n'+v.tag1+(v.tag2?' / '+v.tag2:''):'');},
      parts(v){if(!v||v.start==null)return null;const text=this.task.document.text;return [text.slice(0,v.start),text.slice(v.start,v.end),text.slice(v.end)];},
      notifyError(e){this.$message.error(e.message||String(e));},
      persist(next,success){
        if(this.error)throw Error('请先备份并重新导入，当前本地数据存在错误');
        if(localStorage.getItem(C.KEY)!==this.storageSnapshot)throw Error('其他标签页已更新此任务，请先下载当前备份，再刷新页面后继续');
        C.save(localStorage,next);this.storageSnapshot=localStorage.getItem(C.KEY);this.state=next;this.savedAt=new Date().toLocaleString('zh-CN');
        if(success)this.$message.success(success);
      },
      saveDraft(){if(!this.canReview)return;try{this.persist(C.clone(this.state),'裁定草稿已保存');}catch(e){this.notifyError(e);}},
      pickChanged(d){if(!this.canReview)return;this.decision(d).deferred=false;if(this.decision(d).pick==='R')this.edit(d);},
      edit(d){if(!this.canReview)return;this.editing=d;this.form=C.clone(this.decision(d).custom||d.a||d.b);this.dialog=true;},
      applyEdit(){
        if(!this.canReview)return;
        try{
          const d=this.editing,f=C.clone(this.form);
          if(d.kind==='label'||d.kind==='presence'){if(!C.tags.includes(f.tag1))throw Error('请选择一级标签');if(f.tag1!=='GM')f.tag2='';if(f.tag1==='GM'&&f.tag2&&!C.subTags.includes(f.tag2))throw Error('请选择有效二级标签');}
          if(d.kind==='boundary'||d.kind==='presence'){
            if(!Number.isInteger(f.start)||!Number.isInteger(f.end)||f.start<0||f.end<=f.start||f.end>this.task.document.text.length)throw Error('请填写有效的原文字符范围');
            f.text=this.task.document.text.slice(f.start,f.end);
          }
          if(d.kind==='relation'){
            if(['J','I'].includes(f.type))f.to=null;
            const fake={...C.clone(this.state.dataset),versions:this.state.dataset.versions.map(v=>({...C.clone(v),props:this.propIds.map(id=>C.clone(this.state.dataset.versions.flatMap(x=>x.props).find(p=>p.id===id))),rels:[f]}))};
            C.validateDataset(fake);
          }
          this.state.decisions[d.key]={...this.decision(d),pick:'R',custom:f,deferred:false};this.dialog=false;
        }catch(e){this.notifyError(e);}
      },
      defer(d){if(!this.canReview)return;this.decision(d).deferred=!this.decision(d).deferred;},
      async finalize(){
        if(!this.canReview)return;
        try{
          if(!this.operator.trim())throw Error('请填写裁定者姓名');
          const next=C.finalize(this.state,this.operator.trim());
          await this.$confirm('定稿后此版本只读，不能返回修改。确认提交最终版本？','提交最终版本',{type:'warning',confirmButtonText:'确认定稿',cancelButtonText:'继续检查'});
          this.persist(next,'最终版本已定稿，可以导出');
        }catch(e){if(e!=='cancel'&&e!=='close')this.notifyError(e);}
      },
      go(page,key){
        try{if(this.canReview)this.persist(C.clone(this.state));location.href=page+(key?'?focus='+encodeURIComponent(key):'');}
        catch(e){this.notifyError(e);}
      },
      backup(){
        const raw=this.error?JSON.stringify({rawTask:localStorage.getItem(C.KEY),rawArchives:localStorage.getItem(ARCHIVES)},null,2):JSON.stringify(this.state,null,2);
        E.download(raw||JSON.stringify(this.state,null,2),'裁定备份_'+this.safeName(this.task.id)+'.json','application/json');
      },
      sampleFile(){E.download(JSON.stringify(C.sample(),null,2),'标注对接示例.json','application/json');},
      safeName(name){return String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80)||'task';},
      async importFile(event){
        const file=event.target.files[0];event.target.value='';if(!file)return;
        if(this.role!=='arbitrator'){this.$message.warning('请切换为裁定者导入任务');return;}
        try{
          if(file.size>5*1024*1024)throw Error('JSON 文件不能超过 5 MB');
          const parsed=JSON.parse(await file.text());
          const next=parsed.dataset?C.validateState(parsed):C.initial(parsed);
          await this.$confirm('导入后将切换到新任务。当前任务会保留在任务存档中。'+(this.error?'当前损坏数据会先下载备份。':''),'导入标注版本',{confirmButtonText:'导入',cancelButtonText:'取消'});
          if(this.error){this.backup();localStorage.setItem(ARCHIVES,JSON.stringify(this.archives));this.error='';}
          else this.archiveCurrent();
          this.persist(C.clone(next),'标注版本已导入');this.ensureDecisions();this.archiveIndex=null;this.guide=null;this.withGuide=false;this.refreshGraph();
        }catch(e){if(e!=='cancel'&&e!=='close')this.notifyError(e);}
      },
      archiveCurrent(){
        C.validateState(this.state);
        if(localStorage.getItem(C.KEY)!==this.storageSnapshot)throw Error('其他标签页已更新此任务，请先下载当前备份，再刷新页面后继续');
        const current=JSON.stringify(this.state);
        const list=this.archives.filter(s=>JSON.stringify(s)!==current);
        list.unshift(C.clone(this.state));
        try{localStorage.setItem(ARCHIVES,JSON.stringify(list));}catch(e){throw Error('任务存档保存失败，导入已停止，请先下载备份');}
        this.archives=list;
      },
      async openArchive(index){
        if(this.error)return;
        try{
          const next=C.clone(this.archives[index]);if(!next)return;
          await this.$confirm('切换到该存档？当前任务将自动保留。','切换任务',{confirmButtonText:'切换',cancelButtonText:'取消'});
          this.archiveCurrent();this.persist(next,'已打开任务存档');this.ensureDecisions();this.archiveIndex=null;this.guide=null;this.withGuide=false;this.refreshGraph();
        }catch(e){if(e!=='cancel'&&e!=='close')this.notifyError(e);this.archiveIndex=null;}
      },
      async guideFile(event){
        const file=event.target.files[0];event.target.value='';if(!file)return;
        try{if(file.size>20*1024*1024)throw Error('指南附件不能超过 20 MB');this.guide={name:file.name,bytes:new Uint8Array(await file.arrayBuffer())};this.withGuide=true;}
        catch(e){this.notifyError(e);}
      },
      refreshGraph(){
        if(this.graphUrl)URL.revokeObjectURL(this.graphUrl);this.graphUrl='';
        if(this.state.stage==='final'){
          try{this.graphUrl=URL.createObjectURL(new Blob([E.svg(C.exportPayload(this.state))],{type:'image/svg+xml;charset=utf-8'}));}
          catch(e){this.notifyError(e);}
        }
      },
      async exportData(){
        if(!this.canExport||this.busy)return;
        this.busy=true;
        try{
          if(!this.formats.length)throw Error('请选择至少一种导出格式');
          if(!this.operator.trim())throw Error('请填写操作人姓名');
          if(this.withGuide&&!this.guide)throw Error('请上传实际的标注指南附件，或取消附带指南');
          const p=C.exportPayload(this.state),formats=[...this.formats],guide=this.withGuide?this.guide:null;
          const png=formats.includes('PNG')?await E.png(E.svg(p)):null;
          const bytes=await E.bundle(p,formats,guide,png,JSZip);
          const time=new Date().toISOString(),file='results_'+this.safeName(this.task.id)+'_'+time.replace(/[:.]/g,'-')+'.zip';
          // 记录的是生成与发起下载，不宣称浏览器已把文件保存到磁盘。
          const next=C.recordExport(this.state,{time,who:this.operator.trim(),task:this.task.name,ver:this.task.guideVersion,file,formats,guide:guide?guide.name:null,bytes:bytes.length});
          this.persist(next);E.download(bytes,file,'application/zip');this.$message.success('压缩包已生成，并已发起下载');
        }catch(e){this.notifyError(e);}
        finally{this.busy=false;}
      },
      timeLabel(time){return new Date(time).toLocaleString('zh-CN',{hour12:false});}
    },
    template:`
      <section>
        <h2 class="page-title">{{ page==='review'?'冲突解决':page==='compare'?'差异比对':'结果输出' }}</h2>
        <p class="page-desc">{{ page==='review'?'核对原文，逐项处理争议，提交最终裁定版本':page==='compare'?'按标签、关系、边界和命题缺失查看两份标注版本':'从最终裁定版本生成真实文件，保留导出记录' }}</p>
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
        <el-alert v-if="!error && !locked && role!=='arbitrator'" title="当前为预览模式。切换顶部角色为「裁定者」后可处理争议。" type="info" :closable="false" show-icon />
        <el-alert v-if="locked" title="最终版本已只读。可导出或导入另一个任务，当前版本会保留在存档中。" type="success" :closable="false" show-icon />
        <div class="card" style="margin-top:16px">
          <div class="c-summary"><span>任务：<strong>{{task.name}}</strong></span><span>指南：{{task.guideVersion}}</span><span>状态：<el-tag :type="locked?'success':'warning'">{{locked?'已定稿':'裁定中'}}</el-tag></span></div>
          <div class="c-toolbar">
            <el-button @click="$refs.importInput.click()" :disabled="role!=='arbitrator'||busy">导入标注 JSON / 备份</el-button>
            <input ref="importInput" type="file" accept=".json,application/json" hidden @change="importFile">
            <el-button @click="sampleFile">下载对接示例</el-button><el-button @click="backup">下载当前备份</el-button>
            <el-select v-if="archives.length" v-model="archiveIndex" placeholder="打开任务存档" style="width:240px" @change="openArchive" :disabled="!!error||busy"><el-option v-for="(s,i) in archives" :key="i" :value="i" :label="s.dataset.task.name+' · '+(s.stage==='final'?'已定稿':'草稿')" /></el-select>
          </div>
          <div class="c-muted">两份版本：{{state.dataset.versions[0].name||state.dataset.versions[0].annotatorId}} / {{state.dataset.versions[1].name||state.dataset.versions[1].annotatorId}}。数据保存在当前浏览器；交给组员时请下载备份。字符索引从 0 开始，范围左闭右开。</div>
        </div>
        <template v-if="page!=='results'">
          <div class="c-stats"><div class="c-stat"><b>{{diffs.length}}</b>争议总数</div><div class="c-stat"><b>{{resolvedCount}}</b>已处理</div><div class="c-stat"><b>{{diffs.length-resolvedCount}}</b>未处理 / 待专家裁决</div></div>
          <div class="card"><h3 style="margin-top:0">裁判理由原文</h3><div class="c-source">{{task.document.text}}</div></div>
          <div class="card">
            <div class="c-toolbar"><el-select v-model="filter" style="width:150px"><el-option label="全部差异类型" value="all"/><el-option v-for="(name,kind) in {label:'标签不同',boundary:'边界不同',relation:'关系差异',presence:'命题缺失'}" :key="kind" :value="kind" :label="name"/></el-select><el-select v-model="statusFilter" style="width:140px"><el-option label="全部处理状态" value="all"/><el-option label="已处理" value="done"/><el-option label="未处理" value="pending"/></el-select><el-input v-model="search" clearable placeholder="搜索命题、关系或原文" style="width:260px"/><span class="c-muted">显示 {{filtered.length}} 项</span></div>
            <el-empty v-if="!filtered.length" :description="diffs.length?'没有符合条件的差异':'两份版本一致，可直接核对定稿'"/>
            <article v-for="d in filtered" :key="d.key" :id="'diff-'+d.key" style="padding:16px 0;border-bottom:1px solid #ebeef5">
              <div class="c-toolbar" style="margin-top:0"><el-tag :type="typeTag(d.kind)">{{kindLabel(d.kind)}}</el-tag><strong>{{d.id}}</strong><span class="grow"></span><el-tag :type="decision(d).deferred?'danger':resolved(d)?'success':'info'">{{decision(d).deferred?'待专家裁决':resolved(d)?'已处理':'未处理'}}</el-tag></div>
              <div class="c-pair"><div v-for="(v,i) in [d.a,d.b]" :key="i" class="c-version"><strong>{{state.dataset.versions[i].name||state.dataset.versions[i].annotatorId}}</strong><p class="c-detail">{{describe(d,v)}}</p><div v-if="d.kind==='boundary' && parts(v)" class="c-detail"><span>{{parts(v)[0]}}</span><mark>{{parts(v)[1]}}</mark><span>{{parts(v)[2]}}</span></div></div></div>
              <template v-if="page==='review'">
                <div class="c-actions"><el-radio-group v-model="state.decisions[d.key].pick" :disabled="!canReview" @change="pickChanged(d)"><el-radio-button value="A">采纳 A</el-radio-button><el-radio-button value="B">采纳 B</el-radio-button><el-radio-button value="R">手动重标</el-radio-button></el-radio-group><el-button v-if="decision(d).pick==='R'" @click="edit(d)" :disabled="!canReview">编辑重标</el-button><el-button @click="defer(d)" :disabled="!canReview" :type="decision(d).deferred?'danger':'default'">{{decision(d).deferred?'取消专家裁决':'标记待专家裁决'}}</el-button></div>
                <p v-if="decision(d).pick==='R' && decision(d).custom" class="c-detail">重标结果：{{describe(d,decision(d).custom)}}</p>
                <el-input v-model="state.decisions[d.key].note" :disabled="!canReview" placeholder="裁定理由 / 需要专家讨论的问题（可选）" style="margin-top:10px" maxlength="1000"/>
              </template>
              <div v-else class="c-actions"><span class="c-detail">裁定：{{decision(d).pick==='A'?'采纳 A':decision(d).pick==='B'?'采纳 B':decision(d).pick==='R'?'手动重标':'尚未选择'}}{{decision(d).note?' · '+decision(d).note:''}}</span><el-button size="small" @click="go('review.html',d.key)">查看 / 处理此争议</el-button></div>
            </article>
          </div>
          <div v-if="page==='review'" class="card"><div class="c-toolbar"><label>裁定者：</label><el-input v-model="operator" placeholder="姓名" style="width:180px" :disabled="locked"/><el-button @click="saveDraft" :disabled="!canReview">保存草稿</el-button><el-button type="success" @click="finalize" :disabled="!canReview || resolvedCount!==diffs.length">提交最终版本</el-button><el-button @click="go('compare.html')">差异比对</el-button><el-button v-if="locked" type="primary" @click="go('results.html')">进入结果输出</el-button></div><span class="c-muted">{{savedAt?'最后保存：'+savedAt:'修改后请保存草稿；切换这三页时会自动保存。'}} 待专家裁决表示需要线下讨论，不会自动发送给他人。</span></div>
        </template>
        <template v-else>
          <el-alert v-if="!locked" title="尚未定稿，不能导出。请先到冲突解决页处理争议并提交最终版本。" type="warning" :closable="false" show-icon/>
          <el-alert v-else-if="!canExport && !error" title="切换为任务创建者或裁定者后可导出结果。" type="info" :closable="false"/>
          <div class="card" style="margin-top:16px"><h3 style="margin-top:0">导出内容</h3><el-checkbox-group v-model="formats" :disabled="busy"><el-checkbox v-for="f in ['JSON','Excel','PNG','SVG']" :key="f" :value="f" class="c-format">{{{JSON:'JSON 标注数据（字符索引、标签、关系及裁定记录）',Excel:'Excel 工作簿（命题、关系、关系矩阵、任务信息）',PNG:'论证图示 PNG',SVG:'论证图示 SVG'}[f]}}</el-checkbox></el-checkbox-group><div class="c-toolbar"><el-checkbox v-model="withGuide" :disabled="busy">附带实际标注指南（{{task.guideVersion}}）</el-checkbox><el-button size="small" @click="$refs.guideInput.click()" :disabled="busy">选择指南文件</el-button><span class="c-muted">{{guide?guide.name:'尚未选择附件'}}</span><input ref="guideInput" type="file" hidden @change="guideFile"></div><div class="c-toolbar"><label>操作人：</label><el-input v-model="operator" style="width:180px" :disabled="busy"/><el-button type="primary" :loading="busy" :disabled="!canExport||!formats.length" @click="exportData">生成压缩包并下载</el-button><el-button @click="go('review.html')">查看裁定</el-button></div></div>
          <div v-if="locked" class="card"><h3 style="margin-top:0">最终版本预览</h3><p class="c-muted">裁定者：{{state.final.who}} · 定稿时间：{{timeLabel(state.final.time)}} · {{finalProps.length}} 个命题 / {{finalRels.length}} 条关系</p><el-table :data="finalProps" border><el-table-column prop="id" label="命题" width="90"/><el-table-column prop="text" label="原文" min-width="240"/><el-table-column prop="tag1" label="一级标签" width="100"/><el-table-column prop="tag2" label="二级标签" width="100"/><el-table-column prop="start" label="开始" width="80"/><el-table-column prop="end" label="结束" width="80"/></el-table><p v-for="r in finalRels" :key="r.id" class="c-detail">{{MemberRel(r)}}</p><img v-if="graphUrl" :src="graphUrl" class="c-graph" alt="最终裁定版本论证图示"/></div>
          <div class="card"><h3 style="margin-top:0">导出记录</h3><p class="c-muted">记录文件生成及发起下载的时间；浏览器是否完成保存，请检查下载列表。</p><el-table :data="state.records" border empty-text="暂无导出记录"><el-table-column label="导出时间" width="190"><template #default="s">{{timeLabel(s.row.time)}}</template></el-table-column><el-table-column prop="who" label="操作人" width="130"/><el-table-column prop="ver" label="指南版本" width="100"/><el-table-column label="格式" width="160"><template #default="s">{{s.row.formats.join(' / ')}}</template></el-table-column><el-table-column prop="file" label="文件名" min-width="260"/></el-table></div>
        </template>
        <el-dialog v-model="dialog" title="手动重标" width="620px" :close-on-click-modal="false">
          <template v-if="editing"><p>争议：{{editing.id}} · {{kindLabel(editing.kind)}}</p>
            <template v-if="editing.kind==='boundary'||editing.kind==='presence'"><div class="c-form-row"><label>原文字符范围（左闭右开，原文共 {{task.document.text.length}} 个字符）</label><el-input-number v-model="form.start" :min="0" :max="task.document.text.length-1" :precision="0"/> 至 <el-input-number v-model="form.end" :min="1" :max="task.document.text.length" :precision="0"/></div><div class="c-source">{{previewText}}</div></template>
            <template v-if="editing.kind==='label'||editing.kind==='presence'"><div class="c-form-row"><label>一级标签</label><el-select v-model="form.tag1" @change="form.tag2=''" style="width:100%"><el-option v-for="tag in ['SF','GF','SM','GM']" :key="tag" :value="tag" :label="tag"/></el-select></div><div v-if="form.tag1==='GM'" class="c-form-row"><label>二级标签</label><el-select v-model="form.tag2" style="width:100%"><el-option label="未细分" value=""/><el-option v-for="tag in ['GM-L','GM-I','GM-C','GM-U','GM-M','GM-O']" :key="tag" :value="tag" :label="tag"/></el-select></div></template>
            <template v-if="editing.kind==='relation'"><div class="c-form-row"><label>关系类型</label><el-select v-model="form.type" style="width:100%"><el-option v-for="t in ['S','A','J','M','I']" :key="t" :value="t" :label="t"/></el-select></div><div class="c-form-row"><label>来源命题（S/A/M 选一个，J/I 至少两个）</label><el-select v-model="form.from" multiple style="width:100%"><el-option v-for="id in propIds" :key="id" :value="id" :label="id"/></el-select></div><div v-if="!['J','I'].includes(form.type)" class="c-form-row"><label>目标命题</label><el-select v-model="form.to" style="width:100%"><el-option v-for="id in propIds" :key="id" :value="id" :label="id"/></el-select></div></template>
          </template><template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" @click="applyEdit" :disabled="!canReview">应用重标</el-button></template>
        </el-dialog>
      </section>`
  };
  Workspace.methods.MemberRel=E.relText;
  const app=Vue.createApp({
    data(){return {pageTitle:document.title.split(' - ')[0],role:localStorage.getItem('demoRole')||'annotator'};},
    watch:{role(role){try{localStorage.setItem('demoRole',role);}catch(e){this.$message.error('角色偏好未能保存');}}},
    methods:{go(p){const child=this.$refs.workspace;if(child)child.go(p);else location.href=p;},logout(){this.go('index.html');}}
  });
  app.component('member-c-workspace',Workspace);app.use(ElementPlus).mount('#app');
})();
