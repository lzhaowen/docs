# v1、old 与 PRD 接口对照表

> 基线：2026-07-20 v1 OpenAPI、`openapi.old.json`、开放平台 PRD、`picture_and_video.doc`。  
> 本表供研发内部对照，不属于 Mintlify 导航。v1 文档只展示当前契约字段。

## 接口矩阵

| 当前 v1 接口 | old 对应能力 | PRD 对应能力 | 当前处理 |
| --- | --- | --- | --- |
| `GET /openapi/v1/models` | 无 | `GET /v1/models` | 模型、参数及默认值由运行时模型注册表返回；OpenAPI 示例列出当前发布内容。 |
| `POST /openapi/v1/images/generations` | `createNormalPicture` | 图片生成 | 保留异步任务模型；参考图改为 `url/fileKey`；支持 `resolution` 或像素 `size`。 |
| `POST /openapi/v1/videos/generations` | `createNormalVideo` | 视频生成 | 保留异步任务模型；参考图改为 `url/fileKey`；模型及参数能力由运行时注册表维护。 |
| `POST /openapi/v1/3dmodels/generations` | `generateModelWithText`、`generateModelWithImage`、`createCuteModelsFromImages` | 3D 生成 | 文生 3D、单图生 3D 和 chibi 合并；chibi 通过 `art_style` 表达。 |
| `POST /openapi/v1/3dmodels/refine` | 网页端 refine | 3D refine | 独立 v1 后处理任务。 |
| `POST /openapi/v1/3dmodels/texture` | 网页端 texture | 3D texture | 图片输入统一为 `url/fileKey`。 |
| `POST /openapi/v1/3dmodels/pbr` | 网页端 PBR | 3D PBR | 独立 v1 后处理任务。 |
| `POST /openapi/v1/3dmodels/remesh` | 网页端 remesh | PRD retopo | 对外统一命名为 `remesh`。 |
| `POST /openapi/v1/3dmodels/{id}/convert` | `convertToFormat` | 文件格式转换 | 归属 3D 模型资源，格式枚举沿用当前实际能力。 |
| `GET /openapi/v1/3dmodels/{id}/files` | `retrieveModel`、`convertToFormat` 结果 | 3D 文件 URL | 3D 文件签名 URL 归属 3D 模型资源。 |
| `GET /openapi/v1/tasks/{id}` | `retrieveModel`、`queryGenerationResult`、`queryJobProgress` | 任务查询 | 三个 old 查询入口合并；新增标准化 `progress`。 |
| `GET /openapi/v1/usage` | 点数扣减历史 | 用量流水 | 只返回点数流水，不计算金额。 |
| `GET /openapi/v1/credits` | `queryPointsInfo` | 余额查询 | 按现有点数分类返回账户当前点数。 |
| `POST /openapi/v1/files` | 旧上传及 S3 fileKey 流程 | 文件上传 | 通过 multipart 上传一个本地文件，落库并返回 `fileKey`。 |
| `GET /openapi/v1/files` | 无统一入口 | 文件管理 | 分页查询当前账户的托管输入文件。 |
| `GET /openapi/v1/files/{id}` | 无统一入口 | 文件管理 | 查询一个托管输入文件记录。 |

## 请求参数对照

| 模块 | 相对 old 的新增或标准化 | old/PRD 字段映射 | 当前 v1 字段 |
| --- | --- | --- | --- |
| 图片生成 | 模型注册表 ID、`extra_body`、两种分辨率表达、托管文件引用 | `modelKey -> model`；`jobNum -> n`；`aspectRatio -> aspect_ratio` | `model`、`prompt`、`images[]`、`n`、`resolution`、`size`、`aspect_ratio`、`extra_body` |
| 视频生成 | 模型注册表 ID、`extra_body`、两种分辨率表达、托管文件引用 | `jobNum -> n`；`duration -> duration_seconds`；`aspectRatio -> aspect_ratio` | `model`、`prompt`、`images[]`、`duration_seconds`、`n`、`resolution`、`size`、`aspect_ratio`、`extra_body` |
| 3D 生成 | `art_style`、标准模型 ID、托管文件引用 | `modelCount -> n`；`faceNum -> target_polycount`；`disablePbr -> with_pbr` | `model`、`prompt`、`images[]`、`with_texture`、`with_pbr`、`target_polycount`、`mesh_quality`、`art_style`、`n` |
| remesh | 统一资源 ID 和 face count 命名 | `uuid/model_uuid -> id`；`faceNum -> target_polycount` | `id`、`target_polycount` |
| 任务查询 | 标准状态、进度、异步结果、点数用量、错误对象 | `uuid -> id`；`codeStatus/statusType -> status`；`progress -> progress` | 路径 `id`；响应 `status/progress/result/usage/error` |
| 文件管理 | 增加统一文件记录和 `fileKey` | 本地上传后生成 `fileKey` | 请求 `file`；响应包含 `id/fileKey/status/created_at/updated_at` |
| 点数 | OpenRouter 风格 `/credits` 资源命名 | old 的总点数、月度、年度、永久点数分别映射 | `total_credits`、`monthly_bonus_credits`、`permanent_credits`、`annual_credits`、`expires_at`、`updated_at` |

## 文件引用与安全边界

| 项目 | 规则 |
| --- | --- |
| 引用形式 | 图片、视频和 3D 生成 JSON 中，每个文件引用包含一个 `url` 或一个 `fileKey`。 |
| URL 协议 | URL schema 使用 `^https://` 约束。 |
| SSRF 校验 | 每次 DNS 解析结果和重定向都校验为公网地址。 |
| 内容校验 | 抓取时限制媒体类型、文件大小和请求时长。 |
| `extra_body` | 限制 key、嵌套深度、属性数量和序列化大小，并按模型/供应商策略校验后透传。 |
| 分辨率 | `resolution` 接受 `1K/2K` 形式；`size` 接受 `WIDTHxHEIGHT`；两者互斥。 |

后端实现应采用独立 `/openapi/v1` 路由、控制器和服务适配层，旧 `/api/*` 路由及请求响应保持不变。
