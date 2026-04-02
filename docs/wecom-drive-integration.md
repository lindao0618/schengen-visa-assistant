# 企业微信微盘接入说明

## 当前实现范围

项目已经增加了一版 MVP：

- 后端通过企业微信自建应用 `access_token` 调用微盘接口
- 网站客户详情页可以浏览预配置的微盘目录
- 用户可以把微盘文件“关联”到客户档案
- 关联信息先保存在 `storage/applicant-profiles/<userId>/<applicantId>/wecom-drive-bindings.json`

这版不会替代原有本地上传，只是补一条“从微盘选文件”的链路。

## 你需要在企业微信后台做的事

1. 创建一个企业微信自建应用
2. 打开这个应用的“微盘”相关权限
3. 记录企业 ID `corpid`
4. 记录应用 Secret
5. 把部署服务器公网 IP 加到企业微信 API 白名单
6. 确认这个应用能访问目标微盘目录
7. 准备一个或多个可浏览起点：
   - `spaceId`
   - `fatherId`
   - `label`

## 项目环境变量

在 `.env.local` 里新增：

```env
WECOM_CORP_ID="wwxxxxxxxxxxxxxxxx"
WECOM_AGENT_SECRET="xxxxxxxxxxxxxxxxxxxxxxxx"
WECOM_DRIVE_ROOTS_JSON='[
  {
    "id": "clients",
    "label": "客户材料总目录",
    "spaceId": "SPACEID",
    "fatherId": "FATHERID"
  }
]'
```

## `WECOM_DRIVE_ROOTS_JSON` 的作用

因为这版 MVP 是“从指定目录开始浏览”，所以必须先告诉系统微盘从哪里开始看。

每个 root 需要：

- `id`: 页面内部标识
- `label`: 页面上显示的名字
- `spaceId`: 企业微信微盘空间 ID
- `fatherId`: 这个根目录对应的文件夹 ID

## 页面入口

客户详情页：

- `/applicants/[id]`
- “材料”标签中新增了“企业微信微盘文件”卡片

## 已新增接口

- `GET /api/wecom/drive/status`
- `GET /api/wecom/drive/files?rootId=...&fatherId=...`
- `GET /api/applicants/[id]/wecom-files`
- `POST /api/applicants/[id]/wecom-files`
- `DELETE /api/applicants/[id]/wecom-files/[bindingId]`

## 后续建议

如果这版用顺了，下一步建议补：

1. 企业微信成员 OAuth，按成员权限访问微盘
2. 微盘文件预览/下载代理
3. 关联记录入库，而不是先放 JSON
4. 绑定后自动同步到本地客户档案目录

## 参考接口

- 企业微信网页授权与应用接入：
  - https://wdk-docs.github.io/wework-docs/provider-create-app/
  - https://wdk-docs.github.io/wework-docs/operation/guidelines-for-enterprise-wechat-application-access/
- 微盘文件列表：
  - https://s.apifox.cn/apidoc/docs-site/406014/api-10061425
- 微盘文件信息：
  - https://s.apifox.cn/apidoc/docs-site/406014/api-10061432
- 微盘下载文件：
  - https://s.apifox.cn/apidoc/docs-site/406014/api-10061427
