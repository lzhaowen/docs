'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(rootDir, file), 'utf8'));
const readText = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

const english = readJson('openapi.json');
const chinese = readJson('openapi.zh.json');
const docsConfig = readJson('docs.json');
const fullBackup = readJson('backups/v1-full-20260721/openapi.json');
const publicPaths = [
    '/openapi/v1/files',
    '/openapi/v1/videos/generations',
    '/openapi/v1/tasks/task-info'
];
const publicVideoModelCapabilities = {
    'bytedance/seedance-2.0': {
        resolutions: ['480p', '720p', '1080p', '4K'],
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        defaults: { resolution: '720p', aspectRatio: '16:9', duration: 5 }
    },
    'bytedance/seedance-2.0-fast': {
        resolutions: ['480p', '720p'],
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        defaults: { resolution: '720p', aspectRatio: '16:9', duration: 5 }
    },
    'google/veo-3.1': {
        resolutions: ['720p', '1080p', '4K'],
        aspectRatios: ['16:9', '9:16'],
        durations: [4, 5, 6, 7, 8],
        defaults: { resolution: '720p', aspectRatio: '16:9', duration: 8 }
    },
    'xai/grok-imagine': {
        resolutions: ['480p', '720p'],
        aspectRatios: ['1:1', '16:9', '9:16', '2:3', '3:2'],
        durations: [
            6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
            19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30
        ],
        defaults: { resolution: '720p', aspectRatio: '16:9', duration: 6 }
    }
};
const publicModels = Object.keys(publicVideoModelCapabilities);
const publicResolutions = ['480p', '720p', '1080p', '4K'];
const publicAspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2'];
const publicModes = [
    'text_to_video',
    'first_frame_image_to_video',
    'first_last_frame_image_to_video',
    'reference_to_video'
];
const fileIdPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function resolveRef(spec, ref) {
    return ref
        .slice(2)
        .split('/')
        .reduce((value, key) => value && value[key], spec);
}

function collectRefs(value, refs = []) {
    if (!value || typeof value !== 'object') {
        return refs;
    }
    if (typeof value.$ref === 'string') {
        refs.push(value.$ref);
    }
    Object.values(value).forEach((child) => collectRefs(child, refs));
    return refs;
}

function collectMessageValues(value, values = []) {
    if (!value || typeof value !== 'object') {
        return values;
    }
    for (const [key, child] of Object.entries(value)) {
        if (key === 'message' && typeof child === 'string') {
            values.push(child);
        }
        collectMessageValues(child, values);
    }
    return values;
}

function validateSpec(spec, label) {
    const paths = Object.keys(spec.paths);
    const schemas = spec.components.schemas;
    const fileOperation = spec.paths[publicPaths[0]].post;
    const videoOperation = spec.paths[publicPaths[1]].post;
    const taskOperation = spec.paths[publicPaths[2]].get;
    const videoRequest = schemas.VideoGenerationJsonRequest;

    assert(JSON.stringify(paths) === JSON.stringify(publicPaths), `${label}: public v1 path set mismatch`);
    assert(JSON.stringify(spec.tags.map((tag) => tag.name)) === JSON.stringify(
        label === 'en' ? ['Video generation', 'Tasks', 'Files'] : ['视频生成', '任务', '文件']
    ), `${label}: public tag set mismatch`);
    assert(spec.components.securitySchemes.bearerAuth.type === 'http', `${label}: bearer type mismatch`);
    assert(spec.components.securitySchemes.bearerAuth.scheme === 'bearer', `${label}: bearer scheme mismatch`);
    assert(spec.components.securitySchemes.bearerAuth['x-default'] === '${YOUR_API_KEY}', `${label}: API key placeholder mismatch`);
    assert(JSON.stringify(spec.security) === JSON.stringify([{ bearerAuth: [] }]), `${label}: root security requirement missing`);

    for (const pathItem of Object.values(spec.paths)) {
        for (const operation of Object.values(pathItem)) {
            if (!operation?.responses) continue;
            assert(!operation['x-codeSamples'], `${label}: x-codeSamples must not override Mintlify autogeneration`);
            assert(!operation.parameters?.some((parameter) =>
                parameter.$ref === '#/components/parameters/AuthorizationHeader'
                || String(parameter.name || '').toLowerCase() === 'authorization'
            ), `${label}: Authorization must come from the bearer security scheme`);
        }
    }

    assert(Object.keys(spec.paths[publicPaths[0]]).join(',') === 'post', `${label}: only file upload must be public`);
    assert(
        Object.keys(fileOperation.requestBody.content).join(',') === 'multipart/form-data',
        `${label}: file upload must accept multipart/form-data only`
    );
    assert(
        fileOperation.requestBody.content['multipart/form-data'].schema.$ref
            === '#/components/schemas/CreateManagedFileRequest',
        `${label}: file upload request schema mismatch`
    );
    assert(
        JSON.stringify(schemas.CreateManagedFileRequest.required) === JSON.stringify(['file']),
        `${label}: file upload required fields mismatch`
    );
    assert(
        Object.keys(schemas.CreateManagedFileRequest.properties).join(',') === 'file',
        `${label}: file upload must expose only the local file field`
    );
    assert(schemas.CreateManagedFileRequest.properties.file.format === 'binary', `${label}: file upload must use binary content`);
    assert(fileOperation.responses['201'], `${label}: file upload must return 201`);
    assert(
        fileOperation.responses['201'].content['application/json'].schema.$ref === '#/components/schemas/ManagedFile',
        `${label}: file upload response schema mismatch`
    );
    const managedFile = schemas.ManagedFile;
    assert(JSON.stringify(managedFile.required) === JSON.stringify([
        'id', 'filename', 'bytes', 'mime_type', 'created_at'
    ]), `${label}: uploaded file response fields mismatch`);
    assert(!managedFile.properties.object, `${label}: uploaded file response must not expose object`);
    assert(!managedFile.properties.fileKey, `${label}: uploaded file response must not expose fileKey`);
    assert(!managedFile.properties.purpose, `${label}: uploaded file response must not expose purpose`);
    assert(!managedFile.properties.status, `${label}: synchronous file upload must not expose status`);
    assert(!managedFile.properties.updated_at, `${label}: upload response must contain creation metadata only`);
    assert(managedFile.properties.id.pattern === fileIdPattern, `${label}: uploaded file ID format mismatch`);
    const fileExample = fileOperation.responses['201'].content['application/json'].example;
    assert(new RegExp(fileIdPattern).test(fileExample.id), `${label}: uploaded file example ID mismatch`);
    assert(
        !fileExample.object && !fileExample.fileKey && !fileExample.purpose
        && !fileExample.status && !fileExample.updated_at,
        `${label}: unnecessary file fields leaked into example`
    );

    assert(
        Object.keys(videoOperation.requestBody.content).join(',') === 'application/json',
        `${label}: video creation must accept JSON only`
    );
    assert(videoOperation.responses['202'], `${label}: video creation must return 202`);
    assert(
        videoOperation.responses['202'].content['application/json'].schema.$ref === '#/components/schemas/TaskList',
        `${label}: video creation must return TaskList`
    );
    assert(JSON.stringify(videoRequest.required) === JSON.stringify(['model', 'prompt']), `${label}: video required fields mismatch`);
    assert(!videoRequest.properties.type, `${label}: request type must not be public`);
    assert(!videoRequest.properties.mode, `${label}: request mode must be inferred from its inputs`);
    assert(!videoRequest.anyOf, `${label}: runtime input rules must not split the Mintlify request body into alternatives`);
    assert(
        videoOperation.description.includes(label === 'en' ? 'required prompt' : '必填提示词'),
        `${label}: required prompt must be documented`
    );
    assert(videoRequest.properties.prompt.minLength === 1, `${label}: prompt must be non-empty`);
    assert(JSON.stringify(videoRequest.properties.model.enum) === JSON.stringify(publicModels), `${label}: video model enum mismatch`);
    assert(videoRequest.properties.duration.minimum === 1, `${label}: minimum duration mismatch`);
    assert(!videoRequest.properties.duration.maximum, `${label}: duration maximum must be model-specific`);
    assert(!('default' in videoRequest.properties.duration), `${label}: duration has model-specific defaults`);
    assert(!videoRequest.properties.duration.enum, `${label}: duration enum must be model-specific`);
    assert(!videoRequest.properties.duration_seconds, `${label}: request duration_seconds must not be public`);
    assert(!videoRequest.properties.size, `${label}: video size must not be public`);
    assert(!videoRequest.not, `${label}: stale resolution/size constraint must not be public`);
    assert(videoRequest.properties.n.minimum === 1 && videoRequest.properties.n.maximum === 4, `${label}: task count range mismatch`);
    assert(
        JSON.stringify(videoRequest.properties.resolution.enum) === JSON.stringify(publicResolutions),
        `${label}: resolution enum mismatch`
    );
    assert(JSON.stringify(videoRequest.properties.aspect_ratio.enum) === JSON.stringify(publicAspectRatios), `${label}: aspect ratio enum mismatch`);
    const modelBranches = videoRequest.allOf?.[0]?.oneOf;
    assert(modelBranches?.length === publicModels.length, `${label}: model capability branches mismatch`);
    for (const branch of modelBranches) {
        const branchSchema = branch.$ref ? resolveRef(spec, branch.$ref) : branch;
        const model = branchSchema.properties.model.enum[0];
        const capability = publicVideoModelCapabilities[model];
        assert(capability, `${label}: unknown model capability branch ${model}`);
        assert(JSON.stringify(branchSchema.properties.resolution.enum) === JSON.stringify(capability.resolutions), `${label}: ${model} resolution mismatch`);
        assert(JSON.stringify(branchSchema.properties.aspect_ratio.enum) === JSON.stringify(capability.aspectRatios), `${label}: ${model} aspect ratio mismatch`);
        assert(JSON.stringify(branchSchema.properties.duration.enum) === JSON.stringify(capability.durations), `${label}: ${model} duration mismatch`);
        assert(branchSchema.properties.resolution.default === capability.defaults.resolution, `${label}: ${model} resolution default mismatch`);
        assert(branchSchema.properties.aspect_ratio.default === capability.defaults.aspectRatio, `${label}: ${model} aspect ratio default mismatch`);
        assert(branchSchema.properties.duration.default === capability.defaults.duration, `${label}: ${model} duration default mismatch`);
    }
    assert(!videoRequest.properties.extra_body, `${label}: extra_body must not be public`);

    assert(!videoRequest.properties.images, `${label}: video inputs must not use a top-level images field`);
    assert(!videoRequest.properties.asset_refs, `${label}: internal asset_refs must not be public`);
    const frameImages = videoRequest.properties.frame_images;
    assert(frameImages.type === 'array', `${label}: frame_images must be an array`);
    assert(frameImages.minItems === 1 && frameImages.maxItems === 2, `${label}: frame image count mismatch`);
    assert(frameImages.items.$ref === '#/components/schemas/VideoFrameImage', `${label}: frame image schema mismatch`);
    assert(JSON.stringify(schemas.VideoFrameImage.required) === JSON.stringify(['type', 'frame_type', 'file_id']), `${label}: frame image required fields mismatch`);
    assert(JSON.stringify(schemas.VideoFrameImage.properties.type.enum) === JSON.stringify(['image']), `${label}: frame image media type mismatch`);
    assert(JSON.stringify(schemas.VideoFrameImage.properties.frame_type.enum) === JSON.stringify([
        'first_frame', 'last_frame'
    ]), `${label}: frame type enum mismatch`);
    const inputReferences = videoRequest.properties.input_references;
    assert(inputReferences.type === 'array', `${label}: input_references must be an array`);
    assert(inputReferences.minItems === 1 && inputReferences.maxItems === 12, `${label}: input reference count mismatch`);
    assert(inputReferences.items.$ref === '#/components/schemas/VideoInputReference', `${label}: input reference schema mismatch`);
    assert(JSON.stringify(schemas.VideoInputReference.oneOf.map((item) => item.$ref)) === JSON.stringify([
        '#/components/schemas/VideoImageReference',
        '#/components/schemas/VideoVideoReference',
        '#/components/schemas/VideoAudioReference'
    ]), `${label}: input reference alternatives mismatch`);
    assert(schemas.VideoInputReference.discriminator.propertyName === 'type', `${label}: input reference discriminator mismatch`);
    for (const [schemaName, mediaType] of [
        ['VideoImageReference', 'image'],
        ['VideoVideoReference', 'video'],
        ['VideoAudioReference', 'audio']
    ]) {
        const reference = schemas[schemaName];
        assert(JSON.stringify(reference.required) === JSON.stringify(['type', 'file_id']), `${label}: ${schemaName} required fields mismatch`);
        assert(JSON.stringify(reference.properties.type.enum) === JSON.stringify([mediaType]), `${label}: ${schemaName} media type mismatch`);
        assert(reference.properties.file_id.pattern === fileIdPattern, `${label}: ${schemaName} file_id format mismatch`);
        assert(!reference.properties.url && !reference.oneOf, `${label}: ${schemaName} must accept file_id only`);
    }
    assert(schemas.VideoFrameImage.properties.file_id.pattern === fileIdPattern, `${label}: frame file_id format mismatch`);
    assert(!schemas.VideoFrameImage.properties.url && !schemas.VideoFrameImage.oneOf, `${label}: frame images must accept file_id only`);
    assert(!schemas.FileReferenceKey, `${label}: fileKey schema must not be public`);
    assert(!schemas.VideoAssetReferences, `${label}: internal grouped asset schema must not be public`);

    const examples = videoOperation.requestBody.content['application/json'].examples;
    assert(JSON.stringify(Object.keys(examples)) === JSON.stringify(publicModes), `${label}: video mode examples mismatch`);
    const exampleModels = Object.values(examples).map((example) => example.value.model);
    assert(publicModels.every((model) => exampleModels.includes(model)), `${label}: both video models must appear in examples`);
    assert(Object.values(examples).every((example) => !example.value.mode), `${label}: request examples must not expose mode`);
    assert(!examples.text_to_video.value.input_references, `${label}: text-to-video must not include input references`);
    assert(!examples.text_to_video.value.frame_images, `${label}: text-to-video must not include frame images`);
    assert(
        examples.first_frame_image_to_video.value.frame_images.length === 1,
        `${label}: first-frame mode must include one image`
    );
    assert(
        examples.first_last_frame_image_to_video.value.frame_images.length === 2,
        `${label}: first/last-frame mode must include two typed images`
    );
    assert(
        examples.first_frame_image_to_video.value.frame_images[0].file_id === fileExample.id
        && examples.first_frame_image_to_video.value.frame_images[0].frame_type === 'first_frame',
        `${label}: uploaded file and first-frame examples must use the same file ID`
    );
    assert(
        examples.first_last_frame_image_to_video.value.frame_images.map((frame) => frame.frame_type).join(',')
            === 'first_frame,last_frame',
        `${label}: first/last-frame roles must be explicit`
    );
    const referenceAssets = examples.reference_to_video.value.input_references;
    assert(
        referenceAssets.every((reference) => reference.file_id && !reference.url),
        `${label}: reference mode examples must use file IDs only`
    );
    assert(JSON.stringify(referenceAssets.map((reference) => reference.type)) === JSON.stringify([
        'image', 'video', 'audio'
    ]), `${label}: typed multimodal reference example mismatch`);
    assert(!examples.pixel_size, `${label}: pixel size example must not be public`);
    assert(JSON.stringify([...new Set(Object.values(examples).map((example) => example.value.model))].sort())
        === JSON.stringify([...publicModels].sort()), `${label}: request examples must cover every public model`);
    for (const example of Object.values(examples)) {
        const capability = publicVideoModelCapabilities[example.value.model];
        assert(capability.durations.includes(example.value.duration), `${label}: duration example mismatch`);
        assert(capability.resolutions.includes(example.value.resolution), `${label}: resolution example mismatch`);
        assert(capability.aspectRatios.includes(example.value.aspect_ratio), `${label}: aspect ratio example mismatch`);
    }

    const generationExample = videoOperation.responses['202'].content['application/json'].example;
    assert(schemas.TaskList.required.includes('id'), `${label}: generation response must require batch task id`);
    assert(!schemas.TaskList.properties.id.format, `${label}: batch task id must not be declared as a raw UUID`);
    assert(generationExample.id.startsWith('normal-video-'), `${label}: generation example batch task id mismatch`);
    assert(generationExample.status === 'queued', `${label}: generation batch status must be top-level`);
    assert(generationExample.created_at, `${label}: generation batch created_at must be top-level`);
    assert(publicModes.includes(generationExample.mode), `${label}: generation batch mode must be top-level`);
    assert(publicModels.includes(generationExample.model), `${label}: generation batch model must be top-level`);
    assert(
        generationExample.mode === 'text_to_video'
        && generationExample.model === examples.text_to_video.value.model,
        `${label}: default request and generation response examples must match`
    );
    assert(schemas.TaskReceipt.required.includes('uuid'), `${label}: task receipt must require child uuid`);
    assert(!schemas.TaskReceipt.properties.id, `${label}: task receipt must not expose id`);
    assert(generationExample.data.every((item) => item.uuid && !item.id), `${label}: generation child uuid mismatch`);
    assert(!schemas.TaskList.properties.type && !schemas.TaskList.required?.includes('type'), `${label}: generation response type must not be public`);
    assert(!generationExample.type, `${label}: generation response batch must not expose type`);
    assert(!schemas.TaskReceipt.properties.mode && !schemas.TaskReceipt.properties.model, `${label}: generation child must not expose mode or model`);
    assert(generationExample.data.every((item) => !item.mode && !item.model && !item.type), `${label}: generation child must not expose mode or model`);
    assert(schemas.TaskList.required.includes('status') && schemas.TaskList.required.includes('created_at'), `${label}: generation batch status/time fields must be required`);
    assert(schemas.TaskList.required.includes('mode') && schemas.TaskList.required.includes('model'), `${label}: generation batch mode/model fields must be required`);
    assert(JSON.stringify(schemas.TaskList.properties.mode.enum) === JSON.stringify(publicModes), `${label}: generation batch mode enum mismatch`);
    assert(JSON.stringify(schemas.TaskList.properties.model.enum) === JSON.stringify(publicModels), `${label}: generation batch model enum mismatch`);

    assert(!schemas.TaskReceipt.properties.output, `${label}: task receipt must not expose output`);
    assert(!schemas.TaskReceipt.properties.result, `${label}: task receipt must not expose result`);
    assert(!schemas.Task.properties.result, `${label}: task response must not expose result`);
    assert(schemas.Task.properties.output.$ref === '#/components/schemas/VideoTaskOutput', `${label}: task output must be video-only`);
    assert(schemas.Task.properties.id && !schemas.Task.properties.id.format, `${label}: task id must represent batchUUID`);
    assert(schemas.VideoFile.required.includes('uuid'), `${label}: video output must require child uuid`);
    assert(schemas.VideoFile.properties.url?.nullable === true, `${label}: video output URL must be nullable while pending`);
    assert(
        ['url', 'format', 'duration', 'resolution', 'aspect_ratio', 'mode', 'status', 'created_at', 'updated_at']
            .every((field) => schemas.VideoFile.required.includes(field)),
        `${label}: video output fields must be required`
    );
    assert(schemas.VideoFile.properties.duration && !schemas.VideoFile.properties.duration_seconds, `${label}: video output duration field mismatch`);
    assert(schemas.VideoFile.properties.aspect_ratio?.nullable === true, `${label}: video output aspect_ratio must be nullable`);
    assert(JSON.stringify(schemas.VideoFile.properties.mode?.enum) === JSON.stringify(publicModes), `${label}: video output mode enum mismatch`);
    assert(
        schemas.VideoTaskOutput.properties.videos.description.includes(
            label === 'en' ? 'All child video tasks' : '所有子视频任务'
        ),
        `${label}: video output must document pending child tasks`
    );
    assert(taskOperation.responses['200'].content['application/json'].schema.$ref === '#/components/schemas/Task', `${label}: task response schema mismatch`);
    assert(taskOperation.parameters.length === 2, `${label}: taskinfo must expose id and uuid query parameters`);
    assert(taskOperation.parameters.every((parameter) => parameter.in === 'query' && parameter.required === false), `${label}: taskinfo query parameters must be optional alternatives`);
    assert(taskOperation.parameters.map((parameter) => parameter.name).join(',') === 'id,uuid', `${label}: taskinfo query parameter order mismatch`);
    assert(taskOperation.parameters[1].schema.format === 'uuid', `${label}: taskinfo uuid query parameter format mismatch`);
    assert(taskOperation.description.includes('id') && taskOperation.description.includes('uuid'), `${label}: taskinfo id/uuid exclusivity must be documented`);
    const taskExample = taskOperation.responses['200'].content['application/json'].example;
    assert(taskExample.id.startsWith('normal-video-'), `${label}: taskinfo batch task id mismatch`);
    assert(!taskExample.type && publicModes.includes(taskExample.mode), `${label}: taskinfo mode must be top-level`);
    assert(taskExample.output.videos.length === 1, `${label}: completed video output example missing`);
    assert(taskExample.output.videos[0].uuid, `${label}: completed video child uuid missing`);
    assert(taskExample.output.videos[0].duration === 5 && !taskExample.output.videos[0].duration_seconds, `${label}: completed video duration mismatch`);
    assert(taskExample.output.videos[0].aspect_ratio === '16:9', `${label}: completed video aspect ratio missing`);
    assert(taskExample.output.videos[0].mode === taskExample.mode, `${label}: completed video mode mismatch`);
    assert(taskExample.output.videos[0].status === 'succeeded', `${label}: completed video status missing`);
    assert(taskExample.output.videos[0].created_at && taskExample.output.videos[0].updated_at, `${label}: completed video timestamps missing`);
    assert(!taskExample.result, `${label}: taskinfo result must not be public`);

    for (const schemaName of ['Task', 'TaskReceipt']) {
        for (const field of ['object', 'type', 'progress']) {
            assert(!schemas[schemaName].properties[field], `${label}: ${schemaName}.${field} must not be public`);
            assert(!schemas[schemaName].required?.includes(field), `${label}: ${schemaName}.${field} must not be required`);
        }
    }
    assert(schemas.Task.properties.mode && schemas.Task.required.includes('mode'), `${label}: taskinfo mode must be top-level and required`);
    assert(!schemas.TaskList.properties.object, `${label}: TaskList.object must not be public`);
    assert(!schemas.TaskList.required?.includes('object'), `${label}: TaskList.object must not be required`);
    assert(!schemas.ApiError.properties.type && !schemas.ApiError.required?.includes('type'), `${label}: ApiError.type must not be public`);
    assert(!schemas.ApiError.properties.request_id && !schemas.ApiError.properties.param, `${label}: removed error fields must not be public`);
    assert(!schemas.ApiError.required?.includes('request_id') && !schemas.ApiError.required?.includes('param'), `${label}: removed error fields must not be required`);

    const serialized = JSON.stringify(spec);
    assert(!serialized.includes('"request_id"') && !serialized.includes('"param"'), `${label}: removed error response fields leaked into the spec`);
    assert(!serialized.includes('"fileKey"') && !serialized.includes('"purpose"'), `${label}: internal file fields leaked into the spec`);
    assert(!serialized.includes('"asset_refs"'), `${label}: internal asset_refs leaked into the spec`);
    assert(!serialized.includes('GET /openapi/v1/models'), `${label}: hidden model endpoint leaked into field descriptions`);
    for (const hiddenSchema of ['ImageTaskOutput', 'ModelTaskOutput', 'FileConversionTaskOutput']) {
        assert(!schemas[hiddenSchema], `${label}: hidden schema leaked: ${hiddenSchema}`);
    }
    for (const ref of collectRefs(spec)) {
        assert(resolveRef(spec, ref), `${label}: unresolved reference ${ref}`);
    }
}

function validateNavigation() {
    const languages = docsConfig.navigation.languages;
    for (const language of languages) {
        const v1 = language.versions.find((version) => version.version === 'v1');
        const old = language.versions.find((version) => version.version === 'old');
        const prefix = language.language;
        assert(v1?.default === true, `${prefix}: v1 must be the default version`);
        assert(old, `${prefix}: old version missing`);
        assert(JSON.stringify(v1.groups[0].pages) === JSON.stringify([
            `${prefix}/v1-overview`,
            `${prefix}/common-headers`
        ]), `${prefix}: quickstart pages mismatch`);
        assert(v1.groups[1].openapi.source === (prefix === 'en' ? 'openapi.json' : 'openapi.zh.json'), `${prefix}: OpenAPI source mismatch`);
    }
    assert(docsConfig.api.playground.display === 'simple', 'Mintlify must show the copyable endpoint URL without the interactive playground');
    assert(docsConfig.api.examples.autogenerate === true, 'Mintlify code sample autogeneration must remain enabled');
    assert(docsConfig.api.examples.languages.length >= 4, 'Mintlify must expose multiple code sample languages');
}

function validatePages() {
    for (const locale of ['en', 'zh']) {
        const quickstart = readText(`${locale}/v1-overview.mdx`);
        const entryQuickstart = readText(`${locale}/index.mdx`);
        const headers = readText(`${locale}/common-headers.mdx`);
        assert(quickstart.includes('/openapi/v1/files'), `${locale}: file upload quickstart request missing`);
        assert(quickstart.includes('/videos/generations'), `${locale}: video quickstart request missing`);
        assert(quickstart.includes('/tasks/task-info?id='), `${locale}: task-info polling example missing`);
        assert(quickstart.includes('/tasks/task-info?uuid='), `${locale}: task-info uuid query example missing`);
        assert(quickstart.includes('bytedance/seedance-2.0-fast'), `${locale}: namespaced fast model example missing`);
        assert(quickstart.includes('"duration"'), `${locale}: duration example missing`);
        assert(!quickstart.includes('duration_seconds'), `${locale}: duration_seconds must not appear`);
        assert(!/"(?:object|progress)"\s*:/.test(quickstart), `${locale}: removed response field leaked into quickstart`);
        assert((quickstart.match(/"mode"\s*:/g) || []).length >= 2, `${locale}: response mode examples missing`);
        assert(!quickstart.includes('mode: "first_frame_image_to_video"'), `${locale}: request mode must not appear in Node.js example`);
        assert(quickstart.includes('frame_images'), `${locale}: frame_images example missing`);
        assert(quickstart.includes('frame_type'), `${locale}: frame_type example missing`);
        assert(quickstart.includes('type: "image"'), `${locale}: Node.js frame media type missing`);
        assert(quickstart.includes('file_id'), `${locale}: uploaded file ID example missing`);
        assert(!quickstart.includes('asset_refs'), `${locale}: internal asset_refs must not appear`);
        assert(quickstart.includes('"output"'), `${locale}: task output example missing`);
        assert(quickstart.includes('"aspect_ratio": "16:9"'), `${locale}: video output aspect ratio missing`);
        assert((quickstart.match(/"mode"\s*:/g) || []).length >= 3, `${locale}: child video mode example missing`);
        assert((quickstart.match(/"uuid"\s*:/g) || []).length >= 2, `${locale}: child uuid examples missing`);
        assert(!quickstart.includes('"result"'), `${locale}: stale task result example found`);
        assert(!quickstart.includes('fileKey'), `${locale}: fileKey must not appear in the quickstart`);
        assert(!/\/models|\/images\/|\/3dmodels/.test(quickstart), `${locale}: hidden API leaked into quickstart`);
        assert(entryQuickstart.includes('/openapi/v1/files'), `${locale}: entry quickstart file upload step missing`);
        assert(entryQuickstart.includes('frame_images') && entryQuickstart.includes('input_references'), `${locale}: entry quickstart asset contract missing`);
        assert(entryQuickstart.includes('file_id'), `${locale}: entry quickstart file reference missing`);
        assert(!entryQuickstart.includes('HTTPS URL') && !entryQuickstart.includes('HTTPS `url`'), `${locale}: entry quickstart URL input must not be documented`);
        assert(entryQuickstart.includes('/tasks/task-info?id={id}'), `${locale}: entry quickstart task-info polling example missing`);
        assert(entryQuickstart.includes('output.videos'), `${locale}: entry quickstart output path missing`);
        assert(['uuid', 'aspect_ratio', 'mode'].every((field) => entryQuickstart.includes(field)), `${locale}: entry quickstart video fields missing`);
        assert(!entryQuickstart.includes('/tasks/{id}') && !entryQuickstart.includes('result.videos'), `${locale}: stale entry quickstart contract found`);
        assert(headers.includes('Authorization'), `${locale}: Authorization header missing`);
        assert(headers.includes('X-Request-Id'), `${locale}: X-Request-Id header missing`);
        assert(!/x-ratelimit|Retry-After|JWT|X-Client-Id/i.test(headers), `${locale}: unrelated common header found`);
    }

    const rootQuickstart = readText('index.mdx');
    assert(rootQuickstart.includes('/openapi/v1/files'), 'root: entry quickstart file upload step missing');
    assert(rootQuickstart.includes('frame_images') && rootQuickstart.includes('input_references'), 'root: asset contract missing');
    assert(rootQuickstart.includes('file_id'), 'root: file reference contract missing');
    assert(!rootQuickstart.includes('HTTPS URL') && !rootQuickstart.includes('HTTPS `url`'), 'root: URL input must not be documented');
    assert(rootQuickstart.includes('/tasks/task-info?id={id}'), 'root: entry quickstart task-info polling example missing');
    assert(
        rootQuickstart.includes('output.videos')
        && ['uuid', 'aspect_ratio', 'mode'].every((field) => rootQuickstart.includes(field)),
        'root: entry quickstart output contract missing'
    );
    assert(!rootQuickstart.includes('/tasks/{id}') && !rootQuickstart.includes('result.videos'), 'root: stale entry quickstart contract found');
}

assert(Object.keys(fullBackup.paths).length === 15, 'Full v1 backup must preserve all 15 paths');
assert(fullBackup.paths['/openapi/v1/images/generations'], 'Full v1 backup is incomplete');
assert(fullBackup.paths['/openapi/v1/3dmodels/generations'], 'Full v1 backup is incomplete');

validateSpec(english, 'en');
validateSpec(chinese, 'zh');
validateNavigation();
validatePages();

assert(JSON.stringify(Object.keys(english.paths)) === JSON.stringify(Object.keys(chinese.paths)), 'English and Chinese path sets differ');
assert(JSON.stringify(collectMessageValues(english)) === JSON.stringify(collectMessageValues(chinese)), 'Chinese response message values must remain English');

console.log('Validated file upload and video v1 documentation in English and Chinese.');
