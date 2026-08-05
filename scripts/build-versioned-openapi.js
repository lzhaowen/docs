'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const currentEnglishPath = path.join(rootDir, 'openapi.json');
const currentChinesePath = path.join(rootDir, 'openapi.zh.json');
const oldEnglishPath = path.join(rootDir, 'openapi.old.json');
const oldChinesePath = path.join(rootDir, 'openapi.old.zh.json');
const fullV1BackupPath = path.join(rootDir, 'backups', 'v1-full-20260721', 'openapi.json');

const publicVideoModelCapabilities = {
    'bytedance/seedance-2.0': {
        resolutions: ['480p', '720p', '1080p', '4K'],
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        supportsOutputWithAudio: true,
        defaults: { resolution: '720p', aspectRatio: '16:9', duration: 5, outputWithAudio: true }
    },
    'bytedance/seedance-2.0-fast': {
        resolutions: ['480p', '720p'],
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        supportsOutputWithAudio: true,
        defaults: { resolution: '720p', aspectRatio: '16:9', duration: 5, outputWithAudio: true }
    },
    'google/veo-3.1': {
        resolutions: ['720p', '1080p', '4K'],
        aspectRatios: ['16:9', '9:16'],
        durations: [4, 5, 6, 7, 8],
        supportsOutputWithAudio: true,
        defaults: { resolution: '720p', aspectRatio: '16:9', duration: 8, outputWithAudio: true }
    },
    'xai/grok-imagine': {
        resolutions: ['480p', '720p'],
        aspectRatios: ['1:1', '16:9', '9:16', '2:3', '3:2'],
        durations: [
            6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
            19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30
        ],
        supportsOutputWithAudio: false,
        defaults: { resolution: '720p', aspectRatio: '16:9', duration: 6 }
    }
};
const publicVideoModels = Object.keys(publicVideoModelCapabilities);
const publicVideoResolutions = [...new Set(
    Object.values(publicVideoModelCapabilities).flatMap(({ resolutions }) => resolutions)
)];
const publicVideoAspectRatios = [...new Set(
    Object.values(publicVideoModelCapabilities).flatMap(({ aspectRatios }) => aspectRatios)
)];
const videoModelFieldDescriptions = {
    model: [
        'Video generation model identifier. Parameter defaults and allowed values depend on the selected model.',
        '视频生成模型标识。参数默认值和可选值取决于所选模型。'
    ],
    resolution: [
        'Resolution allowed by the selected video model.',
        '所选视频模型允许的分辨率。'
    ],
    aspect_ratio: [
        'Aspect ratio allowed by the selected video model.',
        '所选视频模型允许的宽高比。'
    ],
    duration: [
        'Duration allowed by the selected video model, in seconds.',
        '所选视频模型允许的时长，单位为秒。'
    ],
    output_with_audio: [
        'Whether to generate native audio with the video.',
        '是否随视频生成原生音频。'
    ],
    input_references: [
        'Uploaded image, video, and audio reference assets. Images support JPG, JPEG, PNG, and WEBP; videos support MP4 and MOV; audio supports MP3 and WAV. The endpoint accepts up to six images, four videos, and two audio files. Each audio file must be 2 to 15 seconds and no larger than 15 MB, and the combined audio duration must not exceed 15 seconds. Audio must be accompanied by at least one image or video. The downstream request body must not exceed 64 MB; do not Base64-encode large files. Every item declares its media type and requires file_id.',
        '已上传的图片、视频和音频参考素材。图片支持 JPG、JPEG、PNG 和 WEBP，视频支持 MP4 和 MOV，音频支持 MP3 和 WAV。接口最多接受六张图片、四个视频和两个音频。单个音频时长为 2 至 15 秒且不超过 15 MB，所有音频总时长不超过 15 秒。音频必须与至少一个图片或视频同时使用。下游请求体不得超过 64 MB；大文件不要使用 Base64 编码。每项声明媒体类型，并且必须提供 file_id。'
    ]
};
const videoModelOutputWithAudioDescriptions = {
    'bytedance/seedance-2.0': [
        'Whether to generate native audio with the video. Enabled by default for Seedance 2.0.',
        '是否随视频生成原生音频。Seedance 2.0 默认开启。'
    ],
    'bytedance/seedance-2.0-fast': [
        'Whether to generate native audio with the video. Enabled by default for Seedance 2.0 Fast.',
        '是否随视频生成原生音频。Seedance 2.0 Fast 默认开启。'
    ],
    'google/veo-3.1': [
        'Whether to generate native audio with the video. Enabled by default for Veo 3.1.',
        '是否随视频生成原生音频。Veo 3.1 默认开启。'
    ]
};
const publicVideoModes = [
    'text_to_video',
    'first_frame_image_to_video',
    'first_last_frame_image_to_video',
    'reference_to_video'
];
const fileIdPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

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
        description: 'Poll asynchronous tasks by ID.'
    },
    {
        name: 'Files',
        aliases: ['open-platform-files'],
        description: 'Upload input files for reuse in generation requests.'
    },
    {
        name: 'Usage',
        aliases: ['open-platform-usage'],
        description: 'Query credit consumption records.'
    },
    {
        name: 'Credits',
        aliases: ['open-platform-balance', 'Balance'],
        description: 'Query the current credit balance.'
    }
];

const schemaFieldDescriptions = {
    ApiError: {
        message: ['Human-readable explanation of the error.', '便于阅读的错误说明。'],
        doc_url: ['Optional documentation URL with more information about the error.', '包含此错误更多信息的可选文档 URL。']
    },
    ErrorResponse: {
        error: ['Structured error details.', '结构化错误详情。']
    },
    ImageFile: {
        uuid: ['Generated image child UUID.', '生成图片子项 UUID。'],
        url: ['Temporary signed URL for downloading the generated image.', '用于下载生成图片的临时签名 URL。'],
        format: ['Image file format when known, such as png.', '已知时返回图片文件格式，例如 png。']
    },
    VideoFile: {
        uuid: ['Generated video child UUID.', '生成视频子项 UUID。'],
        url: ['Temporary signed URL for downloading the generated video when available.', '生成视频可用时用于下载的临时签名 URL。'],
        format: ['Video file format when known, such as mp4.', '已知时返回视频文件格式，例如 mp4。'],
        duration: ['Generated video duration in seconds when available.', '可用时返回生成视频的时长，单位为秒。'],
        resolution: ['Generated video resolution when available, such as 720p.', '可用时返回生成视频的分辨率，例如 720p。'],
        aspect_ratio: ['Generated video aspect ratio when available, such as 16:9.', '可用时返回生成视频的宽高比，例如 16:9。'],
        has_audio: ['Whether native audio generation was enabled for this video.', '此视频是否启用了原生音频生成。'],
        mode: ['Generation mode used for this video.', '此视频使用的生成模式。'],
        status: ['Current status of this generated video.', '此生成视频的当前状态。'],
        created_at: ['Unix timestamp in seconds when this generated video was created.', '此生成视频的创建时间，Unix 时间戳，单位为秒。'],
        updated_at: ['Unix timestamp in seconds when this generated video was last updated.', '此生成视频的最后更新时间，Unix 时间戳，单位为秒。']
    },
    ModelFile: {
        uuid: ['Generated 3D model child UUID.', '生成 3D 模型子项 UUID。'],
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
        videos: [
            'All child video tasks and their current output information. url and format are null until a result file is available.',
            '所有子视频任务及其当前输出信息；结果文件可用前 url 和 format 为 null。'
        ]
    },
    ModelTaskOutput: {
        models: ['Generated 3D model files returned after the task succeeds.', '任务成功后返回的生成 3D 模型文件列表。']
    },
    FileConversionTaskOutput: {
        files: ['Converted files returned after the task succeeds.', '任务成功后返回的转换文件列表。']
    },
    Task: {
        id: ['Batch task ID returned by a generation request.', '生成请求返回的批次任务 ID。'],
        object: ['Object discriminator. Always task.', '对象类型标识，固定为 task。'],
        type: ['Operation type performed by the task.', '任务执行的操作类型。'],
        status: ['Normalized task lifecycle status.', '标准化后的任务生命周期状态。'],
        mode: ['Video generation mode used by the task.', '任务使用的视频生成模式。'],
        output: [
            'Current child video task output, including entries that are still queued or processing.',
            '当前子视频任务输出，包括仍在排队或处理中的条目。'
        ],
        usage: ['Credits charged for this task when available.', '可用时返回此任务扣除的点数。'],
        error: ['Error details when the task fails.', '任务失败时返回的错误详情。'],
        progress: ['Task completion percentage from 0 to 100.', '任务完成进度百分比，范围为 0 到 100。']
    },
    TaskReceipt: {
        uuid: ['Generated child item UUID.', '生成结果子项 UUID。'],
        object: ['Object discriminator. Always task.', '对象类型标识，固定为 task。'],
        mode: ['Video generation mode used for this child item.', '此视频生成子项使用的生成模式。'],
        status: ['Normalized task lifecycle status.', '标准化后的任务生命周期状态。'],
        usage: ['Credits charged for this task when available.', '可用时返回此任务扣除的点数。'],
        error: ['Error details when the task fails.', '任务失败时返回的错误详情。'],
        progress: ['Task completion percentage from 0 to 100.', '任务完成进度百分比，范围为 0 到 100。']
    },
    TaskList: {
        id: ['Batch task ID returned by the generation request.', '生成请求返回的批次任务 ID。'],
        object: ['Object discriminator. Always list.', '对象类型标识，固定为 list。'],
        status: ['Current status shared by the submitted video tasks.', '本次提交的视频任务的当前状态。'],
        created_at: ['Unix timestamp in seconds when the batch task was created.', '批次任务创建时间的 Unix 时间戳，单位为秒。'],
        mode: ['Video generation mode shared by the submitted tasks.', '本次提交任务使用的视频生成模式。'],
        model: ['Video generation model used by the submitted tasks.', '本次提交任务使用的视频生成模型。'],
        data: ['Generated child items created by the request.', '本次请求创建的生成结果子项。'],
        usage: ['Total credits charged for the submitted tasks when available.', '可用时返回本次提交任务扣除的总点数。']
    },
    ModelArchitecture: {
        input_modalities: ['Input modalities published for this model.', '该模型公布的输入模态。'],
        output_modalities: ['Output modalities published for this model.', '该模型公布的输出模态。']
    },
    Model: {
        id: ['Public model identifier used in generation requests.', '生成请求中使用的公开模型标识。'],
        object: ['Object discriminator. Always model.', '对象类型标识，固定为 model。'],
        created_at: ['Unix timestamp in seconds when the model entry was created.', '模型条目创建时间的 Unix 时间戳，单位为秒。'],
        updated_at: ['Unix timestamp in seconds when the model entry was updated.', '模型条目更新时间的 Unix 时间戳，单位为秒。'],
        owned_by: ['Provider or organization that owns the model.', '拥有该模型的供应商或组织。'],
        name: ['Display name of the model.', '模型显示名称。'],
        description: ['Model description maintained by the model registry.', '模型注册表维护的模型说明。'],
        architecture: ['Input and output modalities maintained by the runtime model registry.', '运行时模型注册表维护的输入和输出模态。'],
        supported_parameters: ['Request parameter names maintained by the runtime model registry.', '运行时模型注册表维护的请求参数名称。'],
        default_parameters: ['Default request parameter values maintained by the runtime model registry.', '运行时模型注册表维护的请求参数默认值。']
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
        mode: ['Video generation mode. Use text-to-video without images or image-to-video with images.', '视频生成模式。不传图片时使用 text-to-video，传入图片时使用 image-to-video。'],
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
        uuid: ['UUID of the completed 3D model to edit.', '待编辑的已完成 3D 模型 UUID。'],
        prompt: ['Text instruction describing the texture to generate.', '描述待生成纹理的文本提示词。']
    },
    Refine3DModelRequest: {
        uuid: ['UUID of the completed 3D model to edit.', '待编辑的已完成 3D 模型 UUID。']
    },
    Pbr3DModelRequest: {
        uuid: ['UUID of the completed 3D model to edit.', '待编辑的已完成 3D 模型 UUID。']
    },
    Remesh3DModelRequest: {
        uuid: ['UUID of the completed 3D model to edit.', '待编辑的已完成 3D 模型 UUID。'],
        target_polycount: ['Target face count passed to the remesh pipeline.', '传递给重网格流程的目标面数。']
    },
    ConvertFileRequest: {
        id: ['ID of a completed 3D model, in UUID format.', '已完成 3D 模型的 ID，格式为 UUID。'],
        target_format: ['Target file format for the converted model.', '转换后模型的目标文件格式。']
    },
    FileResource: {
        id: ['Task or model ID associated with these files.', '与这些文件关联的任务或模型 ID。'],
        urls: ['Temporary signed download URLs for available result files.', '可用结果文件的临时签名下载 URL 列表。'],
        thumbnail_urls: ['Temporary signed URLs for available preview images.', '可用预览图片的临时签名 URL 列表。']
    },
    UsageRecord: {
        id: ['Associated task ID.', '关联任务 ID。'],
        model: ['Public model identifier when it can be resolved from the usage record.', '可从用量记录解析时返回公开模型标识。'],
        credits: ['Credits charged by this usage record.', '此条用量记录扣除的点数。']
    },
    UsageList: {
        object: ['Object discriminator. Always usage_list.', '对象类型标识，固定为 usage_list。'],
        data: ['Usage records on the current page.', '当前页的用量记录。'],
        total_credits: ['Total credits represented by the filtered result set.', '筛选结果集合对应的总点数。'],
        page: ['Current one-based page number.', '当前页码，从 1 开始。'],
        has_more: ['Whether another page of usage records is available.', '是否还有下一页用量记录。']
    },
    FileReferenceUrl: {
        url: ['HTTPS source URL. Every DNS result and redirect is checked for a public network address, then media type, size, and fetch time limits are applied.', 'HTTPS 源 URL。每次 DNS 解析结果和重定向都会校验为公网地址，并应用媒体类型、大小和抓取时长限制。']
    },
    FileReferenceId: {
        file_id: ['File ID returned by the file upload endpoint.', '文件上传接口返回的文件 ID。']
    },
    FileReferenceKey: {
        fileKey: ['Managed file key issued by Neural4D.', 'Neural4D 签发的托管文件 key。']
    },
    ImageGenerationJsonRequest: {
        model: ['Model identifier returned by GET /openapi/v1/models.', 'GET /openapi/v1/models 返回的模型标识。'],
        prompt: ['Text instruction describing the image to generate or edit.', '描述待生成或编辑图片的文本提示词。'],
        images: ['Reference images supplied by URL or managed file key.', '通过 URL 或托管文件 key 提供的参考图片。'],
        n: ['Number of image generation tasks to create.', '需要创建的图片生成任务数量。'],
        resolution: ['Named resolution published for the selected image model, currently 1K or 2K. Use this or size.', '所选图片模型公布的命名分辨率，当前为 1K 或 2K。与 size 二选一。'],
        size: ['Pixel size in WIDTHxHEIGHT form. Use this or resolution.', '像素尺寸，格式为 WIDTHxHEIGHT。与 resolution 二选一。'],
        aspect_ratio: ['Target image width-to-height ratio.', '目标图片宽高比。'],
        extra_body: ['Provider parameters forwarded after key, size, depth, and payload validation.', '经过 key、大小、深度和载荷校验后透传的供应商参数。']
    },
    VideoGenerationJsonRequest: {
        model: ['Video generation model identifier.', '视频生成模型标识。'],
        prompt: ['Required text instruction describing the video to generate.', '描述待生成视频内容的必填文本提示词。'],
        frame_images: [
            'First-frame and last-frame images uploaded through POST /openapi/v1/files. Supported formats are JPG, JPEG, PNG, and WEBP. Each frame_type may appear at most once, and every item requires file_id.',
            '通过 POST /openapi/v1/files 上传的首帧和尾帧图片，支持 JPG、JPEG、PNG 和 WEBP 格式。每个 frame_type 最多出现一次，每项都必须提供 file_id。'
        ],
        input_references: videoModelFieldDescriptions.input_references,
        duration: ['Target video duration in seconds.', '目标视频时长，单位为秒。'],
        output_with_audio: ['Whether to generate native audio with the video.', '是否随视频生成原生音频。'],
        n: ['Number of video generation tasks to create.', '需要创建的视频生成任务数量。'],
        resolution: ['Named resolution published for the selected video model, currently 480p, 720p, 1080p, 1K, or 2K.', '所选视频模型公布的命名分辨率，当前为 480p、720p、1080p、1K 或 2K。'],
        aspect_ratio: ['Target video width-to-height ratio.', '目标视频宽高比。'],
        extra_body: ['Provider parameters forwarded after key, nesting depth, property count, and payload validation.', '经过键名、嵌套深度、属性数量和载荷校验后透传的供应商参数。']
    },
    VideoFrameImage: {
        type: ['Media type of the frame asset. Always image.', '帧素材的媒体类型，固定为 image。'],
        frame_type: ['Position represented by this image: first_frame or last_frame.', '此图片表示的帧位置：first_frame 或 last_frame。'],
        file_id: [
            'File ID returned by the file upload endpoint. Supported formats for frame images: JPG, JPEG, PNG, and WEBP.',
            '文件上传接口返回的文件 ID。帧图片支持 JPG、JPEG、PNG 和 WEBP 格式。'
        ]
    },
    VideoImageReference: {
        type: ['Media type of this reference. Always image.', '此参考素材的媒体类型，固定为 image。'],
        file_id: [
            'File ID returned by the file upload endpoint. Supported image reference formats: JPG, JPEG, PNG, and WEBP.',
            '文件上传接口返回的文件 ID。图片参考素材支持 JPG、JPEG、PNG 和 WEBP 格式。'
        ]
    },
    VideoVideoReference: {
        type: ['Media type of this reference. Always video.', '此参考素材的媒体类型，固定为 video。'],
        file_id: [
            'File ID returned by the file upload endpoint. Supported video reference formats: MP4 and MOV.',
            '文件上传接口返回的文件 ID。视频参考素材支持 MP4 和 MOV 格式。'
        ]
    },
    VideoAudioReference: {
        type: ['Media type of this reference. Always audio.', '此参考素材的媒体类型，固定为 audio。'],
        file_id: [
            'File ID returned by the file upload endpoint. Supported audio reference formats: MP3 and WAV. Each file must be 2 to 15 seconds and no larger than 15 MB.',
            '文件上传接口返回的文件 ID。音频参考素材支持 MP3 和 WAV 格式，单个文件时长为 2 至 15 秒且不超过 15 MB。'
        ]
    },
    ThreeDGenerationRequest: {
        model: ['Model identifier returned by GET /openapi/v1/models.', 'GET /openapi/v1/models 返回的模型标识。'],
        prompt: ['Text instruction describing the 3D model to generate.', '描述待生成 3D 模型的文本提示词。'],
        images: ['One reference image supplied by URL or managed file key.', '通过 URL 或托管文件 key 提供的一张参考图片。'],
        with_texture: ['Whether to generate texture data for the model.', '是否为模型生成纹理数据。'],
        with_pbr: ['Whether to generate PBR material data for the model.', '是否为模型生成 PBR 材质数据。'],
        target_polycount: ['Target face count. standard supports 100000 to 500000; high and extra_high support 500000 to 1000000.', '目标面数。standard 支持 100000 到 500000；high 和 extra_high 支持 500000 到 1000000。'],
        mesh_quality: ['Target mesh quality level.', '目标网格质量等级。'],
        art_style: ['Style instruction for the 3D output, including chibi-style generation.', '3D 输出的风格指令，包括 chibi 风格生成。'],
        n: ['Number of 3D generation tasks to create.', '需要创建的 3D 生成任务数量。']
    },
    Texture3DModelRequest: {
        uuid: ['UUID of the completed 3D model to edit.', '待编辑的已完成 3D 模型 UUID。'],
        prompt: ['Text instruction describing the texture to generate.', '描述待生成纹理的文本提示词。'],
        image: ['One reference image supplied by URL or managed file key.', '通过 URL 或托管文件 key 提供的一张参考图片。']
    },
    Refine3DModelRequest: {
        uuid: ['UUID of the completed 3D model to edit.', '待编辑的已完成 3D 模型 UUID。'],
        quality: ['Target mesh quality for the refine task.', '精细化任务的目标网格质量。']
    },
    Pbr3DModelRequest: {
        uuid: ['UUID of the completed 3D model to edit.', '待编辑的已完成 3D 模型 UUID。']
    },
    Remesh3DModelRequest: {
        uuid: ['UUID of the completed 3D model to edit.', '待编辑的已完成 3D 模型 UUID。'],
        target_polycount: ['Target face count passed to the remesh pipeline.', '传递给重网格流程的目标面数。']
    },
    Convert3DModelRequest: {
        target_format: ['Target 3D model format.', '目标 3D 模型格式。'],
        model_size: ['Model size in millimeters.', '模型尺寸，单位为毫米。']
    },
    ManagedFile: {
        id: ['File ID used by generation requests.', '生成请求使用的文件 ID。'],
        filename: ['Original name of the uploaded file.', '上传文件的原始名称。'],
        bytes: ['Uploaded file size in bytes.', '上传文件大小，单位为字节。'],
        mime_type: ['Media type detected for the uploaded file.', '检测到的上传文件媒体类型。'],
        created_at: ['Unix timestamp in seconds when the file was created.', '文件创建时间的 Unix 时间戳，单位为秒。']
    },
    ManagedFileList: {
        object: ['Object discriminator. Always list.', '对象类型标识，固定为 list。'],
        data: ['Managed files visible to the authenticated account.', '当前认证账户可见的托管文件。'],
        first_id: ['ID of the first file in this page, or null when the page is empty.', '本页第一条文件的 ID；页面为空时返回 null。'],
        last_id: ['ID of the last file in this page, or null when the page is empty.', '本页最后一条文件的 ID；页面为空时返回 null。'],
        has_more: ['Whether another page of managed files is available.', '是否还有下一页托管文件。']
    },
    CreateManagedFileRequest: {
        file: [
            'File to upload. Supported image formats: JPG, JPEG, PNG, GIF, WEBP, BMP, HEIC, and HEIF. Supported video formats: MP4, MOV, WEBM, M4V, OGG, and OGV. Supported audio formats: MP3 and WAV.',
            '需要上传的文件。图片支持 JPG、JPEG、PNG、GIF、WEBP、BMP、HEIC 和 HEIF；视频支持 MP4、MOV、WEBM、M4V、OGG 和 OGV；音频支持 MP3 和 WAV。'
        ]
    },
    CreditBalance: {
        total_credits: ['Total credits currently available to the account.', '账户当前可用的总点数。'],
        monthly_bonus_credits: ['Monthly bonus credits currently available.', '当前可用的月度赠送点数。'],
        permanent_credits: ['Permanent credits currently available.', '当前可用的永久点数。'],
        annual_credits: ['Annual-plan credits currently available.', '当前可用的年付套餐点数。'],
        expires_at: ['Unix timestamp for the nearest expiring credit balance, or null when no balance expires.', '最近到期点数的 Unix 时间戳；没有到期点数时返回 null。'],
        updated_at: ['Unix timestamp in seconds when the credit balance was updated.', '点数余额更新时间的 Unix 时间戳，单位为秒。']
    },
    CreditsResponse: {
        data: ['Current credit balance details.', '当前点数余额详情。']
    }
};

const queryParameterDescriptions = {
    id: ['Batch task ID returned by a generation request. Provide this or uuid, but not both.', '生成请求返回的批次任务 ID。与 uuid 二选一，不能同时传入。'],
    uuid: ['Child video UUID returned in the generation response. Provide this or id, but not both.', '生成响应返回的视频子项 UUID。与 id 二选一，不能同时传入。'],
    page: ['One-based page number.', '页码，从 1 开始。'],
    page_size: ['Maximum number of usage records returned per page.', '每页最多返回的用量记录数量。'],
    limit: ['Maximum number of files returned.', '最多返回的文件数量。'],
    after: ['File ID used as the pagination cursor.', '用作分页游标的文件 ID。']
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
    ['API v1 provides model discovery, managed input files, asynchronous generation and 3D processing tasks, task progress, credit usage, and credit balance.', 'API v1 支持模型发现、托管输入文件、异步生成与 3D 处理任务、任务进度、点数流水和点数余额查询。'],
    ['Balance', '余额'],
    ['Credits', '点数'],
    ['Poll asynchronous tasks by ID.', '通过 ID 查询异步任务。'],
    ['Create and inspect managed input files.', '创建和查询托管输入文件。'],
    ['Upload input files for reuse in generation requests.', '上传可在生成请求中复用的输入文件。'],
    ['Query the current credit balance.', '查询当前点数余额。'],
    ['Returns enabled model registry entries and runtime capabilities maintained by the service.', '返回由服务维护的已启用模型注册信息和运行时能力。'],
    ['Returns enabled entries from the runtime model registry. The example lists the models and request parameters currently published by the service.', '返回运行时模型注册表中已启用的条目。示例列出服务当前公布的模型和请求参数。'],
    ['A file reference containing one HTTPS URL or one managed file key.', '包含一个 HTTPS URL 或一个托管文件 key 的文件引用。'],
    ['One input reference using either an uploaded file ID or an HTTPS URL.', '一个使用已上传文件 ID 或 HTTPS URL 的输入素材引用。'],
    ['Provider parameters are validated against the selected model policy. Keys, nesting depth, property count, and serialized payload size are bounded before forwarding.', '供应商参数会按所选模型策略校验，并在透传前限制 key、嵌套深度、属性数量和序列化载荷大小。'],
    ['Creates asynchronous image generation tasks. Reference images use HTTPS URLs or managed file keys. Named resolution and pixel size are mutually exclusive.', '创建异步图片生成任务。参考图片使用 HTTPS URL 或托管文件 key。命名分辨率与像素尺寸互斥。'],
    ['Creates asynchronous video generation tasks. Reference images use HTTPS URLs or managed file keys. Named resolution and pixel size are mutually exclusive.', '创建异步视频生成任务。参考图片使用 HTTPS URL 或托管文件 key。命名分辨率与像素尺寸互斥。'],
    ['Creates asynchronous video generation tasks. Image inputs use HTTPS URLs. Named resolution and pixel size are mutually exclusive.', '创建异步视频生成任务。图片输入使用 HTTPS URL。命名分辨率与像素尺寸互斥。'],
    ['Creates asynchronous video generation tasks. Image inputs use HTTPS URLs.', '创建异步视频生成任务。图片输入使用 HTTPS URL。'],
    ['Creates asynchronous video generation tasks. Input assets use HTTPS URLs and must match the selected mode.', '创建异步视频生成任务。输入素材使用 HTTPS URL，并且必须与所选模式匹配。'],
    ['Creates asynchronous video generation tasks. Input references use an uploaded file ID or HTTPS URL and must match the selected mode.', '创建异步视频生成任务。输入素材使用已上传文件的 ID 或 HTTPS URL，并且必须与所选模式匹配。'],
    ['Creates asynchronous video generation tasks. Generation behavior is inferred from the prompt, frame images, and typed reference assets.', '创建异步视频生成任务。生成方式根据提示词、帧图片和带类型的参考素材推断。'],
    ['Creates asynchronous video generation tasks. Generation behavior is inferred from the required prompt, frame images, and typed reference assets.', '创建异步视频生成任务。生成方式根据必填提示词、帧图片和带类型的参考素材推断。'],
    ['One typed image, video, or audio reference using a file ID returned by the file upload endpoint.', '一个带媒体类型的图片、视频或音频参考素材，使用文件上传接口返回的文件 ID。'],
    ['Video generation model identifier.', '视频生成模型标识。'],
    ['Optional ordered HTTPS image references. Omit for text-to-video; provide one image as the first frame, two images as the first and last frames, or three to six reference images.', '可选的有序 HTTPS 图片引用。不传图片表示文生视频；传一张图片表示首帧，传两张图片依次表示首帧和尾帧，传三至六张图片表示参考图。'],
    ['Generate a video from text', '通过文本生成视频'],
    ['Animate an HTTPS image reference', '使用 HTTPS 图片引用生成视频'],
    ['Animate a first-frame image', '使用首帧图片生成视频'],
    ['Animate first and last frames', '使用首尾帧图片生成视频'],
    ['Generate from reference assets', '使用参考素材生成视频'],
    ['Animate an uploaded first-frame image', '使用已上传的首帧图片生成视频'],
    ['Use an HTTPS image and explicit pixel size', '使用 HTTPS 图片和明确的像素尺寸'],
    ['A cinematic tracking shot through a neon-lit street at night', '夜晚穿行霓虹街道的电影感跟拍镜头'],
    ['The camera slowly pushes in while soft wind moves the leaves', '镜头缓慢推进，微风轻轻吹动树叶'],
    ['Turn the still frame into a smooth product reveal', '将静态画面转化为流畅的产品展示镜头'],
    ['Video generation model used by the task.', '任务使用的视频生成模型。'],
    ['Generated video result returned after asynchronous processing completes.', '异步处理完成后返回的生成视频结果。'],
    ['Managed file key issued by Neural4D.', 'Neural4D 签发的托管文件 key。'],
    ['Returns the current status, progress, generated video result, usage, and error details for a video generation task.', '返回视频生成任务的当前状态、进度、生成视频结果、用量和错误详情。'],
    ['Returns the current status, generated video result, usage, and error details for a video generation task.', '返回视频生成任务的当前状态、生成视频结果、用量和错误详情。'],
    ['Returns task status and output by batch task ID.', '按批次任务 ID 返回任务状态和输出。'],
    ['Returns task status and output by batch task ID or child video UUID. Provide exactly one of the id or uuid query parameters.', '按批次任务 ID 或视频子项 UUID 返回任务状态和输出。id 与 uuid 必须且只能传入一个。'],
    ['Video generation mode used by the task.', '任务使用的视频生成模式。'],
    ['Batch task ID returned by a generation request.', '生成请求返回的批次任务 ID。'],
    ['API v1 creates videos asynchronously and retrieves task progress and results.', 'API v1 用于异步创建视频并查询任务进度和结果。'],
    ['API v1 creates videos asynchronously and retrieves task status and results.', 'API v1 用于异步创建视频并查询任务状态和结果。'],
    ['API v1 uploads reusable input files, creates videos asynchronously, and retrieves task status and results.', 'API v1 用于上传可复用的输入文件、异步创建视频并查询任务状态和结果。'],
    ['Target video duration in seconds.', '目标视频时长，单位为秒。'],
    ['Named resolution published for the selected video model, currently 480p, 720p, 1080p, 1K, or 2K.', '所选视频模型公布的命名分辨率，当前为 480p、720p、1080p、1K 或 2K。'],
    ['Provider parameters forwarded after key, nesting depth, property count, and payload validation.', '经过键名、嵌套深度、属性数量和载荷校验后透传的供应商参数。'],
    ['Creates asynchronous text-to-3D, image-to-3D, or styled 3D generation tasks. Image inputs use one HTTPS URL or managed file key.', '创建异步文生 3D、图生 3D 或风格化 3D 生成任务。图片输入使用一个 HTTPS URL 或托管文件 key。'],
    ['Creates a texture task from a prompt or one reference image supplied by HTTPS URL or managed file key.', '根据提示词或一个通过 HTTPS URL、托管文件 key 提供的参考图片创建纹理任务。'],
    ['Creates a refine task for a completed 3D model.', '为已完成的 3D 模型创建精细化任务。'],
    ['Creates a PBR material task for a completed 3D model.', '为已完成的 3D 模型创建 PBR 材质任务。'],
    ['Creates a remesh task using the requested target face count.', '使用请求的目标面数创建重网格任务。'],
    ['Returns the current task status, progress, output, usage, and error details by task ID.', '按任务 ID 返回当前状态、进度、输出、用量和错误详情。'],
    ['Returns the current task status, progress, result, usage, and error details by task ID.', '按任务 ID 返回当前状态、进度、结果、用量和错误详情。'],
    ['List managed files', '列出托管文件'],
    ['Returns managed input files recorded for the authenticated account.', '返回当前认证账户记录的托管输入文件。'],
    ['Managed file list', '托管文件列表'],
    ['Create a managed file', '创建托管文件'],
    ['Upload a file', '上传文件'],
    ['Imports an HTTPS URL into managed storage, validates every resolved address and redirect, verifies media type and size, and records the resulting file key.', '将 HTTPS URL 导入托管存储，校验每次地址解析和重定向，验证媒体类型与大小，并记录生成的文件 key。'],
    ['Uploads one local file to managed storage and records the resulting file key.', '将一个本地文件上传到托管存储，并记录生成的文件 key。'],
    ['Uploads one local image or video and returns a reusable file ID.', '上传一个本地图片或视频，并返回可复用的文件 ID。'],
    ['Managed file created', '托管文件已创建'],
    ['File uploaded', '文件已上传'],
    ['Retrieve a managed file', '查询托管文件'],
    ['Returns one managed input file record by ID.', '按 ID 返回一个托管输入文件记录。'],
    ['Managed file ID, in UUID format.', '托管文件 ID，格式为 UUID。'],
    ['Managed file ID.', '托管文件 ID。'],
    ['Managed file details', '托管文件详情'],
    ['Completed 3D model ID, in UUID format.', '已完成 3D 模型的 ID，格式为 UUID。'],
    ['Completed 3D model ID.', '已完成 3D 模型的 ID。'],
    ['Creates an asynchronous format conversion task for a completed 3D model.', '为已完成的 3D 模型创建异步格式转换任务。'],
    ['Retrieve 3D model files', '查询 3D 模型文件'],
    ['Returns temporary signed URLs for files generated from a completed 3D model.', '返回已完成 3D 模型生成文件的临时签名 URL。'],
    ['Retrieve credit balance', '查询点数余额'],
    ['Returns the current available credit balance and its account buckets.', '返回当前可用点数余额及其账户分桶。'],
    ['Current credit balance', '当前点数余额'],
    ['Retrieve credits', '查询点数'],
    ['Returns the current credit balance using the account credit categories exposed by the existing points service.', '按现有点数服务提供的账户点数分类返回当前点数余额。'],
    ['Current credits', '当前点数'],
    ['Task ID.', '任务 ID。'],
    ['Use a named resolution and managed file references', '使用命名分辨率和托管文件引用'],
    ['Use an explicit pixel size', '使用明确的像素尺寸'],
    ['Use a named resolution and a URL reference', '使用命名分辨率和 URL 引用'],
    ['Use an explicit pixel size and a managed file reference', '使用明确的像素尺寸和托管文件引用'],
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
    ['Neural4D API key using the Bearer scheme.', '使用 Bearer 方式发送的 Neural4D API 密钥。'],
    ['Request ID used for support and tracing.', '用于技术支持和链路追踪的请求 ID。'],
    ['Request limit for the current window.', '当前时间窗口的请求上限。'],
    ['Requests remaining in the current window.', '当前时间窗口内的剩余请求次数。'],
    ['Time until the request window resets, such as 1s.', '请求时间窗口距离重置的时长，例如 1s。'],
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
    ['Uploads one local image, video, or audio file and returns a reusable file ID.', '上传一个本地图片、视频或音频文件，并返回可复用的文件 ID。'],
    ['The authenticated user cannot access this resource or has insufficient credits', '当前已认证用户无权访问该资源或点数不足'],
    ['Invalid prompt', '提示词无效'],
    ['Unsupported model', '模型不受支持'],
    ['Model unavailable', '模型不可用'],
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
    const existing = fs.existsSync(filePath) ? readJson(filePath) : null;
    const orderedValue = existing ? applyExistingKeyOrder(value, existing) : value;
    fs.writeFileSync(filePath, `${JSON.stringify(orderedValue, null, 2)}\n`, 'utf8');
}

function applyExistingKeyOrder(value, existing) {
    if (Array.isArray(value)) {
        return value.map((item, index) => applyExistingKeyOrder(item, existing?.[index]));
    }
    if (!value || typeof value !== 'object') {
        return value;
    }

    const result = {};
    for (const key of Object.keys(existing || {})) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            result[key] = applyExistingKeyOrder(value[key], existing[key]);
        }
    }
    for (const [key, child] of Object.entries(value)) {
        if (!Object.prototype.hasOwnProperty.call(result, key)) {
            result[key] = applyExistingKeyOrder(child, existing?.[key]);
        }
    }
    return result;
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
        'x-ratelimit-limit-requests': { $ref: '#/components/headers/RateLimitLimitRequests' },
        'x-ratelimit-remaining-requests': { $ref: '#/components/headers/RateLimitRemainingRequests' },
        'x-ratelimit-reset-requests': { $ref: '#/components/headers/RateLimitResetRequests' }
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

function applyV1ProductDecisions(paths, components) {
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const operationTemplate = paths['/openapi/v1/images/generations'].post;
    const operationContext = () => ({
        servers: clone(operationTemplate.servers || []),
        security: clone(operationTemplate.security || [{ bearerAuth: [] }])
    });
    const idParameter = (description) => ({
        name: 'id',
        in: 'path',
        required: true,
        description,
        schema: { type: 'string', format: 'uuid' }
    });
    const successResponse = (description, schema, example) => ({
        description,
        headers: buildStandardResponseHeaders(),
        content: {
            'application/json': {
                schema: { $ref: `#/components/schemas/${schema}` },
                ...(example ? { example } : {})
            }
        }
    });
    const standardErrors = (includeNotFound = false) => ({
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
        ...(includeNotFound ? { '404': { $ref: '#/components/responses/NotFound' } } : {}),
        '429': { $ref: '#/components/responses/RateLimited' },
        '500': { $ref: '#/components/responses/InternalError' }
    });

    components.headers.RateLimitLimitRequests = {
        description: 'Request limit for the current window.',
        schema: { type: 'integer', format: 'int32', minimum: 0 }
    };
    components.headers.RateLimitRemainingRequests = {
        description: 'Requests remaining in the current window.',
        schema: { type: 'integer', format: 'int32', minimum: 0 }
    };
    components.headers.RateLimitResetRequests = {
        description: 'Time until the request window resets, such as 1s.',
        schema: { type: 'string', example: '1s' }
    };

    function replaceRateLimitHeaders(response) {
        if (!response || response.$ref) {
            return;
        }
        response.headers = response.headers || {};
        delete response.headers['X-RateLimit-Limit'];
        delete response.headers['X-RateLimit-Remaining'];
        delete response.headers['X-RateLimit-Reset'];
        Object.assign(response.headers, buildStandardResponseHeaders());
    }
    for (const pathItem of Object.values(paths)) {
        for (const operation of Object.values(pathItem)) {
            if (!operation || !operation.responses) {
                continue;
            }
            Object.values(operation.responses).forEach(replaceRateLimitHeaders);
        }
    }
    Object.values(components.responses || {}).forEach(replaceRateLimitHeaders);
    delete components.headers.XRateLimitLimit;
    delete components.headers.XRateLimitRemaining;
    delete components.headers.XRateLimitReset;

    components.schemas.FileReferenceUrl = {
        type: 'object',
        required: ['url'],
        additionalProperties: false,
        properties: {
            url: {
                type: 'string',
                format: 'uri',
                pattern: '^https://',
                description: 'HTTPS source URL. Every DNS result and redirect is checked for a public network address, then media type, size, and fetch time limits are applied.'
            }
        }
    };
    components.schemas.FileReferenceKey = {
        type: 'object',
        required: ['fileKey'],
        additionalProperties: false,
        properties: {
            fileKey: {
                type: 'string',
                minLength: 1,
                maxLength: 1024,
                description: 'Managed file key returned by the file management endpoint.'
            }
        }
    };
    components.schemas.FileReference = {
        oneOf: [
            { $ref: '#/components/schemas/FileReferenceUrl' },
            { $ref: '#/components/schemas/FileReferenceKey' }
        ],
        description: 'A file reference containing one HTTPS URL or one managed file key.'
    };
    components.schemas.ExtraBody = {
        type: 'object',
        maxProperties: 50,
        additionalProperties: true,
        description: 'Provider parameters are validated against the selected model policy. Keys, nesting depth, property count, and serialized payload size are bounded before forwarding.'
    };

    const resolutionProperties = {
        resolution: {
            type: 'string',
            enum: ['1K', '2K'],
            example: '2K',
            description: 'Named resolution such as 1K or 2K. Use this or size.'
        },
        size: {
            type: 'string',
            pattern: '^[1-9][0-9]{1,4}x[1-9][0-9]{1,4}$',
            example: '2048x2048',
            description: 'Pixel size in WIDTHxHEIGHT form. Use this or resolution.'
        }
    };

    components.schemas.ImageGenerationJsonRequest = {
        type: 'object',
        required: ['model', 'prompt'],
        additionalProperties: false,
        not: { required: ['resolution', 'size'] },
        properties: {
            model: {
                type: 'string',
                minLength: 1,
                example: 'provider/model-id',
                description: 'Model identifier returned by GET /openapi/v1/models.'
            },
            prompt: {
                type: 'string',
                minLength: 1,
                description: 'Text instruction describing the image to generate or edit.'
            },
            images: {
                type: 'array',
                maxItems: 6,
                items: { $ref: '#/components/schemas/FileReference' },
                description: 'Reference images supplied by URL or managed file key.'
            },
            n: {
                type: 'integer',
                minimum: 1,
                maximum: 4,
                default: 1,
                description: 'Number of image generation tasks to create.'
            },
            ...resolutionProperties,
            aspect_ratio: {
                type: 'string',
                enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
                example: '1:1',
                description: 'Target image width-to-height ratio.'
            },
            extra_body: {
                $ref: '#/components/schemas/ExtraBody',
                description: 'Provider parameters forwarded after key, size, depth, and payload validation.'
            }
        }
    };

    components.schemas.VideoGenerationJsonRequest = {
        type: 'object',
        required: ['model', 'prompt'],
        additionalProperties: false,
        not: { required: ['resolution', 'size'] },
        properties: {
            model: {
                type: 'string',
                minLength: 1,
                example: 'provider/model-id',
                description: 'Model identifier returned by GET /openapi/v1/models.'
            },
            prompt: {
                type: 'string',
                minLength: 1,
                description: 'Text instruction describing the video to generate.'
            },
            images: {
                type: 'array',
                maxItems: 6,
                items: { $ref: '#/components/schemas/FileReference' },
                description: 'Reference images supplied by URL or managed file key.'
            },
            duration_seconds: {
                type: 'integer',
                minimum: 4,
                maximum: 15,
                default: 5,
                description: 'Target video duration in seconds.'
            },
            n: {
                type: 'integer',
                minimum: 1,
                maximum: 4,
                default: 1,
                description: 'Number of video generation tasks to create.'
            },
            ...resolutionProperties,
            resolution: {
                ...resolutionProperties.resolution,
                enum: ['480p', '720p', '1080p', '1K', '2K'],
                example: '720p'
            },
            aspect_ratio: {
                type: 'string',
                enum: ['16:9', '9:16', '1:1', '4:3', '3:4'],
                example: '16:9',
                description: 'Target video width-to-height ratio.'
            },
            extra_body: {
                $ref: '#/components/schemas/ExtraBody',
                description: 'Provider parameters forwarded after key, size, depth, and payload validation.'
            }
        }
    };

    components.schemas.ThreeDGenerationRequest = {
        type: 'object',
        required: ['model'],
        additionalProperties: false,
        anyOf: [
            { required: ['prompt'] },
            { required: ['images'] }
        ],
        properties: {
            model: {
                type: 'string',
                minLength: 1,
                example: 'provider/model-id',
                description: 'Model identifier returned by GET /openapi/v1/models.'
            },
            prompt: {
                type: 'string',
                minLength: 1,
                description: 'Text instruction describing the 3D model to generate.'
            },
            images: {
                type: 'array',
                minItems: 1,
                maxItems: 1,
                items: { $ref: '#/components/schemas/FileReference' },
                description: 'One reference image supplied by URL or managed file key.'
            },
            with_texture: {
                type: 'boolean',
                default: true,
                description: 'Whether to generate texture data for the model.'
            },
            with_pbr: {
                type: 'boolean',
                default: true,
                description: 'Whether to generate PBR material data for the model.'
            },
            target_polycount: {
                type: 'integer',
                minimum: 100000,
                maximum: 1000000,
                description: 'Target face count. standard supports 100000 to 500000; high and extra_high support 500000 to 1000000.'
            },
            mesh_quality: {
                type: 'string',
                enum: ['standard', 'high', 'extra_high'],
                default: 'high',
                description: 'Target mesh quality level.'
            },
            art_style: {
                type: 'string',
                enum: ['standard', 'chibi'],
                default: 'standard',
                example: 'chibi',
                description: 'Style instruction for the 3D output, including chibi-style generation.'
            },
            n: {
                type: 'integer',
                minimum: 1,
                maximum: 4,
                default: 1,
                description: 'Number of 3D generation tasks to create.'
            }
        }
    };

    components.schemas.Texture3DModelRequest = {
        type: 'object',
        required: ['id'],
        additionalProperties: false,
        anyOf: [
            { required: ['prompt'] },
            { required: ['image'] }
        ],
        properties: {
            id: {
                type: 'string',
                format: 'uuid',
                description: 'ID of a completed 3D model.'
            },
            prompt: {
                type: 'string',
                minLength: 1,
                description: 'Text instruction describing the texture to generate.'
            },
            image: {
                $ref: '#/components/schemas/FileReference',
                description: 'One reference image supplied by URL or managed file key.'
            }
        }
    };
    components.schemas.Refine3DModelRequest = {
        type: 'object',
        required: ['id'],
        additionalProperties: false,
        properties: {
            id: {
                type: 'string',
                format: 'uuid',
                description: 'ID of a completed 3D model.'
            },
            quality: {
                type: 'string',
                enum: ['extra_high'],
                default: 'extra_high',
                description: 'Target mesh quality for the refine task.'
            }
        }
    };
    components.schemas.Pbr3DModelRequest = {
        type: 'object',
        required: ['id'],
        additionalProperties: false,
        properties: {
            id: {
                type: 'string',
                format: 'uuid',
                description: 'ID of a completed 3D model.'
            }
        }
    };
    components.schemas.Remesh3DModelRequest = {
        type: 'object',
        required: ['id', 'target_polycount'],
        additionalProperties: false,
        properties: {
            id: {
                type: 'string',
                format: 'uuid',
                description: 'ID of a completed 3D model.'
            },
            target_polycount: {
                type: 'integer',
                minimum: 1,
                description: 'Target face count passed to the remesh pipeline.'
            }
        }
    };

    components.schemas.ModelArchitecture = {
        type: 'object',
        required: ['input_modalities', 'output_modalities'],
        additionalProperties: false,
        properties: {
            input_modalities: {
                type: 'array',
                items: { type: 'string' },
                description: 'Input modalities published for this model.'
            },
            output_modalities: {
                type: 'array',
                items: { type: 'string' },
                description: 'Output modalities published for this model.'
            }
        }
    };
    components.schemas.Model = {
        type: 'object',
        required: [
            'id',
            'object',
            'created_at',
            'updated_at',
            'owned_by',
            'architecture',
            'supported_parameters',
            'default_parameters'
        ],
        properties: {
            id: {
                type: 'string',
                description: 'Public model identifier used in generation requests.'
            },
            object: {
                type: 'string',
                enum: ['model'],
                description: 'Object discriminator. Always model.'
            },
            created_at: {
                type: 'integer',
                format: 'int64',
                description: 'Unix timestamp in seconds when the model entry was created.'
            },
            updated_at: {
                type: 'integer',
                format: 'int64',
                description: 'Unix timestamp in seconds when the model entry was updated.'
            },
            owned_by: {
                type: 'string',
                description: 'Provider or organization that owns the model.'
            },
            name: {
                type: 'string',
                description: 'Display name of the model.'
            },
            description: {
                type: 'string',
                description: 'Model description maintained by the model registry.'
            },
            architecture: {
                $ref: '#/components/schemas/ModelArchitecture',
                description: 'Input and output modalities maintained by the runtime model registry.'
            },
            supported_parameters: {
                type: 'array',
                items: { type: 'string' },
                description: 'Request parameter names maintained by the runtime model registry.'
            },
            default_parameters: {
                type: 'object',
                additionalProperties: true,
                description: 'Default request parameter values maintained by the runtime model registry.'
            }
        }
    };
    delete components.schemas.ModelCapabilities;
    paths['/openapi/v1/models'].get.description = 'Returns enabled entries from the runtime model registry. The example lists the models and request parameters currently published by the service.';
    paths['/openapi/v1/models'].get.responses['200'].content['application/json'].example = {
        object: 'list',
        data: [
            {
                id: 'openai/gpt-image-2',
                object: 'model',
                created_at: 1784044800,
                updated_at: 1784044800,
                owned_by: 'openai',
                name: 'GPT Image 2',
                architecture: {
                    input_modalities: ['text', 'image'],
                    output_modalities: ['image']
                },
                supported_parameters: ['prompt', 'images', 'n', 'resolution', 'size', 'aspect_ratio', 'extra_body'],
                default_parameters: { n: 1, resolution: '1K', aspect_ratio: '1:1' }
            },
            {
                id: 'google/nano-banana-pro',
                object: 'model',
                created_at: 1784044800,
                updated_at: 1784044800,
                owned_by: 'google',
                name: 'Nano Banana Pro',
                architecture: {
                    input_modalities: ['text', 'image'],
                    output_modalities: ['image']
                },
                supported_parameters: ['prompt', 'images', 'n', 'resolution', 'size', 'aspect_ratio', 'extra_body'],
                default_parameters: { n: 1, resolution: '1K', aspect_ratio: '1:1' }
            },
            {
                id: 'bytedance/seedance-2.0',
                object: 'model',
                created_at: 1784044800,
                updated_at: 1784044800,
                owned_by: 'bytedance',
                name: 'Seedance 2.0',
                architecture: {
                    input_modalities: ['text', 'image'],
                    output_modalities: ['video']
                },
                supported_parameters: ['prompt', 'images', 'duration_seconds', 'n', 'resolution', 'size', 'aspect_ratio', 'extra_body'],
                default_parameters: { duration_seconds: 5, n: 1, resolution: '720p', aspect_ratio: '16:9' }
            },
            {
                id: 'dreamtech/neural4d-2.5',
                object: 'model',
                created_at: 1784044800,
                updated_at: 1784044800,
                owned_by: 'dreamtech',
                name: 'Neural4D 2.5',
                architecture: {
                    input_modalities: ['text', 'image'],
                    output_modalities: ['3dmodel']
                },
                supported_parameters: [
                    'prompt',
                    'images',
                    'with_texture',
                    'with_pbr',
                    'target_polycount',
                    'mesh_quality',
                    'art_style',
                    'n'
                ],
                default_parameters: {
                    with_texture: true,
                    with_pbr: true,
                    mesh_quality: 'high',
                    art_style: 'standard',
                    n: 1
                }
            }
        ]
    };

    for (const schemaName of ['Task', 'UsageRecord']) {
        if (components.schemas[schemaName]?.properties?.model) {
            delete components.schemas[schemaName].properties.model.enum;
        }
    }
    components.schemas.Task.properties.progress = {
        type: 'number',
        format: 'float',
        minimum: 0,
        maximum: 100,
        description: 'Task completion percentage from 0 to 100.'
    };
    components.schemas.Task.properties.result = {
        $ref: '#/components/schemas/TaskOutput',
        description: 'Task result returned after asynchronous processing completes.'
    };
    delete components.schemas.Task.properties.input;
    delete components.schemas.Task.properties.output;
    components.schemas.TaskReceipt = clone(components.schemas.Task);
    components.schemas.TaskReceipt.required = (components.schemas.TaskReceipt.required || []).filter(
        (field) => !['input', 'output', 'result'].includes(field)
    );
    delete components.schemas.TaskReceipt.properties.input;
    delete components.schemas.TaskReceipt.properties.output;
    delete components.schemas.TaskReceipt.properties.result;
    components.schemas.TaskList.properties.data.items = { $ref: '#/components/schemas/TaskReceipt' };
    components.schemas.TaskType.enum = [
        'image.generation',
        'video.generation',
        '3dmodel.generation',
        '3dmodel.edit.refine',
        '3dmodel.edit.texture',
        '3dmodel.edit.pbr',
        '3dmodel.edit.remesh',
        '3dmodel.convert'
    ];

    const imageOperation = paths['/openapi/v1/images/generations'].post;
    imageOperation.description = 'Creates asynchronous image generation tasks. Reference images use HTTPS URLs or managed file keys. Named resolution and pixel size are mutually exclusive.';
    imageOperation.requestBody = {
        required: true,
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/ImageGenerationJsonRequest' },
                examples: {
                    named_resolution: {
                        summary: 'Use a named resolution and managed file references',
                        value: {
                            model: 'openai/gpt-image-2',
                            prompt: 'A ceramic teapot on a white studio background',
                            images: [
                                { fileKey: 'openapi/files/reference-front.png' },
                                { url: 'https://assets.example.com/reference-side.png' }
                            ],
                            n: 1,
                            resolution: '1K',
                            aspect_ratio: '1:1',
                            extra_body: { provider_option: 'value' }
                        }
                    },
                    pixel_size: {
                        summary: 'Use an explicit pixel size',
                        value: {
                            model: 'openai/gpt-image-2',
                            prompt: 'A ceramic teapot on a white studio background',
                            images: [{ fileKey: 'openapi/files/reference-front.png' }],
                            n: 1,
                            size: '2048x2048',
                            aspect_ratio: '1:1',
                            extra_body: { provider_option: 'value' }
                        }
                    }
                }
            }
        }
    };

    const videoOperation = paths['/openapi/v1/videos/generations'].post;
    videoOperation.description = 'Creates asynchronous video generation tasks. Reference images use HTTPS URLs or managed file keys. Named resolution and pixel size are mutually exclusive.';
    videoOperation.requestBody = {
        required: true,
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/VideoGenerationJsonRequest' },
                examples: {
                    named_resolution: {
                        summary: 'Use a named resolution and a URL reference',
                        value: {
                            model: 'bytedance/seedance-2.0',
                            prompt: 'A slow orbit around a ceramic teapot',
                            images: [{ url: 'https://assets.example.com/first-frame.png' }],
                            duration_seconds: 5,
                            n: 1,
                            resolution: '720p',
                            aspect_ratio: '16:9',
                            extra_body: { provider_option: 'value' }
                        }
                    },
                    pixel_size: {
                        summary: 'Use an explicit pixel size and a managed file reference',
                        value: {
                            model: 'bytedance/seedance-2.0',
                            prompt: 'A slow orbit around a ceramic teapot',
                            images: [{ fileKey: 'openapi/files/first-frame.png' }],
                            duration_seconds: 5,
                            n: 1,
                            size: '1920x1080',
                            aspect_ratio: '16:9',
                            extra_body: { provider_option: 'value' }
                        }
                    }
                }
            }
        }
    };

    const threeDOperation = paths['/openapi/v1/3dmodels/generations'].post;
    threeDOperation.description = 'Creates asynchronous text-to-3D, image-to-3D, or styled 3D generation tasks. Image inputs use one HTTPS URL or managed file key.';
    threeDOperation.requestBody = {
        required: true,
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/ThreeDGenerationRequest' },
                example: {
                    model: 'dreamtech/neural4d-2.5',
                    prompt: 'A stylized ceramic teapot',
                    images: [{ fileKey: 'openapi/files/teapot-reference.png' }],
                    art_style: 'chibi',
                    target_polycount: 500000,
                    mesh_quality: 'high',
                    with_texture: true,
                    with_pbr: true,
                    n: 1
                }
            }
        }
    };

    const textureOperation = paths['/openapi/v1/3dmodels/texture'].post;
    textureOperation.description = 'Creates a texture task from a prompt or one reference image supplied by HTTPS URL or managed file key.';
    textureOperation.requestBody = {
        required: true,
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/Texture3DModelRequest' },
                example: {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    image: { url: 'https://assets.example.com/texture-reference.png' }
                }
            }
        }
    };
    paths['/openapi/v1/3dmodels/refine'].post.description = 'Creates a refine task for a completed 3D model.';
    paths['/openapi/v1/3dmodels/pbr'].post.description = 'Creates a PBR material task for a completed 3D model.';
    paths['/openapi/v1/3dmodels/remesh'].post.description = 'Creates a remesh task using the requested target face count.';

    const taskPath = paths['/openapi/v1/tasks/{id}'];
    delete taskPath.delete;
    taskPath.get.description = 'Returns the current task status, progress, result, usage, and error details by task ID.';
    taskPath.get.parameters = [idParameter('Task ID.')];
    const taskExample = taskPath.get.responses['200']?.content?.['application/json']?.example;
    if (taskExample?.output) {
        taskExample.result = taskExample.output;
        delete taskExample.output;
    }

    components.schemas.ManagedFile = {
        type: 'object',
        required: ['id', 'object', 'fileKey', 'status', 'created_at', 'updated_at'],
        properties: {
            id: { type: 'string', format: 'uuid', description: 'Managed file ID.' },
            object: { type: 'string', enum: ['file'], description: 'Object discriminator. Always file.' },
            fileKey: { type: 'string', description: 'Internal managed file key used by generation tasks.' },
            filename: { type: 'string', description: 'Stored file name when available.' },
            bytes: { type: 'integer', format: 'int64', minimum: 0, description: 'Stored file size in bytes.' },
            mime_type: { type: 'string', description: 'Stored media type.' },
            status: {
                type: 'string',
                enum: ['uploaded', 'processed', 'error'],
                description: 'Current managed file status.'
            },
            created_at: {
                type: 'integer',
                format: 'int64',
                description: 'Unix timestamp in seconds when the file was created.'
            },
            updated_at: {
                type: 'integer',
                format: 'int64',
                description: 'Unix timestamp in seconds when the file was updated.'
            }
        }
    };
    components.schemas.ManagedFileList = {
        type: 'object',
        required: ['object', 'data', 'first_id', 'last_id', 'has_more'],
        properties: {
            object: { type: 'string', enum: ['list'], description: 'Object discriminator. Always list.' },
            data: {
                type: 'array',
                items: { $ref: '#/components/schemas/ManagedFile' },
                description: 'Managed files visible to the authenticated account.'
            },
            first_id: {
                type: 'string',
                nullable: true,
                description: 'ID of the first file in this page, or null when the page is empty.'
            },
            last_id: {
                type: 'string',
                nullable: true,
                description: 'ID of the last file in this page, or null when the page is empty.'
            },
            has_more: { type: 'boolean', description: 'Whether another page of managed files is available.' }
        }
    };
    components.schemas.CreateManagedFileRequest = {
        type: 'object',
        required: ['file'],
        additionalProperties: false,
        properties: {
            file: {
                type: 'string',
                format: 'binary',
                description: 'Local file content uploaded to managed storage.'
            }
        }
    };
    components.schemas.Convert3DModelRequest = {
        type: 'object',
        required: ['target_format'],
        additionalProperties: false,
        properties: {
            target_format: {
                type: 'string',
                enum: ['glb', 'obj', 'fbx', 'stl', 'usdz', 'blend'],
                description: 'Target 3D model format.'
            },
            model_size: {
                type: 'number',
                minimum: 0,
                description: 'Model size in millimeters.'
            }
        }
    };

    const sourceFileOperation = paths['/openapi/v1/3dmodels/{id}/files']?.get
        || paths['/openapi/v1/files/{id}']?.get;
    const sourceConvertOperation = paths['/openapi/v1/3dmodels/{id}/convert']?.post
        || paths['/openapi/v1/files/convert']?.post;
    if (!sourceFileOperation || !sourceConvertOperation) {
        throw new Error('Missing source operations for 3D file access or conversion');
    }
    delete paths['/openapi/v1/files/{id}'];
    delete paths['/openapi/v1/files/convert'];

    paths['/openapi/v1/files'] = {
        get: {
            tags: ['Files'],
            summary: 'List managed files',
            description: 'Returns managed input files recorded for the authenticated account.',
            operationId: 'listFiles',
            ...operationContext(),
            parameters: [
                {
                    name: 'limit',
                    in: 'query',
                    description: 'Maximum number of files returned.',
                    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
                },
                {
                    name: 'after',
                    in: 'query',
                    description: 'File ID used as the pagination cursor.',
                    schema: { type: 'string', format: 'uuid' }
                }
            ],
            responses: {
                '200': successResponse('Managed file list', 'ManagedFileList', {
                    object: 'list',
                    data: [
                        {
                            id: '550e8400-e29b-41d4-a716-446655440000',
                            object: 'file',
                            fileKey: 'openapi/files/550e8400-e29b-41d4-a716-446655440000/reference.png',
                            filename: 'reference.png',
                            bytes: 245760,
                            mime_type: 'image/png',
                            status: 'processed',
                            created_at: 1784044800,
                            updated_at: 1784044800
                        }
                    ],
                    first_id: '550e8400-e29b-41d4-a716-446655440000',
                    last_id: '550e8400-e29b-41d4-a716-446655440000',
                    has_more: false
                }),
                ...standardErrors()
            }
        },
        post: {
            tags: ['Files'],
            summary: 'Create a managed file',
            description: 'Uploads one local file to managed storage and records the resulting file key.',
            operationId: 'createFile',
            ...operationContext(),
            requestBody: {
                required: true,
                content: {
                    'multipart/form-data': {
                        schema: { $ref: '#/components/schemas/CreateManagedFileRequest' },
                        example: {
                            file: '<binary>'
                        }
                    }
                }
            },
            responses: {
                '201': successResponse('Managed file created', 'ManagedFile', {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    object: 'file',
                    fileKey: 'openapi/files/550e8400-e29b-41d4-a716-446655440000/reference.png',
                    filename: 'reference.png',
                    bytes: 245760,
                    mime_type: 'image/png',
                    status: 'processed',
                    created_at: 1784044800,
                    updated_at: 1784044800
                }),
                ...standardErrors()
            }
        }
    };
    paths['/openapi/v1/files/{id}'] = {
        get: {
            tags: ['Files'],
            summary: 'Retrieve a managed file',
            description: 'Returns one managed input file record by ID.',
            operationId: 'getFile',
            ...operationContext(),
            parameters: [idParameter('Managed file ID.')],
            responses: {
                '200': successResponse('Managed file details', 'ManagedFile'),
                ...standardErrors(true)
            }
        }
    };

    sourceConvertOperation.tags = ['3D models'];
    sourceConvertOperation.summary = 'Convert a 3D model format';
    sourceConvertOperation.description = 'Creates an asynchronous format conversion task for a completed 3D model.';
    sourceConvertOperation.operationId = 'convert3DModel';
    sourceConvertOperation.parameters = [idParameter('Completed 3D model ID.')];
    sourceConvertOperation.requestBody = {
        required: true,
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/Convert3DModelRequest' },
                example: { target_format: 'obj', model_size: 2 }
            }
        }
    };
    paths['/openapi/v1/3dmodels/{id}/convert'] = { post: sourceConvertOperation };

    sourceFileOperation.tags = ['3D models'];
    sourceFileOperation.summary = 'Retrieve 3D model files';
    sourceFileOperation.description = 'Returns temporary signed URLs for files generated from a completed 3D model.';
    sourceFileOperation.operationId = 'get3DModelFiles';
    sourceFileOperation.parameters = [idParameter('Completed 3D model ID.')];
    paths['/openapi/v1/3dmodels/{id}/files'] = { get: sourceFileOperation };

    components.schemas.CreditBalance = {
        type: 'object',
        required: [
            'total_credits',
            'monthly_bonus_credits',
            'permanent_credits',
            'annual_credits',
            'updated_at'
        ],
        properties: {
            total_credits: {
                type: 'number',
                minimum: 0,
                description: 'Total credits currently available to the account.'
            },
            monthly_bonus_credits: {
                type: 'number',
                minimum: 0,
                description: 'Monthly bonus credits currently available.'
            },
            permanent_credits: {
                type: 'number',
                minimum: 0,
                description: 'Permanent credits currently available.'
            },
            annual_credits: {
                type: 'number',
                minimum: 0,
                description: 'Annual-plan credits currently available.'
            },
            expires_at: {
                type: 'integer',
                format: 'int64',
                nullable: true,
                description: 'Unix timestamp for the nearest expiring credit balance, or null when no balance expires.'
            },
            updated_at: {
                type: 'integer',
                format: 'int64',
                description: 'Unix timestamp in seconds when the credit balance was updated.'
            }
        }
    };
    components.schemas.CreditsResponse = {
        type: 'object',
        required: ['data'],
        properties: {
            data: {
                $ref: '#/components/schemas/CreditBalance',
                description: 'Current credit balance details.'
            }
        }
    };
    delete components.schemas.Balance;
    delete components.schemas.BalanceBucket;
    delete paths['/openapi/v1/balance'];
    paths['/openapi/v1/credits'] = {
        get: {
            tags: ['Credits'],
            summary: 'Retrieve credits',
            description: 'Returns the current credit balance using the account credit categories exposed by the existing points service.',
            operationId: 'getCredits',
            ...operationContext(),
            parameters: [],
            responses: {
                '200': successResponse('Current credits', 'CreditsResponse', {
                    data: {
                        total_credits: 3200,
                        monthly_bonus_credits: 1200,
                        permanent_credits: 2000,
                        annual_credits: 0,
                        expires_at: 1785542400,
                        updated_at: 1784044800
                    }
                }),
                ...standardErrors()
            }
        }
    };

    for (const parameter of paths['/openapi/v1/usage'].get.parameters || []) {
        if (parameter.name === 'model' && parameter.schema) {
            delete parameter.schema.enum;
        }
    }

    components.parameters = components.parameters || {};
    for (const [route, pathItem] of Object.entries(paths)) {
        for (const [methodName, operation] of Object.entries(pathItem)) {
            if (!operation || !operation.responses) {
                continue;
            }
            delete operation.security;
            operation.parameters = (operation.parameters || []).filter(
                (parameter) => parameter.$ref !== '#/components/parameters/AuthorizationHeader'
                    && String(parameter.name || '').toLowerCase() !== 'authorization'
            );
            delete operation['x-codeSamples'];
        }
    }

    delete components.parameters?.AuthorizationHeader;

    delete components.schemas.ModelFile?.properties?.mesh_type;

    function normalizeExamples(value) {
        if (!value || typeof value !== 'object') {
            return;
        }
        for (const [key, child] of Object.entries(value)) {
            if (child === 'The requested model is not available to this API key') {
                value[key] = 'Model access is restricted for this API key';
            } else {
                normalizeExamples(child);
            }
        }
        if (value.object === 'task') {
            delete value.input;
            if (value.output !== undefined && value.result === undefined) {
                value.result = value.output;
            }
            delete value.output;
        }
    }
    normalizeExamples(paths);
    normalizeExamples(components);

    function addTaskProgressExamples(value) {
        if (!value || typeof value !== 'object') {
            return;
        }
        if (value.object === 'task' && value.progress == null) {
            value.progress = value.status === 'succeeded' ? 100 : 0;
        }
        Object.values(value).forEach(addTaskProgressExamples);
    }
    addTaskProgressExamples(paths);

    for (const schemaName of [
        'ImageGenerationMultipartRequest',
        'VideoGenerationMultipartRequest',
        'TextTo3DGenerationRequest',
        'ImageTo3DGenerationRequest',
        'ConvertFileRequest'
    ]) {
        delete components.schemas[schemaName];
    }
}

function renameSchemaProperty(schema, from, to, description) {
    if (!schema?.properties?.[from]) {
        return;
    }

    const renamed = {
        ...schema.properties[from],
        description
    };
    schema.properties = Object.fromEntries(
        Object.entries(schema.properties).map(([name, value]) => (
            name === from ? [to, renamed] : [name, value]
        ))
    );
    schema.required = (schema.required || []).map((name) => (name === from ? to : name));
}

function applyTaskIdentityContract(paths, components) {
    const taskIdExample = 'normal-video-c50fe63e-699d-4d61-93f5-2099ab159d6d';
    const childUuidExample = '7d1fa4bb-41e6-4a5d-88d8-1851f5342e87';

    for (const [schemaName, description] of [
        ['ImageFile', 'Generated image child UUID.'],
        ['VideoFile', 'Generated video child UUID.'],
        ['ModelFile', 'Generated 3D model child UUID.']
    ]) {
        const schema = components.schemas[schemaName];
        if (!schema) {
            continue;
        }
        const source = schema.properties.uuid || schema.properties.id || {};
        const remainingProperties = Object.fromEntries(
            Object.entries(schema.properties).filter(([name]) => !['id', 'uuid'].includes(name))
        );
        schema.properties = {
            uuid: {
                ...source,
                type: 'string',
                format: 'uuid',
                example: childUuidExample,
                description
            },
            ...remainingProperties
        };
        schema.required = [
            'uuid',
            ...(schema.required || []).filter((name) => !['id', 'uuid'].includes(name))
        ];
    }

    const task = components.schemas.Task;
    task.properties.id = {
        type: 'string',
        example: taskIdExample,
        description: 'Batch task ID returned by a generation request.'
    };
    renameSchemaProperty(
        task,
        'result',
        'output',
        'Generated output returned after asynchronous processing completes.'
    );

    renameSchemaProperty(
        components.schemas.TaskReceipt,
        'id',
        'uuid',
        'Generated child item UUID.'
    );

    const taskList = components.schemas.TaskList;
    taskList.properties = {
        id: {
            type: 'string',
            example: taskIdExample,
            description: 'Batch task ID returned by the generation request.'
        },
        ...taskList.properties
    };
    taskList.required = ['id', ...(taskList.required || []).filter((name) => name !== 'id')];
    taskList.properties.data.description = 'Generated child items created by the request.';

    for (const schemaName of [
        'Refine3DModelRequest',
        'Texture3DModelRequest',
        'Pbr3DModelRequest',
        'Remesh3DModelRequest'
    ]) {
        renameSchemaProperty(
            components.schemas[schemaName],
            'id',
            'uuid',
            'UUID of the completed 3D model to edit.'
        );
    }

    for (const route of [
        '/openapi/v1/3dmodels/refine',
        '/openapi/v1/3dmodels/texture',
        '/openapi/v1/3dmodels/pbr',
        '/openapi/v1/3dmodels/remesh'
    ]) {
        const media = paths[route]?.post?.requestBody?.content?.['application/json'];
        const examples = [media?.example, ...Object.values(media?.examples || {}).map((item) => item.value)];
        for (const example of examples) {
            if (example?.id) {
                example.uuid = example.id;
                delete example.id;
            }
        }
    }

    for (const [route, pathItem] of Object.entries(paths)) {
        for (const operation of Object.values(pathItem)) {
            const response = operation?.responses?.['202'];
            const media = response?.content?.['application/json'];
            if (media?.schema?.$ref !== '#/components/schemas/TaskList' || !media.example) {
                continue;
            }
            const prefix = route.includes('/images/')
                ? 'normal-image'
                : (route.includes('/videos/') ? 'normal-video' : '3d-task');
            media.example.id = `${prefix}-c50fe63e-699d-4d61-93f5-2099ab159d6d`;
            for (const item of media.example.data || []) {
                item.uuid = item.id || childUuidExample;
                delete item.id;
            }
        }
    }

    const oldTaskPath = '/openapi/v1/tasks/{id}';
    const taskInfoPath = '/openapi/v1/tasks/task-info';
    const taskOperation = paths[oldTaskPath]?.get;
    if (!taskOperation) {
        throw new Error('The full v1 backup must contain task retrieval');
    }
    delete paths[oldTaskPath];
    paths[taskInfoPath] = { get: taskOperation };
    taskOperation.operationId = 'getTaskInfo';
    taskOperation.description = 'Returns task status and output by batch task ID.';
    taskOperation.parameters = [
        {
            name: 'id',
            in: 'query',
            required: true,
            description: 'Batch task ID returned by a generation request.',
            schema: {
                type: 'string',
                example: taskIdExample
            }
        }
    ];
    const taskExample = taskOperation.responses['200']?.content?.['application/json']?.example;
    if (taskExample) {
        taskExample.id = taskIdExample;
        if (taskExample.result !== undefined && taskExample.output === undefined) {
            taskExample.output = taskExample.result;
        }
        delete taskExample.result;
        for (const collectionName of ['images', 'videos', 'models']) {
            for (const item of taskExample.output?.[collectionName] || []) {
                item.uuid = item.uuid || item.id || childUuidExample;
                delete item.id;
            }
        }
    }

    for (const schemaName of ['ImageFile', 'VideoFile', 'ModelFile', 'TaskReceipt']) {
        const schema = components.schemas[schemaName];
        if (!schema?.properties?.uuid || schema.properties.id) {
            throw new Error(`${schemaName} must expose uuid and must not expose id`);
        }
    }
    for (const schemaName of [
        'Refine3DModelRequest',
        'Texture3DModelRequest',
        'Pbr3DModelRequest',
        'Remesh3DModelRequest'
    ]) {
        const schema = components.schemas[schemaName];
        if (!schema?.properties?.uuid || schema.properties.id || !schema.required?.includes('uuid')) {
            throw new Error(`${schemaName} must use uuid as the 3D edit handle`);
        }
    }
}

function exposeVideoOnlyV1(paths, components) {
    const filePath = '/openapi/v1/files';
    const videoPath = '/openapi/v1/videos/generations';
    const taskPath = '/openapi/v1/tasks/task-info';
    const fileOperation = paths[filePath]?.post;
    const videoOperation = paths[videoPath]?.post;
    const taskOperation = paths[taskPath]?.get;

    if (!fileOperation || !videoOperation || !taskOperation) {
        throw new Error('The full v1 backup must contain file upload, video generation, and task retrieval');
    }

    const videoRequest = components.schemas.VideoGenerationJsonRequest;
    delete videoRequest.properties.type;
    delete videoRequest.properties.mode;
    videoRequest.required = ['model', 'prompt'];
    delete videoRequest.anyOf;
    videoRequest.properties.model = {
        type: 'string',
        enum: publicVideoModels,
        example: publicVideoModels[0],
        description: 'Video generation model identifier.'
    };
    videoRequest.properties.prompt.minLength = 1;
    videoRequest.properties.prompt.maxLength = 1000;
    videoRequest.properties.prompt.description =
        schemaFieldDescriptions.VideoGenerationJsonRequest.prompt[0];
    const fileIdProperty = {
        type: 'string',
        pattern: fileIdPattern,
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'File ID returned by the file upload endpoint.'
    };
    const createTypedReferenceSchema = (mediaType, fileDescription) => ({
        type: 'object',
        required: ['type', 'file_id'],
        additionalProperties: false,
        properties: {
            type: {
                type: 'string',
                enum: [mediaType],
                description: `Media type of this reference. Always ${mediaType}.`
            },
            file_id: { ...fileIdProperty, description: fileDescription }
        }
    });

    components.schemas.VideoFrameImage = {
        type: 'object',
        required: ['type', 'frame_type', 'file_id'],
        additionalProperties: false,
        properties: {
            type: {
                type: 'string',
                enum: ['image'],
                description: 'Media type of the frame asset. Always image.'
            },
            frame_type: {
                type: 'string',
                enum: ['first_frame', 'last_frame'],
                description: 'Position represented by this image: first_frame or last_frame.'
            },
            file_id: {
                ...fileIdProperty,
                description: schemaFieldDescriptions.VideoFrameImage.file_id[0]
            }
        }
    };
    components.schemas.VideoImageReference = createTypedReferenceSchema(
        'image',
        schemaFieldDescriptions.VideoImageReference.file_id[0]
    );
    components.schemas.VideoVideoReference = createTypedReferenceSchema(
        'video',
        schemaFieldDescriptions.VideoVideoReference.file_id[0]
    );
    components.schemas.VideoAudioReference = createTypedReferenceSchema(
        'audio',
        schemaFieldDescriptions.VideoAudioReference.file_id[0]
    );
    components.schemas.VideoInputReference = {
        oneOf: [
            { $ref: '#/components/schemas/VideoImageReference' },
            { $ref: '#/components/schemas/VideoVideoReference' },
            { $ref: '#/components/schemas/VideoAudioReference' }
        ],
        discriminator: {
            propertyName: 'type',
            mapping: {
                image: '#/components/schemas/VideoImageReference',
                video: '#/components/schemas/VideoVideoReference',
                audio: '#/components/schemas/VideoAudioReference'
            }
        },
        description: 'One typed image, video, or audio reference using a file ID returned by the file upload endpoint.'
    };
    delete videoRequest.properties.images;
    delete videoRequest.properties.asset_refs;
    videoRequest.properties.frame_images = {
        type: 'array',
        minItems: 1,
        maxItems: 2,
        items: { $ref: '#/components/schemas/VideoFrameImage' },
        description: schemaFieldDescriptions.VideoGenerationJsonRequest.frame_images[0]
    };
    videoRequest.properties.input_references = {
        type: 'array',
        minItems: 1,
        maxItems: 12,
        items: { $ref: '#/components/schemas/VideoInputReference' },
        description: videoModelFieldDescriptions.input_references[0]
    };
    videoRequest.properties.duration = {
        type: 'integer',
        minimum: 1,
        description: 'Optional duration in seconds. Allowed values and the default are defined by the selected model.'
    };
    videoRequest.properties.output_with_audio = {
        type: 'boolean',
        description: videoModelFieldDescriptions.output_with_audio[0]
    };
    videoRequest.properties.resolution.enum = publicVideoResolutions;
    videoRequest.properties.resolution.description = videoModelFieldDescriptions.resolution[0];
    videoRequest.properties.aspect_ratio.enum = publicVideoAspectRatios;
    videoRequest.properties.aspect_ratio.description = videoModelFieldDescriptions.aspect_ratio[0];
    videoRequest.properties.model.description = videoModelFieldDescriptions.model[0];
    delete videoRequest.properties.extra_body;
    delete videoRequest.properties.duration_seconds;
    delete videoRequest.properties.size;
    delete videoRequest.not;
    const videoParameterSchemaNames = {
        'bytedance/seedance-2.0': 'Seedance20VideoParameters',
        'bytedance/seedance-2.0-fast': 'Seedance20FastVideoParameters',
        'google/veo-3.1': 'Veo31VideoParameters',
        'xai/grok-imagine': 'GrokImagineVideoParameters'
    };
    for (const [model, capability] of Object.entries(publicVideoModelCapabilities)) {
        components.schemas[videoParameterSchemaNames[model]] = {
            type: 'object',
            required: ['model'],
            properties: {
                model: {
                    type: 'string',
                    enum: [model],
                    description: videoModelFieldDescriptions.model[0]
                },
                resolution: {
                    type: 'string',
                    enum: capability.resolutions,
                    default: capability.defaults.resolution,
                    description: videoModelFieldDescriptions.resolution[0]
                },
                aspect_ratio: {
                    type: 'string',
                    enum: capability.aspectRatios,
                    default: capability.defaults.aspectRatio,
                    description: videoModelFieldDescriptions.aspect_ratio[0]
                },
                duration: {
                    type: 'integer',
                    minimum: capability.durations[0],
                    maximum: capability.durations[capability.durations.length - 1],
                    enum: capability.durations,
                    default: capability.defaults.duration,
                    description: videoModelFieldDescriptions.duration[0]
                },
                ...(capability.supportsOutputWithAudio ? {
                    output_with_audio: {
                        type: 'boolean',
                        default: capability.defaults.outputWithAudio,
                        description: videoModelOutputWithAudioDescriptions[model][0]
                    }
                } : {})
            },
            ...(capability.supportsOutputWithAudio ? {} : {
                not: { required: ['output_with_audio'] }
            })
        };
    }
    videoRequest.allOf = [{
        oneOf: publicVideoModels.map((model) => ({
            $ref: `#/components/schemas/${videoParameterSchemaNames[model]}`
        })),
        discriminator: {
            propertyName: 'model',
            mapping: Object.fromEntries(publicVideoModels.map((model) => [
                model,
                `#/components/schemas/${videoParameterSchemaNames[model]}`
            ]))
        }
    }];

    videoOperation.description = 'Creates asynchronous video generation tasks. Generation behavior is inferred from the required prompt, frame images, and typed reference assets.';
    videoOperation.requestBody.content['application/json'].examples = {
        text_to_video: {
            summary: 'Generate a video from text',
            value: {
                model: 'xai/grok-imagine',
                prompt: 'A cinematic tracking shot through a neon-lit street at night',
                duration: 6,
                n: 1,
                resolution: '720p',
                aspect_ratio: '16:9'
            }
        },
        first_frame_image_to_video: {
            summary: 'Animate an uploaded first-frame image',
            value: {
                model: 'bytedance/seedance-2.0',
                prompt: 'The camera slowly pushes in while soft wind moves the leaves',
                frame_images: [
                    {
                        type: 'image',
                        frame_type: 'first_frame',
                        file_id: '550e8400-e29b-41d4-a716-446655440000'
                    }
                ],
                duration: 5,
                n: 1,
                resolution: '720p',
                aspect_ratio: '16:9',
                output_with_audio: true
            }
        },
        first_last_frame_image_to_video: {
            summary: 'Animate first and last frames',
            value: {
                model: 'bytedance/seedance-2.0-fast',
                prompt: 'Move naturally from the opening frame to the closing frame',
                frame_images: [
                    {
                        type: 'image',
                        frame_type: 'first_frame',
                        file_id: '550e8400-e29b-41d4-a716-446655440000'
                    },
                    {
                        type: 'image',
                        frame_type: 'last_frame',
                        file_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
                    }
                ],
                duration: 5,
                n: 1,
                resolution: '720p',
                aspect_ratio: '16:9',
                output_with_audio: true
            }
        },
        reference_to_video: {
            summary: 'Generate from reference assets',
            value: {
                model: 'google/veo-3.1',
                prompt: 'Create a cohesive cinematic sequence using the supplied references',
                input_references: [
                    { type: 'image', file_id: '550e8400-e29b-41d4-a716-446655440000' },
                    { type: 'video', file_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
                    { type: 'audio', file_id: '7d1fa4bb-41e6-4a5d-88d8-1851f5342e87' }
                ],
                duration: 8,
                n: 1,
                resolution: '720p',
                aspect_ratio: '16:9',
                output_with_audio: true
            }
        }
    };
    videoOperation.responses['202'].content['application/json'].example = {
        id: 'normal-video-c50fe63e-699d-4d61-93f5-2099ab159d6d',
        status: 'queued',
        created_at: 1784044800,
        mode: 'text_to_video',
        model: 'xai/grok-imagine',
        data: [
            {
                uuid: '7d1fa4bb-41e6-4a5d-88d8-1851f5342e87',
                status: 'queued',
                created_at: 1784044800
            }
        ],
        usage: { credits: 90 }
    };

    components.schemas.CreateManagedFileRequest = {
        type: 'object',
        required: ['file'],
        additionalProperties: false,
        properties: {
            file: {
                type: 'string',
                format: 'binary',
                description: schemaFieldDescriptions.CreateManagedFileRequest.file[0]
            }
        }
    };
    components.schemas.ManagedFile = {
        type: 'object',
        required: ['id', 'filename', 'bytes', 'mime_type', 'created_at'],
        additionalProperties: false,
        properties: {
            id: {
                type: 'string',
                pattern: fileIdPattern,
                example: '550e8400-e29b-41d4-a716-446655440000',
                description: 'File ID used by generation requests.'
            },
            filename: {
                type: 'string',
                example: 'first-frame.png',
                description: 'Original name of the uploaded file.'
            },
            bytes: {
                type: 'integer',
                format: 'int64',
                minimum: 0,
                example: 245760,
                description: 'Uploaded file size in bytes.'
            },
            mime_type: {
                type: 'string',
                example: 'image/png',
                description: 'Media type detected for the uploaded file.'
            },
            created_at: {
                type: 'integer',
                format: 'int64',
                description: 'Unix timestamp in seconds when the file was created.'
            }
        }
    };
    fileOperation.tags = ['Files'];
    fileOperation.summary = 'Upload a file';
    fileOperation.description = 'Uploads one local image, video, or audio file and returns a reusable file ID.';
    fileOperation.operationId = 'uploadFile';
    fileOperation.requestBody = {
        required: true,
        content: {
            'multipart/form-data': {
                schema: { $ref: '#/components/schemas/CreateManagedFileRequest' }
            }
        }
    };
    const fileErrorResponses = Object.fromEntries(
        Object.entries(fileOperation.responses || {}).filter(([status]) => status !== '201')
    );
    fileOperation.responses = {
        '201': {
            description: 'File uploaded',
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/ManagedFile' },
                    example: {
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        filename: 'first-frame.png',
                        bytes: 245760,
                        mime_type: 'image/png',
                        created_at: 1784044800
                    }
                }
            }
        },
        ...fileErrorResponses
    };

    const taskListSchema = components.schemas.TaskList;
    taskListSchema.properties.status = {
        allOf: [{ $ref: '#/components/schemas/TaskStatus' }],
        description: 'Current status shared by the submitted video tasks.'
    };
    taskListSchema.properties.created_at = {
        type: 'integer',
        format: 'int64',
        description: 'Unix timestamp in seconds when the batch task was created.'
    };
    taskListSchema.properties.mode = {
        type: 'string',
        enum: publicVideoModes,
        description: 'Video generation mode shared by the submitted tasks.'
    };
    taskListSchema.properties.model = {
        type: 'string',
        enum: publicVideoModels,
        description: 'Video generation model used by the submitted tasks.'
    };
    taskListSchema.required = [
        'id',
        'status',
        'created_at',
        'mode',
        'model',
        ...(taskListSchema.required || []).filter(
            (field) => !['id', 'status', 'created_at', 'mode', 'model'].includes(field)
        )
    ];

    const taskSchema = components.schemas.Task;
    taskSchema.required = (taskSchema.required || []).filter(
        (field) => !['object', 'type', 'progress'].includes(field)
    );
    for (const field of ['object', 'type', 'progress']) {
        delete taskSchema.properties[field];
    }

    const taskReceiptSchema = components.schemas.TaskReceipt;
    taskReceiptSchema.required = (taskReceiptSchema.required || []).filter(
        (field) => !['object', 'type', 'progress'].includes(field)
    );
    for (const field of ['object', 'type', 'progress']) {
        delete taskReceiptSchema.properties[field];
    }
    delete taskReceiptSchema.properties.mode;
    delete taskReceiptSchema.properties.model;
    taskReceiptSchema.required = taskReceiptSchema.required.filter(
        (field) => !['mode', 'model'].includes(field)
    );

    components.responses.BadRequest = {
        description: 'Invalid request',
        headers: buildStandardResponseHeaders(),
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                    invalid_prompt: {
                        summary: 'Invalid prompt',
                        value: {
                            error: {
                                code: 'invalid_prompt',
                                message: 'prompt is required and must be a non-empty string'
                            }
                        }
                    },
                    unsupported_model: {
                        summary: 'Unsupported model',
                        value: {
                            error: {
                                code: 'unsupported_model',
                                message: 'Unsupported modelKey: missing-model'
                            }
                        }
                    },
                    model_unavailable: {
                        summary: 'Model unavailable',
                        value: {
                            error: {
                                code: 'model_unavailable',
                                message: 'Model is unavailable: veo-3.1'
                            }
                        }
                    }
                }
            }
        }
    };
    components.responses.Forbidden = {
        description: 'The authenticated user cannot access this resource or has insufficient credits',
        headers: buildStandardResponseHeaders(),
        content: {
            'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                    error: {
                        code: 'insufficient_credits',
                        message: 'Insufficient credits for video generation'
                    }
                }
            }
        }
    };

    taskSchema.properties.model = {
        type: 'string',
        enum: publicVideoModels,
        nullable: true,
        description: 'Video generation model used by the task.'
    };
    taskSchema.properties.mode = {
        type: 'string',
        enum: publicVideoModes,
        description: 'Video generation mode used by the task.'
    };
    taskSchema.required = ['mode', ...(taskSchema.required || []).filter((field) => field !== 'mode')];
    components.schemas.TaskList.required = (components.schemas.TaskList.required || []).filter(
        (field) => field !== 'object'
    );
    components.schemas.TaskList.required = components.schemas.TaskList.required.filter(
        (field) => field !== 'type'
    );
    delete components.schemas.TaskList.properties.type;
    delete components.schemas.TaskList.properties.object;

    components.schemas.ApiError.required = (components.schemas.ApiError.required || []).filter(
        (field) => !['type', 'request_id', 'param'].includes(field)
    );
    delete components.schemas.ApiError.properties.type;
    delete components.schemas.ApiError.properties.request_id;
    delete components.schemas.ApiError.properties.param;

    function removeErrorTraceFields(value) {
        if (!value || typeof value !== 'object') {
            return;
        }
        if (value.error && typeof value.error === 'object' && !Array.isArray(value.error)) {
            delete value.error.type;
            delete value.error.request_id;
            delete value.error.param;
        }
        Object.values(value).forEach(removeErrorTraceFields);
    }
    removeErrorTraceFields(paths);
    removeErrorTraceFields(components);

    components.schemas.Task.properties.output = {
        $ref: '#/components/schemas/VideoTaskOutput',
        description: schemaFieldDescriptions.Task.output[0]
    };
    components.schemas.Task.required = [
        ...(components.schemas.Task.required || []).filter((field) => field !== 'output'),
        'output'
    ];
    renameSchemaProperty(
        components.schemas.VideoFile,
        'duration_seconds',
        'duration',
        'Generated video duration in seconds when available.'
    );
    const videoFileSchema = components.schemas.VideoFile;
    videoFileSchema.properties.url.nullable = true;
    videoFileSchema.properties.aspect_ratio = {
        type: 'string',
        nullable: true,
        example: '16:9',
        description: 'Generated video aspect ratio when available, such as 16:9.'
    };
    videoFileSchema.properties.has_audio = {
        type: 'boolean',
        description: 'Whether native audio generation was enabled for this video.'
    };
    videoFileSchema.properties.mode = {
        type: 'string',
        enum: publicVideoModes,
        description: 'Generation mode used for this video.'
    };
    videoFileSchema.properties.status = {
        allOf: [{ $ref: '#/components/schemas/TaskStatus' }],
        description: 'Current status of this generated video.'
    };
    videoFileSchema.properties.created_at = {
        type: 'integer',
        format: 'int64',
        description: 'Unix timestamp in seconds when this generated video was created.'
    };
    videoFileSchema.properties.updated_at = {
        type: 'integer',
        format: 'int64',
        description: 'Unix timestamp in seconds when this generated video was last updated.'
    };
    videoFileSchema.required = [
        'uuid',
        'url',
        'format',
        'duration',
        'resolution',
        'aspect_ratio',
        'has_audio',
        'mode',
        'status',
        'created_at',
        'updated_at',
        ...(videoFileSchema.required || []).filter(
            (field) => ![
                'uuid',
                'url',
                'format',
                'duration',
                'resolution',
                'aspect_ratio',
                'has_audio',
                'mode',
                'status',
                'created_at',
                'updated_at'
            ].includes(field)
        )
    ];
    components.schemas.VideoTaskOutput.properties.videos.description =
        schemaFieldDescriptions.VideoTaskOutput.videos[0];
    delete components.schemas.Task.properties.result;
    taskOperation.description = 'Returns task status and output by batch task ID or child video UUID. Provide exactly one of the id or uuid query parameters.';
    taskOperation.parameters = [
        {
            name: 'id',
            in: 'query',
            required: false,
            description: 'Batch task ID returned by a generation request. Provide this or uuid, but not both.',
            schema: {
                type: 'string',
                example: 'normal-video-c50fe63e-699d-4d61-93f5-2099ab159d6d'
            }
        },
        {
            name: 'uuid',
            in: 'query',
            required: false,
            description: 'Child video UUID returned in the generation response. Provide this or id, but not both.',
            schema: {
                type: 'string',
                format: 'uuid',
                example: '7d1fa4bb-41e6-4a5d-88d8-1851f5342e87'
            }
        }
    ];
    taskOperation.responses['200'].content['application/json'].example = {
        id: 'normal-video-c50fe63e-699d-4d61-93f5-2099ab159d6d',
        status: 'succeeded',
        mode: 'first_frame_image_to_video',
        model: 'bytedance/seedance-2.0-fast',
        created_at: 1784044800,
        updated_at: 1784044842,
        usage: { credits: 26 },
        output: {
            videos: [
                {
                    uuid: '7d1fa4bb-41e6-4a5d-88d8-1851f5342e87',
                    url: 'https://cdn.neural4d.com/results/video.mp4',
                    format: 'mp4',
                    duration: 5,
                    resolution: '720p',
                    aspect_ratio: '16:9',
                    has_audio: true,
                    mode: 'first_frame_image_to_video',
                    status: 'succeeded',
                    created_at: 1784044800,
                    updated_at: 1784044842
                }
            ]
        }
    };

    const publicPaths = {
        [filePath]: { post: fileOperation },
        [videoPath]: paths[videoPath],
        [taskPath]: paths[taskPath]
    };

    return {
        paths: publicPaths,
        components: collectReferencedComponents(publicPaths, components)
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
    components.securitySchemes.bearerAuth = {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API key',
        description: 'Neural4D API key using the Bearer scheme.',
        'x-default': '${YOUR_API_KEY}'
    };
    const alreadyUsesProductContract = Boolean(
        (paths['/openapi/v1/credits'] || paths['/openapi/v1/balance'])
        && paths['/openapi/v1/files']
        && paths['/openapi/v1/3dmodels/{id}/convert']
    );
    if (!alreadyUsesProductContract) {
        applyV1ContractAdjustments(paths, components);
    }
    applyV1ProductDecisions(paths, components);
    applyTaskIdentityContract(paths, components);
    const publicSpec = exposeVideoOnlyV1(paths, components);

    return {
        openapi: source.openapi,
        info: {
            title: 'Neural4D API',
            description: 'API v1 uploads reusable input files, creates videos asynchronously, and retrieves task status and results.',
            version: '1.0.0'
        },
        servers: [
            {
                url: 'https://api.neural4d.com',
                description: 'Production server'
            }
        ],
        security: [{ bearerAuth: [] }],
        tags: v1Tags
            .filter(({ name }) => ['Video generation', 'Tasks', 'Files'].includes(name))
            .map(({ name, description }) => ({ name, description })),
        paths: publicSpec.paths,
        components: publicSpec.components
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
            continue;
        }

        for (const [fieldName, descriptions] of Object.entries(fields)) {
            const field = schema.properties && schema.properties[fieldName];
            if (!field) {
                continue;
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

if (!fs.existsSync(fullV1BackupPath)) {
    throw new Error(`Full v1 backup not found: ${fullV1BackupPath}`);
}

function preserveEnglishExampleValues(englishValue, localizedValue) {
    if (!englishValue || !localizedValue || typeof englishValue !== 'object' || typeof localizedValue !== 'object') {
        return;
    }
    for (const [key, englishChild] of Object.entries(englishValue)) {
        if (!(key in localizedValue)) {
            continue;
        }
        if (key === 'example' || key === 'value') {
            localizedValue[key] = JSON.parse(JSON.stringify(englishChild));
            continue;
        }
        preserveEnglishExampleValues(englishChild, localizedValue[key]);
    }
}

function applyVideoModelFieldDescriptions(spec, languageIndex) {
    const schema = spec.components.schemas.VideoGenerationJsonRequest;
    if (!schema) {
        return;
    }

    for (const [fieldName, descriptions] of Object.entries(videoModelFieldDescriptions)) {
        if (schema.properties?.[fieldName]) {
            schema.properties[fieldName].description = descriptions[languageIndex];
        }
    }
    for (const branch of schema.allOf?.[0]?.oneOf || []) {
        const properties = branch.$ref
            ? spec.components.schemas[branch.$ref.split('/').pop()]?.properties
            : branch.properties;
        for (const fieldName of ['model', 'resolution', 'aspect_ratio', 'duration']) {
            if (properties?.[fieldName]) {
                properties[fieldName].description = videoModelFieldDescriptions[fieldName][languageIndex];
            }
        }
        const model = properties?.model?.enum?.[0];
        if (properties?.output_with_audio && videoModelOutputWithAudioDescriptions[model]) {
            properties.output_with_audio.description = videoModelOutputWithAudioDescriptions[model][languageIndex];
        }
    }
}

const v1English = buildV1Spec(readJson(fullV1BackupPath));
applyFieldDescriptions(v1English, 0);
applyVideoModelFieldDescriptions(v1English, 0);
const v1Chinese = localize(v1English);
applyFieldDescriptions(v1Chinese, 1);
applyVideoModelFieldDescriptions(v1Chinese, 1);
preserveEnglishMessageValues(v1English, v1Chinese);
preserveEnglishExampleValues(v1English, v1Chinese);

assertAllFieldsDocumented(v1English);
assertAllFieldsDocumented(v1Chinese);
assertChineseHumanText(v1Chinese);
writeJson(currentEnglishPath, v1English);
writeJson(currentChinesePath, v1Chinese);

console.log(`Generated ${Object.keys(v1English.paths).length} v1 paths in English and Chinese.`);
