# 裁判文书标注平台 · HTML 高保真原型

用于「软件工程Ⅱ」团队作业的需求梳理与对齐原型。基于 Vue 3 + Element Plus（CDN 引入），
**无需后端、无需构建**，双击打开即可点击走查全部四阶段流程。

## 一、怎么运行

1. 直接双击 `index.html`，用浏览器打开（推荐 Chrome / Edge）。
2. 登录页为演示：**任意账号密码**点击「登录」即可进入工作台。
3. 顶部右侧可切换三角色（任务创建者 / 标注员 / 裁定者）预览不同视角。
4. 左侧侧边栏可跳转到全部 14 个页面。

> 说明：Vue 与 Element Plus 已**本地打包**在 `assets/vendor/` 目录，双击 `index.html` 即可离线运行，
> **无需联网**、无需构建。

## 二、目录结构

```
prototype/
├── index.html            登录页（演示入口）
├── dashboard.html        工作台（总览统计 + 快捷入口）
├── tasks.html            任务管理（任务列表 + 阶段流转）
├── task-create.html      创建任务（三步：选文书→配标签→分成员）
├── documents.html        文书总库（导入 + 裁判理由提取）
├── configs.html          配置中心（命题/关系标签 + 指南版本）
├── users.html            用户管理（账号 + 角色权限）
├── segment.html          文本切割（颗粒度对齐）
├── segment-review.html   切割复核（裁定统一切割）
├── annotate.html         标注工作台（三栏：原文/命题 + 操作区 + 图示）
├── graph.html            论证图示（S/A/J/M/I 节点与箭头）
├── review.html           冲突解决（并排对比 + 裁定）
├── compare.html          差异比对（标签/关系/边界差异）
├── results.html          结果输出（JSON/Excel/PNG/SVG 导出）
├── assets/
│   ├── style.css         共享样式（布局/侧栏/图示/登录页）
│   └── vendor/           Vue 3 + Element Plus（本地打包，离线可运行）
└── README.md             本文件
```

## 三、页面 ↔ 四阶段流程对应

| 阶段 | 页面 | 角色 |
| --- | --- | --- |
| 创建任务 | task-create → documents → configs → users | 任务创建者 |
| 标注 | segment → segment-review → annotate → graph | 标注员 / 裁定者 |
| 冲突解决 | review → compare | 裁定者 |
| 结果输出 | results | 创建者 / 裁定者 |

## 四、四人分工（与页面对应）

| 成员 | 角色定位 | 负责页面 | 对应业务需求 |
| --- | --- | --- | --- |
| 成员A（组长） | 主线 + 整合 | index / dashboard / tasks / task-create | 需求1、4 |
| 成员B | 切割 + 标注核心 | segment / segment-review / annotate / graph | 需求1 |
| 成员C | 裁定 + 输出 | review / compare / results | 需求1 |
| 成员D | 数据 + 配置 + 教学 | documents / configs / users | 需求2、3、4 |

> 说明：业务需求 2（学生学习模型）、3（教师教学）目前**没有独立页面**，在
> `documents.html`、`users.html` 中以橙色 `⚠ 待确认` / 红色 `✗ 缺口` 标注，作为对老师的对齐点。

## 五、原型标注约定

每个页面用两类「缺口标注」标出需求文档里还没对齐的地方，方便答辩时逐条说明：

- **`⚠ 待确认`**（橙色虚线框）：设计上有待与老师/业务方确认的点；
- **`✗ 缺口`**（红色虚线框）：对照四条业务需求后确认缺失的功能。

## 六、整合到 GitHub（小组协作）

```bash
# 在 prototype/ 目录下初始化仓库
cd prototype
git init
git add .
git commit -m "法律论证标注系统 HTML 高保真原型初版"

# 推送到小组仓库（先在 GitHub 建好空仓库）
git remote add origin https://github.com/<组名>/<仓库名>.git
git branch -M main
git push -u origin main
```

推送后，可在 GitHub 仓库 Settings → Pages 开启 GitHub Pages（选 main 分支根目录），
得到一个可在线访问、可发给老师点击的网址，替代本机双击打开。
