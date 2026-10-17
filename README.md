# 市场风险观察站

面向金融与 AI 产业研究的交互式数据平台，使用 React、TypeScript、Recharts 和 Vite。公开网页由 GitHub Pages 免费托管，无需 ChatGPT 或 GitHub 登录。

- IXG、MOVE、VIX、美债收益率及期限利差
- 标普与纳指等权／加权、市场广度、自由对比及回撤分栏
- GPU 租金、AI 公司收入披露、Token 报价与云厂商财报利息负担
- GitHub Actions 每两小时检查来源，历史增量保存，失败保留上次有效值

## 本地运行

在 `web` 目录执行 `npm ci`、`npm run dev`。构建执行 `npm run build`。

## 云端更新

工作流：`.github/workflows/refresh.yml`。SEC 请求身份仅存储于仓库的 `SEC_USER_AGENT` 加密 Secret；不进入网页或数据文件。网页按钮只读取最近云端快照，不能强制 GitHub 定时任务立即执行。GitHub 调度可能延迟。

## 数据口径

所有来源与观测日期在网页注明。财报和 ARR 是稀疏披露；历史发行记录需人工核验。信用利差功能已移除；没有每日 OAS。GPU 为 Silicon Data 公开窗口累积历史，不代表已取得商业再分发授权。仅供研究，不构成投资建议。
