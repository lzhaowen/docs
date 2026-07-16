'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const currentEnglishPath = path.join(rootDir, 'openapi.json');
const currentChinesePath = path.join(rootDir, 'openapi.zh.json');
const oldEnglishPath = path.join(rootDir, 'openapi.old.json');
const oldChinesePath = path.join(rootDir, 'openapi.old.zh.json');

const v1Tags = [
    {
        name: 'Models',
        aliases: ['open-platform-models'],
        description: 'Discover the models and capabilities available to the current API key.'
    },
    {
        name: 'Image generation',
        aliases: ['open-platform-images'],
        description: 'Create asynchronous image generation tasks.'
    },
    {
        name: 'Video generation',
        aliases: ['open-platform-videos'],
        description: 'Create asynchronous video generation tasks.'
    },
    {
        name: '3D models',
        aliases: ['open-platform-3d'],
        description: 'Create and post-process 3D models.'
    },
    {
        name: 'Tasks',
        aliases: ['open-platform-tasks'],
        description: 'Poll tasks and remove task history entries by ID.'
    },
    {
        name: 'Files',
        aliases: ['open-platform-files'],
        description: 'Retrieve signed result URLs and convert 3D model formats.'
    },
    {
        name: 'Usage',
        aliases: ['open-platform-usage'],
        description: 'Query credit consumption records.'
    }
];

const schemaFieldDescriptions = {
    ApiError: {
        type: ['High-level error category for programmatic handling.', '用于程序处理的高层错误类别。'],
        message: ['Human-readable explanation of the error.', '便于阅读的错误说明。'],
        param: ['Request field associated with the error, or null when the error is not field-specific.', '与错误相关的请求字段；错误不针对特定字段时为 null。'],
        request_id: ['Request ID used to trace this error.', '用于追踪此错误的请求 ID。'],
        doc_url: ['Optional documentation URL with more information about the error.', '包含此错误更多信息的可选文档 URL。']
    },
    ErrorResponse: {
        error: ['Structured error details.', '结构化错误详情。']
    },
    ImageFile: {
        url: ['Temporary signed URL for downloading the generated image.', '用于下载生成图片的临时签名 URL。'],
        format: ['Image file format when known, such as png.', '已知时返回图片文件格式，例如 png。']
    },
    VideoFile: {
        url: ['Temporary signed URL for downloading the generated video.', '用于下载生成视频的临时签名 URL。'],
        format: ['Video file format when known, such as mp4.', '已知时返回视频文件格式，例如 mp4。'],
        duration_seconds: ['Generated video duration in seconds when available.', '可用时返回生成视频的时长，单位为秒。'],
        resolution: ['Generated video resolution when available, such as 720p.', '可用时返回生成视频的分辨率，例如 720p。']
    },
    ModelFile: {
        id: ['Generated 3D model resource ID in UUID format.', 'UUID 格式的已生成 3D 模型资源 ID。'],
        url: ['Temporary signed URL for downloading the generated 3D model.', '用于下载生成 3D 模型的临时签名 URL。'],
        format: ['3D model file format when known, such as glb.', '已知时返回 3D 模型文件格式，例如 glb。'],
        thumbnail_urls: ['Temporary signed URLs for model preview images.', '模型预览图片的临时签名 URL 列表。'],
        polycount: ['Number of polygon faces in the model when available.', '可用时返回模型的多边形面数。'],
        mesh_type: ['Mesh topology type reported by the generation pipeline when available.', '可用时返回生成流程报告的网格拓扑类型。'],
        has_texture: ['Whether the model includes texture data when known.', '已知时表示模型是否包含纹理数据。'],
        has_pbr: ['Whether the model includes PBR material data when known.', '已知时表示模型是否包含 PBR 材质数据。']
    },
    FileLink: {
        url: ['Temporary signed URL for downloading the file.', '用于下载文件的临时签名 URL。'],
        format: ['File format represented by this URL.', '此 URL 对应的文件格式。']
    },
    ImageTaskOutput: {
        images: ['Generated image files returned after the task succeeds.', '任务成功后返回的生成图片文件列表。']
    },
    VideoTaskOutput: {
        videos: ['Generated video files returned after the task succeeds.', '任务成功后返回的生成视频文件列表。']
    },
    ModelTaskOutput: {
        models: ['Generated 3D model files returned after the task succeeds.', '任务成功后返回的生成 3D 模型文件列表。']
    },
    FileConversionTaskOutput: {
        files: ['Converted files returned after the task succeeds.', '任务成功后返回的转换文件列表。']
    },
    Task: {
        id: ['Public task ID in UUID format.', 'UUID 格式的公开任务 ID。'],
        object: ['Object discriminator. Always task.', '对象类型标识，固定为 task。'],
        type: ['Operation type performed by the task.', '任务执行的操作类型。'],
        status: ['Normalized task lifecycle status.', '标准化后的任务生命周期状态。'],
        output: ['Task result. Present when output is available.', '任务结果，在结果可用时返回。'],
        usage: ['Credits charged for this task when available.', '可用时返回此任务扣除的点数。'],
        error: ['Error details when the task fails.', '任务失败时返回的错误详情。']
    },
    TaskList: {
        object: ['Object discriminator. Always list.', '对象类型标识，固定为 list。'],
        data: ['Tasks created by the request.', '本次请求创建的任务列表。'],
        usage: ['Total credits charged for the submitted tasks when available.', '可用时返回本次提交任务扣除的总点数。']
    },
    ModelCapabilities: {
        supports_text_input: ['Whether the model accepts text input.', '模型是否接受文本输入。'],
        supports_image_input: ['Whether the model accepts image input.', '模型是否接受图片输入。'],
        supports_video_input: ['Whether the public API accepts video input for this model.', '公开 API 是否允许该模型接收视频输入。'],
        max_n: ['Maximum number of outputs allowed in one request.', '单次请求允许生成的最大输出数量。'],
        aspect_ratios: ['Supported output aspect ratios.', '支持的输出宽高比。'],
        resolutions: ['Supported output resolutions.', '支持的输出分辨率。'],
        durations_seconds: ['Complete list of supported video durations in seconds.', '支持的视频时长完整列表，单位为秒。'],
        mesh_qualities: ['Supported 3D mesh quality levels.', '支持的 3D 网格质量等级。'],
        output_formats: ['Supported downloadable output formats.', '支持下载的输出格式。'],
        postprocessing: ['Supported 3D post-processing operations.', '支持的 3D 后处理操作。']
    },
    Model: {
        id: ['Public model identifier used in generation requests.', '生成请求中使用的公开模型标识。'],
        object: ['Object discriminator. Always model.', '对象类型标识，固定为 model。'],
        modality: ['Primary output modality produced by the model.', '模型生成的主要输出类型。'],
        owned_by: ['Provider or organization that owns the model.', '拥有该模型的供应商或组织。'],
        modes: ['Generation modes supported by the model.', '该模型支持的生成模式。'],
        capabilities: ['Limits and options supported by the model.', '该模型支持的限制和选项。']
    },
    ModelList: {
        object: ['Object discriminator. Always list.', '对象类型标识，固定为 list。'],
        data: ['Models available to the authenticated account.', '当前已认证账户可用的模型列表。']
    },
    ImageGenerationJsonRequest: {
        prompt: ['Text instruction describing the image to generate.', '描述待生成图片内容的文本提示词。'],
        mode: ['Image generation mode. JSON requests support text-to-image.', '图片生成模式。JSON 请求支持 text-to-image。'],
        n: ['Number of image generation tasks to create.', '需要创建的图片生成任务数量。'],
        resolution: ['Target image resolution.', '目标图片分辨率。'],
        aspect_ratio: ['Target image width-to-height ratio.', '目标图片宽高比。'],
        extra_body: ['Additional provider parameters forwarded with the generation request.', '随生成请求透传的其他供应商参数。']
    },
    ImageGenerationMultipartRequest: {
        model: ['Image model identifier returned by GET /openapi/v1/models.', 'GET /openapi/v1/models 返回的图片模型标识。'],
        prompt: ['Text instruction describing the image to generate or edit.', '描述待生成或编辑图片内容的文本提示词。'],
        mode: ['Generation mode. Uploading images selects image-to-image; an empty image list selects text-to-image.', '生成模式。上传图片时使用 image-to-image；图片列表为空时使用 text-to-image。'],
        images: ['Up to six local reference images uploaded with multipart/form-data.', '通过 multipart/form-data 上传的本地参考图片，最多六张。'],
        n: ['Number of image generation tasks to create.', '需要创建的图片生成任务数量。'],
        resolution: ['Target image resolution.', '目标图片分辨率。'],
        aspect_ratio: ['Target image width-to-height ratio.', '目标图片宽高比。'],
        extra_body: ['Additional provider parameters forwarded with the generation request.', '随生成请求透传的其他供应商参数。']
    },
    VideoGenerationJsonRequest: {
        prompt: ['Text instruction describing the video to generate.', '描述待生成视频内容的文本提示词。'],
        mode: ['Video generation mode. JSON requests support text-to-video.', '视频生成模式。JSON 请求支持 text-to-video。'],
        duration_seconds: ['Target video duration in seconds.', '目标视频时长，单位为秒。'],
        resolution: ['Target video resolution.', '目标视频分辨率。'],
        aspect_ratio: ['Target video width-to-height ratio.', '目标视频宽高比。'],
        n: ['Number of videos to generate.', '需要生成的视频数量。'],
        extra_body: ['Additional provider parameters forwarded with the generation request.', '随生成请求透传的其他供应商参数。']
    },
    VideoGenerationMultipartRequest: {
        model: ['Video model identifier returned by GET /openapi/v1/models.', 'GET /openapi/v1/models 返回的视频模型标识。'],
        prompt: ['Text instruction describing the video to generate.', '描述待生成视频内容的文本提示词。'],
        mode: ['Generation mode inferred from image count when omitted: 0 for text, 1 for first frame, 2 for first and last frames, and 3 to 6 for references.', '省略时根据图片数量推断模式：0 张为文本生成，1 张为首帧，2 张为首尾帧，3 到 6 张为参考图。'],
        images: ['Up to six local images ordered as first frame, last frame, or references.', '最多六张本地图片，按首帧、尾帧或参考图顺序上传。'],
        duration_seconds: ['Target video duration in seconds.', '目标视频时长，单位为秒。'],
        resolution: ['Target video resolution.', '目标视频分辨率。'],
        aspect_ratio: ['Target video width-to-height ratio.', '目标视频宽高比。'],
        n: ['Number of videos to generate.', '需要生成的视频数量。'],
        extra_body: ['Additional provider parameters forwarded with the generation request.', '随生成请求透传的其他供应商参数。']
    },
    TextTo3DGenerationRequest: {
        mode: ['3D generation mode. Text requests use text-to-3d.', '3D 生成模式。文本请求使用 text-to-3d。'],
        prompt: ['Text instruction describing the 3D model to generate.', '描述待生成 3D 模型的文本提示词。'],
        with_texture: ['Whether to generate texture data for the model.', '是否为模型生成纹理数据。'],
        mesh_quality: ['Target mesh quality level.', '目标网格质量等级。'],
        n: ['Number of 3D models to generate.', '需要生成的 3D 模型数量。']
    },
    ImageTo3DGenerationRequest: {
        model: ['Optional 3D model identifier returned by GET /openapi/v1/models.', 'GET /openapi/v1/models 返回的可选 3D 模型标识。'],
        mode: ['3D generation mode. Image requests use image-to-3d.', '3D 生成模式。图片请求使用 image-to-3d。'],
        image: ['One local JPG, JPEG, PNG, or WEBP image uploaded with multipart/form-data.', '通过 multipart/form-data 上传的一张本地 JPG、JPEG、PNG 或 WEBP 图片。'],
        with_texture: ['Whether to generate texture data for the model.', '是否为模型生成纹理数据。'],
        mesh_quality: ['Target mesh quality level.', '目标网格质量等级。'],
        n: ['Number of 3D models to generate.', '需要生成的 3D 模型数量。']
    },
    Texture3DModelRequest: {
        id: ['ID of a completed 3D model, in UUID format.', '已完成 3D 模型的 ID，格式为 UUID。'],
        prompt: ['Text instruction describing the texture to generate.', '描述待生成纹理的文本提示词。']
    },
    Refine3DModelRequest: {
        id: ['ID of a completed 3D model, in UUID format.', '已完成 3D 模型的 ID，格式为 UUID。']
    },
    Pbr3DModelRequest: {
        id: ['ID of a completed 3D model, in UUID format.', '已完成 3D 模型的 ID，格式为 UUID。']
    },
    Remesh3DModelRequest: {
        id: ['ID of a completed 3D model, in UUID format.', '已完成 3D 模型的 ID，格式为 UUID。'],
        target_polycount: ['Target face count passed to the remesh pipeline.', '传递给重网格流程的目标面数。']
    },
    ConvertFileRequest: {
        id: ['ID of a completed 3D model, in UUID format.', '已完成 3D 模型的 ID，格式为 UUID。'],
        target_format: ['Target file format for the converted model.', '转换后模型的目标文件格式。']
    },
    FileResource: {
        id: ['Task or model ID associated with these files, in UUID format.', '与这些文件关联的任务或模型 ID，格式为 UUID。'],
        urls: ['Temporary signed download URLs for available result files.', '可用结果文件的临时签名下载 URL 列表。'],
        thumbnail_urls: ['Temporary signed URLs for available preview images.', '可用预览图片的临时签名 URL 列表。']
    },
    UsageRecord: {
        id: ['Associated task ID in UUID format.', '关联任务的 ID，格式为 UUID。'],
        model: ['Public model identifier when it can be resolved from the usage record.', '可从用量记录解析时返回公开模型标识。'],
        credits: ['Credits charged by this usage record.', '此条用量记录扣除的点数。']
    },
    UsageList: {
        object: ['Object discriminator. Always usage_list.', '对象类型标识，固定为 usage_list。'],
        data: ['Usage records on the current page.', '当前页的用量记录。'],
        total_credits: ['Total credits represented by the filtered result set.', '筛选结果集合对应的总点数。'],
        page: ['Current one-based page number.', '当前页码，从 1 开始。'],
        has_more: ['Whether another page of usage records is available.', '是否还有下一页用量记录。']
    }
};

const queryParameterDescriptions = {
    page: ['One-based page number.', '页码，从 1 开始。'],
    page_size: ['Maximum number of usage records returned per page.', '每页最多返回的用量记录数量。']
};

const legacySchemaFieldDescriptions = {
    GenerateModelWithTextRequest: {
        onlyGenerateMesh: ['Whether to generate only the mesh, without texture or PBR output.', '是否仅生成网格，不生成纹理或 PBR 输出。'],
        mesh_quality: ['Mesh quality level. Supported values are standard, high, and extra_high.', '网格质量等级。支持 standard、high 和 extra_high。'],
        faceNum: ['Target face count. standard accepts 100000 to 500000 and defaults to 500000; high and extra_high accept 500000 to 1000000 and default to 1000000.', '目标面数。standard 支持 100000 到 500000，默认 500000；high 和 extra_high 支持 500000 到 1000000，默认 1000000。']
    },
    GenerateModelWithImageRequest: {
        image: ['Required input file. The multipart part must use an image/* Content-Type and must not exceed 50 MB.', '必填输入文件。multipart 文件部分必须使用 image/* Content-Type，且不得超过 50 MB。'],
        onlyGenerateMesh: ['Whether to generate only the mesh, without texture or PBR output.', '是否仅生成网格，不生成纹理或 PBR 输出。'],
        mesh_quality: ['Mesh quality level. Supported values are standard, high, and extra_high.', '网格质量等级。支持 standard、high 和 extra_high。'],
        faceNum: ['Target face count. standard accepts 100000 to 500000 and defaults to 500000; high and extra_high accept 500000 to 1000000 and default to 1000000.', '目标面数。standard 支持 100000 到 500000，默认 500000；high 和 extra_high 支持 500000 到 1000000，默认 1000000。']
    },
    GenerateModelWithTextResponse: {
        uploadedImageUrl: ['Always null for text-only generation.', '纯文本生成时始终为 null。'],
        pointsDeducted: ['Credits deducted when the value is available.', '可用时返回本次请求扣除的点数。'],
        generationConfig: ['Normalized face-count configuration applied to this generation request.', '本次生成请求实际采用的标准化面数配置。']
    },
    GenerateModelWithImageResponse: {
        pointsDeducted: ['Credits deducted when the value is available.', '可用时返回本次请求扣除的点数。'],
        generationConfig: ['Normalized face-count configuration applied to this generation request.', '本次生成请求实际采用的标准化面数配置。']
    },
    GenerationConfig: {
        faceNum: ['Face-count limits and the normalized value applied to the generation task.', '生成任务的面数限制及实际采用的标准化值。']
    },
    GenerationFaceNumConfig: {
        default: ['Default face count for the selected mesh quality.', '所选网格质量对应的默认面数。'],
        min: ['Minimum face count for the selected mesh quality.', '所选网格质量允许的最小面数。'],
        max: ['Maximum face count for the selected mesh quality.', '所选网格质量允许的最大面数。'],
        value: ['Normalized face count applied to the generation task.', '生成任务实际采用的标准化面数。']
    },
    ApiValidationErrorItem: {
        type: ['Validation error category.', '校验错误类别。'],
        value: ['Rejected request value when it is available.', '可用时返回被拒绝的请求值。'],
        msg: ['Human-readable validation error message.', '可读的参数校验错误信息。'],
        path: ['Request field that failed validation.', '未通过校验的请求字段。'],
        location: ['Request location containing the invalid field.', '无效字段所在的请求位置。']
    },
    ApiValidationErrorResponse: {
        errors: ['Request validation errors.', '请求参数校验错误列表。']
    },
    GenerationModerationResponse: {
        limitType: ['Content moderation result code.', '内容审核结果代码。'],
        message: ['Content moderation message.', '内容审核提示信息。']
    },
    ApiErrorResponse: {
        message: ['Human-readable API error message.', '可读的 API 错误信息。'],
        error: ['Internal or downstream error description when available.', '可用时返回内部或下游错误说明。']
    },
    CreateCuteModelsFromImagesResponse: {
        success: ['Whether the batch request was processed successfully.', '批量请求是否处理成功。'],
        totalFiles: ['Total number of uploaded input files.', '上传的输入文件总数。'],
        successCount: ['Number of input files queued successfully.', '成功进入队列的输入文件数量。'],
        failureCount: ['Number of input files that failed to queue.', '未能进入队列的输入文件数量。'],
        results: ['Successful queue results for each processed input file.', '每个成功处理的输入文件对应的入队结果。'],
        failures: ['Failure details for input files that could not be queued.', '未能进入队列的输入文件对应的失败详情。'],
        message: ['Human-readable summary of the batch operation.', '批量操作的可读摘要信息。']
    },
    CreateCuteModelResult: {
        uuids: ['Generated job or model UUIDs for this input file.', '此输入文件生成的任务或模型 UUID 列表。'],
        success: ['Whether this input file was queued successfully.', '此输入文件是否成功进入队列。'],
        message: ['Human-readable result for this input file.', '此输入文件对应的可读处理结果。']
    },
    QueuedGenerationResponse: {
        success: ['Whether the generation request was accepted.', '生成请求是否已被接受。'],
        data: ['Queue and task details for the accepted generation request.', '已接受生成请求的队列和任务详情。']
    },
    QueryGenerationResultResponse: {
        success: ['Whether the generation result query succeeded.', '生成结果查询是否成功。'],
        data: ['Current status and result data for the requested generation UUID.', '所查询生成 UUID 的当前状态和结果数据。']
    },
    QueryGenerationResultData: {
        uuid: ['Generation UUID supplied in the query.', '查询时提供的生成任务 UUID。']
    },
    CheckHumanImageResponse: {
        message: ['Human-readable portrait detection result.', '可读的人像检测结果说明。']
    },
    QueryPointsInfoResponse: {
        data: ['Current point balances grouped by point type.', '按点数类型分组的当前余额。'],
        message: ['Human-readable point balance query result.', '可读的点数余额查询结果。']
    },
    BalanceInfo: {
        total_points: ['Total points currently available to the account.', '账户当前可用的总点数。'],
        monthly_bonus_points: ['Available points granted by the monthly plan.', '月度套餐赠送的可用点数。'],
        permanent_points: ['Available permanent points without a monthly expiration.', '不按月到期的永久可用点数。'],
        year_points: ['Available points granted by the annual plan.', '年度套餐赠送的可用点数。']
    },
    QueryJobProgressResponse: {
        message: ['Human-readable job progress query result.', '可读的任务进度查询结果。']
    }
};

function applyLegacyGenerationEndpointUpdates(spec, languageIndex) {
    const isChinese = languageIndex === 1;
    spec.info.version = '1.5.4';

    const textRequestSchema = spec.components.schemas.GenerateModelWithTextRequest;
    const imageRequestSchema = spec.components.schemas.GenerateModelWithImageRequest;
    delete textRequestSchema.properties.sourcePage;
    delete imageRequestSchema.properties.preUpload;
    delete imageRequestSchema.properties.sourcePage;
    delete imageRequestSchema.properties.mode;
    textRequestSchema.properties.prompt.minLength = 1;

    const requestSchemas = [
        textRequestSchema,
        imageRequestSchema
    ];

    for (const schema of requestSchemas) {
        schema.properties.modelCount.maximum = 4;
        schema.properties.disablePbr.enum = [0, 1];
        schema.properties.disablePbr.default = 0;
        Object.assign(schema.properties, {
            onlyGenerateMesh: {
                type: 'boolean',
                default: false
            },
            mesh_quality: {
                type: 'string',
                enum: ['standard', 'high', 'extra_high'],
                default: 'high'
            },
            faceNum: {
                type: 'integer',
                minimum: 100000,
                maximum: 1000000
            }
        });
        schema.oneOf = [
            {
                required: ['mesh_quality'],
                properties: {
                    mesh_quality: {
                        type: 'string',
                        enum: ['standard'],
                        description: isChinese ? 'standard 网格质量。' : 'Standard mesh quality.'
                    },
                    faceNum: {
                        type: 'integer',
                        minimum: 100000,
                        maximum: 500000,
                        description: isChinese ? 'standard 质量对应的目标面数。' : 'Target face count for standard quality.'
                    }
                }
            },
            {
                properties: {
                    mesh_quality: {
                        type: 'string',
                        enum: ['high', 'extra_high'],
                        description: isChinese ? 'high、extra_high 或省略时采用的网格质量。' : 'High or extra-high mesh quality; this branch also applies when omitted.'
                    },
                    faceNum: {
                        type: 'integer',
                        minimum: 500000,
                        maximum: 1000000,
                        description: isChinese ? 'high、extra_high 或默认质量对应的目标面数。' : 'Target face count for high, extra-high, or default quality.'
                    }
                }
            }
        ];
    }

    spec.components.schemas.GenerationFaceNumConfig = {
        type: 'object',
        required: ['default', 'min', 'max', 'value'],
        properties: {
            default: { type: 'integer' },
            min: { type: 'integer' },
            max: { type: 'integer' },
            value: { type: 'integer' }
        }
    };
    spec.components.schemas.GenerationConfig = {
        type: 'object',
        required: ['faceNum'],
        properties: {
            faceNum: { $ref: '#/components/schemas/GenerationFaceNumConfig' }
        }
    };
    spec.components.schemas.ApiValidationErrorItem = {
        type: 'object',
        required: ['msg', 'path', 'location'],
        properties: {
            type: { type: 'string' },
            value: { nullable: true },
            msg: { type: 'string' },
            path: { type: 'string' },
            location: { type: 'string' }
        }
    };
    spec.components.schemas.ApiValidationErrorResponse = {
        type: 'object',
        required: ['errors'],
        properties: {
            errors: {
                type: 'array',
                items: { $ref: '#/components/schemas/ApiValidationErrorItem' }
            }
        }
    };
    spec.components.schemas.GenerationModerationResponse = {
        type: 'object',
        required: ['limitType', 'message'],
        properties: {
            limitType: {
                type: 'integer',
                enum: [3, 4]
            },
            message: { type: 'string' }
        }
    };
    spec.components.schemas.ApiErrorResponse = {
        type: 'object',
        properties: {
            message: { type: 'string' },
            error: { type: 'string' }
        }
    };

    const responseSchemas = [
        {
            schema: spec.components.schemas.GenerateModelWithTextResponse,
            uploadedImageDescription: isChinese ? '纯文本生成时始终为 null。' : 'Always null for text-only generation.'
        },
        {
            schema: spec.components.schemas.GenerateModelWithImageResponse,
            uploadedImageDescription: isChinese ? '上传源图片的签名访问地址；无法生成地址时为 null。' : 'Signed URL for the uploaded source image, or null when unavailable.'
        }
    ];
    for (const { schema, uploadedImageDescription } of responseSchemas) {
        schema.required = Array.from(new Set([
            ...(schema.required || []),
            'type',
            'message',
            'uuids',
            'uploadedImageUrl'
        ]));
        Object.assign(schema.properties, {
            type: {
                ...schema.properties.type,
                type: 'string',
                enum: ['sys']
            },
            message: {
                ...schema.properties.message,
                type: 'string',
                enum: ['Generating']
            },
            uuids: {
                ...schema.properties.uuids,
                type: 'array',
                minItems: 1,
                maxItems: 4,
                items: {
                    type: 'string',
                    format: 'uuid'
                }
            },
            uploadedImageUrl: {
                ...schema.properties.uploadedImageUrl,
                type: 'string',
                format: 'uri',
                nullable: true,
                description: uploadedImageDescription
            }
        });
        Object.assign(schema.properties, {
            pointsDeducted: {
                type: 'integer',
                nullable: true
            },
            generationConfig: {
                allOf: [{ $ref: '#/components/schemas/GenerationConfig' }],
                nullable: true
            }
        });
    }

    const endpointUpdates = [
        {
            path: '/api/generateModelWithText',
            responseSchema: 'GenerateModelWithTextResponse',
            description: isChinese
                ? '通过文本提示词生成 3D 模型。支持控制模型数量、网格质量、目标面数以及是否仅生成网格。未传新参数时保持原有默认行为。'
                : 'Generate 3D models from a text prompt. Supports model count, mesh quality, target face count, and mesh-only output. Existing defaults are preserved when the new options are omitted.',
            example: {
                prompt: 'people',
                modelCount: 1,
                disablePbr: 0,
                onlyGenerateMesh: false,
                mesh_quality: 'high',
                faceNum: 1000000
            }
        },
        {
            path: '/api/generateModelWithImage',
            responseSchema: 'GenerateModelWithImageResponse',
            description: isChinese
                ? '通过一张上传图片生成 3D 模型。支持控制模型数量、网格质量、目标面数以及是否仅生成网格。未传新参数时保持原有默认行为。'
                : 'Generate 3D models from one uploaded image. Supports model count, mesh quality, target face count, and mesh-only output. Existing defaults are preserved when the new options are omitted.',
            example: {
                image: '(binary)',
                modelCount: 1,
                disablePbr: 0,
                onlyGenerateMesh: false,
                mesh_quality: 'high',
                faceNum: 1000000
            }
        }
    ];

    function buildErrorResponse(description, example) {
        return {
            description,
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/ApiErrorResponse' },
                    example
                }
            }
        };
    }

    for (const update of endpointUpdates) {
        const operation = spec.paths[update.path].post;
        const isImageEndpoint = update.path.endsWith('WithImage');
        operation.description = update.description;
        const contentType = isImageEndpoint
            ? 'multipart/form-data'
            : 'application/json';
        operation.requestBody.content[contentType].examples.default.value = update.example;
        if (isImageEndpoint) {
            operation.requestBody.content[contentType].encoding = {
                image: { contentType: 'image/*' }
            };
        }
        if (operation['x-mint']?.metadata) {
            operation['x-mint'].metadata.description = update.description;
        }

        const responseContent = operation.responses['200'].content['application/json'];
        responseContent.schema = {
            oneOf: [
                { $ref: `#/components/schemas/${update.responseSchema}` },
                { $ref: '#/components/schemas/GenerationModerationResponse' }
            ]
        };
        operation.responses['200'].description = isChinese
            ? '生成任务已接受，或请求未通过内容审核。'
            : 'Generation job accepted, or the request was rejected by content moderation.';
        responseContent.examples.moderated = {
            value: {
                limitType: 3,
                message: isImageEndpoint ? 'Please check the image.' : 'Please check the prompt.'
            }
        };

        operation.responses['400'] = {
            description: isChinese
                ? (isImageEndpoint ? '请求参数或图片文件无效。' : '请求参数无效。')
                : (isImageEndpoint ? 'Invalid request parameter or image file.' : 'Invalid request parameter.'),
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/ApiValidationErrorResponse' },
                    example: {
                        errors: [{
                            type: 'field',
                            value: 5,
                            msg: 'modelCount must be an integer between 1 and 4 (inclusive)',
                            path: 'modelCount',
                            location: 'body'
                        }]
                    }
                }
            }
        };
        Object.assign(operation.responses, {
            '401': {
                description: isChinese ? '身份认证失败。' : 'Authentication failed.',
                content: {
                    'text/plain': {
                        schema: { type: 'string' },
                        example: 'Unauthorized'
                    }
                }
            },
            '402': buildErrorResponse(
                isChinese ? '账户、IP 或点数限制阻止了本次请求。' : 'The request was blocked by an account, IP, or credit restriction.',
                { message: 'Insufficient points or account restricted' }
            ),
            '429': buildErrorResponse(
                isChinese ? '请求频率超过限制。' : 'Rate limit exceeded.',
                { message: 'Too many requests from this user, please try again after a minute.' }
            ),
            '500': buildErrorResponse(
                isChinese ? '生成服务或内部服务不可用。' : 'Generation or internal service unavailable.',
                { error: 'Internal server error' }
            )
        });
        if (!isImageEndpoint) {
            operation.responses['403'] = buildErrorResponse(
                isChinese ? '当前账户无权执行本次生成。' : 'The current account is not allowed to run this generation.',
                { message: 'Generation is not available for the current account' }
            );
        } else {
            delete operation.responses['403'];
            delete operation.responses['404'];
        }

        const responseExample = responseContent.examples?.generating?.value;
        if (responseExample) {
            responseExample.type = 'sys';
            responseExample.message = 'Generating';
            responseExample.uuids = ['f47ac10b-58cc-4372-a567-0e02b2c3d479'];
            if (!isImageEndpoint) {
                responseExample.uploadedImageUrl = null;
            }
            responseExample.generationConfig = {
                faceNum: {
                    default: 1000000,
                    min: 500000,
                    max: 1000000,
                    value: 1000000
                }
            };
        }
    }
}

function assertLegacyGenerationExamplesAligned(spec) {
    const endpoints = [
        {
            path: '/api/generateModelWithText',
            requestSchema: 'GenerateModelWithTextRequest',
            responseSchema: 'GenerateModelWithTextResponse',
            contentType: 'application/json',
            expectsUploadedImageUrl: false
        },
        {
            path: '/api/generateModelWithImage',
            requestSchema: 'GenerateModelWithImageRequest',
            responseSchema: 'GenerateModelWithImageResponse',
            contentType: 'multipart/form-data',
            expectsUploadedImageUrl: true
        }
    ];

    for (const endpoint of endpoints) {
        const operation = spec.paths[endpoint.path].post;
        const requestSchema = spec.components.schemas[endpoint.requestSchema];
        const responseSchema = spec.components.schemas[endpoint.responseSchema];
        const requestExample = operation.requestBody.content[endpoint.contentType]
            .examples.default.value;
        const responseExamples = operation.responses['200'].content['application/json'].examples;
        const successExample = responseExamples.generating.value;
        const moderationExample = responseExamples.moderated.value;

        const requestFields = Object.keys(requestSchema.properties).sort();
        const requestExampleFields = Object.keys(requestExample).sort();
        if (requestFields.join(',') !== requestExampleFields.join(',')) {
            throw new Error(`${endpoint.path} request example fields do not match its schema`);
        }
        for (const requiredField of requestSchema.required || []) {
            if (requestExample[requiredField] === undefined) {
                throw new Error(`${endpoint.path} request example is missing ${requiredField}`);
            }
        }

        const quality = requestExample.mesh_quality || 'high';
        const minFaceNum = quality === 'standard' ? 100000 : 500000;
        const maxFaceNum = quality === 'standard' ? 500000 : 1000000;
        if (requestExample.faceNum < minFaceNum || requestExample.faceNum > maxFaceNum) {
            throw new Error(`${endpoint.path} request example faceNum does not match mesh_quality`);
        }

        const responseFields = new Set(Object.keys(responseSchema.properties));
        for (const field of Object.keys(successExample)) {
            if (!responseFields.has(field)) {
                throw new Error(`${endpoint.path} success example contains unknown field ${field}`);
            }
        }
        for (const requiredField of responseSchema.required || []) {
            if (!Object.prototype.hasOwnProperty.call(successExample, requiredField)) {
                throw new Error(`${endpoint.path} success example is missing ${requiredField}`);
            }
        }
        if (
            successExample.type !== 'sys' ||
            successExample.message !== 'Generating' ||
            successExample.uuids.length !== requestExample.modelCount
        ) {
            throw new Error(`${endpoint.path} success example does not match the request example`);
        }
        if (successExample.generationConfig?.faceNum?.value !== requestExample.faceNum) {
            throw new Error(`${endpoint.path} response faceNum does not match the request example`);
        }
        if (endpoint.expectsUploadedImageUrl !== (typeof successExample.uploadedImageUrl === 'string')) {
            throw new Error(`${endpoint.path} uploadedImageUrl example does not match the endpoint`);
        }
        if (
            ![3, 4].includes(moderationExample.limitType) ||
            typeof moderationExample.message !== 'string'
        ) {
            throw new Error(`${endpoint.path} moderation example is invalid`);
        }
    }
}

const translations = new Map([
    ['Neural4D API', 'Neural4D API'],
    ['API v1 provides model discovery, asynchronous generation and post-processing tasks, signed file access, format conversion, and credit usage records.', 'API v1 支持模型发现、异步生成与后处理任务、签名文件访问、格式转换和点数使用记录查询。'],
    ['Models', '模型'],
    ['Image generation', '图片生成'],
    ['Video generation', '视频生成'],
    ['3D models', '3D 模型'],
    ['Tasks', '任务'],
    ['Files', '文件'],
    ['Usage', '用量'],
    ['Discover the models and capabilities available to the current API key.', '查询当前 API 密钥可用的模型及其能力。'],
    ['Create asynchronous image generation tasks.', '创建异步图片生成任务。'],
    ['Create asynchronous video generation tasks.', '创建异步视频生成任务。'],
    ['Create and post-process 3D models.', '创建并后处理 3D 模型。'],
    ['Retrieve signed result URLs and convert 3D model formats.', '获取带签名的结果 URL，并转换 3D 模型格式。'],
    ['Query credit consumption records.', '查询点数消耗记录。'],
    ['List available models', '列出可用模型'],
    ['Available model list', '可用模型列表'],
    ['Production server', '生产环境'],
    ['Create image generation tasks', '创建图片生成任务'],
    ['Generation tasks accepted', '已接受生成任务'],
    ['Create video generation tasks', '创建视频生成任务'],
    ['Create 3D model generation tasks', '创建 3D 模型生成任务'],
    ['Refine a 3D model', '精细化 3D 模型'],
    ['Queues the refine pipeline for a completed model ID. It upgrades standard or high meshes to extra_high and regenerates texture/PBR from the source context when available.', '为已完成的模型 ID 提交精细化流程。该流程会将 standard 或 high 网格升级为 extra_high，并在源上下文可用时重新生成纹理和 PBR。'],
    ['Refine task accepted', '已接受精细化任务'],
    ['Generate a texture for a 3D model', '为 3D 模型生成纹理'],
    ['Queues texture generation using exactly one input: a prompt or one local reference image.', '使用且仅使用一种输入提交纹理生成任务：提示词或一张本地参考图片。'],
    ['Texture task accepted', '已接受纹理任务'],
    ['Generate PBR materials for a 3D model', '为 3D 模型生成 PBR 材质'],
    ['Queues the PBR pipeline for a completed model ID. The terminal task returns the resulting model URL.', '为已完成的模型 ID 提交 PBR 流程。任务结束后返回结果模型 URL。'],
    ['PBR task accepted', '已接受 PBR 任务'],
    ['Remesh a 3D model', '重网格化 3D 模型'],
    ['Queues the remesh pipeline with the requested target face count.', '使用请求的目标面数提交重网格流程。'],
    ['Remesh task accepted', '已接受重网格任务'],
    ['Retrieve a task', '查询任务'],
    ['Task details', '任务详情'],
    ['Task ID returned by a generation or post-processing submission, in UUID format.', '生成或后处理请求返回的任务 ID，格式为 UUID。'],
    ['Task ID, in UUID format.', '任务 ID，格式为 UUID。'],
    ['Retrieve signed file URLs', '获取带签名的文件 URL'],
    ['Returns temporary signed result URLs for a completed image, video, or 3D model ID. Use the ID as the persistent identifier.', '返回已完成图片、视频或 3D 模型 ID 对应的临时签名结果 URL。请使用 ID 作为持久标识。'],
    ['File URLs', '文件 URL'],
    ['Task or 3D model ID, in UUID format.', '任务或 3D 模型 ID，格式为 UUID。'],
    ['Convert a 3D model format', '转换 3D 模型格式'],
    ['Starts asynchronous 3D format conversion. The completed task returns signed file URLs.', '启动异步 3D 格式转换。任务完成后返回带签名的文件 URL。'],
    ['Conversion task accepted', '已接受转换任务'],
    ['List credit usage', '列出点数用量'],
    ['Returns credit consumption records for the authenticated user, with optional filters for time, model, and task type.', '返回当前已认证用户的点数消耗记录，并支持按时间、模型和任务类型筛选。'],
    ['Credit usage records', '点数用量记录'],
    ['Inclusive Unix timestamp in seconds.', '起始 Unix 时间戳（秒，包含该时刻）。'],
    ['Exclusive Unix timestamp in seconds.', '结束 Unix 时间戳（秒，不包含该时刻）。'],
    ['Filter by public provider/model alias.', '按公开的供应商/模型别名筛选。'],
    ['Filter by public task type.', '按公开任务类型筛选。'],
    ['Use the API key provided by Neural4D. Send it in the Authorization header with the Bearer scheme.', '使用 Neural4D 提供的 API 密钥，并通过 Authorization 请求头的 Bearer 方式发送。'],
    ['Request ID used for support and tracing.', '用于技术支持和链路追踪的请求 ID。'],
    ['Request limit for the current window.', '当前时间窗口的请求上限。'],
    ['Requests remaining in the current window.', '当前时间窗口内的剩余请求次数。'],
    ['Unix timestamp in seconds when the current window resets.', '当前时间窗口重置时的 Unix 时间戳（秒）。'],
    ['Seconds to wait before retrying.', '重试前需要等待的秒数。'],
    ['Use an image model returned by GET /openapi/v1/models.', '使用 GET /openapi/v1/models 返回的图片模型。'],
    ['Defaults to image-to-image when one or more images are uploaded; otherwise text-to-image.', '上传一张或多张图片时默认为 image-to-image，否则默认为 text-to-image。'],
    ['Up to six local reference images uploaded with multipart/form-data.', '通过 multipart/form-data 上传的本地参考图片，最多六张。'],
    ['Use a video model returned by GET /openapi/v1/models.', '使用 GET /openapi/v1/models 返回的视频模型。'],
    ['Generation mode inferred from image count when omitted: 0 for text, 1 for first frame, 2 for first and last frames, and 3 to 6 for references.', '省略时根据图片数量推断模式：0 张为文本生成，1 张为首帧，2 张为首尾帧，3 到 6 张为参考图。'],
    ['Up to six local images ordered as first frame, last frame, or references.', '最多六张本地图片，按首帧、尾帧或参考图顺序上传。'],
    ['Optional 3D model alias from GET /openapi/v1/models. The account default is used when omitted.', 'GET /openapi/v1/models 返回的可选 3D 模型别名。省略时使用账户默认模型。'],
    ['Requires with_texture=true.', '要求 with_texture=true。'],
    ['One local JPG, JPEG, PNG, or WEBP image uploaded with multipart/form-data.', '通过 multipart/form-data 上传的一张本地 JPG、JPEG、PNG 或 WEBP 图片。'],
    ['Optional semantic or style instruction.', '可选的语义或风格说明。'],
    ['ID of a completed 3D model, in UUID format. The adapter resolves it to the internal model ID.', '已完成 3D 模型的 ID，格式为 UUID。适配层会将其解析为内部模型 ID。'],
    ['The current refine pipeline upgrades standard or high meshes to extra_high.', '当前精细化流程会将 standard 或 high 网格升级为 extra_high。'],
    ['ID of a completed 3D model, in UUID format.', '已完成 3D 模型的 ID，格式为 UUID。'],
    ['One local texture reference image.', '一张本地纹理参考图片。'],
    ['Target face count passed to the remesh pipeline.', '传递给重网格流程的目标面数。'],
    ['Public task ID in UUID format. Multi-output submissions return one Task per ID.', 'UUID 格式的公开任务 ID。多输出请求会为每个 ID 返回一个 Task。'],
    ['Public provider/model alias returned by GET /openapi/v1/models.', 'GET /openapi/v1/models 返回的公开供应商/模型别名。'],
    ['Unix timestamp in seconds.', 'Unix 时间戳（秒）。'],
    ['Normalized request snapshot. Uploaded binary data is not embedded.', '标准化后的请求快照，不包含上传的二进制数据。'],
    ['Unix timestamp in seconds when the signed URLs expire.', '签名 URL 到期时的 Unix 时间戳（秒）。'],
    ['Model size in millimeters.', '模型尺寸，单位为毫米。'],
    ['Credits charged for the task or submission.', '该任务或请求扣除的点数。'],
    ['Stable machine-readable error code.', '稳定且可供程序读取的错误码。'],
    ['Stable usage record ID.', '稳定的用量记录 ID。'],
    ['Associated task ID in UUID format.', '关联任务的 ID，格式为 UUID。'],
    ['Public task type.', '公开任务类型。'],
    ['Generated 3D model resource ID in UUID format.', 'UUID 格式的已生成 3D 模型资源 ID。'],
    ['Invalid request', '请求无效'],
    ['Authentication failed', '认证失败'],
    ['The authenticated user cannot access this model or resource', '当前已认证用户无权访问该模型或资源'],
    ['Request or quota limit exceeded', '已超过请求或配额限制'],
    ['Internal or upstream service error', '内部或上游服务错误'],
    ['The requested resource was not found', '未找到请求的资源'],
    ['Optional client request ID. The service echoes it when valid or generates one.', '可选的客户端请求 ID。值有效时服务会原样返回，否则会生成一个。'],
    ['A ceramic teapot on a white studio background', '白色摄影棚背景中的陶瓷茶壶'],
    ['A slow orbit around a ceramic teapot', '镜头缓慢环绕一个陶瓷茶壶'],
    ['A stylized ceramic teapot', '风格化的陶瓷茶壶'],
    ['prompt is required and must be a non-empty string', 'prompt 为必填项，且必须是非空字符串'],
    ['The API key is invalid or expired', 'API 密钥无效或已过期'],
    ['The requested model is not available to this API key', '当前 API 密钥无法使用所请求的模型'],
    ['The requested task does not exist', '所请求的任务不存在'],
    ['Too many requests. Retry after the indicated interval.', '请求过多，请在指定时间后重试。'],
    ['An internal error occurred', '发生内部错误'],
    ['Poll tasks and remove task history entries by ID.', '通过 ID 轮询任务并移除任务历史记录。'],
    ['Returns the currently enabled public models. Use this response as the source of truth for model IDs, modes, and capabilities. Account access is enforced when a task is submitted.', '返回当前启用的公开模型。请以此响应作为模型 ID、模式和能力的权威来源。提交任务时会校验账户访问权限。'],
    ['Creates 1 to 4 image generation tasks from a prompt and up to six optional reference images. Use application/json for text-to-image and multipart/form-data for image-guided generation. The response includes queued tasks and charged credits.', '根据提示词和最多六张可选参考图片创建 1 到 4 个图片生成任务。文生图使用 application/json，参考图生成使用 multipart/form-data。响应包含已排队任务和扣除点数。'],
    ['Creates one task ID per requested video. Multipart image count determines text, first-frame, first-last-frame, or reference mode when mode is omitted.', '每个请求生成的视频都会创建一个任务 ID。省略 mode 时，multipart 图片数量决定文本、首帧、首尾帧或参考图模式。'],
    ['Creates text-to-3D or single-image-to-3D tasks. Use application/json for text input and multipart/form-data for one local image.', '创建文生 3D 或单图生 3D 任务。文本输入使用 application/json，单张本地图片使用 multipart/form-data。'],
    ['Returns one task by its ID. IDs use UUID format. Statuses are normalized to queued, processing, succeeded, or failed. Poll this endpoint until a terminal status is returned.', '通过任务 ID 返回单个任务，ID 使用 UUID 格式。状态统一为 queued、processing、succeeded 或 failed。请轮询此接口，直到返回终态。'],
    ['Task ID returned by a generation or post-processing request, in UUID format.', '生成或后处理请求返回的任务 ID，格式为 UUID。'],
    ['Task or 3D model ID, in UUID format.', '任务或 3D 模型 ID，格式为 UUID。'],
    ['Remove a task history entry', '移除任务历史记录'],
    ["Removes the task and its result from the authenticated account's history. Queued or running execution keeps its current state.", '从当前已认证账户的历史记录中移除任务及其结果。排队中或运行中的执行保持当前状态。'],
    ['Task history entry removed', '任务历史记录已移除'],
    ['The requested task has not produced files yet', '所请求的任务尚未生成文件'],
    ['The requested task has not produced downloadable files yet.', '所请求的任务尚未生成可下载文件。'],
    ['Stable operation type assigned to an asynchronous task.', '异步任务对应的稳定操作类型。'],
    ['Normalized lifecycle status of an asynchronous task.', '异步任务的标准化生命周期状态。'],
    ['Failure details recorded by asynchronous processing.', '异步处理记录的失败详情。'],
    ['Stable machine-readable task failure code.', '稳定且可供程序读取的任务失败代码。'],
    ['Human-readable explanation of the task failure.', '便于阅读的任务失败说明。'],
    ['Unix timestamp in seconds when the task failed.', '任务失败时的 Unix 时间戳（秒）。'],
    ['Whether retrying the same operation may succeed.', '重试相同操作是否可能成功。']
]);

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function collectReferencedComponents(paths, components) {
    const required = new Map();

    function scan(value) {
        if (typeof value === 'string' && value.startsWith('#/components/')) {
            const [, , section, name] = value.split('/');
            if (!required.has(section)) {
                required.set(section, new Set());
            }
            required.get(section).add(name);
            return;
        }

        if (value && typeof value === 'object') {
            Object.values(value).forEach(scan);
        }
    }

    scan(paths);
    let previousCount = -1;
    while (previousCount !== [...required.values()].reduce((sum, names) => sum + names.size, 0)) {
        previousCount = [...required.values()].reduce((sum, names) => sum + names.size, 0);
        for (const [section, names] of required.entries()) {
            for (const name of names) {
                const component = components[section] && components[section][name];
                if (!component) {
                    throw new Error(`Missing referenced component: #/components/${section}/${name}`);
                }
                scan(component);
            }
        }
    }

    const selected = {};
    for (const [section, definitions] of Object.entries(components)) {
        if (section === 'securitySchemes') {
            selected.securitySchemes = {
                bearerAuth: definitions.bearerAuth
            };
            continue;
        }

        const names = required.get(section);
        if (names) {
            selected[section] = Object.fromEntries(
                Object.entries(definitions).filter(([name]) => names.has(name))
            );
        }
    }

    return selected;
}

function buildStandardResponseHeaders() {
    return {
        'X-RateLimit-Limit': { $ref: '#/components/headers/XRateLimitLimit' },
        'X-RateLimit-Remaining': { $ref: '#/components/headers/XRateLimitRemaining' },
        'X-RateLimit-Reset': { $ref: '#/components/headers/XRateLimitReset' }
    };
}

function buildConflictResponse(description, code, message) {
    return {
        description,
        headers: buildStandardResponseHeaders(),
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                    error: {
                        type: 'invalid_request_error',
                        code,
                        message,
                        request_id: 'req_01J2R6Y7F6Q8K9P0M1N2B3V4CX'
                    }
                }
            }
        }
    };
}

function applyV1ContractAdjustments(paths, components) {
    const operationIds = new Map([
        ['GET /openapi/v1/models', 'listModels'],
        ['POST /openapi/v1/images/generations', 'createImageGeneration'],
        ['POST /openapi/v1/videos/generations', 'createVideoGeneration'],
        ['POST /openapi/v1/3dmodels/generations', 'create3DModelGeneration'],
        ['POST /openapi/v1/3dmodels/refine', 'refine3DModel'],
        ['POST /openapi/v1/3dmodels/texture', 'texture3DModel'],
        ['POST /openapi/v1/3dmodels/pbr', 'generate3DModelPbr'],
        ['POST /openapi/v1/3dmodels/remesh', 'remesh3DModel'],
        ['GET /openapi/v1/tasks/{id}', 'getTask'],
        ['DELETE /openapi/v1/tasks/{id}', 'deleteTaskHistory'],
        ['GET /openapi/v1/files/{id}', 'getFiles'],
        ['POST /openapi/v1/files/convert', 'convertFile'],
        ['GET /openapi/v1/usage', 'listUsage']
    ]);
    components.responses.TaskNotReady = buildConflictResponse(
        'The requested task has not produced files yet',
        'task_not_ready',
        'The requested task has not produced downloadable files yet.'
    );

    components.schemas.TaskType = {
        type: 'string',
        enum: [
            'image.generation',
            'video.generation',
            '3dmodel.generation',
            '3dmodel.edit.refine',
            '3dmodel.edit.texture',
            '3dmodel.edit.pbr',
            '3dmodel.edit.remesh',
            'file.convert'
        ],
        description: 'Stable operation type assigned to an asynchronous task.'
    };
    components.schemas.TaskStatus = {
        type: 'string',
        enum: ['queued', 'processing', 'succeeded', 'failed'],
        description: 'Normalized lifecycle status of an asynchronous task.'
    };
    components.schemas.TaskError = {
        type: 'object',
        required: ['code', 'message'],
        description: 'Failure details recorded by asynchronous processing.',
        properties: {
            code: {
                type: 'string',
                description: 'Stable machine-readable task failure code.'
            },
            message: {
                type: 'string',
                description: 'Human-readable explanation of the task failure.'
            },
            failed_at: {
                type: 'integer',
                format: 'int64',
                description: 'Unix timestamp in seconds when the task failed.'
            },
            retryable: {
                type: 'boolean',
                description: 'Whether retrying the same operation may succeed.'
            }
        }
    };

    const taskSchema = components.schemas.Task;
    taskSchema.properties.type = {
        allOf: [{ $ref: '#/components/schemas/TaskType' }],
        description: 'Operation type performed by the task.'
    };
    taskSchema.properties.status = {
        allOf: [{ $ref: '#/components/schemas/TaskStatus' }],
        description: 'Normalized task lifecycle status.'
    };
    taskSchema.properties.error = {
        allOf: [{ $ref: '#/components/schemas/TaskError' }],
        description: 'Error details when the task fails.'
    };
    components.schemas.UsageRecord.properties.type = {
        allOf: [{ $ref: '#/components/schemas/TaskType' }],
        description: 'Public task type.'
    };

    components.schemas.ModelCapabilities = {
        type: 'object',
        additionalProperties: false,
        properties: {
            supports_text_input: { type: 'boolean' },
            supports_image_input: { type: 'boolean' },
            supports_video_input: { type: 'boolean' },
            max_n: { type: 'integer', minimum: 1, maximum: 4 },
            aspect_ratios: {
                type: 'array',
                uniqueItems: true,
                items: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:3', '3:4'] }
            },
            resolutions: {
                type: 'array',
                uniqueItems: true,
                items: { type: 'string', enum: ['1K', '2K', '480p', '720p', '1080p'] }
            },
            durations_seconds: {
                type: 'array',
                uniqueItems: true,
                items: { type: 'integer', enum: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }
            },
            mesh_qualities: {
                type: 'array',
                uniqueItems: true,
                items: { type: 'string', enum: ['standard', 'high', 'extra_high'] }
            },
            output_formats: {
                type: 'array',
                uniqueItems: true,
                items: { type: 'string', enum: ['glb', 'obj', 'fbx', 'stl', 'usdz', 'blend'] }
            },
            postprocessing: {
                type: 'array',
                uniqueItems: true,
                items: { type: 'string', enum: ['refine', 'texture', 'pbr', 'remesh'] }
            }
        }
    };
    const publicModelIds = [
        'openai/gpt-image-2',
        'google/nano-banana-pro',
        'bytedance/seedance-2.0',
        'dreamtech/neural4d-2.5'
    ];
    components.schemas.Model.properties.id.enum = publicModelIds;
    components.schemas.Model.properties.id.example = 'openai/gpt-image-2';
    components.schemas.Model.properties.owned_by.enum = ['openai', 'google', 'bytedance', 'dreamtech'];
    components.schemas.Model.properties.modes.items.enum = [
        'text-to-image',
        'image-to-image',
        'text-to-video',
        'first-frame-to-video',
        'first-last-frame-to-video',
        'reference-to-video',
        'text-to-3d',
        'image-to-3d'
    ];

    paths['/openapi/v1/models'].get.responses['200'].content['application/json'].example = {
        object: 'list',
        data: [
            {
                id: 'openai/gpt-image-2',
                object: 'model',
                modality: 'image',
                owned_by: 'openai',
                modes: ['text-to-image', 'image-to-image'],
                capabilities: {
                    supports_text_input: true,
                    supports_image_input: true,
                    supports_video_input: false,
                    max_n: 4,
                    aspect_ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
                    resolutions: ['1K', '2K']
                }
            },
            {
                id: 'google/nano-banana-pro',
                object: 'model',
                modality: 'image',
                owned_by: 'google',
                modes: ['text-to-image', 'image-to-image'],
                capabilities: {
                    supports_text_input: true,
                    supports_image_input: true,
                    supports_video_input: false,
                    max_n: 4,
                    aspect_ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
                    resolutions: ['1K', '2K']
                }
            },
            {
                id: 'bytedance/seedance-2.0',
                object: 'model',
                modality: 'video',
                owned_by: 'bytedance',
                modes: ['text-to-video', 'first-frame-to-video', 'first-last-frame-to-video', 'reference-to-video'],
                capabilities: {
                    supports_text_input: true,
                    supports_image_input: true,
                    supports_video_input: false,
                    max_n: 4,
                    aspect_ratios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
                    resolutions: ['480p', '720p', '1080p'],
                    durations_seconds: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
                }
            },
            {
                id: 'dreamtech/neural4d-2.5',
                object: 'model',
                modality: '3dmodel',
                owned_by: 'dreamtech',
                modes: ['text-to-3d', 'image-to-3d'],
                capabilities: {
                    supports_text_input: true,
                    supports_image_input: true,
                    supports_video_input: false,
                    max_n: 4,
                    mesh_qualities: ['standard', 'high', 'extra_high'],
                    output_formats: ['glb', 'obj', 'fbx', 'stl', 'usdz', 'blend'],
                    postprocessing: ['refine', 'texture', 'pbr', 'remesh']
                }
            }
        ]
    };

    const modelEnums = new Map([
        ['ImageGenerationJsonRequest', ['openai/gpt-image-2', 'google/nano-banana-pro']],
        ['ImageGenerationMultipartRequest', ['openai/gpt-image-2', 'google/nano-banana-pro']],
        ['VideoGenerationJsonRequest', ['bytedance/seedance-2.0']],
        ['VideoGenerationMultipartRequest', ['bytedance/seedance-2.0']],
        ['TextTo3DGenerationRequest', ['dreamtech/neural4d-2.5']],
        ['ImageTo3DGenerationRequest', ['dreamtech/neural4d-2.5']]
    ]);
    for (const [schemaName, values] of modelEnums) {
        const modelField = components.schemas[schemaName].properties.model;
        modelField.enum = values;
        modelField.example = values[0];
    }

    components.schemas.Task.properties.model.enum = publicModelIds;
    components.schemas.UsageRecord.properties.model.enum = publicModelIds;

    for (const schemaName of [
        'ImageGenerationJsonRequest',
        'ImageGenerationMultipartRequest',
        'VideoGenerationJsonRequest',
        'VideoGenerationMultipartRequest'
    ]) {
        components.schemas[schemaName].properties.extra_body = {
            type: 'object',
            additionalProperties: true,
            description: 'Additional provider parameters forwarded with the generation request.'
        };
    }

    const imageRequestContent = paths['/openapi/v1/images/generations'].post.requestBody.content;
    imageRequestContent['application/json'].example.extra_body = {
        custom_option: 'value'
    };
    imageRequestContent['multipart/form-data'].example = {
        model: 'openai/gpt-image-2',
        prompt: 'Restyle the reference images as a studio product photo',
        mode: 'image-to-image',
        images: ['(binary)', '(binary)'],
        n: 2,
        resolution: '1K',
        aspect_ratio: '4:3',
        extra_body: {
            custom_option: 'value'
        }
    };
    imageRequestContent['multipart/form-data'].encoding = {
        extra_body: { contentType: 'application/json' }
    };

    const videoRequestContent = paths['/openapi/v1/videos/generations'].post.requestBody.content;
    videoRequestContent['application/json'].example.extra_body = {
        custom_option: 'value'
    };
    videoRequestContent['multipart/form-data'].example = {
        model: 'bytedance/seedance-2.0',
        prompt: 'A slow orbit around the reference subject',
        mode: 'first-frame-to-video',
        images: ['(binary)'],
        duration_seconds: 5,
        resolution: '720p',
        aspect_ratio: '16:9',
        n: 1,
        extra_body: {
            custom_option: 'value'
        }
    };
    videoRequestContent['multipart/form-data'].encoding = {
        extra_body: { contentType: 'application/json' }
    };

    if (components.schemas.Texture3DModelRequest.anyOf) {
        components.schemas.Texture3DModelRequest.oneOf = components.schemas.Texture3DModelRequest.anyOf;
        delete components.schemas.Texture3DModelRequest.anyOf;
    }
    for (const schemaName of ['TextTo3DGenerationRequest', 'ImageTo3DGenerationRequest']) {
        delete components.schemas[schemaName].properties.extra_body;
    }

    const uuidFields = [
        ['Task', 'id'],
        ['ModelFile', 'id'],
        ['Refine3DModelRequest', 'id'],
        ['Texture3DModelRequest', 'id'],
        ['Pbr3DModelRequest', 'id'],
        ['Remesh3DModelRequest', 'id'],
        ['ConvertFileRequest', 'id'],
        ['FileResource', 'id'],
        ['UsageRecord', 'id']
    ];
    for (const [schemaName, fieldName] of uuidFields) {
        components.schemas[schemaName].properties[fieldName].format = 'uuid';
    }

    for (const [pathName, pathItem] of Object.entries(paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
            if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
                continue;
            }
            const operationKey = `${method.toUpperCase()} ${pathName}`;
            operation.operationId = operationIds.get(operationKey) || operation.operationId;

            operation.parameters = (operation.parameters || []).filter((parameter) => {
                return parameter.$ref !== '#/components/parameters/XRequestId'
                    && parameter.name !== 'X-Request-Id';
            });
            for (const parameter of operation.parameters) {
                if (!parameter.$ref && parameter.name === 'id' && parameter.in === 'path') {
                    parameter.schema.format = 'uuid';
                    parameter.description = pathName.includes('/files/')
                        ? 'Task or 3D model ID, in UUID format.'
                        : 'Task ID returned by a generation or post-processing request, in UUID format.';
                }
                if (!parameter.$ref && parameter.name === 'type' && parameter.in === 'query') {
                    parameter.schema = { $ref: '#/components/schemas/TaskType' };
                }
                if (!parameter.$ref && parameter.name === 'model' && parameter.in === 'query') {
                    parameter.schema.enum = publicModelIds;
                }
            }

            for (const response of Object.values(operation.responses || {})) {
                if (!response.$ref && response.headers) {
                    delete response.headers['X-Request-Id'];
                }
            }

        }
    }

    for (const response of Object.values(components.responses || {})) {
        if (response.headers) {
            delete response.headers['X-Request-Id'];
        }
    }
    if (components.parameters) {
        delete components.parameters.XRequestId;
    }
    if (components.headers) {
        delete components.headers.XRequestId;
    }

    paths['/openapi/v1/models'].get.description = 'Returns the currently enabled public models. Use this response as the source of truth for model IDs, modes, and capabilities. Account access is enforced when a task is submitted.';
    paths['/openapi/v1/images/generations'].post.description = 'Creates 1 to 4 image generation tasks from a prompt and up to six optional reference images. Use application/json for text-to-image and multipart/form-data for image-guided generation. The response includes queued tasks and charged credits.';
    paths['/openapi/v1/videos/generations'].post.description = 'Creates one task ID per requested video. Multipart image count determines text, first-frame, first-last-frame, or reference mode when mode is omitted.';
    paths['/openapi/v1/3dmodels/generations'].post.description = 'Creates text-to-3D or single-image-to-3D tasks. Use application/json for text input and multipart/form-data for one local image.';
    paths['/openapi/v1/3dmodels/refine'].post.description = 'Queues the refine pipeline for a completed model ID. It upgrades standard or high meshes to extra_high and regenerates texture/PBR from the source context when available.';
    paths['/openapi/v1/3dmodels/texture'].post.description = 'Queues texture generation using exactly one input: a prompt or one local reference image.';
    paths['/openapi/v1/3dmodels/pbr'].post.description = 'Queues the PBR pipeline for a completed model ID. The terminal task returns the resulting model URL.';
    paths['/openapi/v1/tasks/{id}'].get.description = 'Returns one task by its ID. IDs use UUID format. Statuses are normalized to queued, processing, succeeded, or failed. Poll this endpoint until a terminal status is returned.';
    paths['/openapi/v1/files/{id}'].get.description = 'Returns temporary signed result URLs for a completed image, video, or 3D model ID. Use the ID as the persistent identifier.';
    paths['/openapi/v1/files/convert'].post.description = 'Starts asynchronous 3D format conversion. The completed task returns signed file URLs.';
    paths['/openapi/v1/usage'].get.description = 'Returns credit consumption records for the authenticated user, with optional filters for time, model, and task type.';

    const remeshTask = paths['/openapi/v1/3dmodels/remesh'].post;
    remeshTask.summary = 'Remesh a 3D model';
    remeshTask.description = 'Queues the remesh pipeline with the requested target face count.';
    remeshTask.responses['202'].description = 'Remesh task accepted';

    const deleteTask = paths['/openapi/v1/tasks/{id}'].delete;
    deleteTask.summary = 'Remove a task history entry';
    deleteTask.description = "Removes the task and its result from the authenticated account's history. Queued or running execution keeps its current state.";
    delete deleteTask.responses['200'];
    deleteTask.responses['204'] = {
        description: 'Task history entry removed',
        headers: buildStandardResponseHeaders()
    };

    paths['/openapi/v1/files/{id}'].get.responses['409'] = {
        $ref: '#/components/responses/TaskNotReady'
    };
}

function buildV1Spec(source) {
    const paths = JSON.parse(JSON.stringify(Object.fromEntries(
        Object.entries(source.paths).filter(([route]) => route.startsWith('/openapi/v1'))
    )));

    if (Object.keys(paths).length === 0) {
        throw new Error('No /openapi/v1 paths were found in openapi.json');
    }

    const normalizedTagNames = new Map();
    for (const tag of v1Tags) {
        normalizedTagNames.set(tag.name, tag.name);
        tag.aliases.forEach((alias) => normalizedTagNames.set(alias, tag.name));
    }

    for (const pathItem of Object.values(paths)) {
        for (const operation of Object.values(pathItem)) {
            if (operation && Array.isArray(operation.tags)) {
                operation.tags = operation.tags.map((tag) => normalizedTagNames.get(tag) || tag);
            }
            if (operation && Array.isArray(operation.servers)) {
                operation.servers = operation.servers.map((server) => ({
                    ...server,
                    description: 'Production server'
                }));
            }
        }
    }

    const components = collectReferencedComponents(paths, source.components);
    components.securitySchemes.bearerAuth.description = 'Use the API key provided by Neural4D. Send it in the Authorization header with the Bearer scheme.';
    components.securitySchemes.bearerAuth['x-default'] = 'Bearer ${YOUR_API_KEY}';
    applyV1ContractAdjustments(paths, components);

    return {
        openapi: source.openapi,
        info: {
            title: 'Neural4D API',
            description: 'API v1 provides model discovery, asynchronous generation and post-processing tasks, signed file access, format conversion, and credit usage records.',
            version: '1.0.0'
        },
        servers: [
            {
                url: 'https://api.neural4d.com',
                description: 'Production server'
            }
        ],
        tags: v1Tags.map(({ name, description }) => ({ name, description })),
        paths,
        components
    };
}

function localize(value) {
    if (typeof value === 'string') {
        return translations.get(value) || value;
    }

    if (Array.isArray(value)) {
        return value.map(localize);
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, child]) => [key, localize(child)])
        );
    }

    return value;
}

function preserveEnglishMessageValues(englishValue, localizedValue) {
    if (!englishValue || !localizedValue || typeof englishValue !== 'object' || typeof localizedValue !== 'object') {
        return;
    }

    for (const [key, englishChild] of Object.entries(englishValue)) {
        if (!(key in localizedValue)) {
            continue;
        }
        if (key === 'message' && typeof englishChild === 'string') {
            localizedValue[key] = englishChild;
            continue;
        }
        preserveEnglishMessageValues(englishChild, localizedValue[key]);
    }
}

function applyFieldDescriptions(spec, languageIndex) {
    for (const [schemaName, fields] of Object.entries(schemaFieldDescriptions)) {
        const schema = spec.components.schemas[schemaName];
        if (!schema) {
            throw new Error(`Missing schema for field descriptions: ${schemaName}`);
        }

        for (const [fieldName, descriptions] of Object.entries(fields)) {
            const field = schema.properties && schema.properties[fieldName];
            if (!field) {
                throw new Error(`Missing field for description: ${schemaName}.${fieldName}`);
            }
            field.description = descriptions[languageIndex];
        }
    }

    for (const pathItem of Object.values(spec.paths)) {
        for (const operation of Object.values(pathItem)) {
            if (!operation || !Array.isArray(operation.parameters)) {
                continue;
            }
            for (const parameter of operation.parameters) {
                const descriptions = queryParameterDescriptions[parameter.name];
                if (descriptions && !parameter.$ref) {
                    parameter.description = descriptions[languageIndex];
                }
            }
        }
    }
}

function applyLegacyFieldDescriptions(spec, languageIndex) {
    for (const [schemaName, fields] of Object.entries(legacySchemaFieldDescriptions)) {
        const schema = spec.components.schemas[schemaName];
        if (!schema) {
            throw new Error(`Missing legacy schema for field descriptions: ${schemaName}`);
        }

        for (const [fieldName, descriptions] of Object.entries(fields)) {
            const field = schema.properties && schema.properties[fieldName];
            if (!field) {
                throw new Error(`Missing legacy field for description: ${schemaName}.${fieldName}`);
            }
            field.description = descriptions[languageIndex];
        }
    }
}

function assertAllFieldsDocumented(spec) {
    const missing = [];

    function inspectSchema(schema, location) {
        if (!schema || typeof schema !== 'object') {
            return;
        }

        for (const [fieldName, field] of Object.entries(schema.properties || {})) {
            if (typeof field.description !== 'string' || field.description.trim() === '') {
                missing.push(`${location}.${fieldName}`);
            }
            inspectSchema(field, `${location}.${fieldName}`);
        }

        if (schema.items) {
            inspectSchema(schema.items, `${location}[]`);
        }
        for (const composition of ['allOf', 'oneOf', 'anyOf']) {
            (schema[composition] || []).forEach((item, index) => {
                inspectSchema(item, `${location}.${composition}[${index}]`);
            });
        }
    }

    for (const [schemaName, schema] of Object.entries(spec.components.schemas || {})) {
        inspectSchema(schema, `#/components/schemas/${schemaName}`);
    }

    for (const [pathName, pathItem] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
            if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
                continue;
            }

            for (const parameter of [...(pathItem.parameters || []), ...(operation.parameters || [])]) {
                if (!parameter.$ref && (!parameter.description || parameter.description.trim() === '')) {
                    missing.push(`${method.toUpperCase()} ${pathName} parameter ${parameter.name}`);
                }
            }

            for (const [contentType, media] of Object.entries(operation.requestBody?.content || {})) {
                inspectSchema(media.schema, `${method.toUpperCase()} ${pathName} request ${contentType}`);
            }

            for (const [status, response] of Object.entries(operation.responses || {})) {
                if (response.$ref) {
                    continue;
                }
                for (const [headerName, header] of Object.entries(response.headers || {})) {
                    if (!header.$ref && (!header.description || header.description.trim() === '')) {
                        missing.push(`${method.toUpperCase()} ${pathName} response ${status} header ${headerName}`);
                    }
                }
                for (const [contentType, media] of Object.entries(response.content || {})) {
                    inspectSchema(media.schema, `${method.toUpperCase()} ${pathName} response ${status} ${contentType}`);
                }
            }
        }
    }

    if (missing.length > 0) {
        throw new Error(`OpenAPI fields missing descriptions:\n${missing.join('\n')}`);
    }
}

function assertChineseHumanText(spec) {
    const untranslated = [];

    function walk(value, key, location) {
        if (
            typeof value === 'string' &&
            ['title', 'summary', 'description'].includes(key) &&
            /[A-Za-z]{3}/.test(value) &&
            !/[\u4e00-\u9fff]/.test(value) &&
            value !== 'Neural4D API'
        ) {
            untranslated.push(`${location}: ${value}`);
            return;
        }

        if (value && typeof value === 'object') {
            for (const [childKey, child] of Object.entries(value)) {
                walk(child, childKey, `${location}/${childKey}`);
            }
        }
    }

    walk(spec, '', '#');
    if (untranslated.length > 0) {
        throw new Error(`Untranslated Chinese OpenAPI text:\n${untranslated.join('\n')}`);
    }
}

function preserveLegacySpecs() {
    if (!fs.existsSync(oldEnglishPath)) {
        const legacyEnglish = execFileSync(
            'git',
            ['show', 'HEAD:openapi.json'],
            { cwd: rootDir, encoding: 'utf8' }
        );
        writeJson(oldEnglishPath, JSON.parse(legacyEnglish));
    }

    if (!fs.existsSync(oldChinesePath)) {
        writeJson(oldChinesePath, readJson(currentChinesePath));
    }
}

preserveLegacySpecs();

const legacyEnglish = readJson(oldEnglishPath);
const legacyChinese = readJson(oldChinesePath);
applyLegacyGenerationEndpointUpdates(legacyEnglish, 0);
applyLegacyGenerationEndpointUpdates(legacyChinese, 1);
applyLegacyFieldDescriptions(legacyEnglish, 0);
applyLegacyFieldDescriptions(legacyChinese, 1);
preserveEnglishMessageValues(legacyEnglish, legacyChinese);
assertLegacyGenerationExamplesAligned(legacyEnglish);
assertLegacyGenerationExamplesAligned(legacyChinese);
assertAllFieldsDocumented(legacyEnglish);
assertAllFieldsDocumented(legacyChinese);
writeJson(oldEnglishPath, legacyEnglish);
writeJson(oldChinesePath, legacyChinese);

const v1English = buildV1Spec(readJson(currentEnglishPath));
applyFieldDescriptions(v1English, 0);
const v1Chinese = localize(v1English);
applyFieldDescriptions(v1Chinese, 1);
preserveEnglishMessageValues(v1English, v1Chinese);

assertAllFieldsDocumented(v1English);
assertAllFieldsDocumented(v1Chinese);
assertChineseHumanText(v1Chinese);
writeJson(currentEnglishPath, v1English);
writeJson(currentChinesePath, v1Chinese);

console.log(`Generated ${Object.keys(v1English.paths).length} v1 paths in English and Chinese.`);
