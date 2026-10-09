# 成员 C：裁定、差异比对与结果输出

直接用 Chrome / Edge 打开 `review.html`，切换右上角角色为「裁定者」。依赖均在本地，无需安装或联网。

## 演示流程

1. 默认载入两名标注员的示例版本，含标签、边界、关系三类争议。也可点击「导入标注 JSON / 备份」导入真实数据。
2. 逐项采纳 A/B 或手动重标。边界重标按原文字符索引输入；关系重标填写类型、来源与目标；可写裁定理由。
3. 尚未选择、未填写重标或标记「待专家裁决」的争议会阻止定稿。专家待办用于记录线下讨论，不会发送消息。
4. 「保存草稿」后刷新保留数据。从这三页的导航离开时，裁定者草稿也会自动保存。跨标签页检测到数据被更新时，会要求先备份并刷新，避免覆盖。
5. 差异比对页支持按差异类型、处理状态和文本筛选，并跳转到对应争议。
6. 提交最终版本后只读。任务创建者或裁定者可在结果页生成 ZIP，包含勾选的 JSON、XLSX、PNG、SVG。
7. 如需附带指南，请选择与任务指南版本对应的真实文件；系统没有虚构的指南正文。附件最多 20 MB。
8. 导出记录表示文件已生成并已发起浏览器下载；是否保存成功以浏览器下载列表为准。

数据保存在当前浏览器的 localStorage，浏览器之间不共享。交给组员请下载备份 JSON。导入其他任务会存档当前版本；同一任务 ID 的不同裁定版本也会保留，可从「打开任务存档」切换。最终版本不因切换任务而变为可编辑。数据损坏时先下载原始数据备份，再导入有效 JSON 恢复。

## 成员 B 的数据接口

点击「下载对接示例」可获取完整合法 JSON。导入文件最多 5 MB。当前支持同一份原文的**两名标注员**对照；多人的结果应先选定要比较的两份版本。

```json
{
  "schemaVersion": 1,
  "task": {
    "id": "task-001",
    "name": "标注任务名称",
    "guideVersion": "v1.2",
    "document": { "id": "doc-001", "name": "文书名称", "text": "原告已履约。被告应支付。" }
  },
  "versions": [
    {
      "annotatorId": "A",
      "name": "标注员 A",
      "props": [
        { "id": "P1", "text": "原告已履约。", "start": 0, "end": 6, "tag1": "SF", "tag2": "" },
        { "id": "P2", "text": "被告应支付。", "start": 6, "end": 12, "tag1": "SM", "tag2": "" }
      ],
      "rels": [{ "id": "R1", "type": "S", "from": ["P1"], "to": "P2" }]
    },
    {
      "annotatorId": "B",
      "name": "标注员 B",
      "props": [
        { "id": "P1", "text": "原告已履约。", "start": 0, "end": 6, "tag1": "SF", "tag2": "" },
        { "id": "P2", "text": "被告应支付。", "start": 6, "end": 12, "tag1": "SM", "tag2": "" }
      ],
      "rels": []
    }
  ]
}
```

- 命题 ID 应在两份版本中稳定对应；相同 ID 比较标签和边界，仅一方出现则显示命题缺失。不是按列表序号强行对齐。
- 关系 ID 也需稳定对应；同一 ID 比较类型、来源和目标。来源数组的顺序不影响差异判断。
- 索引采用 JavaScript UTF-16 字符位置，左闭右开，即 `text.slice(start, end)` 必须等于命题文本。包含 emoji 等字符时不能按 Unicode 码点数计算索引。
- `tag1` 支持 SF、GF、SM、GM；非 GM 的 `tag2` 必须为空。GM 可不细分或使用 GM-L/I/C/U/M/O。
- S/A/M 关系：一个来源、一个不同的目标。J/I 关系：至少两个不同来源，`to` 为 `null`。
- ID 不可重复；关系引用的命题必须存在。最终裁定若删除命题导致悬空关系，会拒绝定稿并提示检查相关争议。

成员 B 目前的页面没有写入共享业务数据，C 页不会冒充读取成功。B 可以按此格式下载 JSON 交给 C，也可调用 `MemberC.initial(dataset)` 和 `MemberC.save(localStorage, state)` 写入 `nju.memberC.v1`（需要同浏览器、同源且先载入 `assets/member-c-core.js`）。不要覆盖已经定稿的数据；优先通过导入入口切换并存档。

## 文件职责与验证

- `assets/member-c-core.js`：格式校验、差异识别、裁定合成、最终版本校验、本地保存。
- `assets/member-c-export.js`：XLSX 工作簿、SVG/PNG 和 ZIP 生成。Excel 单元格按字符串存储文本，避免把用户文本当公式执行。
- `assets/member-c-ui.js` / `assets/member-c.css`：三个页面的共享组件与专用样式。未修改成员 A/B/D 的页面和公共样式。
- `assets/vendor/jszip.min.js`：JSZip 3.10.1 离线依赖，许可证见同目录 `jszip.LICENSE.md`。
- `tests/member-c*.cjs`：数据、导出和浏览器回归测试。

Node 单元测试：

```text
node --test --test-isolation=none tests/member-c.test.cjs tests/member-c-export.test.cjs
```

浏览器测试需要 Playwright 和本机 Edge，在独立临时浏览器配置中运行，不使用日常浏览器数据：

```text
node tests/member-c-browser.cjs "包含 playwright 的 node_modules 绝对路径"
```

测试使用示例数据，检查草稿刷新、跨页一致、定稿锁定、真实下载内容、指南、导出记录、非法导入、同任务多版本存档和损坏数据恢复。文件导出后的用户编辑不受平台控制；页面只读属于离线原型的流程约束，不是服务器权限机制。
